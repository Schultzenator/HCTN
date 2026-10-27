---
marp: true
theme: default
size: 16:9
paginate: true
title: Opportunity Radar
description: Open Agent Hackathon 2026 submission deck by Piotr Szutt / Agent Foundry
style: |
  section { background: #101c2d; color: #edf3f8; font-family: Arial, sans-serif; padding: 64px 78px; font-size: 29px; }
  h1 { color: #72e8bd; font-size: 54px; letter-spacing: -1.5px; }
  h2 { color: #72e8bd; font-size: 42px; letter-spacing: -0.6px; }
  p, li { line-height: 1.45; }
  strong { color: #72e8bd; }
  code { background: #20334b; color: #edf3f8; font-size: 23px; }
  pre { background: #20334b; padding: 24px; }
  a { color: #8bc7ff; }
  table { font-size: 24px; color: #edf3f8; }
  tr, th, td { background: #101c2d !important; border-color: #48617c !important; }
  section::after { color: #a9b9c9; font-size: 18px; }
---

# Opportunity Radar

One ranked brief with source evidence

Piotr Szutt / Agent Foundry\
Solo builder

Open Agent Hackathon 2026\
Track 01: Solving Fragmented Intelligence

---

## Fragmented opportunity discovery

Developers compare hackathon calendars, bounty boards and GitHub issues by hand.

The same listing can appear in several places. Source attribution gets lost, and an unlinked rumor can look like a valid lead.

**Radar preserves the source links in a brief the developer can review.**

---

## A reproducible offline workflow

# 8 records · 6 unique · 5 recommendations

Three synthetic source datasets feed the same pipeline.

Shared evidence links merge duplicate records. The evidence gate excludes one unlinked rumor before ranking.

The demo uses a **deterministic mock**, with no API key or external LLM call.

---

## Pipeline and extension points

1. SourceProvider plugins collect records concurrently.
2. URL normalization and connected duplicates retain attribution.
3. The evidence gate requires valid HTTP(S) provenance.
4. ModelProvider ranks eligible records against a profile.
5. Output validation checks IDs, complete coverage and scores.
6. The Markdown report includes explanations and source links.

Strict TypeScript / Node.js 22 / built-in Node test runner

---

## Product output: one attributed recommendation

```text
1. Agent Federation Challenge mirror — 100/100
Tags: agents, data, open-source, typescript
Why: Profile tag matches: agents, data,
     open-source, typescript. 3 evidence links.
Evidence:
  fixture:bounty-board .../synthetic/agent-federation
  fixture:calendar     .../synthetic/agent-federation
  fixture:bounty-board .../synthetic/board/agents
```

Excerpt from the actual offline report, URLs shortened for display.\
All opportunities and links in this demo are illustrative fixtures.

---

## Ranking and review

The default profile is `typescript agents data open-source`.

Mock scores reflect exact profile/tag matches and evidence count, with a deterministic tie break. A different profile changes the ranking.

**Evidence links establish provenance.** They do not confirm payment, eligibility or deadlines.

External model responses must include every eligible ID exactly once, a score in 0–100 and a nonempty explanation.

---

## Reliability and current scope

**20 tests pass** across the CLI, pipeline and adapter contracts.

Tests cover transitive deduplication, source failure isolation, the evidence gate, malformed model output and safe Markdown rendering.

Optional live mode fetches GitHub issues. Calendar and board sources remain synthetic. GitHub errors trigger a disclosed fixture fallback.

HTTP tests use fake fetchers. This demo stays offline.

---

## Sponsor technology: exact status

| Technology | Implementation and remaining work |
| --- | --- |
| Meterless / NVIDIA Nemotron | Generic OpenAI-compatible adapter ready. No verified sponsor call. Provision endpoint, key and model, then validate a real run. |
| Zetaris | No integration. SourceProvider is an extension point only. A real connector and execution evidence remain to build. |
| Cursor | Not used. No usage or bonus claim. |

The current build does not demonstrate completed sponsor integration. Meterless prompt-library integration is also absent.

---

## Next work and delivery

Next: connect a Zetaris view, verify Meterless/Nemotron ranking, replace calendar fixtures and extract eligibility with evidence.

**Pre-existing code disclosure:** implementation commit `77a0e64` dates to 21 October 2026, before the 22–27 October build window. This kit adds demo media and submission documentation. Eligibility requires organizer confirmation.

Code: [github.com/Schultzenator/HCTN](https://github.com/Schultzenator/HCTN/tree/main/open-agent-hackathon-2026)\
Run: `cd open-agent-hackathon-2026 && npm ci && npm run demo`

Piotr Szutt / Agent Foundry
