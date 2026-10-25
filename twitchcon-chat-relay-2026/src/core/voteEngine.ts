import type { ChatEvent } from '../twitch/chatSource.js';
export const ACTIONS = ['explore', 'help', 'build'] as const;
export type Action = typeof ACTIONS[number];
export interface VoteRound {
  id: number;
  status: 'open' | 'closed' | 'approved';
  openedAt: number;
  deadline: number;
  votes: { userId: string; displayName: string; action: Action }[];
  counts: Record<Action, number>;
  winner: Action | null;
}
export type VoteResult = 'accepted' | 'rate-limited' | 'already-voted' | 'ignored' | 'closed';
export class VoteEngine {
  private round: VoteRound | null = null;
  private nextId = 1;
  private attempts = new Map<string, number>();
  constructor(private readonly clock: () => number = Date.now, private readonly rateLimitMs = 1000) {}
  open(durationMs = 15_000): VoteRound {
    this.tick();
    if (this.round && this.round.status !== 'approved') throw new Error('Approve or discard the current round first');
    if (!Number.isInteger(durationMs) || durationMs < 1000 || durationMs > 300_000) throw new Error('Duration must be 1–300 seconds');
    const now = this.clock();
    this.attempts.clear();
    this.round = { id: this.nextId++, status: 'open', openedAt: now, deadline: now + durationMs,
      votes: [], counts: { explore: 0, help: 0, build: 0 }, winner: null };
    return this.snapshot()!;
  }
  vote(event: ChatEvent): VoteResult {
    this.tick();
    if (!this.round || this.round.status !== 'open') return 'closed';
    const match = /^!vote\s+(explore|help|build)\s*$/i.exec(event.text.trim());
    if (!match) return 'ignored';
    const now = this.clock();
    const previous = this.attempts.get(event.userId);
    if (previous !== undefined && now - previous < this.rateLimitMs) return 'rate-limited';
    // Bound rate-limit memory to the same 10k-user cap as the vote ledger.
    if (this.attempts.size >= 10_000 && previous === undefined) return 'ignored';
    this.attempts.set(event.userId, now);
    if (this.round.votes.some(v => v.userId === event.userId)) return 'already-voted';
    const action = match[1]!.toLowerCase() as Action;
    this.round.votes.push({ userId: event.userId, displayName: event.displayName, action });
    this.round.counts[action]++;
    return 'accepted';
  }
  tick(): boolean {
    if (this.round?.status === 'open' && this.clock() >= this.round.deadline) { this.close(); return true; }
    return false;
  }
  close(): VoteRound {
    if (!this.round || this.round.status !== 'open') throw new Error('No open vote');
    this.round.status = 'closed';
    const best = Math.max(...ACTIONS.map(a => this.round!.counts[a]));
    // Fixed palette order is the explicit deterministic tie-break rule.
    this.round.winner = best > 0 ? ACTIONS.find(a => this.round!.counts[a] === best)! : null;
    return this.snapshot()!;
  }
  approve(): VoteRound {
    this.tick();
    if (!this.round || this.round.status !== 'closed' || !this.round.winner) throw new Error('Close a non-empty vote before approving');
    this.round.status = 'approved';
    return this.snapshot()!;
  }
  discard(): void { this.round = null; this.attempts.clear(); }
  snapshot(): VoteRound | null { return structuredClone(this.round); }
}
