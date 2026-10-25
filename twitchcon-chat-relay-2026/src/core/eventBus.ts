import { isChatEvent, type ChatEvent } from '../twitch/chatSource.js';

/** Synchronous FIFO dispatch; retained message IDs survive source reconnects. */
export class EventBus {
  private seen = new Map<string, true>();
  private buffer: ChatEvent[] = [];
  private listeners = new Set<(event: ChatEvent) => void>();
  private queue: ChatEvent[] = [];
  private dispatching = false;
  accepted = 0;
  duplicates = 0;
  invalid = 0;
  constructor(private readonly dedupCapacity = 20_000, private readonly replayCapacity = 200) {
    if (dedupCapacity < 1 || replayCapacity < 1) throw new Error('Bus capacities must be positive');
  }
  subscribe(listener: (event: ChatEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  publish(event: ChatEvent): boolean {
    if (!isChatEvent(event)) { this.invalid++; return false; }
    if (this.seen.has(event.id)) { this.duplicates++; return false; }
    const copy = { ...event };
    this.seen.set(copy.id, true);
    if (this.seen.size > this.dedupCapacity) this.seen.delete(this.seen.keys().next().value!);
    this.accepted++;
    this.buffer.push(copy);
    if (this.buffer.length > this.replayCapacity) this.buffer.shift();
    this.queue.push(copy);
    if (this.dispatching) return true;
    this.dispatching = true;
    try {
      while (this.queue.length) {
        const next = this.queue.shift()!;
        for (const listener of this.listeners) listener({ ...next });
      }
    } finally { this.dispatching = false; }
    return true;
  }
  replay(): ChatEvent[] { return this.buffer.map(event => ({ ...event })); }
}
