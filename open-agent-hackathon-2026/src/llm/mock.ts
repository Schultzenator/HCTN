import { createHash } from 'node:crypto';
import type { Assessment, ModelProvider, Opportunity } from '../types.js';
export class MockModelProvider implements ModelProvider {
  readonly name = 'deterministic mock (no external LLM)';
  async rank(opportunities: readonly Opportunity[], profile: string): Promise<Assessment[]> {
    const terms = new Set(profile.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? []);
    return opportunities.map(record => {
      const matches = record.tags.filter(tag => terms.has(tag.toLowerCase()));
      const tieBreak = createHash('sha256').update(record.id).digest()[0]! % 10;
      return {
        id: record.id,
        score: Math.min(100, 40 + matches.length * 15 + Math.min(record.evidence.length, 3) * 3 + tieBreak),
        reason: matches.length ? `Profile tag matches: ${matches.join(', ')}. ${record.evidence.length} evidence link(s).` : `No exact profile tag match; ${record.evidence.length} evidence link(s).`,
      };
    });
  }
}
