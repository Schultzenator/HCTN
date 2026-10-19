// LLM brain (AGENT_MODE=openai | mistral, BYO key). Tool-calling loop over the same
// tool surface the scripted brain uses deterministically. Falls back gracefully:
// any API error is reported as an error event — the server still responds.

import { CATALOG, byId } from "../store/catalog.js";
import type { PayPalGateway } from "../paypal/client.js";
import type { Agent, AgentEvent, AgentRunResult, CartLine } from "./scripted.js";

interface ToolCall { id: string; name: string; args: Record<string, unknown>; }

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_catalog",
      description: "List all products in the demo merchant catalog with price, rating and stock.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "add_to_cart",
      description: "Add a product to the cart by its id. Never add the same product twice.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "Product id from the catalog, e.g. kb-01" },
        },
        required: ["product_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_order",
      description: "Create a PayPal sandbox order for the current cart and get the buyer approval link. Call this only once, after the cart is final.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "finish",
      description: "End the shopping run with a one-sentence summary for the user.",
      parameters: {
        type: "object",
        properties: { summary: { type: "string" } },
        required: ["summary"],
      },
    },
  },
];

export class LlmAgent implements Agent {
  constructor(
    private provider: "openai" | "mistral",
    private apiKey: string,
    private paypal: PayPalGateway,
  ) {}

  private endpoint(): string {
    return this.provider === "openai"
      ? "https://api.openai.com/v1/chat/completions"
      : "https://api.mistral.ai/v1/chat/completions";
  }

  private model(): string {
    return this.provider === "openai" ? "gpt-4o-mini" : "mistral-small-latest";
  }

  private async chat(messages: unknown[]): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const res = await fetch(this.endpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ model: this.model(), messages, tools: TOOLS, tool_choice: "auto" }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`LLM API ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return (await res.json()) as any;
    } finally {
      clearTimeout(timer);
    }
  }

  async run(goal: string): Promise<AgentRunResult> {
    const events: AgentEvent[] = [];
    const log = (kind: AgentEvent["kind"], message: string) =>
      events.push({ t: events.length, kind, message });

    const budgetMatch = goal.match(/(\d+(?:[.,]\d+)?)/);
    const budget = budgetMatch ? Number(budgetMatch[1].replace(",", ".")) : null;
    log("plan", `Goal parsed: "${goal}"${budget ? ` — budget: $${budget}` : " — no explicit budget"}. LLM brain: ${this.provider}.`);

    const cart: CartLine[] = [];
    const inCart = new Set<string>();
    let order: Awaited<ReturnType<PayPalGateway["createOrder"]>> | null = null;

    const catalogBrief = () =>
      CATALOG.map((p) => `${p.id} | ${p.name} | ${p.category} | $${p.price} | rating ${p.rating} | stock ${p.stock}`).join("\n");

    const execute = (call: ToolCall): string => {
      switch (call.name) {
        case "get_catalog":
          log("tool", "get_catalog()");
          return catalogBrief();
        case "add_to_cart": {
          const p = byId(String(call.args.product_id));
          if (!p) return "ERROR: unknown product_id";
          if (inCart.has(p.id)) return "ERROR: product already in cart";
          if (p.stock <= 0) return "ERROR: out of stock — pick an alternative";
          cart.push({ productId: p.id, name: p.name, quantity: 1, unitPrice: p.price });
          inCart.add(p.id);
          const total = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
          log("tool", `add_to_cart(${p.id}) → ${p.name} ($${p.price}); cart total $${total.toFixed(2)}.`);
          return `Added ${p.name}. Cart total: $${total.toFixed(2)}.`;
        }
        case "create_order": {
          if (cart.length === 0) return "ERROR: cart is empty";
          const total = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
          if (budget !== null && total > budget) return `ERROR: cart total $${total.toFixed(2)} exceeds budget $${budget}`;
          return ""; // placeholder, replaced below
        }
        case "finish":
          log("think", String(call.args.summary ?? "Done."));
          return "OK";
        default:
          return `ERROR: unknown tool ${call.name}`;
      }
    };

    const system = [
      "You are AgentCart, an autonomous shopping agent operating a PayPal SANDBOX demo store (no real money).",
      "Buyer goal in the user message. Rules: stay within the stated budget if given; pick good value (rating per dollar); never add the same product twice; prefer covering all requested needs; when done building the cart, call create_order exactly once, then finish with a one-sentence summary.",
    ].join(" ");

    const messages: any[] = [
      { role: "system", content: system },
      { role: "user", content: goal },
    ];

    try {
      for (let step = 0; step < 12; step++) {
        const data = await this.chat(messages);
        const msg = data.choices?.[0]?.message;
        if (!msg) throw new Error("LLM returned no message");
        const calls: ToolCall[] = (msg.tool_calls ?? []).map((c: any) => ({
          id: c.id,
          name: c.function.name,
          args: JSON.parse(c.function.arguments ?? "{}"),
        }));
        if (calls.length === 0) {
          log("think", msg.content ?? "");
          break;
        }
        messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
        for (const call of calls) {
          if (call.name === "create_order" && cart.length > 0 && !order) {
            order = await this.paypal.createOrder(cart.map((c) => ({ name: c.name, quantity: c.quantity, unitPrice: c.unitPrice })));
            log("tool", `paypal.createOrder() → ${order.orderId} (${this.paypal.kind}) — awaiting buyer approval.`);
            log("info", `Approve the order here: ${order.approveUrl}`);
            const result = `Order created: ${order.orderId}, total $${order.total.toFixed(2)}. Approve URL: ${order.approveUrl}`;
            messages.push({ role: "tool", tool_call_id: call.id, content: result });
            continue;
          }
          const result = execute(call);
          messages.push({ role: "tool", tool_call_id: call.id, content: result });
        }
        if (order) break;
      }
    } catch (e) {
      log("error", String(e));
    }

    const total = round2(cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0));
    return {
      goal,
      budget,
      cart,
      total,
      withinBudget: budget === null || total <= budget,
      events,
      order: order ? { orderId: order.orderId, approveUrl: order.approveUrl, total: order.total } : undefined,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
