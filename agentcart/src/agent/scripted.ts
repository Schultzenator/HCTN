// Deterministic scripted brain (default AGENT_MODE=scripted — no LLM key needed).
// The same "tool" surface is exposed to the LLM brain (agent/llm.ts, openai/mistral modes).

import { CATALOG, byId, negotiatePrice, searchProducts, type Product } from "../store/catalog.js";
import type { PayPalGateway } from "../paypal/client.js";

export interface AgentEvent {
  t: number;
  kind: "plan" | "think" | "tool" | "info" | "error";
  message: string;
}

export interface CartLine {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface AgentRunResult {
  goal: string;
  budget: number | null;
  cart: CartLine[];
  total: number;
  withinBudget: boolean;
  events: AgentEvent[];
  order?: { orderId: string; approveUrl: string; total: number };
}

export interface Agent {
  run(goal: string): Promise<AgentRunResult>;
}

const BUDGET_RE = /\$?\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:usd|dollars|zł)/i;

export function parseBudget(goal: string): number | null {
  const m = goal.match(BUDGET_RE);
  if (!m) return null;
  const v = Number((m[1] ?? m[2]).replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : null;
}

const NEEDS_HINTS: [RegExp, string[]][] = [
  [/office|desk setup|workstation|home office/i, ["desk", "chair", "lamp", "keyboard", "mouse"]],
  [/stream|podcast|youtube/i, ["microphone", "webcam", "lamp"]],
  [/calls|meetings|zoom|teams/i, ["headset", "webcam"]],
];

function inferNeeds(goal: string): string[] {
  for (const [re, needs] of NEEDS_HINTS) if (re.test(goal)) return needs;
  return ["keyboard", "mouse", "lamp"];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export class ScriptedAgent implements Agent {
  constructor(private paypal: PayPalGateway) {}

  async run(goal: string): Promise<AgentRunResult> {
    const events: AgentEvent[] = [];
    const log = (kind: AgentEvent["kind"], message: string) =>
      events.push({ t: events.length, kind, message });

    const budget = parseBudget(goal);
    log("plan", `Goal parsed: "${goal}"${budget ? ` — budget: $${budget}` : " — no explicit budget, using $500"}.`);
    const effectiveBudget = budget ?? 500;

    const needs = inferNeeds(goal);
    log("think", `Shopping plan: cover ${needs.join(", ")}.`);

    const cart: CartLine[] = [];
    const inCart = new Set<string>();
    let total = 0;

    // Pick best-value in-stock candidate for a need: EXACT category first, then fuzzy search.
    // Dedupe: a product already in the cart is never picked again.
    const pickBest = (need: string, remainingOverride?: number): Product | undefined => {
      const remaining = remainingOverride ?? effectiveBudget - total;
      const exact = CATALOG.filter((p) => p.category === need && p.stock > 0);
      const pool = exact.length > 0 ? exact : searchProducts(need).filter((p) => p.stock > 0);
      return pool
        .filter((p) => p.price <= remaining && !inCart.has(p.id))
        .sort((a, b) => b.rating / b.price - a.rating / a.price)[0];
    };

    const addToCart = (p: Product) => {
      cart.push({ productId: p.id, name: p.name, quantity: 1, unitPrice: p.price });
      inCart.add(p.id);
      total = round2(cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0));
    };

    const skipped: string[] = [];
    for (const need of needs) {
      const pick = pickBest(need);
      if (!pick) {
        skipped.push(need);
        log("info", `Skipping "${need}" — no candidate fits the remaining budget ($${(effectiveBudget - total).toFixed(2)}).`);
        continue;
      }
      log("tool", `search("${need}") → picked ${pick.name} ($${pick.price}, ★${pick.rating}).`);
      addToCart(pick);
    }

    // Negotiation pass: a 5% bundle discount on the priciest item can unblock skipped needs.
    if (skipped.length > 0 && cart.length > 0) {
      const priciest = cart.reduce((a, b) => (a.unitPrice > b.unitPrice ? a : b));
      const product = byId(priciest.productId) as Product;
      const deal = negotiatePrice(product);
      const afterDiscountRemaining = round2(effectiveBudget - (total - (product.price - deal.product.price)));
      const candidate = skipped
        .map((n) => pickBest(n, afterDiscountRemaining))
        .filter((p): p is Product => !!p)
        .sort((a, b) => a.price - b.price)[0];
      if (candidate) {
        priciest.unitPrice = deal.product.price;
        total = round2(cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0));
        log("tool", deal.note);
        log("think", `Discount frees $${(product.price - deal.product.price).toFixed(2)} — retrying skipped needs.`);
        for (const need of [...skipped]) {
          const pick = pickBest(need);
          if (pick) {
            log("tool", `search("${need}") → picked ${pick.name} ($${pick.price}, ★${pick.rating}).`);
            addToCart(pick);
            skipped.splice(skipped.indexOf(need), 1);
          }
        }
      }
    }

    if (cart.length === 0) {
      log("error", "Nothing fits the budget — raise it or relax the goal.");
      return { goal, budget, cart, total: 0, withinBudget: false, events };
    }

    log("info", `Cart ready: ${cart.map((c) => c.name).join("; ")} — total $${total.toFixed(2)} (budget $${effectiveBudget.toFixed(2)}).`);

    // Curveball: last item goes out of stock right before payment → substitute.
    const last = cart[cart.length - 1];
    const stockCheck = byId(last.productId);
    if (stockCheck && stockCheck.stock === 0) {
      log("error", `Merchant: "${last.name}" just went out of stock!`);
      const alt = CATALOG.filter((p) => p.category === stockCheck.category && p.id !== stockCheck.id && p.stock > 0 && p.price <= stockCheck.price * 1.2)
        .sort((a, b) => b.rating - a.rating)[0];
      if (alt) {
        log("think", `Substituting with best-rated alternative: ${alt.name} ($${alt.price}).`);
        last.productId = alt.id;
        last.name = alt.name;
        last.unitPrice = alt.price;
        total = round2(cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0));
      }
    }

    // Create the PayPal order (tool call).
    const order = await this.paypal.createOrder(cart.map((c) => ({ name: c.name, quantity: c.quantity, unitPrice: c.unitPrice })));
    log("tool", `paypal.createOrder() → ${order.orderId} (${this.paypal.kind}) — awaiting buyer approval.`);
    log("info", `Approve the order here: ${order.approveUrl}`);

    return {
      goal,
      budget,
      cart,
      total,
      withinBudget: total <= effectiveBudget,
      events,
      order: { orderId: order.orderId, approveUrl: order.approveUrl, total: order.total },
    };
  }
}
