import { EventBus } from './eventBus.js';
import { SceneEngine, type Scene } from './sceneEngine.js';
import { VoteEngine } from './voteEngine.js';
import type { ChatEvent, SourceStatus } from '../twitch/chatSource.js';
export class Studio {
  readonly bus = new EventBus();
  readonly votes: VoteEngine;
  readonly scenes: SceneEngine;
  private listeners = new Set<() => void>();
  private source: { status: SourceStatus; detail: string } = { status: 'stopped', detail: '' };
  private playback: Scene | null = null;
  private playbackVersion = 0;
  private lastVoteResult = '';
  constructor(readonly seed: string, readonly mode: 'fixture' | 'live', clock: () => number = Date.now) {
    this.votes = new VoteEngine(clock);
    this.scenes = new SceneEngine(seed);
    this.bus.subscribe(event => { this.lastVoteResult = this.votes.vote(event); this.notify(); });
  }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify(): void { for (const listener of this.listeners) listener(); }
  ingest(event: ChatEvent): void { if (!this.bus.publish(event)) this.notify(); }
  setSource(status: SourceStatus, detail = ''): void { this.source = { status, detail }; this.notify(); }
  tick(): void { if (this.votes.tick()) this.notify(); }
  command(action: string, payload: Record<string, unknown>): void {
    switch (action) {
      case 'open': this.votes.open(typeof payload.durationMs === 'number' ? payload.durationMs : 15_000); break;
      case 'close': this.votes.close(); break;
      case 'discard': this.votes.discard(); break;
      case 'approve': {
        const round = this.votes.approve();
        this.playback = this.scenes.apply(round); this.playbackVersion++; break;
      }
      case 'undo': this.playback = this.scenes.undo(); this.playbackVersion++; break;
      case 'replay':
        if (payload.sceneId !== undefined && (!Number.isInteger(payload.sceneId) || typeof payload.sceneId !== 'number')) throw new Error('Invalid scene id');
        this.playback = this.scenes.replay(payload.sceneId as number | undefined); this.playbackVersion++; break;
      default: throw new Error('Unknown moderator command');
    }
    this.notify();
  }
  snapshot() {
    return { mode: this.mode, seed: this.seed, source: { ...this.source }, round: this.votes.snapshot(),
      scene: this.scenes.current(), playback: structuredClone(this.playback), playbackVersion: this.playbackVersion,
      history: this.scenes.history(), stats: { accepted: this.bus.accepted, duplicates: this.bus.duplicates, invalid: this.bus.invalid },
      lastVoteResult: this.lastVoteResult };
  }
  serialize(): string { return JSON.stringify(this.snapshot(), null, 2); }
}
