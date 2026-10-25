import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocketServer } from 'ws';
import { once } from 'node:events';
import { IrcSource, parsePrivmsg } from '../src/twitch/ircSource.js';
import { EventBus } from '../src/core/eventBus.js';
import { VoteEngine } from '../src/core/voteEngine.js';
async function until(check: () => boolean): Promise<void> {
  const deadline = Date.now() + 3000;
  while (!check()) { if (Date.now() > deadline) throw new Error('Timed out'); await delay(5); }
}
const line = (id: string, user: string) => `@id=${id};user-id=${user};display-name=Viewer\\s${user};tmi-sent-ts=123 :viewer!viewer@viewer PRIVMSG #test :!vote explore\r\n`;
test('real WebSocket disconnect/reconnect reauthenticates, answers PING and deduplicates retransmissions', async t => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 }); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address === 'object');
  const source = new IrcSource({ channel: 'test', username: 'bot', token: 'secret', url: `ws://127.0.0.1:${address.port}`, reconnectMs: 5 });
  t.after(async () => { source.stop(); for (const client of server.clients) client.terminate(); await new Promise<void>(r => server.close(() => r())); });
  let connections = 0; const handshakes: string[][] = []; let pong = false;
  server.on('connection', socket => {
    const n = ++connections; const commands: string[] = []; handshakes.push(commands);
    socket.on('message', data => {
      const text = data.toString(); commands.push(text);
      if (text.startsWith('PONG')) pong = true;
      if (text.startsWith('JOIN')) {
        socket.send(':tmi.twitch.tv 001 bot :Welcome\r\nPING :tmi.twitch.tv\r\n' + line('one', 'u1'));
        if (n === 1) setTimeout(() => socket.close(), 30);
        else socket.send(line('one', 'u1') + line('two', 'u2'));
      }
    });
  });
  const bus = new EventBus(); const votes = new VoteEngine(); votes.open(); bus.subscribe(e => votes.vote(e));
  const statuses: string[] = [];
  source.start(e => bus.publish(e), s => statuses.push(s));
  await until(() => bus.accepted === 2 && bus.duplicates >= 1 && pong);
  assert.equal(connections, 2);
  assert.equal(votes.snapshot()!.counts.explore, 2);
  for (const commands of handshakes) {
    assert.ok(commands.some(c => c.startsWith('PASS oauth:secret')));
    assert.ok(commands.some(c => c.startsWith('CAP REQ')));
    assert.ok(commands.some(c => c.startsWith('NICK bot')));
    assert.ok(commands.some(c => c.startsWith('JOIN #test')));
  }
  assert.ok(statuses.includes('reconnecting')); source.stop();
  await delay(40); assert.equal(connections, 2);
});
test('Twitch RECONNECT instruction resumes source without resetting message dedup', async t => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 }); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address === 'object');
  const source = new IrcSource({ channel: 'test', username: 'bot', token: 'secret', url: `ws://127.0.0.1:${address.port}`, reconnectMs: 5 });
  t.after(async () => { source.stop(); for (const s of server.clients) s.terminate(); await new Promise<void>(r => server.close(() => r())); });
  const bus = new EventBus(); let connections = 0;
  server.on('connection', socket => {
    const n = ++connections;
    socket.on('message', data => { if (data.toString().startsWith('JOIN')) socket.send(line('same', 'u1') + (n === 1 ? ':tmi.twitch.tv RECONNECT\r\n' : '')); });
  });
  source.start(e => bus.publish(e), () => {});
  await until(() => bus.duplicates === 1);
  assert.equal(connections, 2); assert.equal(bus.accepted, 1);
});
test('parser ignores other channels and untagged messages; IRC input cannot inject credentials', () => {
  assert.equal(parsePrivmsg(line('x', 'u').trim(), 'other'), null);
  assert.equal(parsePrivmsg(':viewer PRIVMSG #test :!vote explore', 'test'), null);
  assert.equal(parsePrivmsg(line('x', 'u').trim(), 'test')!.displayName, 'Viewer u');
  assert.throws(() => new IrcSource({ channel: 'test\r\nJOIN #evil', username: 'bot', token: 'secret' }));
  assert.throws(() => new IrcSource({ channel: 'test', username: 'bot', token: 'secret\r\nPRIVMSG' }));
});
test('chat text cannot impersonate IRC control commands or authentication failures', async t => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 }); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address === 'object');
  const source = new IrcSource({ channel: 'test', username: 'bot', token: 'secret', url: `ws://127.0.0.1:${address.port}`, reconnectMs: 5 });
  t.after(async () => { source.stop(); for (const s of server.clients) s.terminate(); await new Promise<void>(r => server.close(() => r())); });
  let connections = 0; let received = 0; const statuses: string[] = [];
  server.on('connection', socket => {
    connections++;
    socket.on('message', data => {
      if (data.toString().startsWith('JOIN')) socket.send(line('control-text', 'u1').replace('!vote explore', ' RECONNECT NOTICE bot :Login authentication failed :You are banned'));
    });
  });
  source.start(() => { received++; }, s => statuses.push(s));
  await until(() => received === 1); await delay(30);
  assert.equal(connections, 1); assert.ok(!statuses.includes('error'));
});
test('authentication rejection stops retrying; silent connections trigger watchdog reconnect', async t => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 }); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address === 'object');
  const config = { channel: 'test', username: 'bot', token: 'secret', url: `ws://127.0.0.1:${address.port}`, reconnectMs: 5 };
  let connections = 0;
  server.on('connection', socket => {
    const n = ++connections;
    if (n === 1) socket.on('message', data => { if (data.toString().startsWith('JOIN')) socket.send(':tmi.twitch.tv NOTICE * :Login authentication failed\r\n'); });
  });
  const authSource = new IrcSource(config);
  const idleSource = new IrcSource({ ...config, idleTimeoutMs: 30 });
  t.after(async () => { authSource.stop(); idleSource.stop(); for (const s of server.clients) s.terminate(); await new Promise<void>(r => server.close(() => r())); });
  let error = false;
  authSource.start(() => {}, status => { if (status === 'error') error = true; });
  await until(() => error); await delay(40); assert.equal(connections, 1);
  idleSource.start(() => {}, () => {});
  await until(() => connections >= 3); idleSource.stop();
  assert.equal(connections, 3);
});
