import assert from 'node:assert/strict';
import { createPublicKey, createHmac } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Audit } from './audit.js';
import { Airwallex } from './airwallex.js';
import { signIntent } from './domain.js';
import { startMock, DEMO_NOW } from './mock.js';
import { IntentPay, replay } from './service.js';
import { startServer } from './server.js';
import { demoKey, fixtureIntent, fixturePurchase } from './fixtures.js';
// Unique append-only run directory. No existing audit is ever overwritten.
const directory = `data/demo-${Date.now()}`;
mkdirSync(directory, { recursive: true });
const mock = await startMock(() => DEMO_NOW);
const bank = new Airwallex({ baseUrl: mock.url, clientId: 'mock-client', apiKey: 'mock-key', cardholderId: 'mock-holder', beneficiaries: { 'monitor-store': 'mock-beneficiary' }, merchantBrandIds: { 'monitor-store': ['mock-brand-monitor'] }, mock: true });
const audit = new Audit(`${directory}/audit.jsonl`, () => DEMO_NOW);
const publicKey = createPublicKey(demoKey);
writeFileSync(`${directory}/owner-public.pem`, publicKey.export({ type: 'spki', format: 'pem' }));
const service = new IntentPay(bank, audit, publicKey, () => DEMO_NOW);
const token = 'intentpay-demo-token';
const server = await startServer(service, { token, webhookSecret: 'demo-webhook-secret' });
async function tool(name: string, args: unknown): Promise<any> {
  const response = await fetch(`${server.url}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) });
  const rpc: any = await response.json();
  if (!response.ok || rpc.error || rpc.result.isError) throw new Error(JSON.stringify(rpc));
  return JSON.parse(rpc.result.content[0].text);
}
try {
  console.log('IntentPay — deterministic MOCK demo; MCP Streamable HTTP; no live money or Slack');
  const envelope = signIntent(fixtureIntent, demoKey);
  writeFileSync(`${directory}/envelope.json`, JSON.stringify(envelope, null, 2));
  console.log('1. Owner signs Ed25519 intent: USD 150 total cap, EUR purchases, monitor-store, expires 13:00Z.');
  const allowed = await tool('propose_purchase', { envelope, purchase: fixturePurchase });
  assert.equal(allowed.decision.code, 'APPROVE');
  console.log(`2. EUR 108 / locked FX 0.90 = USD 120 -> ${allowed.decision.code}; JIT single-use card ${allowed.action.id}, USD 120 native authorization spend limit + mapped merchant brand allowlist.`);
  const auth = await bank.request('/mock/authorizations', 'POST', { card_id: allowed.action.id, merchant: 'monitor-store', amountMinor: '10800', currency: 'EUR' });
  assert.equal(auth.status, 'AUTHORIZED'); audit.append('simulated_authorization', fixturePurchase.id, auth);
  console.log('   Simulated card authorization: AUTHORIZED. Quote is a budget check; card settlement FX is separate.');
  const forbidden = { ...fixturePurchase, id: '20000000-0000-4000-8000-000000000002', amountMinor: '18000', rail: 'payout' };
  const rejected = await tool('propose_purchase', { envelope, purchase: forbidden });
  assert.equal(rejected.decision.code, 'REJECT_BUDGET_EXCEEDED'); assert.equal(rejected.action, null);
  console.log('3. EUR 180 = USD 200; remaining USD 30 -> REJECT_BUDGET_EXCEEDED; no payment.');
  await service.recordApproval(forbidden.id, 'demo-owner', true, 'Explicitly authorize a separate USD 220 replacement intent');
  console.log('4. HUMAN MOMENT: owner approval recorded locally. Owner signs a new envelope; original rejection stays intact.');
  const revised = signIntent({ ...fixtureIntent, id: '10000000-0000-4000-8000-000000000002', budgetMinor: '22000' }, demoKey);
  const paid = await tool('propose_purchase', { envelope: revised, purchase: { ...forbidden, id: '20000000-0000-4000-8000-000000000003' } });
  assert.equal(paid.decision.code, 'APPROVE'); assert.equal(paid.action.status, 'SENT');
  console.log(`5. Revised intent -> APPROVE; quote-bound payout ${paid.action.id}: SENT (separate purchase rail).`);
  const transactions = await bank.transactions(); audit.append('reconciliation', forbidden.id, transactions);
  const raw = JSON.stringify({ id: 'evt_demo_001', name: 'transfer.sent', data: { object: { id: paid.action.id } } });
  const timestamp = String(DEMO_NOW), signature = createHmac('sha256', 'demo-webhook-secret').update(timestamp + raw).digest('hex');
  const webhook = await fetch(`${server.url}/webhooks/airwallex`, { method: 'POST', headers: { 'x-timestamp': timestamp, 'x-signature': signature }, body: raw });
  assert.equal(webhook.status, 200);
  const trail = await tool('get_audit_trail', {});
  const replayed = replay(audit, publicKey); assert.equal(replayed.matches, true); assert.equal(replayed.decisions, 3);
  console.log(`6. Audit replay: ${trail.length} hash-linked events, ${replayed.decisions} policy decisions verified, match=${replayed.matches}.`);
  for (const row of replayed.results as any[]) console.log(`   ${row.requestId}: ${row.type === 'human_approval' ? 'HUMAN_APPROVED (new signature required)' : row.decision.code}`);
  console.log(`Audit: ${audit.path}\nReplay: AUDIT_PATH=${audit.path} INTENTPAY_PUBLIC_KEY_PATH=${directory}/owner-public.pem npm run audit -- replay`);
} finally { await server.close(); await mock.close(); }
