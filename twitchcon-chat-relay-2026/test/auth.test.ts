import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { validateToken, ValidatedSource } from '../src/twitch/validatedSource.js';
import type { ChatSource } from '../src/twitch/chatSource.js';
const valid = { login: 'bot', scopes: ['chat:read'], expires_in: 3600 };
const reply = (data: unknown, status = 200): typeof fetch => async () => new Response(JSON.stringify(data), { status });
test('OAuth validation enforces user token, username, scope and expiry; strips oauth prefix', async () => {
  const fake: typeof fetch = async (url, options) => {
    assert.equal(url, 'https://id.twitch.tv/oauth2/validate');
    assert.equal((options!.headers as Record<string, string>).Authorization, 'OAuth secret');
    return new Response(JSON.stringify(valid));
  };
  assert.equal(await validateToken('oauth:secret', 'BOT', fake), 3600);
  for (const data of [{ ...valid, login: 'other' }, { ...valid, scopes: [] }, { ...valid, expires_in: 0 }, null]) {
    await assert.rejects(validateToken('secret', 'bot', reply(data)));
  }
  await assert.rejects(validateToken('secret', 'bot', reply({}, 401)));
});
test('validation wrapper checks before starting; revocation stops active source', async t => {
  let started = 0; let stopped = 0; let checks = 0;
  const inner: ChatSource = { start: () => { started++; }, stop: () => { stopped++; } };
  const fake: typeof fetch = async () => new Response(JSON.stringify(valid), { status: ++checks === 1 ? 200 : 401 });
  const wrapper = new ValidatedSource(inner, 'secret', 'bot', fake, 100);
  t.after(() => wrapper.stop());
  const statuses: string[] = []; wrapper.start(() => {}, status => statuses.push(status));
  const deadline = Date.now() + 2000;
  while (!statuses.includes('error')) { assert.ok(Date.now() < deadline, 'Revocation timeout'); await delay(5); }
  assert.equal(started, 1); assert.equal(stopped, 1); assert.equal(checks, 2);
});
test('stop during token validation cannot resurrect a connection', async () => {
  let started = false;
  let finish!: (response: Response) => void;
  const fake: typeof fetch = () => new Promise(resolve => { finish = resolve; });
  const wrapper = new ValidatedSource({ start: () => { started = true; }, stop: () => {} }, 'secret', 'bot', fake);
  wrapper.start(() => {}, () => {}); wrapper.stop();
  finish(new Response(JSON.stringify(valid))); await delay(0);
  assert.equal(started, false);
});
