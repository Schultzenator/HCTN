import type { Channel, ChannelAdapter } from './types.js';
import { MockAdapter } from './mock.js';
import { SesAdapter } from './ses.js';
import { EumAdapter } from './eum.js';

export interface ChannelRegistry {
  get(channel: Channel): ChannelAdapter;
  all(): ChannelAdapter[];
}

export function buildChannels(mode: 'mock' | 'live' = 'mock'): ChannelRegistry {
  const make = (channel: Channel): ChannelAdapter => {
    if (mode === 'live') {
      if (channel === 'email') return new SesAdapter();
      return new EumAdapter(channel);
    }
    return new MockAdapter(channel);
  };
  const adapters: Record<string, ChannelAdapter> = {
    sms: make('sms'), rcs: make('rcs'), whatsapp: make('whatsapp'), email: make('email')
  };
  return {
    get: (c) => adapters[c],
    all: () => Object.values(adapters)
  };
}
