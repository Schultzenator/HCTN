# Zetaris Demo Challenge pack

## Live integration

The adapter is `src/sources/zetaris.ts`. It uses the documented SQL Editor endpoint:

```text
POST {ZETARIS_BASE_URL}/api/v1.0/sql-editor/sqls/run-query
X-Org-ID: {ZETARIS_ORG_ID}
X-Request-ID: <generated UUID>
Authorization: Bearer {ZETARIS_API_KEY}
{"sql":"SELECT * FROM ..."}
```

The query should return columns `id`, `title`, `description`, `kind`, `tags`, and `url`/`evidenceUrl`. Arrays are also accepted as `headers` + `data`. No credentials are stored in this repository.

```bash
cp .env.example .env
# Fill the four ZETARIS_* values locally, then:
node --env-file=.env dist/cli.js --zetaris --profile "typescript agents data open-source"
```

An actual live smoke is still an operator step because it requires the Zetaris trial's org ID and API key. The adapter contract is covered by automated tests; do not call the demo complete until the command above visibly returns a Zetaris-attributed record.

## Write-up one-liner

> Zetaris was amazing because Opportunity Radar could query federated opportunity data in place through one governed SQL surface, preserving source evidence without copying every underlying dataset into the app.

## Demo script — target 2:40

1. **0:00–0:20 — problem.** “Opportunities are fragmented across calendars, bounty boards and issue trackers. Radar needs one evidence-backed view.”
2. **0:20–0:45 — live Zetaris.** Show the Zetaris source/query and run `node --env-file=.env dist/cli.js --zetaris ...`; point at the `source: zetaris` evidence.
3. **0:45–1:20 — result.** Show federation, deduplication, ranking and the rejected no-link rumor. Explain that Zetaris is a real source in the same `SourceProvider` contract.
4. **1:20–2:10 — why Zetaris was amazing (50 seconds).** “The important change is not another copied export. Zetaris lets Radar query data where it already lives through a governed federated layer. One SQL surface can combine sources while the underlying records stay in place; only the result set crosses into the agent. That makes the integration small, auditable and easy to swap into an existing evidence-first pipeline. We keep the source attribution all the way to the recommendation, so the model sees where every opportunity came from. For this demo, Zetaris turns fragmented intelligence into a live, explainable input instead of a one-off import.”
5. **2:10–2:40 — proof and close.** Run `npm test`; show `22 passed`, then repeat the one-line write-up claim.

## Recording pack

Frames to capture in order:

| Frame | Screen | Purpose |
|---|---|---|
| A | Zetaris console/query | Proves live Zetaris configuration and query |
| B | terminal with `--zetaris` | Proves the live request and returned rows |
| C | rendered Markdown report | Proves `source: zetaris` evidence and ranking |
| D | source code `zetaris.ts` | Shows the adapter is real, typed and small |
| E | `npm test` | Shows repeatable verification |

Keep the raw recording and final MP4 in `recording/` locally. `recording/*.mp4` is ignored by Git.

```bash
# Example: lossless-ish screen capture assembled from clips
ffmpeg -f concat -safe 0 -i recording/segments.txt -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k recording/zetaris-opportunity-radar.mp4

# Inspect duration and codec before Dropbox upload
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height -of json recording/zetaris-opportunity-radar.mp4
```

Dropbox upload, final recording, voiceover and submission remain operator actions.
