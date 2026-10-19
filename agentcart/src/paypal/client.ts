// PayPal gateway — one interface, two implementations:
//  * LiveSandboxGateway: real PayPal Orders API v2 (api-m.sandbox.paypal.com)
//  * MockGateway: in-memory simulation with identical response shapes (no keys needed)
// SANDBOX ONLY (GT-3): the base URL is fixed to the sandbox host.

export interface OrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface CreatedOrder {
  orderId: string;
  status: "CREATED";
  approveUrl: string;
  total: number;
  currency: string;
}

export interface CaptureResult {
  captureId: string;
  status: "COMPLETED";
  total: number;
  currency: string;
  grossAmount: number; // merchant receives total - fee
  fee: number;
  refunds: { refundId: string; amount: number }[];
}

export interface PayPalGateway {
  readonly kind: "live-sandbox" | "mock";
  createOrder(items: OrderItem[]): Promise<CreatedOrder>;
  captureOrder(orderId: string): Promise<CaptureResult>;
  refundCapture(orderId: string, amount: number): Promise<{ refundId: string; amount: number }>;
}

// ---------------------------------------------------------------------------
// Mock implementation
// ---------------------------------------------------------------------------

export class MockGateway implements PayPalGateway {
  readonly kind = "mock" as const;
  private orders = new Map<string, { items: OrderItem[]; approved: boolean; captured?: CaptureResult }>();

  async createOrder(items: OrderItem[]): Promise<CreatedOrder> {
    const orderId = "MOCK-" + Math.random().toString(36).slice(2, 10).toUpperCase();
    const total = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    this.orders.set(orderId, { items, approved: false });
    return {
      orderId,
      status: "CREATED",
      approveUrl: `/mock/paypal/approve/${orderId}`,
      total: round2(total),
      currency: "USD",
    };
  }

  /** Simulates the buyer logging in on paypal.com and approving. */
  approve(orderId: string): boolean {
    const o = this.orders.get(orderId);
    if (!o || o.captured) return false;
    o.approved = true;
    return true;
  }

  async captureOrder(orderId: string): Promise<CaptureResult> {
    const o = this.orders.get(orderId);
    if (!o) throw new Error(`Mock order not found: ${orderId}`);
    if (!o.approved) throw new Error("Order not approved by buyer yet (mock).");
    if (o.captured) return o.captured;
    const total = round2(o.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0));
    const fee = round2(total * 0.034 + 0.3);
    const captured: CaptureResult = {
      captureId: "MOCKCAP-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
      status: "COMPLETED",
      total,
      currency: "USD",
      grossAmount: round2(total - fee),
      fee,
      refunds: [],
    };
    o.captured = captured;
    return captured;
  }

  async refundCapture(orderId: string, amount: number): Promise<{ refundId: string; amount: number }> {
    const o = this.orders.get(orderId);
    if (!o?.captured) throw new Error(`Order not captured: ${orderId}`);
    const refunded = o.captured.refunds.reduce((s, r) => s + r.amount, 0);
    if (amount > o.captured.total - refunded) throw new Error("Refund exceeds captured amount (mock).");
    const r = { refundId: "MOCKREF-" + Math.random().toString(36).slice(2, 10).toUpperCase(), amount: round2(amount) };
    o.captured.refunds.push(r);
    return r;
  }
}

// ---------------------------------------------------------------------------
// Live sandbox implementation (Orders API v2 via REST — no SDK dependency)
// ---------------------------------------------------------------------------

export class LiveSandboxGateway implements PayPalGateway {
  readonly kind = "live-sandbox" as const;
  private token?: { value: string; expiresAt: number };
  private captures = new Map<string, CaptureResult>();

  constructor(
    private clientId: string,
    private clientSecret: string,
    private base = "https://api-m.sandbox.paypal.com"
  ) {}

  private async auth(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt - 60_000) return this.token.value;
    const creds = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const res = await fetch(`${this.base}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) throw new Error(`PayPal OAuth failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return data.access_token;
  }

  private async api<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.auth();
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`PayPal ${method} ${path} failed: ${res.status} ${text}`);
    return JSON.parse(text) as T;
  }

  async createOrder(items: OrderItem[]): Promise<CreatedOrder> {
    const total = round2(items.reduce((s, i) => s + i.unitPrice * i.quantity, 0));
    const body = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: { currency_code: "USD", value: total.toFixed(2), breakdown: { item_total: { currency_code: "USD", value: total.toFixed(2) } } },
          items: items.map((i) => ({
            name: i.name,
            quantity: String(i.quantity),
            unit_amount: { currency_code: "USD", value: i.unitPrice.toFixed(2) },
            category: "PHYSICAL_GOODS",
          })),
        },
      ],
    };
    const data = await this.api<any>("POST", "/v2/checkout/orders", body);
    const approve = (data.links ?? []).find((l: any) => l.rel === "approve" || l.rel === "payer-action");
    if (!approve) throw new Error("PayPal order created but no approve link returned.");
    return { orderId: data.id, status: "CREATED", approveUrl: approve.href, total, currency: "USD" };
  }

  async captureOrder(orderId: string): Promise<CaptureResult> {
    const cached = this.captures.get(orderId);
    if (cached) return cached;
    const data = await this.api<any>("POST", `/v2/checkout/orders/${orderId}/capture`);
    const pu = data.purchase_units?.[0]?.payments?.captures?.[0];
    if (!pu) throw new Error(`Capture missing in PayPal response for ${orderId}`);
    const result: CaptureResult = {
      captureId: pu.id,
      status: "COMPLETED",
      total: Number(pu.amount.value),
      currency: pu.amount.currency_code,
      grossAmount: Number(pu.seller_receivable_breakdown?.net_amount?.value ?? pu.amount.value),
      fee: Number(pu.seller_receivable_breakdown?.paypal_fee?.value ?? 0),
      refunds: [],
    };
    this.captures.set(orderId, result);
    return result;
  }

  async refundCapture(orderId: string, amount: number): Promise<{ refundId: string; amount: number }> {
    const cap = this.captures.get(orderId);
    if (!cap) throw new Error(`Order not captured yet: ${orderId}`);
    const data = await this.api<any>("POST", `/v2/payments/captures/${cap.captureId}/refund`, {
      amount: { currency_code: cap.currency, value: amount.toFixed(2) },
    });
    const r = { refundId: data.id, amount: Number(data.amount?.value ?? amount) };
    cap.refunds.push(r);
    return r;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
