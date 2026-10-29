import assert from 'node:assert/strict';
import test from 'node:test';
import { ZetarisSource, zetarisConfigFromEnv } from '../sources/zetaris.js';

test('Zetaris adapter posts SQL and maps tabular response to opportunities', async () => {
  let request: Request | undefined;
  const source = new ZetarisSource({
    baseUrl: 'https://api.enterprise.zetaris.com', orgId: 'demo-org', apiKey: 'secret', sql: 'SELECT * FROM radar',
    fetcher: async (input, init) => {
      request = new Request(input, init);
      return new Response(JSON.stringify({ headers: ['id', 'title', 'description', 'url'], data: [['a', 'A', 'D', 'https://example.com/a']] }), { status: 200 });
    },
  });
  const opportunities = await source.fetch();
  assert.equal(opportunities[0]?.title, 'A');
  assert.equal(opportunities[0]?.evidence[0]?.source, 'zetaris');
  assert.equal(request?.headers.get('X-Org-ID'), 'demo-org');
  assert.equal(request?.headers.get('Authorization'), 'Bearer secret');
  assert.deepEqual(await request?.json(), { sql: 'SELECT * FROM radar' });
});

test('Zetaris env config has no secret defaults', () => {
  const config = zetarisConfigFromEnv({ ZETARIS_BASE_URL: 'https://example.test', ZETARIS_ORG_ID: '1' });
  assert.equal(config.apiKey, '');
  assert.match(config.sql, /opportunity_radar/);
});
