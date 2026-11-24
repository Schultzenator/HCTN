# HCTN — repository work state

Updated: 2026-11-24 (repository index refresh).
Baseline commit: `b14c6bb02cff92c1b853699baf7268151dff28a4` (2026-11-10).

## What this file is

Repository-level state: what exists, what is verified, what is not. Per-project scope,
quickstart, tests and limitations live in that project's own README. Per-project work logs stay
next to their code (for example `emma-hackathon-2026/WORK-STATE.md`).

## Current state

- 18 project directories under `main`, listed and described in [README.md](README.md).
- TypeScript/Node code projects (execution not verified for this index): `agentcart`, `airwallex-banking-2026`, `amazon-build-ship-shape-2026`, `aws-cds-agentic-hackathon-2026`, `builderio-agent-native-2026`, `dev-hf26-week3`, `emma-hackathon-2026`, `meta-ai-hackathon-2026`, `near-swarmbid-20261114`, `open-agent-hackathon-2026`, `twitchcon-chat-relay-2026`.
- Python code projects (execution not verified for this index): `flip-the-switch-2026`, `vultr-agent-rush-2026` (Docker required), `name-that-llm`, `zindi-bias`.
- Non-code artifacts: `chimpx-20261114` (thread draft), `raptorx-20261106` (research reports), `ugreen-ai-nas-2026` (concept).
- This repository contains source and documentation; whether a project is deployed or published elsewhere is not tracked here.
- Project READMEs document configuration and provide `.env.example` files where present. No repository-wide secret scan was performed for this index.

## Verification standard

A statement is "verified" only when the project records the command and its output (tests,
typecheck, demo run, smoke test). Third-party integrations that could not be exercised without
credentials or accounts are recorded as unverified, never as working.

## Known gaps

- `chimpx-20261114`: thread draft only — no code, no README.
- `emma-hackathon-2026`: no project README yet; submission kit, test notes and demo script are present.
- `raptorx-20261106`, `ugreen-ai-nas-2026`: research and concept artifacts, not runnable code.
- `zindi-bias`: no real cross-validation is possible because the organizer publishes no labels; only submission-format validation was performed.
- `name-that-llm`: measured attribution quality is low (accuracy ≈ 0.104); the number is reported as measured, not as a success.
- `vultr-agent-rush-2026`: its README describes a deployable VM design, but its project WORK-STATE lists deployment as remaining work; no deployment is claimed here.
- `.github/workflows/hctn-ci.yml` is present on the baseline and targets `amazon-build-ship-shape-2026`. Its push and pull-request triggers were not run for this documentation update; commits use `[skip actions]` under the repository's no-GitHub-Actions operating rule.

## History

This repository-level state supersedes the previous root `WORK-STATE.md` on 2026-11-24. The
previous file remains available in Git history at commit `b14c6bb` and earlier; its historic
contents were not audited as part of this index update.
