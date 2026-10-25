import test from 'node:test';
import assert from 'node:assert/strict';
import { VoteEngine } from '../src/core/voteEngine.js';
import type { ChatEvent } from '../src/twitch/chatSource.js';
const message = (userId: string, text = '!vote explore'): ChatEvent => ({ id: `msg-${userId}`, userId, displayName: userId, text, timestamp: 0 });
test('one vote per stable user ID, rate limiting and bounded command palette', () => {
  let now = 0;
  const votes = new VoteEngine(() => now);
  votes.open(10_000);
  assert.equal(votes.vote(message('a')), 'accepted');
  assert.equal(votes.vote(message('a', '!vote build')), 'rate-limited');
  now = 1000;
  assert.equal(votes.vote(message('a', '!vote build')), 'already-voted');
  for (const text of ['!vote delete', '!vote explore; rm -rf /', '$(touch /tmp/never-execute)', '!exec ls', '!vote help extra']) {
    assert.equal(votes.vote(message('b', text)), 'ignored');
  }
  assert.equal(votes.vote(message('b', ' !VOTE HELP ')), 'accepted');
  const round = votes.close();
  assert.deepEqual(round.counts, { explore: 1, help: 1, build: 0 });
  assert.equal(round.winner, 'explore');
});
test('timeout at the exact deadline blocks late votes, including stale event timestamps', () => {
  let now = 0;
  const votes = new VoteEngine(() => now);
  votes.open(1000);
  now = 999; assert.equal(votes.vote(message('a')), 'accepted');
  now = 1000; assert.equal(votes.vote(message('b')), 'closed');
  assert.equal(votes.snapshot()!.status, 'closed');
  assert.equal(votes.snapshot()!.votes.length, 1);
  assert.equal(votes.tick(), false);
});
test('empty votes cannot be approved; pending result must be resolved before opening again', () => {
  const votes = new VoteEngine();
  assert.throws(() => votes.approve());
  votes.open();
  assert.throws(() => votes.open());
  assert.throws(() => votes.approve());
  votes.close();
  assert.throws(() => votes.approve());
  assert.throws(() => votes.open());
  votes.discard(); votes.open();
  votes.vote(message('a')); votes.close(); votes.approve();
  assert.throws(() => votes.approve());
  votes.open(); assert.equal(votes.vote(message('a')), 'accepted');
});
test('snapshots are detached and invalid durations do not create rounds', () => {
  const votes = new VoteEngine();
  for (const n of [0, 999, 300001, NaN, 1500.5]) assert.throws(() => votes.open(n));
  const snapshot = votes.open(); snapshot.counts.build = 999;
  assert.equal(votes.snapshot()!.counts.build, 0);
});
