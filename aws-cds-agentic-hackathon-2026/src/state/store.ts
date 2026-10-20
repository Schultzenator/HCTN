import type { Channel } from '../channels/types.js';

export interface CustomerProfile {
  customerId: string;
  /** Delivery address used for order placement. */
  address: string;
  email: string;
  phone: string;
  preferredChannel: Channel;
  marketingOptIn: boolean;
}

/**
 * Conversation state - the backbone of cross-channel continuity.
 * A thread started on SMS continues on RCS with full context,
 * because every turn is stored against the customer, not the channel.
 */
export interface Conversation {
  customerId: string;
  turns: { channel: Channel; role: 'customer' | 'agent'; text: string; ts: string }[];
  cart: { sku: string; qty: number }[];
  lastChannel: Channel;
  pendingOrder?: { orderId: string; status: 'scheduled' | 'placed' | 'delivered' };
}

export interface StateStore {
  getConversation(customerId: string): Promise<Conversation>;
  appendTurn(customerId: string, channel: Channel, role: 'customer' | 'agent', text: string): Promise<void>;
  addToCart(customerId: string, sku: string, qty: number): Promise<void>;
  setOrder(customerId: string, orderId: string): Promise<void>;
  getProfile(customerId: string): Promise<CustomerProfile>;
}

export class MemoryStore implements StateStore {
  private conversations = new Map<string, Conversation>();
  private profiles = new Map<string, CustomerProfile>();

  seedProfiles(list: CustomerProfile[]) { for (const p of list) this.profiles.set(p.customerId, p); }

  async getProfile(customerId: string) {
    const p = this.profiles.get(customerId);
    if (!p) throw new Error('unknown customer ' + customerId);
    return p;
  }
  async getConversation(customerId: string) {
    let c = this.conversations.get(customerId);
    if (!c) { c = { customerId, turns: [], cart: [], lastChannel: 'sms' }; this.conversations.set(customerId, c); }
    return c;
  }
  async appendTurn(customerId: string, channel: Channel, role: 'customer' | 'agent', text: string) {
    const c = await this.getConversation(customerId);
    c.turns.push({ channel, role, text, ts: new Date().toISOString() });
    c.lastChannel = channel;
  }
  async addToCart(customerId: string, sku: string, qty: number) {
    const c = await this.getConversation(customerId);
    const line = c.cart.find(l => l.sku === sku);
    if (line) line.qty += qty; else c.cart.push({ sku, qty });
  }
  async setOrder(customerId: string, orderId: string) {
    const c = await this.getConversation(customerId);
    c.pendingOrder = { orderId, status: 'placed' };
  }
}
