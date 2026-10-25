import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPublicKey, createHmac } from 'node:crypto';
import { mkdirSync, mkdtempSync, appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Airwallex, configuredAirwallex, verifyWebhook, apiInstant } from '../src/airwallex.js';
import { Audit } from '../src/audit.js';
import { IntentPay, replay } from '../src/service.js';
import { signIntent } from '../src/domain.js';
import { demoKey, fixtureIntent, fixturePurchase } from '../src/fixtures.js';
import { startMock, DEMO_NOW } from '../src/mock.js';
import { startServer } from '../src/server.js';
import { listen, close, json, readBody } from '../src/http.js';
mkdirSync('data/test', { recursive: true });
const key = createPublicKey(demoKey), envelope = signIntent(fixtureIntent, demoKey);
async function setup(options = {}) {
  const mock = await startMock(() => DEMO_NOW);
  const bank = new Airwallex({ baseUrl: mock.url, clientId: 'mock-client', apiKey: 'mock-key', cardholderId: 'mock-holder', beneficiaries: { 'monitor-store': 'mock-beneficiary' }, merchantBrandIds: { 'monitor-store': ['mock-brand-monitor'] }, mock: true });
  const path = join(mkdtempSync('data/test/intentpay-'), 'audit.jsonl');
  const audit = new Audit(path, () => DEMO_NOW);
  const service = new IntentPay(bank, audit, key, () => DEMO_NOW, { log: () => {}, ...options });
  return { mock, bank, audit, service };
}
test('FX, JIT controls, simulated authorization, retries, cap and audit replay', async () => {
  const { mock, bank, audit, service } = await setup();
  try {
    const approved = await service.propose(envelope, fixturePurchase);
    assert.equal(approved.decision.code, 'APPROVE');
    const again = await service.propose(envelope, fixturePurchase); assert.deepEqual(again, approved);
    assert.equal(mock.calls.filter(c => c.path === '/issuing/cards/create').length, 1);
    const controls = approved.action.controls;
    assert.equal(controls.allowed_transaction_count, 'SINGLE');
    assert.deepEqual(controls.allowed_currencies, ['EUR']);
    assert.deepEqual(controls.allowed_merchant_brands, { ids: ['mock-brand-monitor'] });
    assert.equal(mock.calls.find(c => c.path === '/issuing/cards/create')!.body.mock_merchant_allowlist, undefined);
    assert.equal(controls.transaction_limits.limits[0].amount, 120);
    await bank.updateCardControls(approved.action.id, controls);
    const authorize = (merchant: string, amountMinor = '10800') => bank.request('/mock/authorizations', 'POST', { card_id: approved.action.id, currency: 'EUR', merchant, amountMinor });
    assert.equal((await authorize('evil')).status, 'DECLINED');
    assert.equal((await authorize('monitor-store', '10801')).status, 'DECLINED');
    assert.equal((await authorize('monitor-store')).status, 'AUTHORIZED');
    assert.equal((await authorize('monitor-store')).status, 'DECLINED');
    const over = await service.propose(envelope, { ...fixturePurchase, id: '20000000-0000-4000-8000-000000000002' });
    assert.equal(over.decision.code, 'REJECT_BUDGET_EXCEEDED'); assert.equal(over.action, null);
    assert.equal(mock.calls.filter(c => c.path === '/issuing/cards/create').length, 1);
    await service.recordApproval(over.requestId, 'owner', true, 'Issue a fresh signed intent');
    assert.equal(audit.read(over.requestId).find(e => e.type === 'human_approval')?.data.approved, true);
    await assert.rejects(service.recordApproval(over.requestId, 'owner', true, 'again'), /already resolved/);
    await assert.rejects(service.propose(envelope, { ...fixturePurchase, amountMinor: '1' }), /reused/);
    await assert.rejects(service.propose(signIntent({ ...fixtureIntent, budgetMinor: '99999' }, demoKey), { ...fixturePurchase, id: '20000000-0000-4000-8000-000000000003' }), /immutable/);
    assert.equal(replay(audit, key).matches, true);
    assert.equal(mock.calls.filter(c => c.path === '/authentication/login').length, 1);
  } finally { await mock.close(); }
});
test('payout carries locked quote and trusted beneficiary; transactions reconcile', async () => {
  const { mock, bank, service } = await setup();
  try {
    const result = await service.propose(envelope, { ...fixturePurchase, rail: 'payout' });
    assert.equal(result.action.status, 'SENT');
    const body = mock.calls.find(c => c.path === '/transfers/create')!.body;
    assert.equal(body.beneficiary_id, 'mock-beneficiary'); assert.equal(body.transfer_amount, 108);
    assert.equal(body.source_currency, 'USD'); assert.ok(body.quote_id);
    assert.equal(body.fee_paid_by, 'BENEFICIARY');
    assert.equal((await bank.transactions() as any).items.length, 1);
    assert.equal((await bank.paymentAttempts() as any).has_more, false);
  } finally { await mock.close(); }
});
test('merchant and invalid signature rejects never fetch FX or execute', async () => {
  const { mock, service } = await setup();
  try {
    const rejected = await service.propose(envelope, { ...fixturePurchase, merchant: 'evil' });
    assert.equal(rejected.decision.code, 'REJECT_MERCHANT_NOT_ALLOWED'); assert.equal(mock.calls.length, 0);
    const forged = await service.propose({ ...envelope, intent: { ...fixtureIntent, budgetMinor: '99999' } }, { ...fixturePurchase, id: '20000000-0000-4000-8000-000000000002' });
    assert.equal(forged.decision.code, 'REJECT_INVALID_SIGNATURE');
  } finally { await mock.close(); }
});
test('human threshold requests approval without executing; console fallback and local resolution', async () => {
  const messages: string[] = [];
  const { mock, audit, service } = await setup({ log: (message: string) => messages.push(message), slackWebhook: 'http://127.0.0.1:1' });
  try {
    const result = await service.propose(signIntent({ ...fixtureIntent, humanAboveMinor: '10000' }, demoKey), fixturePurchase);
    assert.equal(result.decision.code, 'NEEDS_HUMAN_APPROVAL'); assert.equal(result.action, null);
    assert.equal(messages.length, 1); assert.equal(audit.read().find(e => e.type === 'approval_notification')?.data.channel, 'console');
    await service.recordApproval(fixturePurchase.id, 'owner', false, 'No purchase today');
    assert.equal(audit.read().at(-1)!.data.approved, false);
    assert.equal(mock.calls.filter(c => c.path === '/issuing/cards/create').length, 0);
  } finally { await mock.close(); }
});
test('Slack notification uses webhook and records delivery', async () => {
  let received = '';
  const slack = createServer(async (req, res) => { received = await readBody(req); json(res, 200, {}); });
  const url = await listen(slack);
  const { mock, audit, service } = await setup({ slackWebhook: url });
  try {
    await service.propose(envelope, { ...fixturePurchase, amountMinor: '18000' });
    assert.match(JSON.parse(received).text, /REJECT_BUDGET_EXCEEDED/);
    assert.equal(audit.read().find(e => e.type === 'approval_notification')?.data.channel, 'slack');
  } finally { await mock.close(); await close(slack); }
});
test('SDK client initializes, discovers tools and exercises Streamable HTTP', async () => {
  const { mock, audit, service } = await setup();
  const server = await startServer(service, { token: 'integration-test-token', webhookSecret: 'secret' });
  const client = new Client({ name: 'integration-test', version: '1.0.0' });
  try {
    assert.equal((await fetch(server.url + '/mcp', { method: 'POST' })).status, 401);
    await client.connect(new StreamableHTTPClientTransport(new URL(server.url + '/mcp'), { requestInit: { headers: { authorization: 'Bearer integration-test-token' } } }));
    assert.deepEqual((await client.listTools()).tools.map(t => t.name).sort(), ['check_policy', 'get_audit_trail', 'propose_purchase']);
    const checked: any = await client.callTool({ name: 'check_policy', arguments: { envelope, purchase: fixturePurchase } });
    assert.equal(JSON.parse(checked.content[0].text).code, 'APPROVE'); assert.equal(audit.read().length, 0);
    const proposed: any = await client.callTool({ name: 'propose_purchase', arguments: { envelope, purchase: fixturePurchase } });
    assert.equal(JSON.parse(proposed.content[0].text).decision.code, 'APPROVE');
    const trail: any = await client.callTool({ name: 'get_audit_trail', arguments: {} }); assert.ok(JSON.parse(trail.content[0].text).length >= 5);
    const unauthorizedApproval: any = await client.callTool({ name: 'approve_purchase', arguments: {} }); assert.equal(unauthorizedApproval.isError, true);
    const headers = { authorization: 'Bearer integration-test-token', 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
    assert.equal((await fetch(server.url + '/mcp', { method: 'POST', headers, body: '{' })).status, 400);
    assert.equal((await fetch(server.url + '/mcp', { headers })).status, 405);
    assert.equal((await fetch(server.url + '/mcp', { method: 'POST', headers: { ...headers, origin: 'https://evil.test' }, body: '{}' })).status, 403);
    const raw = JSON.stringify({ id: 'evt_1', name: 'transfer.sent', data: { object: { id: 'transfer_1' } } });
    const timestamp = String(DEMO_NOW), signature = createHmac('sha256', 'secret').update(timestamp + raw).digest('hex');
    for (let n = 0; n < 2; n++) assert.equal((await fetch(server.url + '/webhooks/airwallex', { method: 'POST', body: raw, headers: { 'x-timestamp': timestamp, 'x-signature': signature } })).status, 200);
    assert.equal(audit.read().filter(e => e.type === 'webhook').length, 1);
    assert.equal((await fetch(server.url + '/webhooks/airwallex', { method: 'POST', body: raw, headers: { 'x-timestamp': timestamp, 'x-signature': '0'.repeat(64) } })).status, 401);
  } finally { await client.close(); await server.close(); await mock.close(); }
});
test('webhook raw-body HMAC and timestamp window fail closed', () => {
  const raw = '{ "id": 1 }', timestamp = String(DEMO_NOW), secret = 'test';
  const sig = createHmac('sha256', secret).update(timestamp + raw).digest('hex');
  assert.equal(verifyWebhook(raw, timestamp, sig, secret, DEMO_NOW), true);
  assert.equal(verifyWebhook(raw.trim() + ' ', timestamp, sig, secret, DEMO_NOW), false);
  assert.equal(verifyWebhook(raw, timestamp, sig, secret, DEMO_NOW + 300001), false);
  assert.equal(verifyWebhook(raw, timestamp, 'z'.repeat(64), secret, DEMO_NOW), false);
});
test('file lock prevents simultaneous spending and restart keeps reservations', async () => {
  const { mock, audit, bank, service } = await setup();
  try {
    const results = await Promise.allSettled([service.propose(envelope, fixturePurchase), service.propose(envelope, { ...fixturePurchase, id: '20000000-0000-4000-8000-000000000002' })]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    const restarted = new IntentPay(bank, new Audit(audit.path, () => DEMO_NOW), key, () => DEMO_NOW, { log: () => {} });
    const result = await restarted.propose(envelope, { ...fixturePurchase, id: '20000000-0000-4000-8000-000000000003' });
    assert.equal(result.decision.code, 'REJECT_BUDGET_EXCEEDED');
  } finally { await mock.close(); }
});
test('uncertain execution retains budget and cannot be blindly replayed', async () => {
  const { mock, audit, service } = await setup();
  service.bank.card = async () => { throw new Error('timeout after send'); };
  try {
    await assert.rejects(service.propose(envelope, fixturePurchase), /timeout/);
    assert.equal(audit.read().find(e => e.type === 'error')!.data.reservationRetained, true);
    await assert.rejects(service.propose(envelope, fixturePurchase), /Incomplete/);
    assert.equal((await service.check(envelope, fixturePurchase)).code, 'REJECT_BUDGET_EXCEEDED');
  } finally { await mock.close(); }
});
test('append-only audit detects modified and truncated files', () => {
  const path = join(mkdtempSync('data/test/intentpay-audit-'), 'audit.jsonl');
  const audit = new Audit(path, () => DEMO_NOW); audit.append('test', 'one', { value: 1 });
  const original = readFileSync(path, 'utf8');
  writeFileSync(path, original.replace('"value":1', '"value":2')); assert.throws(() => audit.read(), /integrity/);
  writeFileSync(path, original); appendFileSync(path, '{'); assert.throws(() => audit.read(), /Truncated/);
});
test('missing creds start local HTTP fallback; partial and invalid creds fail visibly', async () => {
  const fallback = await configuredAirwallex({});
  try { assert.equal(fallback.client.config.mock, true); assert.equal((await fallback.client.transactions() as any).items.length, 0); } finally { await fallback.close(); }
  await assert.rejects(configuredAirwallex({ AIRWALLEX_CLIENT_ID: 'partial' }), /both/);
  const mock = await startMock();
  const configured = await configuredAirwallex({ AIRWALLEX_CLIENT_ID: 'bad', AIRWALLEX_API_KEY: 'bad', AIRWALLEX_BASE_URL: mock.url });
  try { await assert.rejects(configured.client.transactions(), /HTTP 401/); } finally { await mock.close(); }
});
test('quote expiring during the request fails closed and replay uses exact evaluation time', async () => {
  const { mock, audit, bank } = await setup();
  let tick = 0;
  const service = new IntentPay(bank, audit, key, () => DEMO_NOW + (tick++ === 0 ? 0 : 60000), { log: () => {} });
  try {
    const result = await service.propose(envelope, fixturePurchase);
    assert.equal(result.decision.code, 'REJECT_QUOTE_EXPIRED');
    assert.equal(result.action, null);
    assert.equal(mock.calls.some(call => call.path === '/issuing/cards/create'), false);
    assert.equal(replay(audit, key).matches, true);
  } finally { await mock.close(); }
});
test('native merchant restrictions are required before card creation', async () => {
  const { mock, bank } = await setup();
  try {
    const quote = await bank.quote(envelope, fixturePurchase);
    delete bank.config.merchantBrandIds;
    await assert.rejects(bank.card(envelope, fixturePurchase, quote), /merchant brand IDs required/);
    bank.config.merchantBrandIds = { 'monitor-store': [] };
    await assert.rejects(bank.card(envelope, fixturePurchase, quote), /merchant brand IDs required/);
    assert.equal(mock.calls.some(c => c.path === '/issuing/cards/create'), false);
  } finally { await mock.close(); }
});
test('sandbox-style FX timestamps normalize at the HTTP boundary', async () => {
  const api = createServer(async (req, res) => {
    if (req.url?.endsWith('/authentication/login')) return json(res, 201, { token: 'token', expires_at: '2099-01-01T00:00:00+0000' });
    json(res, 201, { quote_id: 'sandbox-format', sell_currency: 'USD', buy_currency: 'EUR', sell_amount: 120, buy_amount: 108,
      valid_from_at: '2026-10-27T12:00:00+0000', valid_to_at: '2026-10-27T13:01:00+0100' });
  });
  const url = await listen(api);
  try {
    const bank = new Airwallex({ baseUrl: url, clientId: 'client', apiKey: 'key' });
    const quote = await bank.quote(envelope, fixturePurchase);
    assert.equal(quote.validFrom, '2026-10-27T12:00:00+00:00');
    assert.equal(Date.parse(quote.expiresAt), DEMO_NOW + 60000);
    assert.throws(() => apiInstant('2026-10-27T12:00:00+9999'));
    assert.throws(() => apiInstant('October 27 2026'));
  } finally { await close(api); }
});
test('requested payment_attempts POST exists only as mock payout compatibility contract', async () => {
  const { mock, bank } = await setup();
  try {
    const quote = await bank.quote(envelope, fixturePurchase);
    const body = { request_id: fixturePurchase.id, beneficiary_id: 'mock-beneficiary', source_currency: 'USD', transfer_currency: 'EUR', transfer_amount: 108, quote_id: quote.id };
    const response = await bank.request('/pa/payment_attempts', 'POST', body);
    assert.equal(response.status, 'SENT');
    assert.deepEqual(await bank.request('/pa/payment_attempts', 'POST', body), response);
  } finally { await mock.close(); }
});
