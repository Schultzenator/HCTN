import test from 'node:test';
import assert from 'node:assert/strict';
import { SceneEngine } from '../src/core/sceneEngine.js';
import { Studio } from '../src/core/state.js';
import type { VoteRound } from '../src/core/voteEngine.js';
const round = (id: number): VoteRound => ({ id, status: 'approved', openedAt: 0, deadline: 1000,
  votes: [{ userId: 'u1', displayName: 'StarSailor', action: 'explore' }], counts: { explore: 1, help: 0, build: 0 }, winner: 'explore' });
test('same seed + approved rounds give byte-identical scenes across all three templates', () => {
  const a = new SceneEngine('twitchcon'); const b = new SceneEngine('twitchcon');
  for (let i = 1; i <= 3; i++) assert.deepEqual(a.apply(round(i)), b.apply(round(i)));
  assert.deepEqual(a.history().map(s => s.template), ['forest', 'harbor', 'citadel']);
  assert.equal(JSON.stringify(a.history()), JSON.stringify(b.history()));
  assert.notEqual(new SceneEngine('different').apply(round(1)).seed, a.history()[0]!.seed);
});
test('undo restores exact prior scene; reapply reproduces it; replay never mutates history', () => {
  const engine = new SceneEngine('seed');
  const first = engine.apply(round(1)); const second = engine.apply(round(2));
  const original = engine.history();
  assert.deepEqual(engine.replay(1), first); assert.deepEqual(engine.history(), original);
  const mutable = engine.replay(); mutable.contributors.push('injected');
  assert.deepEqual(engine.replay(), second);
  assert.deepEqual(engine.undo(), first);
  assert.deepEqual(engine.apply(round(2)), second);
  engine.undo(); assert.equal(engine.undo(), null);
  assert.throws(() => engine.undo()); assert.throws(() => engine.replay());
});
test('unapproved and duplicate approvals are rejected', () => {
  const engine = new SceneEngine('seed');
  assert.throws(() => engine.apply({ ...round(1), status: 'closed' }));
  engine.apply(round(1)); assert.throws(() => engine.apply(round(1)));
});
test('moderator workflow creates no scene from chat alone; undo/replay publish canonical state', () => {
  const studio = new Studio('seed', 'fixture', () => 0);
  studio.command('open', { durationMs: 1000 });
  studio.ingest({ id: '1', userId: 'u1', displayName: '<script>alert(1)</script>', text: '!vote explore', timestamp: 0 });
  assert.equal(studio.snapshot().scene, null);
  assert.throws(() => studio.command('approve', {}));
  studio.command('close', {}); studio.command('approve', {});
  const scene = studio.snapshot().scene;
  studio.command('replay', {}); assert.deepEqual(studio.snapshot().scene, scene);
  assert.equal(studio.snapshot().playbackVersion, 2);
  studio.command('undo', {}); assert.equal(studio.snapshot().scene, null);
  assert.equal(studio.snapshot().playback, null);
  assert.equal(JSON.parse(studio.serialize()).history.length, 0);
});
