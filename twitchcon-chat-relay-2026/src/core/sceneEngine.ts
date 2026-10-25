import type { Action, VoteRound } from './voteEngine.js';
export const TEMPLATES = [
  { id: 'forest', title: 'The Lantern Forest', symbol: '✦', place: 'beneath the glowing canopy', color: '#4de3b0',
    details: ['a river of fireflies', 'an ancient singing oak', 'a trail of silver leaves'] },
  { id: 'harbor', title: 'The Cloud Harbor', symbol: '☁', place: 'above the drifting islands', color: '#8cbdff',
    details: ['a ship made of starlight', 'a lighthouse in the clouds', 'a fleet of paper birds'] },
  { id: 'citadel', title: 'The Clockwork Citadel', symbol: '⚙', place: 'inside the brass city', color: '#ffcb70',
    details: ['a sleeping copper giant', 'a garden of tiny gears', 'a bridge between clock towers'] }
] as const;
export interface Scene {
  id: number; roundId: number; seed: number; template: typeof TEMPLATES[number]['id'];
  title: string; symbol: string; color: string; action: Action; narrative: string; contributors: string[];
}
function hash(text: string): number {
  let value = 2166136261;
  for (const char of text) { value ^= char.charCodeAt(0); value = Math.imul(value, 16777619); }
  return value >>> 0;
}
export class SceneEngine {
  private scenes: Scene[] = [];
  constructor(private readonly sessionSeed: string) {}
  apply(round: VoteRound): Scene {
    if (round.status !== 'approved' || !round.winner) throw new Error('Only moderator-approved winners can create scenes');
    if (this.scenes.some(s => s.roundId === round.id)) throw new Error('Round already applied');
    const id = (this.scenes.at(-1)?.id ?? 0) + 1;
    const seed = hash(`${this.sessionSeed}:${id}:${round.id}:${round.winner}`);
    // Cycle all three templates; seed picks the detail within each template.
    const template = TEMPLATES[(id - 1) % TEMPLATES.length]!;
    const detail = template.details[seed % template.details.length]!;
    const phrases: Record<Action, string> = {
      explore: `The party discovers ${detail}`,
      help: `The party comes together to protect ${detail}`,
      build: `The party builds a new home beside ${detail}`
    };
    const scene: Scene = { id, roundId: round.id, seed, template: template.id, title: template.title,
      symbol: template.symbol, color: template.color, action: round.winner,
      narrative: `${phrases[round.winner]} ${template.place}. The next chapter belongs to chat.`,
      contributors: round.votes.filter(v => v.action === round.winner).slice(0, 12).map(v => v.displayName) };
    this.scenes.push(scene);
    if (this.scenes.length > 100) this.scenes.shift();
    return structuredClone(scene);
  }
  undo(): Scene | null {
    if (!this.scenes.length) throw new Error('No scene to undo');
    this.scenes.pop();
    return this.current();
  }
  replay(id?: number): Scene {
    const scene = id === undefined ? this.scenes.at(-1) : this.scenes.find(s => s.id === id);
    if (!scene) throw new Error('Scene not found');
    return structuredClone(scene);
  }
  current(): Scene | null { return structuredClone(this.scenes.at(-1) ?? null); }
  history(): Scene[] { return structuredClone(this.scenes); }
}
