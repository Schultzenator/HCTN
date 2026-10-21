# Opportunity Radar demo (about 90 seconds)

1. Explain the problem: the same opportunity is scattered across calendars, bounty boards and GitHub; a rumor without a primary link should not become a recommendation.
2. Run `npm run demo`. Point to **8 federated → 6 deduplicated → 5 evidence-backed recommendations**. The full run is offline and reproducible.
3. Open the Agent Federation recommendation: it retains the calendar evidence and mirrored bounty-board provenance. The TypeScript connector merges board and GitHub evidence. The unlinked rumor is absent.
4. Run `node dist/cli.js --profile "design"`. The profile changes the deterministic scores. Explain that mock ranking supports offline review; the same interface accepts external models.
5. Show `src/types.ts`: sources and models are independent plugins. Open `src/llm/openai.ts` to show the Meterless/Nemotron integration point and validated structured output.
6. Optionally run `npm run live` when online. It fetches real bounty-labeled GitHub issues; any API failure is disclosed and uses synthetic fallback data. These labels do not establish that payment is available.
7. End with `npm test` and the Markdown evidence links. Future work: real calendar/board connectors, a Zetaris source adapter, richer eligibility and deadline extraction with claim-level evidence.

## Verification

```bash
npx tsc --noEmit
npm test
npm run demo
```

The test suite covers URL normalization, transitive and conservative deduplication, source federation and failure isolation, the pre-model evidence gate, deterministic mock scoring, ranking validation, GitHub success/fallback, the OpenAI-compatible request/response contract, safe Markdown rendering, the full pipeline and CLI behavior. All HTTP tests inject fake fetch functions; no network or API credentials are required.
