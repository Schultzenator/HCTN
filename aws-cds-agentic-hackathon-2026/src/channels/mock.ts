import type { Channel, ChannelAdapter, OutboundMessage } from './types.js';

/** Collects outbound traffic in memory; used by tests and the offline demo. */
export class MockAdapter implements ChannelAdapter {
  readonly live = false;
  static sent: OutboundMessage[] = [];
  constructor(public readonly channel: Channel) {}
  async send(msg: OutboundMessage) {
    MockAdapter.sent.push(msg);
    return { messageId: 'mock-' + Math.random().toString(36).slice(2, 10), provider: 'mock' };
  }
  static reset() { MockAdapter.sent = []; }
}
