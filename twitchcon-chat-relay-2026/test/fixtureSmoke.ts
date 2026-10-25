/** End-to-end fixture CLI rehearsal. No Twitch credentials or browser required. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import type { Studio } from '../src/core/state.js';
type State = ReturnType<Studio['snapshot']>;
const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
const address = probe.address(); assert.ok(address && typeof address === 'object');
const port = address.port; await new Promise<void>(resolve => probe.close(() => resolve()));
// Run outside the project root to verify the default fixture resolves from the entry point.
const child = spawn(process.execPath, [fileURLToPath(new URL('../src/index.js', import.meta.url)), '--fixture'], {
  cwd: fileURLToPath(new URL('.', import.meta.url)), env: { ...process.env, PORT: String(port), SESSION_SEED: 'smoke-2026' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let output = ''; child.stdout.on('data', data => { output += String(data); }); child.stderr.on('data', data => { output += String(data); });
const exited = once(child, 'exit');
const base = `http://127.0.0.1:${port}`;
async function waitFor(predicate: (s: State) => boolean, timeoutMs = 20_000): Promise<State> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/api/state`, { signal: AbortSignal.timeout(1000) });
      const state = await response.json() as State;
      if (predicate(state)) return state;
    } catch { /* process may still be starting */ }
    assert.equal(child.exitCode, null, `CLI exited early: ${output}`);
    await delay(100);
  }
  throw new Error(`Smoke timeout: ${output}`);
}
try {
  await waitFor(s => s.mode === 'fixture');
  const html = await (await fetch(base)).text();
  const key = /name="moderator-key" content="([a-f0-9]+)"/.exec(html)![1]!;
  assert.ok(key);
  async function command(action: string, extra: Record<string, unknown> = {}): Promise<State> {
    const response = await fetch(`${base}/api/command`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Moderator-Key': key }, body: JSON.stringify({ action, ...extra }) });
    assert.equal(response.status, 200, await response.clone().text());
    return await response.json() as State;
  }
  const timedOut = await waitFor(s => s.round?.status === 'closed');
  assert.equal(timedOut.stats.accepted, 15); assert.equal(timedOut.stats.duplicates, 1);
  assert.deepEqual(timedOut.round!.counts, { explore: 7, help: 3, build: 2 });
  assert.equal(timedOut.round!.votes.length, 12);
  const chapters = [(await command('approve')).scene!];
  console.log('PASS: compiled CLI --fixture from another cwd; default timeout; 12 votes / 1 duplicate.');
  for (let i = 0; i < 2; i++) {
    await command('fixture');
    await waitFor(s => s.source.status === 'finished');
    await command('close');
    chapters.push((await command('approve')).scene!);
  }
  assert.deepEqual(chapters.map(s => s.template), ['forest', 'harbor', 'citadel']);
  assert.equal((await command('undo')).scene!.template, 'harbor');
  const replay = await command('replay', { sceneId: 1 });
  assert.equal(replay.scene!.template, 'harbor'); assert.equal(replay.playback!.template, 'forest');
  const controller = new AbortController();
  const stream = await fetch(`${base}/events`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(3000)]) });
  const reader = stream.body!.getReader(); let frame = '';
  while (!frame.includes('\n\n')) { const item = await reader.read(); assert.equal(item.done, false); frame += new TextDecoder().decode(item.value); }
  await reader.cancel(); controller.abort();
  assert.ok(frame.includes('event: state')); assert.ok(frame.includes('"playbackVersion":5'));
  assert.equal((await fetch(`${base}/overlay`)).status, 200);
  console.log('PASS: three templates; undo restores harbor; replay shows forest without mutating canonical history; SSE reconnect snapshot; overlay HTTP 200.');
  console.log(JSON.stringify({ counts: timedOut.round!.counts, chapters: chapters.map(s => ({ id: s.id, template: s.template, seed: s.seed })), finalCanonical: replay.scene!.template, finalPlayback: replay.playback!.template, stats: replay.stats }, null, 2));
} finally {
  child.kill('SIGTERM');
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([exited, new Promise<never>((_, reject) => {
      timeout = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('CLI did not shut down cleanly')); }, 3000);
    })]);
    assert.equal(result[0], 0, `CLI failed: ${output}`);
  } finally { clearTimeout(timeout); }
}
