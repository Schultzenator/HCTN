import { z } from 'zod';
import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { decimalToMinor, minorToDecimal, quoteSchema, instant, type SignedIntent, type Purchase, type Quote } from './domain.js';
import { startMock } from './mock.js';
export interface Config { baseUrl: string; clientId: string; apiKey: string; loginAs?: string; cardholderId?: string; beneficiaries?: Record<string, string>; merchantBrandIds?: Record<string, string[]>; mock?: boolean }
// Airwallex examples also use ISO offsets without a colon (+0000). Normalize only at the API boundary.
export function apiInstant(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Malformed API timestamp');
  const normalized = value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  return instant.parse(normalized);
}
export class Airwallex {
  private token = ''; private tokenExpires = 0;
  constructor(readonly config: Config) {}
  private async raw(path: string, method: string, body?: unknown, headers: Record<string, string> = {}): Promise<any> {
    const response = await fetch(this.config.baseUrl.replace(/\/$/, '') + '/api/v1' + path, {
      method, headers: { 'content-type': 'application/json', 'x-api-version': '2024-09-27', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`Airwallex ${method} ${path}: HTTP ${response.status} (reconcile before retrying writes)`);
    return response.json();
  }
  async request(path: string, method = 'GET', body?: unknown): Promise<any> {
    if (this.tokenExpires <= Date.now() + 30000) {
      const auth = await this.raw('/authentication/login', 'POST', undefined, {
        'x-client-id': this.config.clientId, 'x-api-key': this.config.apiKey,
        ...(this.config.loginAs ? { 'x-login-as': this.config.loginAs } : {})
      });
      if (!auth.token || typeof auth.expires_at !== 'string' || !Number.isFinite(Date.parse(apiInstant(auth.expires_at)))) throw new Error('Malformed authentication response');
      this.token = auth.token; this.tokenExpires = Date.parse(apiInstant(auth.expires_at));
    }
    return this.raw(path, method, body, { authorization: `Bearer ${this.token}` });
  }
  async quote(envelope: SignedIntent, purchase: Purchase): Promise<Quote> {
    const raw = await this.request('/fx/quotes/create', 'POST', {
      buy_currency: purchase.currency, sell_currency: envelope.intent.baseCurrency,
      buy_amount: Number(minorToDecimal(purchase.amountMinor, purchase.currency)), validity: 'MIN_1'
    });
    return quoteSchema.parse({ id: raw.quote_id, baseCurrency: raw.sell_currency, targetCurrency: raw.buy_currency,
      targetMinor: decimalToMinor(raw.buy_amount, raw.buy_currency), baseMinor: decimalToMinor(raw.sell_amount, raw.sell_currency),
      validFrom: apiInstant(raw.valid_from_at), expiresAt: apiInstant(raw.valid_to_at), locked: true });
  }
  async card(e: SignedIntent, p: Purchase, quote: Quote): Promise<{ id: string; controls: unknown; merchantEnforcement: string }> {
    if (!this.config.cardholderId) throw new Error('AIRWALLEX_CARDHOLDER_ID required for issuing');
    const brandIds = Object.hasOwn(this.config.merchantBrandIds ?? {}, p.merchant) ? this.config.merchantBrandIds![p.merchant] : undefined;
    if (!brandIds?.length || brandIds.some(id => typeof id !== 'string' || !id.trim())) throw new Error('Trusted merchant brand IDs required for native card restrictions');
    const controls = {
      allowed_merchant_brands: { ids: brandIds },
      allowed_transaction_count: 'SINGLE', allowed_currencies: [p.currency], active_to: e.intent.expiresAt,
      transaction_limits: { currency: e.intent.baseCurrency, limits: [{ interval: 'PER_TRANSACTION', amount: Number(minorToDecimal(quote.baseMinor, e.intent.baseCurrency)) }, { interval: 'ALL_TIME', amount: Number(minorToDecimal(quote.baseMinor, e.intent.baseCurrency)) }] }
    };
    const card = await this.request('/issuing/cards/create', 'POST', { request_id: p.id,
      cardholder_id: this.config.cardholderId, form_factor: 'VIRTUAL', created_by: 'IntentPay Owner', is_personalized: true, program: { purpose: 'COMMERCIAL' }, activate_on_issue: true,
      authorization_controls: controls });
    if (!card.id) throw new Error('Malformed card response');
    return { id: card.id, controls, merchantEnforcement: 'gateway exact merchant allowlist; native mapped merchant brands, single-use, currency, expiry, spend limits' };
  }
  async updateCardControls(id: string, controls: unknown): Promise<unknown> {
    return this.request(`/issuing/cards/${encodeURIComponent(id)}/update`, 'POST', { request_id: randomUUID(), authorization_controls: controls });
  }
  async payout(e: SignedIntent, p: Purchase, quote: Quote): Promise<{ id: string; status: string }> {
    const beneficiary = Object.hasOwn(this.config.beneficiaries ?? {}, p.merchant) ? this.config.beneficiaries![p.merchant] : undefined;
    if (!beneficiary) throw new Error('No trusted beneficiary mapping for merchant');
    const result = await this.request('/transfers/create', 'POST', {
      request_id: p.id, beneficiary_id: beneficiary, source_currency: e.intent.baseCurrency,
      transfer_currency: p.currency, transfer_amount: Number(minorToDecimal(p.amountMinor, p.currency)),
      transfer_method: 'LOCAL', reason: 'goods_purchased', reference: p.id, quote_id: quote.id, fee_paid_by: 'BENEFICIARY'
    });
    if (!result.id || !result.status) throw new Error('Malformed payout response');
    return { id: result.id, status: result.status };
  }
  async transactions(): Promise<unknown> { return this.request('/financial_transactions'); }
  async paymentAttempts(): Promise<unknown> { return this.request('/pa/payment_attempts'); }
}
export async function configuredAirwallex(env: NodeJS.ProcessEnv = process.env): Promise<{ client: Airwallex; close: () => Promise<void> }> {
  if (Boolean(env.AIRWALLEX_CLIENT_ID) !== Boolean(env.AIRWALLEX_API_KEY)) throw new Error('Provide both AIRWALLEX_CLIENT_ID and AIRWALLEX_API_KEY, or neither');
  if (env.AIRWALLEX_CLIENT_ID && env.AIRWALLEX_API_KEY) {
    const baseUrl = env.AIRWALLEX_BASE_URL ?? 'https://api.sandbox.airwallex.com';
    if (new URL(baseUrl).protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname)) throw new Error('Remote Airwallex requires HTTPS');
    return { client: new Airwallex({ baseUrl, clientId: env.AIRWALLEX_CLIENT_ID, apiKey: env.AIRWALLEX_API_KEY,
      loginAs: env.AIRWALLEX_LOGIN_AS, cardholderId: env.AIRWALLEX_CARDHOLDER_ID,
      beneficiaries: z.record(z.string().min(1)).parse(JSON.parse(env.AIRWALLEX_BENEFICIARIES_JSON ?? '{}')),
      merchantBrandIds: z.record(z.array(z.string().min(1)).min(1)).parse(JSON.parse(env.AIRWALLEX_MERCHANT_BRANDS_JSON ?? '{}')) }), close: async () => {} };
  }
  const mock = await startMock();
  return { client: new Airwallex({ baseUrl: mock.url, clientId: 'mock-client', apiKey: 'mock-key', cardholderId: 'mock-holder', beneficiaries: { 'monitor-store': 'mock-beneficiary' }, merchantBrandIds: { 'monitor-store': ['mock-brand-monitor'] }, mock: true }), close: mock.close };
}
export function verifyWebhook(raw: string, timestamp: string, signature: string, secret: string, now = Date.now()): boolean {
  if (!/^\d{13}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 300000 || !/^[a-fA-F0-9]{64}$/.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(timestamp + raw).digest();
  const actual = Buffer.from(signature, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
