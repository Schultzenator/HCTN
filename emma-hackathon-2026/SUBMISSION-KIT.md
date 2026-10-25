# FleetPilot — submission kit for PW

Verified 2026-10-22 against the [official hackathon page](https://hackathon.emma.ms/)
and its [form behavior](https://hackathon.emma.ms/main.js). Recheck before submitting.

## Requirements and judging

Showcases permits 1–2 people; PW enters solo. Deadline: **1 December 2026,
23:59 CET** (Warsaw time; 22:59 UTC). Required: **90-second demo video and
GitHub repo**. The demo must show actual emma API/SDK provisioning and first
run. Judging covers end-to-end execution, essential multi-cloud emma use,
originality, and shareability. These are the published Showcases criteria;
no numerical weights are published. [Source](https://hackathon.emma.ms/)

## Step by step

1. Publish the committed project to GitHub. Current remote:
   `https://github.com/Schultzenator/HCTN.git`. Candidate project link:
   **https://github.com/Schultzenator/HCTN/tree/HEAD/emma-hackathon-2026**.
   PW must push the iteration commit and verify this link signed out. Local
   commit creation does not publish it. Prefer a commit permalink for judging.
2. Open https://hackathon.emma.ms/ and click **Apply for hackathon**.
3. Select **Showcases**; paste the application pitch below. Enter a real past
   project link plus two lines, name, and email. State “solo” in the pitch;
   there is no visible team-size field.
4. Click **Submit application** and retain confirmation. Current HTML contains
   `REPLACE_WITH_WEB3FORMS_KEY`, so delivery is unverified. If it fails, PW can
   use **info@emma.ms**, the published fallback; include the same application.
5. After approval, use the supplied credits and **#showcases** channel.
   Ask for final delivery instructions, video host/visibility, and final fields:
   no final-project upload form is publicly exposed today.
6. Resolve the live integration blockers below, rehearse using
   DEMO-VIDEO-SCRIPT.md, and have PW record the 90-second screen demo.
7. Prepare the repo link, accessible video link/file, title, description below,
   PW's contact details and solo track. Deliver using the organizer-confirmed
   final channel before the deadline. Open both links signed out, then save
   the receipt or confirmation. Application acceptance alone is not final delivery.

## Ready-to-paste application pitch

FleetPilot — solo entry, Showcases. I am building a TypeScript GPU fleet assistant
with a CLI and MCP tools for comparing provider offers, selecting a placement
within a budget, deploying, proposing cost savings, and teardown. The current
prototype runs reproducibly against an offline mock. My showcase goal is a real
emma provisioning and first-run demo that makes cross-provider price decisions
visible. The REST adapter still needs validation against emma's actual API.
Repository: https://github.com/Schultzenator/HCTN/tree/HEAD/emma-hackathon-2026

## Ready-to-paste current project description

FleetPilot makes GPU placement decisions inspectable. Its TypeScript planner
compares a multi-provider inventory against VRAM, GPU count, region, spot policy,
and budget constraints, explains its selection, and exposes the same operations
through a CLI and MCP tools. The deterministic offline scenario plans and
simulates deployment, reports fleet cost, proposes a cheaper placement after a
simulated market change, and terminates the mock instance. In that fixture,
hourly cost could fall from $18.99 to $15.75: a projected $2,365.20 saving over
730 hours, not realized savings. Sixteen automated tests and TypeScript checking
pass. Live emma integration and actual GPU execution remain unverified.

This description is accurate for this iteration and can be pasted as-is.
After genuine live validation, update the final paragraph with observed evidence
and attach PW's actual video URL; do not claim the fixture run is cloud execution.

## Submission blockers / PW handoff

- The REST base URL, auth, endpoint paths and schemas in `src/emma/rest.ts`
  are assumptions. Reconcile with official API documentation and sandbox access.
- `--live` only changes the CLI's display label; the presence of
  `EMMA_API_KEY` actually selects the REST client. A label alone proves nothing.
- The scenario uses a placeholder workload image and has no readiness polling,
  SSH execution or first-run logs. Real provisioning and first-run proof require
  additional implementation and live verification before an eligible recording.
- The planner constrains VRAM and GPU count, not GPU model. The scripted H100
  sentence is stricter than the request schema. Describe the current requirement
  as eight 80-GB GPUs; do not promise an H100-only filter.
- Video recording/upload, registration, push/public repo access and final
  delivery are PW's actions. None were performed in this iteration.

The historical RESEARCH.md was written offline; this verified kit supersedes its
hackathon submission and judging assumptions. Its API assumptions remain unresolved.
