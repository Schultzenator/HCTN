import { test } from 'node:test';
import assert from 'node:assert';
import { buildChannels } from '../channels/index.js';
import { MemoryStore } from '../state/store.js';
import { OmniLoopAgent } from '../agent/loop.js';
import { ScriptedModel } from '../bedrock/model.js';
import { MockAdapter } from '../channels/mock.js';
import type { ToolCall } from '../bedrock/model.js';

function makeAgent(script: (input: string) => ToolCall[]) {
  const store = new MemoryStore();
  store.seedProfiles([
    { customerId: 'c1', address: 'x', email: 'demo@example.com', phone: '+48600100200', preferredChannel: 'sms', marketingOptIn: true }
  ]);
  const channels = buildChannels('mock');
  const model = new ScriptedModel((input) => ({ text: '', toolCalls: script(input) }));
  return { agent: new OmniLoopAgent({ model, store, channels }), store };
}

test('cross-channel continuity: thread started on SMS continues on RCS', async () => {
  MockAdapter.reset();
  const { agent, store } = makeAgent((input) => {
    if (input.includes('powerbank')) return [{ name: 'search_catalog', args: { query: 'powerbank' } }];
    return [];
  });
  await agent.handleInbound('c1', 'sms', 'looking for a powerbank');
  await agent.handleInbound('c1', 'rcs', 'ok continue');
  const conv = await store.getConversation('c1');
  const chans = conv.turns.map(t => t.channel);
  assert.ok(chans.includes('sms') && chans.includes('rcs'), 'cross-channel turns stored');
});

test('order flow: search, cart, place order across channels', async () => {
  MockAdapter.reset();
  const { agent, store } = makeAgent((input) => {
    if (input.includes('powerbank')) return [{ name: 'search_catalog', args: { query: 'powerbank' } }];
    if (input.includes('add')) return [{ name: 'add_to_cart', args: { sku: 'PS-5X', qty: '2' } }];
    if (input.includes('order')) return [{ name: 'place_order', args: {} }];
    return [];
  });
  await agent.handleInbound('c1', 'sms', 'powerbank');
  await agent.handleInbound('c1', 'rcs', 'add two of the 5000');
  await agent.handleInbound('c1', 'whatsapp', 'place my order');
  const conv = await store.getConversation('c1');
  assert.ok(conv.pendingOrder && conv.pendingOrder.status === 'placed');
  assert.deepStrictEqual(conv.cart, [{ sku: 'PS-5X', qty: 2 }]);
  assert.ok(MockAdapter.sent.some(m => m.channel === 'sms' && m.text.includes('PS-5X')));
  assert.ok(MockAdapter.sent.some(m => m.channel === 'whatsapp' && m.text.includes('298 PLN')));
});

test('channel handoff: agent sends email receipt on request from chat channel', async () => {
  MockAdapter.reset();
  const { agent } = makeAgent((input) =>
    input.includes('receipt') ? [{ name: 'send_via_channel', args: { channel: 'email', text: 'Your receipt' } }] : []
  );
  await agent.handleInbound('c1', 'sms', 'send me the receipt by email');
  const email = MockAdapter.sent.find(m => m.channel === 'email');
  assert.ok(email, 'email was sent');
  assert.strictEqual(email.to, 'demo@example.com');
  assert.strictEqual(email.text, 'Your receipt');
});

test('mock mode has no live adapters', async () => {
  const channels = buildChannels('mock');
  assert.ok(channels.all().every(c => !c.live));
});
