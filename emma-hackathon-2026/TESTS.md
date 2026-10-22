# FleetPilot verification — iteration 2

Executed 2026-10-22 in `emma-hackathon-2026/` with Node v22.22.1,
npm 9.2.0 and TypeScript 5.9.3 (resolved in package-lock.json).

## Dependency install

`npm install` initially failed with ENOENT because the environment-configured
cache directory `/home/schultze/Factory/tmp/sectile-/npm/_cacache` was unavailable.
`npm install --cache .npm-cache` then exited 0: added 3 packages, audited 4,
0 vulnerabilities. The project-local cache is ignored; package-lock.json is committed.
Use the cache override again if this environment still needs it.

## npm test

Command: `npm test` (exit 0). Runs `npm run build --silent` followed by
`node --test dist/test/*.test.js`.

| Suite / source file grouping | Passed | Failed | Skipped | Cancelled | Todo |
|---|---:|---:|---:|---:|---:|
| Mock client — src/test/mock.test.ts | 6 | 0 | 0 | 0 | 0 |
| Planner — src/test/planner.test.ts | 10 | 0 | 0 | 0 | 0 |
| Total | 16 | 0 | 0 | 0 | 0 |

These are file groupings, not Node `describe()` suites. Raw Node summary:

```text
1..16
# tests 16
# suites 0
# pass 16
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 200.681853
```

Coverage exercised: mock market refresh and isolation, create/list/terminate and
error cases; cheapest placement, spot policy, VRAM/region/budget constraints,
node multiplication, duration projections and deterministic plans.
No failing tests or type errors required source changes.

## TypeScript

`npx tsc --noEmit` exited 0 with no diagnostics. An earlier explicit-cache run,
`npx --cache .npm-cache tsc --noEmit`, also exited 0.

Scope: the existing tsconfig excludes the orphaned `src/core/` generation,
`src/emma/api.ts`, `src/emma/fixtures.ts`, `src/mcp/tools.ts`, and
`src/mcp/jsonrpc.ts`. This result applies to the configured active source tree;
it does not certify those legacy files.

## Demo smoke check and limits

`npm run demo` exited 0 in offline mock mode: inventory → plan → deploy →
fleet status → savings proposal → terminate. Fixture prices: 18.99 → 15.75 USD/h;
3.24 USD/h potential saving × 730 h = 2365.20 USD/month. Optimization proposes
placements; it does not migrate workloads.

No live API, actual GPU workload, authentication, REST adapter, MCP transport or
LLM client was validated by this test run. There are two test files, not the five
suites claimed in the previous work-state instructions.
