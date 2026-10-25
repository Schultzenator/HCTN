# Chat Relay Studio

**Chat writes. You direct.** A cooperative Twitch story where viewers choose from three actions, a moderator approves the outcome, and an OBS browser source brings the next chapter to life. Built with Codex for the TwitchCon track.

No model inference, paid APIs, generated-code execution, or shell commands at runtime. Stories use three authored templates, a deterministic seed and explicit moderator approval.

## Quickstart (Node 22)

```bash
cd twitchcon-chat-relay-2026
npm install
npm test
npm run typecheck
npm run demo
```

Open **http://127.0.0.1:3210**. The fixture starts a 15-second vote automatically. After the countdown, click **Approve winning scene**. Use **Play new fixture round** after approving/discarding the preceding round to see the harbor and citadel chapters. Use **Undo scene**, **Replay scene**, or click a chapter card.

`npm run smoke` runs a roughly 40-second end-to-end CLI/HTTP/SSE rehearsal covering all three fixture chapters, undo/replay and process shutdown. Latest captured output: [verification/fixture-smoke.txt](verification/fixture-smoke.txt).

`npm test` builds TypeScript, then runs `node --test`. No accounts or network access are needed for tests or fixture playback (installation needs npm). The lockfile pins dependencies. `npm ci` is also supported.

After building, the explicit CLI is:

```bash
node dist/src/index.js --fixture
node dist/src/index.js --fixture fixtures/events.jsonl
node dist/src/index.js --help
```

The default fixture path resolves relative to the built entry point, so it also works from another working directory. A custom fixture path resolves against the working directory. `npm start` and `npm run demo` read `.env` using Node 22; direct `node` commands need exported environment variables or `--env-file=.env`.

In the supplied restricted build environment `npm_config_cache` points to an unavailable directory. If installation fails with that path, use `npm --cache ./node_modules/.cache/npm install` (or `env -u npm_config_cache npm install`). The project `.npmrc` keeps the normal cache inside ignored `node_modules` when no environment override is present.

## OBS

1. Start the server and leave it running.
2. OBS → Sources → **Browser** → URL **http://127.0.0.1:3210/overlay**.
3. Set width **1920**, height **1080**, FPS **30**. The overlay is an opaque full-scene stage; place your camera above it, or resize it as a story card.
4. Open the moderator panel separately. It requires no OBS interaction.
5. SSE pushes complete snapshots. If OBS reconnects or refreshes, it receives current playback, round and counts immediately. Replay retriggers the reveal animation for all connected overlays.

The panel/overlay use local assets and system fonts; no CDN. Browser reduced-motion settings are respected. Restarting the Node process creates a new empty session.

## Connect a real Twitch channel

This MVP implements **Twitch IRC over TLS WebSocket**, not EventSub. Twitch currently recommends EventSub for new integrations; IRC is the explicitly permitted MVP transport here. It is read-only: it does not send chat messages or run moderation commands.

Configuration:

```bash
cp .env.example .env
# Edit .env locally; do not commit tokens.
npm run build
npm start
```

| Variable | Meaning |
| --- | --- |
| `PORT` | Local HTTP port, default `3210`, bind fixed to `127.0.0.1` |
| `SESSION_SEED` | 1–100 characters, default `twitchcon-2026` |
| `TWITCH_CHANNEL` | Channel login without `#` |
| `TWITCH_USERNAME` | Login of the account that authorized the token |
| `TWITCH_OAUTH_TOKEN` | User access token, raw or `oauth:` prefixed; required scope `chat:read` |

**Owner setup (manual, not performed by this implementation run):**

1. Sign in to the [Twitch developer console](https://dev.twitch.tv/console/apps) and register an application. For a local manual implicit-flow token, register the exact redirect **`http://localhost:3210`** (adjust if changing the port). No callback path is required: `/` serves the panel, and OAuth fragments are never sent to the HTTP server.
2. Start fixture mode while obtaining the token so that the local redirect is reachable. Follow Twitch's [implicit grant instructions](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#implicit-grant-flow). Use your client ID, that exact redirect, `response_type=token`, `scope=chat%3Aread`, and a fresh random `state` for each request. Example shape (replace both placeholders; do not reuse an example state):

   ```text
   https://id.twitch.tv/oauth2/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=http%3A%2F%2Flocalhost%3A3210&response_type=token&scope=chat%3Aread&state=FRESH_RANDOM_STATE
   ```

3. Authorize as the account used for `TWITCH_USERNAME`. Check the returned fragment's `state` matches your request. Copy only `access_token` from the fragment into `.env`, then remove the fragment from the browser address bar. The app does not collect/store tokens from the browser. No client secret is used by the relay. Implicit tokens have no refresh token: reauthorize when expired.
4. Stop fixture mode; run `npm start`. Confirm **LIVE / connected** in the panel. Validation checks the username, scope and expiry before connecting and at least hourly thereafter. Validation/network failure stops the source with an error; correct credentials/connectivity and restart. No token appears in state, SSE or logs.
5. Click **Start round**. From the channel chat send `!vote explore`, `!vote help`, or `!vote build`. Verify counts, close or wait for timeout, then approve. Use a second real account to demonstrate two distinct viewers. The broadcaster may vote too.

Read-only IRC needs [`chat:read`](https://dev.twitch.tv/docs/authentication/scopes/#irc-chat-scopes), not `chat:edit`. Transport, tags, authentication and PING/PONG follow [Twitch IRC documentation](https://dev.twitch.tv/docs/chat/irc/); periodic validation follows [Twitch's validation requirement](https://dev.twitch.tv/docs/authentication/validate-tokens/). Live OAuth and Twitch connectivity still require owner verification; offline tests do not prove a live channel connection.

## Rules and behavior

- Only the complete, case-insensitive `!vote explore|help|build` syntax is accepted. Other chat, extra arguments, shell-like text and unknown commands are ignored. No execution/evaluation path exists for chat input.
- Stable Twitch `user-id` gives one vote per user **per round**. The first vote wins; a display-name change cannot create another vote. Valid command attempts are limited to one per second per user. The ledger/rate-limit map is capped at 10,000 users per round; further new voters are ignored.
- Votes use **arrival time**, not user/source timestamps. At the exact deadline, new votes are rejected. The server checks timeout every 100 ms and again before processing a vote/approval.
- Ties resolve in the documented order **explore → help → build**. An empty round has no winner and must be discarded. Starting another round requires approving or discarding the previous round. Closing/timeout never auto-approves.
- Approval credits up to 12 winning voters. Names are rendered with `textContent`. The template cycle is **forest → harbor → citadel**; a stable hash of session seed, chapter index, round ID and winning action chooses authored scene details. Repeat the same seed and approved round sequence for identical scene data.
- **Undo** removes the latest canonical chapter, restoring the prior chapter exactly (or the prologue). It does not reopen or change the approved vote. The next round has a new ID. **Replay** re-emits any retained chapter and retriggers its animation without modifying canonical history. The preview/overlay show replayed playback; `scene` in exported state remains the latest canonical chapter.
- The event bus dispatches synchronously in FIFO order, deduplicates the last **20,000 accepted message IDs**, and retains a detached **200-event replay buffer**. Duplicate IDs are dropped across reconnects. Older evicted IDs can be accepted again; the per-round user ledger still blocks a second vote from the same user.
- WebSocket failures, server `RECONNECT`, or 90 seconds without IRC traffic trigger reconnect with exponential backoff from 1 to 30 seconds. Each connection repeats CAP/PASS/NICK/JOIN and answers PING. Authentication rejection stops retrying. Twitch IRC does **not** backfill messages lost while disconnected.
- History retains the last **100 chapters** in memory. Undo/replay cannot reach evicted history. `/api/state` exports a JSON snapshot (including `seed`, canonical `scene`, current `playback`, votes and history). There is no disk persistence, import or restoration across process restarts. `Studio.serialize()` provides the same application state as JSON without server clock/revision metadata.

## Fixture format

`fixtures/events.jsonl` is **authored synthetic data**, not a recording of real viewers. Each line contains:

```json
{"delayMs":700,"event":{"id":"01","userId":"u1","displayName":"MossPilot","text":"!vote explore","timestamp":1792936800000}}
```

Delays are relative to the previous event (0–60,000 ms). The bundled fixture finishes in about 11 seconds, contains 16 deliveries / 15 unique IDs, 12 valid viewer votes, one duplicate ID, one repeated voter, one unknown action and one shell-like non-command. Final counts: **explore 7, help 3, build 2**. Each deliberate new fixture playback uses a new run-ID namespace; duplicate IDs inside that run stay duplicates. Bus statistics are cumulative across rounds. The original timestamps are retained as metadata; voting uses arrival time.

## Architecture and local API

```text
IRC WebSocket → ValidatedSource ─┐
JSONL → FixtureSource ───────────┴→ EventBus (FIFO, dedup, buffer)
                                      ↓
                                 VoteEngine
                                      ↓ moderator approval only
                                 SceneEngine (seed / undo / replay)
                                      ↓
                                 Studio snapshot → HTTP/SSE → panel + OBS
```

- `src/twitch/chatSource.ts`: shared source contract; `ircSource.ts`: IRC transport/parser; `validatedSource.ts`: OAuth lifecycle; `fixtureSource.ts`: JSONL playback.
- `src/core/`: bus, vote engine, scene engine and session state.
- `src/server/`: loopback HTTP, moderator UI and overlay; bounded SSE clients, heartbeats and coalesced state updates.
- `test/`: Node built-in tests, real local WebSocket server, fake OAuth HTTP responses and real local HTTP/SSE requests. No live credentials or external services.

`GET /health`, `GET /api/state`, `GET /events` (SSE `state` events), `GET /overlay`. On reconnect `/events` sends a full current snapshot, rather than partial event deltas. `POST /api/command` accepts `open` (optional `durationMs` 1,000–300,000), `close`, `approve`, `discard`, `undo`, `replay` (optional `sceneId`) and `fixture` (only fixture mode). Requires `Content-Type: application/json` and `X-Moderator-Key` from the local panel. Bodies are limited to 4 KiB. A random key rotates each process start; reload the panel after restarting.

The server validates Host/Origin, serves no CORS permissions, binds only loopback, and uses a restrictive CSP. This is a local tool for a trusted workstation; do not proxy it onto the public Internet. No remote login, multi-moderator permissions or secret store is implemented. Fixture and chat sources only emit data. Runtime code never imports `child_process`, invokes a shell, evaluates chat, or calls a model API.

## Delivery status

Implemented and checked offline; see root `WORK-STATE.md` for exact evidence and limits. **Not a completed hackathon submission.** Remaining owner work: configure/authorize Twitch, verify on the actual channel and OBS, record a public English video ≤3 minutes without showing credentials, include the real Codex session ID, publish the repository and submit on Devpost. Do not describe fixture footage as live Twitch footage. Recording script: [DEMO.md](DEMO.md).

MIT licensed. No push, publication, Twitch account creation or submission is performed by the application.
