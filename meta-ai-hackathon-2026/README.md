# Household Ops Agent

Household Ops Agent turns a messy evening into a small, explainable plan. It is a TypeScript/Node ESM demo for the Meta Global AI Developer Hackathon, built around three meaningful Meta Model API calls:

1. `sam-3.1` perceives household or pantry objects in an optional photo.
2. `muse-spark-1.3` turns the request, constraints, inventory and perception into an ordered plan with reasons.
3. `muse-image-1.0` creates a warm visual of the proposed evening.

The agent returns a trace, so a demo can show which model did what. With no key it runs in honest `mock` mode; no fake Meta response is presented as live inference.

The live event page currently lists project submissions as due **November 4, 2026 at 9:00 PM ET** (November 5 at 03:00 CET in Warsaw). The operator owns the portal submission; this repository does not automate or access it.

## Quickstart

Requirements: Node.js 20+.

```bash
npm install
npm test
npm run demo
```

The demo reads `META_API_KEY` (or `MODEL_API_KEY`). If the operator has supplied `/home/schultze/Factory/secrets/meta.env`, it is loaded automatically without copying it into this project. The API base defaults to `https://api.meta.ai/v1` and can be overridden with `META_API_BASE`. Force the safe fallback with `META_MOCK=1`.

```bash
META_API_KEY=... npm run demo
# or, for a deterministic local run:
META_MOCK=1 npm run demo
```

Secrets are not committed. `.env.example` documents the names only.

## How it works

`src/agent.ts` is the orchestration loop. It optionally sends an image and the noun prompt `Find household items and food products` to SAM, sends the resulting structured perception plus household context to Spark, and then asks Muse Image for an illustration. Each stage is recorded in `trace` with `live` or `mock` status. The mock client makes the end-to-end path executable even before a key arrives.

The production adapter uses the documented OpenAI-compatible Responses API at `META_API_BASE/responses` and the one-off Muse Image endpoint at `META_API_BASE/images/generations`. The implementation deliberately keeps the HTTP surface small so it can be swapped for the official SDK later without changing the agent contract. Meta's current docs call the standard credential `MODEL_API_KEY`; this app also accepts the operator-requested `META_API_KEY` alias.

## Limitations and honest demo notes

- The current CLI uses a fixed example input; a web/mobile shell can call `runHouseholdOps` with user input and an uploaded image.
- SAM response normalization currently expects JSON in the returned text. A production UI should also render masks returned by the API and validate the exact account-level schema.
- Generated images may be returned as a signed URL or base64 data URL. The CLI prints the result object, so a real UI should display it instead of logging large payloads.
- When no key exists, the plan and detection are deterministic mock fixtures. This is suitable for development and demo rehearsal, but should be disclosed in a recorded demo if live Meta inference is unavailable.
- The submission is for the Indie track and targets “Build for Your World”: the domain is the builder's own household workflow.

## Meta references

- [Meta Global AI Developer Hackathon](https://dev.meta.ai/events/global-hackathon)
- [Meta Model API overview](https://dev.meta.ai/docs/overview)
- [Responses API](https://dev.meta.ai/docs/protocols/responses)
- [SAM media segmentation](https://dev.meta.ai/docs/media-segmentation)
- [Muse Image generation](https://dev.meta.ai/docs/image-generation)

## License

MIT.
