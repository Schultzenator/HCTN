# HCTN — bounty and hackathon workspace

Public workspace for open-source bounty and hackathon projects. Each directory is a project or
submission workspace; some contain research or concept material rather than runnable code.
This index does not assert that a submission was filed or accepted.

Index state: reflects commit `b14c6bb` (2026-11-10), refreshed 2026-11-24. If a directory is
not listed here, it does not exist in `main`.

## Projects

| Directory | Project | What it does | Stack | Verification reported by the project |
| --- | --- | --- | --- | --- |
| `agentcart/` | AgentCart | End-to-end purchase flow (default mock PayPal; real sandbox is optional) | Express, TypeScript | See project README |
| `airwallex-banking-2026/` | IntentPay | Agents propose purchases; a deterministic policy engine authorizes within an owner-signed intent, then issues cards/payouts with an audit trail | Node 22, TypeScript, Ed25519, Airwallex API | Project-reported policy unit and HTTP integration tests; not independently checked for this index |
| `amazon-build-ship-shape-2026/` | Household Ops MCP | Self-hosted MCP server over Streamable HTTP for the Alexa+ track | TypeScript, MCP | See project README |
| `aws-cds-agentic-hackathon-2026/` | OmniLoop | Agentic omnichannel commerce agent (SMS/RCS, WhatsApp, SES + Bedrock) | TypeScript, AWS SDK | See project README |
| `builderio-agent-native-2026/` | Triage Desk | Support inbox agent classifies mail and drafts replies; a human approves or rejects | Agent-Native framework, React + Vite, Mistral | Demo recording; no tests documented. A `vitest --run --passWithNoTests` script exists and may pass with no tests |
| `chimpx-20261114/` | — | X (Twitter) thread submission draft; content only, no code | — | None (no code, no README) |
| `dev-hf26-week3/` | Tortoise | Daily planner: Gemma picks one anchor task, deterministic guardrails decide, streaks reward consistency | TypeScript, zero dependencies | See project README |
| `emma-hackathon-2026/` | FleetPilot (Emma hackathon entry) | TypeScript agent project with submission kit, test notes and demo script; project README not written yet | TypeScript, Node | See `TESTS.md` |
| `flip-the-switch-2026/` | Graveyard Foreman | Human-approved incident triage: classifies P0/P1/P2, proposes one safe action that needs explicit `approve` | Python (stdlib state machine), unittest | `python3 -m unittest -v` — triage and approval-guardrail tests |
| `meta-ai-hackathon-2026/` | Household Ops Agent | Plans an evening from a request, inventory and photo perception into an explainable ordered plan | TypeScript/Node ESM, Meta Model API, mock mode | Project README documents `npm test` and mock demo tracing; a live Meta API run is not evidenced there |
| `name-that-llm/` | Name That LLM | Kaggle authorship attribution: classify which LLM wrote a given passage | Python, scikit-learn/LightGBM TF-IDF, sentence-transformers | Project-reported 5-fold CV (seed 42): accuracy 0.1037 ±0.0099, macro-F1 0.1037; folds/C tuning are not an independent estimate. Submission format validation only checks a 3-row file |
| `near-swarmbid-20261114/` | SwarmBid | Policy-gated agent coordination market: agents bid, the allocator picks the cheapest compliant bid before settlement | TypeScript, read-only NEAR testnet RPC | `npm test` — policy rejection, job scoping, spend limits, winner selection, receipts |
| `open-agent-hackathon-2026/` | Opportunity Radar | Evidence-first opportunity federation, deduplication and LLM ranking with audit evidence | TypeScript, Node 22 | Archived session review (2026-10-29) reports 22 tests and offline demo 8→6→5; not rerun for this index |
| `raptorx-20261106/` | RaptorX research challenge entry | Two AI research reports on Solana tokens, each with a critical follow-up question | Research artifacts (screenshots, transcripts) | None (no code, no test suite) |
| `twitchcon-chat-relay-2026/` | Chat Relay Studio | Cooperative Twitch chat story engine: viewers vote, a moderator approves, an OBS overlay plays the next chapter | Node 22, TypeScript, WebSocket/SSE | Project `verification/` files report 25 tests, clean `tsc --noEmit` and fixture smoke PASS; not rerun for this index |
| `ugreen-ai-nas-2026/` | UGREEN AI NAS concept | Concept for an AI NAS skill: document intake, OCR/classification, summaries, rules-based actions | Concept only | None (no implementation) |
| `vultr-agent-rush-2026/` | Containment Foreman | Plans work, executes each step in a disposable Docker sandbox, returns receipts with exit status, timing and output hashes | Python (stdlib server), Docker; OpenAI-compatible adapter selectable by environment | Project WORK-STATE (2026-11-04) reports 7 tests; requires Docker, not rerun for this index. Vultr deployment was not performed per project WORK-STATE |
| `zindi-bias/` | Mapping equity baseline | Public-data audit plus a constant-0.5 baseline for the Zindi mapping equity challenge | Python, parquet; gradient-boosting training code verified only on synthetic data, not real labels | Format validation only — the organizer publishes no labels, so real cross-validation is impossible |

## How to run a project

Each project README has its own setup instructions. Node requirements and package managers vary;
for example, Builder.io Triage Desk uses `pnpm`, while AgentCart and Meta AI document Node.js 20+.
Use this only as a repository clone example; it is not a universal project quickstart. Check the
selected project's README for commands:

```bash
git clone https://github.com/Schultzenator/HCTN.git
cd HCTN/<project-directory>
# Follow this project's README; some use pnpm or other commands.
```

Python projects use their own README instructions. Project READMEs and
`.env.example` files document configuration where present. No repository-wide secret scan was
performed for this index; do not infer its result from these files.

## Known gaps

- `chimpx-20261114/` contains only a thread draft, without code or a README.
- `emma-hackathon-2026/` has no project README yet; its submission kit and test notes are in place.
- `raptorx-20261106/` and `ugreen-ai-nas-2026/` are research or concept artifacts, not runnable code.
- `.github/workflows/hctn-ci.yml` is present on the indexed baseline. Its push and pull-request
  triggers were not run for this documentation update; commits use `[skip actions]` under the
  repository's no-GitHub-Actions operating rule.
- `agentcart/`, `amazon-build-ship-shape-2026/`, `aws-cds-agentic-hackathon-2026/`, `dev-hf26-week3/` and `emma-hackathon-2026/` state verification results only in their own READMEs or test notes; this index does not restate unverified numbers.

## Verification standard

A claim counts as verified only when the project records the command output that produced it
(tests, typecheck, demo run). Integrations that need credentials unavailable at build time are
marked unverified rather than "working".
