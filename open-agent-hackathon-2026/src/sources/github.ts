import type { Opportunity, SourceProvider } from '../types.js';
import { FixtureSource } from './fixtures.js';
export interface GitHubOptions { fetcher?: typeof fetch; onWarning?: (message: string) => void }
export class GitHubSource implements SourceProvider {
  readonly name = 'github:bounty-issues';
  constructor(private readonly options: GitHubOptions = {}) {}
  async fetch(): Promise<Opportunity[]> {
    try {
      const url = new URL('https://api.github.com/search/issues');
      url.search = new URLSearchParams({ q: 'is:issue is:open label:bounty', sort: 'updated', order: 'desc', per_page: '20' }).toString();
      const response = await (this.options.fetcher ?? fetch)(url, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'opportunity-radar', 'X-GitHub-Api-Version': '2022-11-28' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object' || !('items' in data) || !Array.isArray(data.items)) throw new Error('Malformed GitHub search response');
      return data.items.map((item: unknown): Opportunity => {
        if (!item || typeof item !== 'object') throw new Error('Malformed GitHub issue');
        const issue = item as Record<string, unknown>;
        if (typeof issue.number !== 'number' || typeof issue.html_url !== 'string' || typeof issue.title !== 'string' || !/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/.test(issue.html_url)) throw new Error('Malformed GitHub issue');
        const tags = Array.isArray(issue.labels) ? issue.labels.flatMap((label: unknown) => typeof label === 'object' && label !== null && 'name' in label && typeof label.name === 'string' ? [label.name] : []) : [];
        return { id: `github:${issue.html_url}`, title: issue.title, description: typeof issue.body === 'string' ? issue.body.slice(0, 4000) : '', kind: 'issue', tags, evidence: [{ url: issue.html_url, source: this.name }] };
      });
    } catch (error) {
      this.options.onWarning?.(`GitHub unavailable (${error instanceof Error ? error.message : 'unknown error'}); using synthetic fixture data.`);
      return new FixtureSource('github').fetch();
    }
  }
}
