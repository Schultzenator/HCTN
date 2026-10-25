import type { StateStore } from '../state/store.js';
import type { ChannelRegistry } from '../channels/index.js';
import type { Channel } from '../channels/types.js';

export const CATALOG: Record<string, { name: string; pricePln: number; stock: number }> = {
  'PS-5X': { name: 'PowerMax 5000 powerbank', pricePln: 149, stock: 42 },
  'PS-3X': { name: 'PowerMax 3000 powerbank', pricePln: 99, stock: 60 },
  'CH-USB-C': { name: 'USB-C braided cable 2m', pricePln: 39, stock: 180 },
  'CH-GAN': { name: 'GaN 65W charger', pricePln: 129, stock: 25 }
};

export interface ToolContext {
  store: StateStore;
  channels: ChannelRegistry;
  customerId: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, string>;
  run(args: Record<string, string>, ctx: ToolContext): Promise<string>;
}

export const tools: Tool[] = [
  {
    name: 'search_catalog',
    description: 'Search products by free-text query. Returns SKU, name, price (PLN) and stock.',
    parameters: { query: 'free text search, e.g. "powerbank" or "charger"' },
    async run(args) {
      const q = (args.query ?? '').toLowerCase();
      const hits = Object.entries(CATALOG)
        .filter(([sku, p]) => sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
        .map(([sku, p]) => sku + ': ' + p.name + ' - ' + p.pricePln + ' PLN (' + p.stock + ' in stock)');
      return hits.length ? hits.join('; ') : 'no products found';
    }
  },
  {
    name: 'add_to_cart',
    description: 'Add a quantity of a product SKU to the customer cart.',
    parameters: { sku: 'product SKU', qty: 'quantity as digits' },
    async run(args, { store, customerId }) {
      const sku = args.sku ?? '';
      if (!CATALOG[sku]) return 'ERROR unknown sku ' + sku;
      const qty = Math.max(1, parseInt(args.qty ?? '1', 10));
      if (qty > CATALOG[sku].stock) return 'ERROR only ' + CATALOG[sku].stock + ' in stock';
      await store.addToCart(customerId, sku, qty);
      return 'added ' + qty + 'x ' + sku;
    }
  },
  {
    name: 'place_order',
    description: 'Place an order for the current cart and send confirmation. Returns order id and total.',
    parameters: {},
    async run(_args, { store, customerId }) {
      const conv = await store.getConversation(customerId);
      if (conv.cart.length === 0) return 'ERROR cart is empty';
      const total = conv.cart.reduce((s, l) => s + CATALOG[l.sku].pricePln * l.qty, 0);
      const orderId = 'ORD-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      await store.setOrder(customerId, orderId);
      const lines = conv.cart.map(l => l.qty + 'x ' + CATALOG[l.sku].name).join(', ');
      return 'order ' + orderId + ' placed (' + lines + ') total ' + total + ' PLN';
    }
  },
  {
    name: 'send_via_channel',
    description: 'Send a message to the customer on a specific channel: sms, rcs, whatsapp or email. Use when the customer asks to continue elsewhere (e.g. "send receipt to email").',
    parameters: { channel: 'sms|rcs|whatsapp|email', text: 'message text' },
    async run(args, { store, channels, customerId }) {
      const channel = args.channel as Channel;
      const profile = await store.getProfile(customerId);
      const to = channel === 'email' ? profile.email : profile.phone;
      const res = await channels.get(channel).send({ channel, to, text: args.text ?? '' });
      await store.appendTurn(customerId, channel, 'agent', args.text ?? '');
      return 'sent on ' + channel + ' (msg ' + res.messageId + ')';
    }
  },
  {
    name: 'get_conversation_history',
    description: 'Read the cross-channel conversation history with the customer, including channel of each turn.',
    parameters: {},
    async run(_args, { store, customerId }) {
      const conv = await store.getConversation(customerId);
      if (conv.turns.length === 0) return 'no history yet';
      return conv.turns.map(t => '[' + t.channel + '] ' + t.role + ': ' + t.text).join(' | ');
    }
  }
];

export function findTool(name: string) { return tools.find(t => t.name === name); }
