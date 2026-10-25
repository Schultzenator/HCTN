export type Channel = 'sms' | 'rcs' | 'whatsapp' | 'email';

export interface InboundMessage {
  channel: Channel;
  /** End-user phone number (E.164) or email address. */
  from: string;
  text: string;
  /** Provider message id, for idempotency. */
  messageId: string;
}

export interface OutboundMessage {
  channel: Channel;
  to: string;
  text: string;
  /** Rich content (RCS cards, WhatsApp interactive). Provider-specific JSON. */
  rich?: Record<string, unknown>;
}

export interface ChannelAdapter {
  readonly channel: Channel;
  /** True when the adapter talks to a real AWS CDS service. */
  readonly live: boolean;
  send(msg: OutboundMessage): Promise<{ messageId: string; provider: string }>;
}
