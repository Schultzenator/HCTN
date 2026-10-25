# Recording script — Chat Relay Studio

Target: **2:45**, English narration, screen capture + optional TTS, no face required. Use a real Twitch channel in the final submission. Fixture footage is for rehearsal and must be labeled synthetic.

## Preparation

- `npm install && npm test && npm run typecheck`.
- Rehearse with `npm run demo`; approve all three templates, undo and replay.
- Owner authorizes Twitch using README, sets `.env`, and restarts with `npm start`.
- OBS Browser Source: `http://127.0.0.1:3210/overlay`, 1920 × 1080, 30 FPS. Open the panel and real channel chat side by side. Keep `.env`, OAuth fragments, tokens, shell history and developer-console credentials off-screen.
- Have two real consenting accounts ready. Moderator uses a 10-second window. Additional rounds may be recorded as jump cuts with clear continuity.
- Obtain the **actual main Codex session ID** from the operator's session records. Do not fabricate it or show a different run as the implementation session. Add it to the Devpost submission when verified.

## Shot list and English narration

| Time | Picture / action | Narration |
| --- | --- | --- |
| 0:00–0:15 | Title + OBS prologue | “Chat Relay Studio turns Twitch chat into a cooperative story. Viewers choose the path, and the streamer directs the next chapter.” |
| 0:15–0:45 | Real Twitch channel visible. Start round; two viewers send different `!vote` commands. Repeat a vote from one account. | “The action palette is small and deliberate. Each viewer gets one vote per round, and repeat attempts cannot take over the story.” |
| 0:45–1:10 | Show timeout and frozen counts, then moderator approval. Capture forest reveal and contributor credits. | “The timer closes voting. Nothing becomes canon until the moderator approves. The overlay then reveals the winning chapter and credits the viewers who chose it.” |
| 1:10–1:35 | Next two approved rounds, harbor and citadel (jump cuts permitted). | “Three authored worlds keep the stream moving. A deterministic seed makes the same decisions produce the same scene, without model calls or API bills during the show.” |
| 1:35–1:55 | Undo latest chapter; replay earlier chapter card. | “Undo restores the previous chapter exactly. Replay brings any retained scene back on screen without rewriting the story history.” |
| 1:55–2:15 | Brief test output, source interface and reconnect test; clearly label offline material. | “The same source interface supports Twitch and synthetic fixtures. Offline tests exercise reconnects, duplicate deliveries, vote deadlines, and deterministic undo. Twitch cannot recover chat sent while the connection is down.” |
| 2:15–2:35 | Actual Codex implementation session and relevant diff (hide sensitive context) | “I used Codex to implement the TypeScript engines, local WebSocket and HTTP integration tests, and moderator flow. Tests run with Node’s built-in runner. Chat is always treated as data.” |
| 2:35–2:45 | OBS final scene + project URL | “Chat writes. You direct. Run it locally, add the browser source to OBS, and let your community build the next chapter.” |

## Final verification by the owner

- Show an actual Twitch connection and real votes; fixture-only footage does not fulfill the live integration requirement.
- Check contributor names are appropriate for public display.
- Visually inspect panel and OBS at 1920 × 1080, including all three templates and replay animation. This build environment had no available browser or OBS for a visual review.
- Keep the video **under 3:00** and publish it publicly on YouTube. Verify the link in a signed-out browser.
- Publish the intended repository only after reviewing credentials and license; no push was performed during implementation.
- Add English product description, repository, video, actual Codex session ID and judge access details on Devpost. Verify submission status and the form countdown personally. Operational target supplied by owner: **2026-11-02 21:00 UTC**; do not wait until the final hour.

## Expected fixture rehearsal

At startup, the first vote opens for 15 seconds. After about 11 seconds: 15 accepted messages, one duplicate ID filtered, 12 viewer votes: explore 7 / help 3 / build 2. After timeout approve → forest. Play new fixture round → wait or close after playback → approve → harbor. Repeat → citadel. Undo → harbor, replay chapter 1 → forest playback while canonical history remains at harbor.

This is a recording plan, **not an existing video or evidence of a live Twitch test**.
