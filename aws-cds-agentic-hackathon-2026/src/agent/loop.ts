import type { Model, ChatTurn } from '../bedrock/model.js';
import { findTool, tools } from './tools.js';
import type { StateStore } from '../state/store.js';
import type { ChannelRegistry } from '../channels/index.js';
import type { Channel } from '../channels/types.js';

const SYSTEM = 'You are OmniLoop, an agentic commerce assistant. You help customers over SMS, RCS, WhatsApp and email. ' +
  'You keep full cross-channel context: when a customer moves to another channel, continue the conversation where it stopped. ' +
  'Use the provided tools to search products, manage the cart, place orders and send messages on requested channels. ' +
  'Be concise - messages must fit a text bubble. Currency is PLN.';

export interface AgentDeps {
  model: Model;
  store: StateStore;
  channels: ChannelRegistry;
}

/**
 * The agentic loop (AgentCore-style): observe inbound message -> decide -> act (tools) -> respond,
 * always writing every turn to the shared conversation state so the thread survives channel switches.
 */
export class OmniLoopAgent {
  constructor(private deps: AgentDeps) {}

  async handleInbound(customerId: string, channel: Channel, text: string): Promise<string> {
    const { model, store, channels } = this.deps;
    await store.appendTurn(customerId, channel, 'customer', text);
    const conv = await store.getConversation(customerId);
    const ctx = { store, channels, customerId };
    const history: ChatTurn[] = [];
    for (const t of conv.turns.slice(-20)) {
      history.push({ role: t.role === 'customer' ? 'user' : 'assistant', text: '[' + t.channel + '] ' + t.text });
    }
    const out = await model.reply(SYSTEM, history, tools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })));
    const results: string[] = [];
    for (const call of out.toolCalls) {
      const tool = findTool(call.name);
      if (!tool) { results.push('ERROR no tool ' + call.name); continue; }
      results.push(await tool.run(call.args, ctx));
    }
    let reply = out.text;
    if (results.length) reply = (reply ? reply + ' ' : '') + results.map(r => '[' + r + ']').join(' ');
    await store.appendTurn(customerId, channel, 'agent', reply);
    // Echo back on the same channel the customer wrote from.
    const profile = await store.getProfile(customerId);
    const to = channel === 'email' ? profile.email : profile.phone;
    await channels.get(channel).send({ channel, to, text: reply });
    return reply;
  }
}
