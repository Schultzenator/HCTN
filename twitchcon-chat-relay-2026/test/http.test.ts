import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { Studio } from '../src/core/state.js';
import { createStudioServer } from '../src/server/http.js';
import { uiScript } from '../src/server/panel.js';
import vm from 'node:vm';

async function setup(t: { after: (fn: () => void) => void }) {
  const studio = new Studio('test', 'fixture');
  const app = createStudioServer(studio);
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  t.after(() => app.close());
  const address = app.server.address(); assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  const html = await (await fetch(base)).text();
  const key = /name="moderator-key" content="([a-f0-9]+)"/.exec(html)![1]!;
  const command = (action: string, rest: Record<string, unknown> = {}, headers: Record<string, string> = {}) => fetch(`${base}/api/command`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Moderator-Key': key, ...headers }, body: JSON.stringify({ action, ...rest })
  });
  return { studio, base, html, key, command };
}
test('HTTP moderator workflow, SSR assets and state export', async t => {
  const { studio, base, html, key, command } = await setup(t);
  assert.ok(html.includes('Chat writes.')); assert.equal(key.length, 64);
  const overlay = await (await fetch(`${base}/overlay`)).text();
  assert.ok(overlay.includes('class="overlay"')); assert.ok(!overlay.includes(key));
  assert.equal((await fetch(`${base}/styles.css`)).status, 200);
  assert.equal((await fetch(`${base}/ui.js`)).status, 200);
  assert.equal((await command('approve')).status, 400);
  assert.equal((await command('open', { durationMs: 1000 })).status, 200);
  studio.ingest({ id: 'one', userId: 'u1', displayName: '<img src=x onerror=alert(1)>', text: '!vote build', timestamp: 0 });
  assert.equal((await command('close')).status, 200);
  assert.equal((await command('approve')).status, 200);
  const state = await (await fetch(`${base}/api/state`)).json() as ReturnType<Studio['snapshot']>;
  assert.equal(state.scene!.action, 'build'); assert.equal(state.history.length, 1);
  assert.equal((await command('replay')).status, 200);
  assert.equal((await command('undo')).status, 200);
  assert.equal(studio.snapshot().scene, null);
  assert.equal((await command('fixture')).status, 400);
  assert.equal((await command('exec', { text: 'touch /tmp/never-execute' })).status, 400);
  assert.equal((await fetch(`${base}/health`)).status, 200);
});
test('HTTP rejects CSRF, DNS rebinding, missing key, oversized body and malformed input', async t => {
  const { base, command } = await setup(t);
  assert.equal((await command('open', {}, { 'X-Moderator-Key': '' })).status, 403);
  assert.equal((await command('open', {}, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await command('open', {}, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await command('open', { padding: 'x'.repeat(5000) })).status, 413);
  assert.equal((await command('unknown')).status, 400);
  const rebindingStatus = await new Promise<number | undefined>((resolve, reject) => {
    const req = http.get(base, { headers: { Host: 'evil.example' } }, response => { response.resume(); resolve(response.statusCode); });
    req.on('error', reject);
  });
  assert.equal(rebindingStatus, 403);
  assert.equal((await fetch(`${base}/not-found`)).status, 404);
});
test('SSE sends initial snapshot and complete current state after reconnect', async t => {
  const { base, command } = await setup(t);
  async function readState(): Promise<string> {
    const response = await fetch(`${base}/events`, { signal: AbortSignal.timeout(3000) });
    assert.equal(response.headers.get('content-type'), 'text/event-stream');
    const reader = response.body!.getReader();
    let text = '';
    try {
      while (!text.includes('\n\n')) { const result = await reader.read(); if (result.done) break; text += new TextDecoder().decode(result.value); }
    } finally { await reader.cancel(); }
    return text;
  }
  assert.ok((await readState()).includes('"round":null'));
  await command('open');
  const afterReconnect = await readState();
  assert.ok(afterReconnect.includes('event: state')); assert.ok(afterReconnect.includes('"status":"open"'));
});
test('browser script parses and renders untrusted names only through textContent', () => {
  assert.doesNotThrow(() => new vm.Script(uiScript));
  assert.ok(!uiScript.includes('innerHTML'));
  assert.ok(uiScript.includes('.textContent'));
});
test('server timer closes idle voting without another chat event', async t => {
  const { studio, command } = await setup(t);
  await command('open', { durationMs: 1000 });
  await new Promise(resolve => setTimeout(resolve, 1150));
  assert.equal(studio.snapshot().round!.status, 'closed');
  assert.equal(studio.snapshot().round!.winner, null);
  assert.equal((await command('approve')).status, 400);
});
test('UI script applies a full snapshot and keeps hostile contributor names as literal text', () => {
  class Element {
    textContent: string | number = ''; value = '15'; hidden = false; disabled = false; offsetWidth = 100;
    style: Record<string, string> = {}; dataset: Record<string, string> = {};
    children: Element[] = []; onclick: (() => void) | null = null;
    classList = { contains: () => false, remove: () => {}, add: () => {} };
    addEventListener() {} replaceChildren() { this.children = []; } append(child: Element) { this.children.push(child); }
  }
  const elements = new Map<string, Element>();
  const element = (id: string) => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id)!; };
  const studio = new Studio('seed', 'fixture');
  studio.command('open', {});
  const hostile = '<img src=x onerror=alert(1)>';
  studio.ingest({ id: '1', userId: 'u1', displayName: hostile, text: '!vote help', timestamp: 0 });
  studio.command('close', {}); studio.command('approve', {});
  const context = vm.createContext({
    document: { body: new Element(), getElementById: element,
      querySelectorAll: () => [], querySelector: (selector: string) => element(selector), createElement: () => new Element() },
    EventSource: class { onopen = null; onerror = null; addEventListener() {} },
    Date, setInterval: () => 0
  });
  vm.runInContext(uiScript, context);
  context.snapshot = { ...studio.snapshot(), serverTime: Date.now() };
  vm.runInContext('render(snapshot)', context);
  assert.equal(element('title').textContent, 'The Lantern Forest');
  assert.equal(element('contributors').textContent, `Inspired by ${hostile}`);
  assert.equal(element('stage').dataset.template, 'forest');
  assert.equal(element('count-help').textContent, 1);
  assert.equal(element('history').children.length, 1);
});
