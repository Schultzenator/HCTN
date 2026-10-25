import { buildChannels } from '../channels/index.js';
import { MemoryStore } from '../state/store.js';
import { OmniLoopAgent } from '../agent/loop.js';
import { ScriptedModel } from '../bedrock/model.js';
import { MockAdapter } from '../channels/mock.js';
import type { Channel } from '../channels/types.js';
import { CATALOG } from '../agent/tools.js';
import type { ToolCall } from '../bedrock/model.js';

/**
 * Offline demo: the cross-channel story from the hackathon brief, as commerce.
 * 1. Customer asks on SMS about powerbanks -> agent searches catalog, answers.
 * 2. Customer switches to RCS -> agent continues with full history (no re-asking).
 * 3. Customer orders on RCS -> agent places order.
 * 4. Customer asks for receipt on email (SES) -> agent sends it cross-channel.
 */
const store = new MemoryStore();
store.seedProfiles([
  { customerId: 'c1', address: 'ul. Przykladowa 1, Nysa', email: 'demo@example.com', phone: '+48600100200', preferredChannel: 'sms', marketingOptIn: true }
]);
const channels = buildChannels('mock');

const plan: { input: string; calls: ToolCall[] }[] = [
  { input: 'hey, what powerbanks do you have?', calls: [{ name: 'search_catalog', args: { query: 'powerbank' } }] },
  { input: 'ok switching to RCS - add 2 of the 5000 one to my cart', calls: [{ name: 'add_to_cart', args: { sku: 'PS-5X', qty: '2' } }] },
  { input: 'placing the order now', calls: [{ name: 'place_order', args: {} }] },
  { input: 'send the receipt to my email please', calls: [{ name: 'send_via_channel', args: { channel: 'email', text: 'Your OmniLoop receipt for order - thank you!' } }] }
];
const flow: Channel[] = ['sms', 'rcs', 'rcs', 'rcs'];
let step = 0;

const model = new ScriptedModel((input) => {
  const s = plan[Math.min(step, plan.length - 1)];
  return { text: '', toolCalls: s.input === input ? s.calls : [] };
});
const agent = new OmniLoopAgent({ model, store, channels });

console.log('=== OmniLoop cross-channel demo (mock channels) ===');
MockAdapter.reset();
for (let i = 0; i < plan.length; i++) {
  step = i;
  if (i === 3) {
    const conversation = await store.getConversation('c1');
    const total = conversation.cart.reduce((sum, line) => sum + CATALOG[line.sku].pricePln * line.qty, 0);
    plan[i].calls[0].args.text = 'Your OmniLoop receipt: ' + conversation.pendingOrder?.orderId +
      ', 2x PowerMax 5000 powerbank, total ' + total + ' PLN. Thank you!';
  }
  const reply = await agent.handleInbound('c1', flow[i], plan[i].input);
  console.log('[customer/' + flow[i] + '] ' + plan[i].input);
  console.log('[agent] ' + reply + '\n');
}
console.log('--- Outbound traffic (what AWS CDS would deliver) ---');
for (const m of MockAdapter.sent) console.log(m.channel + ' -> ' + m.to + ': ' + m.text);

