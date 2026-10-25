import express from 'express';
import { buildChannels } from '../channels/index.js';
import { MemoryStore } from '../state/store.js';
import { OmniLoopAgent } from '../agent/loop.js';
import { BedrockModel, ScriptedModel } from '../bedrock/model.js';
import type { Channel } from '../channels/types.js';

/**
 * Inbound webhook server. AWS CDS delivery events (EUM two-way messaging,
 * SES inbound receipt) POST here; the agent answers on the originating channel.
 * Run: OMNILOOP_MODE=mock|live npm start
 */
const mode = (process.env.OMNILOOP_MODE as 'mock' | 'live') ?? 'mock';
const store = new MemoryStore();
store.seedProfiles([
  { customerId: 'c1', address: 'ul. Przykladowa 1, Nysa', email: 'demo@example.com', phone: '+48600100200', preferredChannel: 'sms', marketingOptIn: true }
]);
const channels = buildChannels(mode);
const model = mode === 'live' ? new BedrockModel() : new ScriptedModel((input) => ({ text: '', toolCalls: input.includes('receipt') ? [{ name: 'send_via_channel', args: { channel: 'email', text: 'receipt' } }] : [] }));
const agent = new OmniLoopAgent({ model, store, channels });

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true, mode, channels: channels.all().map(c => ({ channel: c.channel, live: c.live })) }));

/** EUM inbound: { channel, from, text, messageId }. */
app.post('/webhook/eum', async (req, res) => {
  const { channel, from, text, messageId } = req.body ?? {};
  if (!channel || !from || !text) { res.status(400).json({ error: 'channel, from, text required' }); return; }
  const reply = await agent.handleInbound('c1', channel as Channel, String(text));
  res.json({ echo: reply, messageId });
});

/** SES inbound (receipt rule -> SNS -> here): parse common headers/body. */
app.post('/webhook/ses', async (req, res) => {
  const from = req.body?.mail?.commonHeaders?.from?.[0] ?? 'unknown';
  const text = req.body?.content ?? req.body?.text ?? '';
  const reply = await agent.handleInbound('c1', 'email', String(text));
  res.json({ echo: reply, from });
});

const port = parseInt(process.env.PORT ?? '3002', 10);
app.listen(port, () => console.log('OmniLoop webhook server on :' + port + ' (' + mode + ')'));
