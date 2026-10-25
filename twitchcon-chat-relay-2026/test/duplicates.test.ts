import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../src/core/eventBus.js';
import { VoteEngine } from '../src/core/voteEngine.js';
import { FixtureSource } from '../src/twitch/fixtureSource.js';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const event = { id: 'msg1', userId: 'u1', displayName: 'User', text: '!vote explore', timestamp: 0 };
test('event IDs deduplicate independently from one-vote-per-user and buffer is bounded', () => {
  const bus = new EventBus(3, 2); const votes = new VoteEngine(() => 0);
  votes.open(); bus.subscribe(e => votes.vote(e));
  assert.equal(bus.publish(event), true);
  assert.equal(bus.publish({ ...event, userId: 'forged' }), false);
  bus.publish({ ...event, id: 'msg2' });
  bus.publish({ ...event, id: 'msg3', userId: 'u2' });
  assert.equal(votes.snapshot()!.counts.explore, 2);
  assert.equal(bus.duplicates, 1);
  assert.equal(bus.replay().length, 2);
  const copy = bus.replay(); copy[0]!.text = 'mutated';
  assert.equal(bus.replay()[0]!.text, '!vote explore');
  assert.equal(bus.publish({ ...event, id: '' }), false);
  assert.equal(bus.invalid, 1);
});
test('bus dispatch is FIFO even when listeners publish nested events', () => {
  const bus = new EventBus(); const seen: string[] = [];
  bus.subscribe(e => { if (e.id === 'first') bus.publish({ ...event, id: 'second' }); });
  bus.subscribe(e => seen.push(e.id));
  bus.publish({ ...event, id: 'first' });
  assert.deepEqual(seen, ['first', 'second']);
});
test('JSONL fixture uses the same bus and preserves duplicate identities within a run', async t => {
  const dir = mkdtempSync(fileURLToPath(new URL('./relay-fixture-', import.meta.url))); t.after(() => rmSync(dir, { recursive: true }));
  const path = join(dir, 'events.jsonl');
  writeFileSync(path, [event, event, { ...event, id: 'msg2', userId: 'u2' }].map(e => JSON.stringify({ delayMs: 1, event: e })).join('\n'));
  const bus = new EventBus(); const source = new FixtureSource(path); t.after(() => source.stop());
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Fixture timeout')), 2000);
    source.start(e => bus.publish(e), status => { if (status === 'finished') { clearTimeout(timeout); resolve(); } });
  });
  assert.equal(bus.accepted, 2); assert.equal(bus.duplicates, 1);
  writeFileSync(path, '{"delayMs":0,"event":{}}'); assert.throws(() => new FixtureSource(path));
});
