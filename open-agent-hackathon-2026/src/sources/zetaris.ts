import { randomUUID } from 'node:crypto';
import type { Opportunity, SourceProvider } from '../types.js';

export interface ZetarisConfig {
  baseUrl: string;
  orgId: string;
  apiKey: string;
  sql: string;
  fetcher?: typeof fetch;
}

interface ZetarisResponse { headers?: unknown; data?: unknown; rows?: unknown; }

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function rowToOpportunity(row: Record<string, unknown>, index: number): Opportunity {
  const evidenceUrl = asString(row.evidenceUrl ?? row.url, 'https://zetaris.com');
  const kind = row.kind === 'hackathon' || row.kind === 'bounty' || row.kind === 'issue' ? row.kind : 'issue';
  const tags = Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === 'string') : ['zetaris'];
  return {
    id: asString(row.id, `zetaris:${index + 1}`),
    title: asString(row.title ?? row.name, `Zetaris opportunity ${index + 1}`),
    description: asString(row.description ?? row.summary, 'Opportunity returned by Zetaris federated query.'),
    kind,
    tags,
    evidence: [{ url: evidenceUrl, source: 'zetaris' }],
  };
}

export class ZetarisSource implements SourceProvider {
  readonly name = 'zetaris';
  private readonly fetcher: typeof fetch;

  constructor(private readonly config: ZetarisConfig) { this.fetcher = config.fetcher ?? fetch; }

  async fetch(): Promise<Opportunity[]> {
    if (!this.config.baseUrl || !this.config.orgId || !this.config.apiKey || !this.config.sql) {
      throw new Error('Zetaris requires ZETARIS_BASE_URL, ZETARIS_ORG_ID, ZETARIS_API_KEY and ZETARIS_SQL');
    }
    const endpoint = new URL('/api/v1.0/sql-editor/sqls/run-query', this.config.baseUrl).toString();
    const response = await this.fetcher(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json', 'X-Org-ID': this.config.orgId, 'X-Request-ID': randomUUID() },
      body: JSON.stringify({ sql: this.config.sql }),
    });
    if (!response.ok) throw new Error(`Zetaris query failed (${response.status})`);
    const payload = asRecord(await response.json() as ZetarisResponse);
    const headers = Array.isArray(payload.headers) ? payload.headers.filter((header): header is string => typeof header === 'string') : [];
    const rawRows = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.rows) ? payload.rows : [];
    const rows = rawRows.map((rawRow) => Array.isArray(rawRow) ? Object.fromEntries(headers.map((header, index) => [header, rawRow[index]])) : asRecord(rawRow));
    return rows.map(rowToOpportunity);
  }
}

export function zetarisConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ZetarisConfig {
  return { baseUrl: env.ZETARIS_BASE_URL ?? '', orgId: env.ZETARIS_ORG_ID ?? '', apiKey: env.ZETARIS_API_KEY ?? '', sql: env.ZETARIS_SQL ?? 'SELECT * FROM opportunity_radar.opportunities' };
}
