import { readFile } from 'node:fs/promises';
import type { Opportunity, SourceProvider } from '../types.js';
export type FixtureName = 'hackathons' | 'bounties' | 'github';
export class FixtureSource implements SourceProvider {
  readonly name: string;
  constructor(private readonly fixture: FixtureName) { this.name = `fixture:${fixture}`; }
  async fetch(): Promise<Opportunity[]> {
    const data: unknown = JSON.parse(await readFile(new URL(`../../test/fixtures/${this.fixture}.json`, import.meta.url), 'utf8'));
    if (!Array.isArray(data)) throw new Error('Fixture must contain an array');
    return data as Opportunity[];
  }
}
