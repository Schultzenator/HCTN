import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { canonicalUrl, deduplicate, federate, FixtureSource, GitHubSource, MockModelProvider, OpenAIModelProvider, rankOpportunities, renderMarkdown } from '../index.js';
import type { ModelProvider, Opportunity } from '../types.js';
const record = (id: string, urls = [`https://example.org/${id}`]): Opportunity => ({ id, title: `Title ${id}`, description: 'Description', kind: 'bounty', tags: ['typescript'], evidence: urls.map(url => ({ url, source: 'test' })) });
const responseFetch = (body: unknown, status = 200): typeof fetch => async () => new Response(JSON.stringify(body), { status });
const model = new MockModelProvider();

test('canonical URLs remove tracking, fragment and trailing slash but preserve identity queries', () => {
  assert.equal(canonicalUrl('https://EXAMPLE.org/event/?utm_source=x#top'), 'https://example.org/event');
  assert.notEqual(canonicalUrl('https://example.org/?id=1'), canonicalUrl('https://example.org/?id=2'));
  assert.equal(canonicalUrl('https://github.com/Example/Repo/issues/42'), 'https://github.com/example/repo/issues/42');
});
test('reject unsafe, malformed and credential-bearing evidence URLs', () => {
  for (const url of ['javascript:alert(1)', 'file:///tmp/data', 'no-url', 'https://user:secret@example.org']) assert.equal(canonicalUrl(url), undefined);
});
test('dedup merges canonical evidence and preserves independent source attributions', () => {
  const a = record('a', ['https://example.org/shared?utm_source=x']);
  const b = { ...record('b', ['https://example.org/shared']), tags: ['Data', 'typescript'], evidence: [{ url: 'https://example.org/shared', source: 'other' }] };
  const merged = deduplicate([a, b]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]!.evidence.length, 2);
  assert.deepEqual(merged[0]!.tags, ['data', 'typescript']);
  assert.equal(a.evidence[0]!.url, 'https://example.org/shared?utm_source=x');
});
test('dedup joins transitive bridge records independent of order', () => {
  const a = record('a', ['https://example.org/a']);
  const b = record('b', ['https://example.org/b']);
  const bridge = record('bridge', ['https://example.org/a', 'https://example.org/b']);
  assert.equal(deduplicate([a, b, bridge]).length, 1);
  assert.deepEqual(deduplicate([a, b, bridge]), deduplicate([bridge, b, a]));
});
test('same titles alone do not merge distinct opportunities', () => {
  assert.equal(deduplicate([record('a'), { ...record('b'), title: 'Title a' }]).length, 2);
});
test('federates all fixture source types and deduplicates eight to six records', async () => {
  const result = await federate([new FixtureSource('hackathons'), new FixtureSource('bounties'), new FixtureSource('github')]);
  assert.equal(result.opportunities.length, 8);
  assert.equal(deduplicate(result.opportunities).length, 6);
  assert.deepEqual(result.warnings, []);
});
test('source failures preserve results from healthy providers and disclose failure', async () => {
  const result = await federate([{ name: 'ok', fetch: async () => [record('ok')] }, { name: 'broken', fetch: async () => { throw new Error('offline'); } }]);
  assert.equal(result.opportunities.length, 1);
  assert.match(result.warnings[0]!, /broken failed: offline/);
});
test('evidence filter runs before model and strips invalid links', async () => {
  const spy: ModelProvider = { name: 'spy', rank: async opportunities => {
    assert.equal(opportunities.length, 1);
    assert.deepEqual(opportunities[0]!.evidence, record('valid').evidence);
    return [{ id: 'valid', score: 99, reason: 'Eligible' }];
  } };
  const mixed = { ...record('valid'), evidence: [...record('valid').evidence, { url: 'javascript:evil', source: 'bad' }] };
  const result = await rankOpportunities([record('none', []), record('bad', ['file:///x']), mixed], spy, 'typescript');
  assert.equal(result.length, 1);
});
test('empty eligible set does not call model', async () => {
  const spy: ModelProvider = { name: 'unused', rank: async () => { throw new Error('must not run'); } };
  assert.deepEqual(await rankOpportunities([record('none', [])], spy, ''), []);
});
test('mock LLM is deterministic and rewards matching profile tags', async () => {
  const rows = [record('a'), record('b')];
  assert.deepEqual(await model.rank(rows, 'typescript'), await model.rank(rows, 'typescript'));
  assert.ok((await model.rank(rows, 'typescript'))[0]!.score > (await model.rank(rows, 'design'))[0]!.score);
  const hyphenated = [{ ...record('open'), tags: ['open-source'] }];
  assert.ok((await model.rank(hyphenated, 'open-source'))[0]!.score > (await model.rank(hyphenated, 'design'))[0]!.score);
});
test('ranking sorts descending with stable ID tie break', async () => {
  const fixed: ModelProvider = { name: 'fixed', rank: async () => [ { id: 'a', score: 50, reason: 'a' }, { id: 'b', score: 90, reason: 'b' }, { id: 'c', score: 90, reason: 'c' } ] };
  assert.deepEqual((await rankOpportunities([record('c'), record('a'), record('b')], fixed, '')).map(item => item.id), ['b', 'c', 'a']);
});
test('ranking rejects missing, invented, duplicate and invalid model scores', async () => {
  for (const assessments of [[], [{ id: 'invented', score: 1, reason: 'x' }], [{ id: 'a', score: 101, reason: 'x' }], [{ id: 'a', score: NaN, reason: 'x' }], [{ id: 'a', score: 1, reason: '' }]]) {
    await assert.rejects(rankOpportunities([record('a')], { name: 'bad', rank: async () => assessments }, ''), /Model|model/);
  }
  await assert.rejects(rankOpportunities([record('a'), record('b')], { name: 'duplicate', rank: async () => [{ id: 'a', score: 1, reason: 'x' }, { id: 'a', score: 2, reason: 'x' }] }, ''), /duplicate/);
});
test('ranking rejects ambiguous duplicate input IDs', async () => {
  await assert.rejects(rankOpportunities([record('a'), record('a')], model, ''), /unique/);
});
test('GitHub maps API issues without authentication', async () => {
  const source = new GitHubSource({ fetcher: async (input, init) => {
    assert.match(String(input), /api.github.com\/search\/issues/);
    assert.equal(new URL(String(input)).searchParams.get('q'), 'is:issue is:open label:bounty');
    assert.equal(new Headers(init?.headers).has('Authorization'), false);
    return new Response(JSON.stringify({ items: [{ number: 4, html_url: 'https://github.com/acme/repo/issues/4', title: 'A task', body: null, labels: [{ name: 'bounty' }] }] }));
  } });
  const rows = await source.fetch();
  assert.equal(rows[0]!.title, 'A task');
  assert.deepEqual(rows[0]!.tags, ['bounty']);
  assert.equal(rows[0]!.evidence[0]!.source, 'github:bounty-issues');
});
test('GitHub rate limits, malformed data and network errors fall back with notice', async () => {
  for (const fetcher of [responseFetch({}, 403), responseFetch({}, 429), responseFetch({ items: [{}] }), responseFetch({}), (async () => { throw new Error('network down'); }) as typeof fetch]) {
    const warnings: string[] = [];
    const rows = await new GitHubSource({ fetcher, onWarning: warning => warnings.push(warning) }).fetch();
    assert.deepEqual(rows, await new FixtureSource('github').fetch());
    assert.match(warnings[0]!, /synthetic fixture/);
  }
});
test('OpenAI adapter sends correct endpoint, model and JSON data with bearer auth', async () => {
  const provider = new OpenAIModelProvider({ baseUrl: 'https://model.example/v1/', apiKey: 'test-key', model: 'nemotron-test', fetcher: async (input, init) => {
    assert.equal(input, 'https://model.example/v1/chat/completions');
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-key');
    const body = JSON.parse(String(init?.body)) as { model: string; messages: { role: string; content: string }[] };
    assert.equal(body.model, 'nemotron-test');
    assert.match(body.messages[0]!.content, /untrusted data/);
    assert.equal(JSON.parse(body.messages[1]!.content).profile, 'typescript');
    assert.ok(init?.signal);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ assessments: [{ id: 'a', score: 80, reason: 'Tag match' }] }) } }] }));
  } });
  assert.equal((await rankOpportunities([record('a')], provider, 'typescript'))[0]!.score, 80);
});
test('OpenAI adapter rejects HTTP failures and malformed structured output', async () => {
  for (const fetcher of [responseFetch({}, 401), responseFetch({ choices: [] }), responseFetch({ choices: [{ message: { content: '{broken' } }] }), responseFetch({ choices: [{ message: { content: '{"assessments":[{}]}' } }] })]) {
    await assert.rejects(new OpenAIModelProvider({ baseUrl: 'https://model.example/v1', apiKey: 'key', model: 'model', fetcher }).rank([record('a')], ''));
  }
});
test('Markdown report includes evidence and escapes untrusted content', async () => {
  const rows = await rankOpportunities([{ ...record('a'), title: '<script> [evil](x)\n## heading' }], model, 'typescript');
  const report = renderMarkdown(rows, { mode: 'offline', model: model.name, profile: 'typescript', fetched: 1, deduplicated: 1, warnings: ['fallback'] });
  assert.match(report, /\[test\]\(https:\/\/example.org\/a\)/);
  assert.match(report, /Source notices/);
  assert.ok(!report.includes('<script>'));
  assert.ok(!report.includes('\n## heading'));
});
test('full offline pipeline produces five evidence-backed recommendations', async () => {
  const result = await federate([new FixtureSource('hackathons'), new FixtureSource('bounties'), new FixtureSource('github')]);
  const ranked = await rankOpportunities(deduplicate(result.opportunities), model, 'typescript agents data open-source');
  assert.equal(ranked.length, 5);
  assert.ok(ranked.every(row => row.evidence.length));
  assert.ok(ranked.every(row => !row.title.includes('rumor')));
});
test('CLI demo renders reproducibly and invalid options exit nonzero', () => {
  const cli = new URL('../cli.js', import.meta.url);
  const run = (...args: string[]) => spawnSync(process.execPath, [cli.pathname, ...args], { encoding: 'utf8', env: { ...process.env, MODEL_BASE_URL: '', MODEL_API_KEY: '', MODEL_NAME: '' } });
  const first = run();
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /8 federated → 6 deduplicated → 5 evidence-backed/);
  assert.match(first.stdout, /all opportunities are synthetic/);
  assert.equal(first.stdout, run().stdout);
  assert.equal(run('--unknown').status, 1);
  assert.equal(run('--model').status, 1);
  assert.equal(run('--model', 'openai').status, 1);
});
