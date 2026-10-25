# RESEARCH — emma hackathon, Showcases track

Status: compiled offline. Live web access (hackathon.emma.ms, docs.emma.ms) was
denied by this session's approval callback, so this document separates
**confirmed facts** (from the task brief) from **assumptions that PW must verify
before submitting**.

## 1. Hackathon — confirmed facts (from the task brief)

| Item | Value |
|---|---|
| Organizer | emma (hackathon.emma.ms) |
| Product | emma — API/SDK for provisioning and managing GPU instances across multiple clouds (multi-cloud GPU infrastructure) |
| Track | Showcases — solo-friendly |
| Required deliverables | 90-second demo video + public GitHub repository |
| Deadline | 2026-12-01 23:59 CET |
| Budget | Free emma credits for the duration (registration handled by PW — do not register anything from this repo) |
| Prize pool | $50,000 (per task title — verify split per track) |
| Judging rubrics | Innovation, practicality, demo quality |

## 2. Submission format (confirmed + to verify)

Confirmed by the brief:

1. A public GitHub repository with working code.
2. A demo video of about 90 seconds.
3. Submission through the hackathon portal before the deadline.

To verify on the portal (cannot be checked offline):

- Exact form fields (video link? repo link? written summary? team size?)
- Whether the video must be uploaded (YouTube unlisted vs. direct upload)
- Whether credits require a registered emma account bound to the submission
- Any required hashtags, licenses or naming conventions

## 3. What emma is (positioning, high confidence)

emma is a multi-cloud GPU infrastructure control plane: one API and SDK to
discover, provision, manage and tear down GPU compute across hyperscalers and
neoclouds, with unified billing. The value proposition relevant to this project:

- **Federation**: one inventory of GPU offers across many providers/regions.
- **Unified lifecycle**: create/list/terminate instances through one API
  regardless of the underlying cloud.
- **Pricing transparency**: on-demand and (where available) spot pricing per
  offer — the raw material for cost optimization.
- **Developer-first**: REST API with API-key auth, SDKs, developer docs.

## 4. Assumed API shape (to reconcile with the real OpenAPI spec)

The project isolates all emma-facing assumptions in one interface
(`src/emma/client.ts`) and one adapter (`src/emma/rest.ts`):

| Assumption | Notes for verification |
|---|---|
| Auth: `Authorization: Bearer <EMMA_API_KEY>` | Confirm header/scheme (could be `x-api-key`) |
| Base URL: `https://api.emma.ms/v1` | Confirm host and versioning from docs |
| `GET /offers` → GPU offer inventory (provider, region, GPU type, price/h, spot price) | Confirm resource name (`offers` vs `instances/types` vs `gpu`) and response schema |
| `GET /instances` → running instances | Confirm |
| `POST /instances` `{ offerId, workload, useSpot, image, command }` | Confirm required fields (image? startup script? SSH keys?) |
| `DELETE /instances/{id}` | Confirm (vs `POST /instances/{id}:terminate`) |

The mock client (`src/emma/mock.ts`) implements the same interface with a
deterministic multi-provider market, so the agent, optimizer, MCP server, CLI and
tests all run offline without a key. Switching to the real API is one environment
variable: `EMMA_API_KEY` (see README).

## 5. Judging rubrics → project mapping

| Rubric | How FleetPilot scores |
|---|---|
| Innovation | GPU fleet ops exposed as an MCP server: any MCP-capable LLM client (Claude Desktop, IDE agents) can deploy and optimize multi-cloud GPU fleets in natural language; deterministic, evidence-based cost optimizer (spot vs on-demand, cross-provider migration) — not a wrapper, a decision layer with auditable rationale |
| Practicality | Runs offline in mock mode with zero runtime dependencies; single-env-var switch to the real emma API; realistic operations (plan → deploy → status → optimize → teardown) |
| Demo quality | Deterministic 90-second scripted run: live terminal, real code walkthrough, visible savings math; PL+EN voiceover, captions as a separate CC track (never burned into the picture) |

## 6. Verification checklist for PW (before recording/submitting)

1. Open hackathon.emma.ms and copy the exact Showcases submission requirements
   into SUBMISSION-KIT.md (form fields, video hosting, any required text).
2. Open the emma developer docs / OpenAPI spec and reconcile the table in
   section 4 with `src/emma/rest.ts` (one file, endpoint map at the top).
3. Register on emma, create an API key, set `EMMA_API_KEY` and run
   `npm run demo -- --live` once against the sandbox/credits environment.
4. Confirm the deadline in local time (2026-12-01 23:59 CET) on the portal.

## 7. Sources

- Task brief (PW) — facts in section 1.
- General knowledge of emma's public positioning — sections 3-4 assumptions.
- No live pages were fetched this session (network denied); nothing in this
  document is quoted from a fetched page.
