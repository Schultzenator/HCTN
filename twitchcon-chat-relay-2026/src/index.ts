import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { Studio } from './core/state.js';
import { FixtureSource } from './twitch/fixtureSource.js';
import { ValidatedSource } from './twitch/validatedSource.js';
import { IrcSource } from './twitch/ircSource.js';
import type { ChatSource } from './twitch/chatSource.js';
import { createStudioServer } from './server/http.js';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: node dist/src/index.js [--fixture [path.jsonl]]\nEnv: PORT=3210 SESSION_SEED=twitchcon-2026 TWITCH_CHANNEL TWITCH_USERNAME TWITCH_OAUTH_TOKEN');
  process.exit(0);
}
if (args.length > 0 && (args[0] !== '--fixture' || args.length > 2 || args[1]?.startsWith('--'))) {
  console.error('Unknown arguments. Use --help.'); process.exit(1);
}
try {
  const fixtureIndex = args.indexOf('--fixture');
  const fixture = fixtureIndex >= 0;
  const port = Number(process.env.PORT ?? 3210);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1–65535');
  const seed = process.env.SESSION_SEED ?? 'twitchcon-2026';
  if (!seed.length || seed.length > 100) throw new Error('SESSION_SEED must contain 1–100 characters');
  const studio = new Studio(seed, fixture ? 'fixture' : 'live');
  let source: ChatSource;
  let fixtureRun = 0;
  const fixturePath = fixture
    ? args[fixtureIndex + 1] ? resolve(args[fixtureIndex + 1]!) : fileURLToPath(new URL('../../fixtures/events.jsonl', import.meta.url))
    : '';
  const playFixture = (): void => {
    // Validate the recording before changing an existing round or source.
    const next = new FixtureSource(fixturePath, `fixture-${fixtureRun + 1}`);
    studio.command('open', { durationMs: 15_000 });
    fixtureRun++;
    source?.stop(); source = next;
    source.start(event => studio.ingest(event), (status, detail) => studio.setSource(status, detail));
  };
  if (fixture) {
    // Fail fast on a missing/malformed recording, before opening the HTTP port.
    source = new FixtureSource(fixturePath);
  } else {
    const { TWITCH_CHANNEL: channel, TWITCH_USERNAME: username, TWITCH_OAUTH_TOKEN: token } = process.env;
    if (!channel || !username || !token) throw new Error('Set TWITCH_CHANNEL, TWITCH_USERNAME and TWITCH_OAUTH_TOKEN, or use --fixture');
    source = new ValidatedSource(new IrcSource({ channel, username, token }), token, username);
  }
  const app = createStudioServer(studio, fixture ? playFixture : undefined);
  app.server.on('error', error => { console.error(`HTTP startup failed: ${error.message}`); source.stop(); app.close(); process.exitCode = 1; });
  app.server.listen(port, '127.0.0.1', () => {
    console.log(`Chat Relay Studio / ${fixture ? 'SYNTHETIC FIXTURE' : 'TWITCH LIVE'}\nPanel: http://127.0.0.1:${port}\nOBS: http://127.0.0.1:${port}/overlay\nSeed: ${seed}`);
    if (fixture) playFixture();
    else source.start(event => studio.ingest(event), (status, detail) => studio.setSource(status, detail));
  });
  const stop = (): void => { source.stop(); app.close(); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Startup failed'); process.exitCode = 1;
}
