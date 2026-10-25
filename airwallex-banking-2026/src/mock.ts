import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { close, json, listen, readBody } from './http.js';
import { decimalToMinor, minorToDecimal, exponents, type Currency } from './domain.js';
export const DEMO_NOW = Date.parse('2026-10-27T12:00:00Z');
export async function startMock(now: () => number = Date.now, port = 0) {
  const calls: { path: string; method: string; body: any }[] = [];
  const quotes = new Map<string, any>(), cards = new Map<string, any>(), writes = new Map<string, any>();
  const transactions: any[] = [];
  const id = (prefix: string, data: unknown) => prefix + createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 20);
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url!, 'http://localhost').pathname.replace('/api/v1', '');
      const body = JSON.parse((await readBody(req)) || '{}');
      calls.push({ path, method: req.method ?? '', body });
      if (path === '/authentication/login' && req.method === 'POST') {
        if (req.headers['x-client-id'] !== 'mock-client' || req.headers['x-api-key'] !== 'mock-key') return json(res, 401, { code: 'credentials_invalid' });
        return json(res, 201, { token: 'mock-token', expires_at: new Date(Date.now() + 1800000).toISOString() });
      }
      if (req.headers.authorization !== 'Bearer mock-token') return json(res, 401, { code: 'unauthorized' });
      if (path === '/fx/quotes/create' && req.method === 'POST') {
        const { buy_currency: buy, sell_currency: sell } = body as { buy_currency: Currency; sell_currency: Currency };
        if (!(buy in exponents) || !(sell in exponents)) return json(res, 400, { code: 'currency_unsupported' });
        // Fixed fixture: 0.90 EUR per USD; all same-currency pairs use 1:1.
        if (!(buy === sell || (buy === 'EUR' && sell === 'USD'))) return json(res, 400, { code: 'pair_unsupported' });
        const target = BigInt(decimalToMinor(body.buy_amount, buy));
        const base = buy === sell ? target : (target * 10n + 8n) / 9n;
        const quote = { quote_id: id('quote_', { ...body, at: now() }), buy_currency: buy, sell_currency: sell,
          buy_amount: minorToDecimal(target.toString(), buy), sell_amount: minorToDecimal(base.toString(), sell),
          client_rate: buy === sell ? 1 : 0.9, valid_from_at: new Date(now()).toISOString(), valid_to_at: new Date(now() + 60000).toISOString() };
        quotes.set(quote.quote_id, quote); return json(res, 201, quote);
      }
      if (path === '/issuing/cards/create' && req.method === 'POST') {
        const key = 'card:' + body.request_id;
        if (writes.has(key)) return json(res, 200, writes.get(key));
        if (body.form_factor !== 'VIRTUAL' || !body.cardholder_id || body.authorization_controls?.allowed_transaction_count !== 'SINGLE' || !body.authorization_controls?.transaction_limits?.limits?.length || !body.authorization_controls?.allowed_merchant_brands?.ids?.length) return json(res, 400, { code: 'invalid_card' });
        const card = { id: id('card_', body.request_id), status: 'ACTIVE', ...body };
        cards.set(card.id, card); writes.set(key, card); return json(res, 201, card);
      }
      const update = path.match(/^\/issuing\/cards\/([^/]+)\/update$/);
      if (update && req.method === 'POST') {
        const card = cards.get(update[1]!); if (!card) return json(res, 404, {});
        card.authorization_controls = body.authorization_controls; return json(res, 200, card);
      }
      // IntentPay-only simulator, never claimed to be an Airwallex endpoint.
      if (path === '/mock/authorizations' && req.method === 'POST') {
        const card = cards.get(body.card_id), controls = card?.authorization_controls;
        const limit = controls?.transaction_limits?.limits?.find((v: any) => v.interval === 'PER_TRANSACTION');
        const target = BigInt(body.amountMinor);
        const base = controls?.transaction_limits.currency === body.currency ? target : (body.currency === 'EUR' && controls?.transaction_limits.currency === 'USD' ? (target * 10n + 8n) / 9n : -1n);
        const approved = base > 0n && card && !card.used && now() < Date.parse(controls.active_to) && controls.allowed_currencies.includes(body.currency) && controls.allowed_merchant_brands.ids.includes(body.merchant === 'monitor-store' ? 'mock-brand-monitor' : 'unknown-brand') && base <= BigInt(decimalToMinor(limit.amount, controls.transaction_limits.currency));
        if (approved) { card.used = true; transactions.push({ id: id('auth_', body), card_id: card.id, status: 'AUTHORIZED', ...body }); }
        return json(res, 200, { status: approved ? 'AUTHORIZED' : 'DECLINED' });
      }
      // Compatibility alias requested in the brief; real payouts use transfers/create.
      if (['/transfers/create', '/pa/payment_attempts'].includes(path) && req.method === 'POST') {
        const key = 'payout:' + body.request_id;
        if (writes.has(key)) return json(res, 200, writes.get(key));
        const q = quotes.get(body.quote_id);
        if (!q || now() >= Date.parse(q.valid_to_at) || q.used || body.beneficiary_id !== 'mock-beneficiary' || body.transfer_currency !== q.buy_currency || body.source_currency !== q.sell_currency || decimalToMinor(body.transfer_amount, q.buy_currency) !== decimalToMinor(q.buy_amount, q.buy_currency)) return json(res, 400, { code: 'invalid_transfer_or_quote' });
        q.used = true; const result = { id: id('transfer_', body.request_id), status: 'SENT', quote_id: q.quote_id };
        writes.set(key, result); transactions.push(result); return json(res, 201, result);
      }
      if (['/financial_transactions', '/pa/transactions', '/pa/payment_attempts'].includes(path) && req.method === 'GET') return json(res, 200, { items: transactions, has_more: false });
      return json(res, 404, { code: 'not_found' });
    } catch { json(res, 400, { code: 'invalid_request' }); }
  });
  const url = await listen(server, port);
  return { url, calls, close: () => close(server) };
}
