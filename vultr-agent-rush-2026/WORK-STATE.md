# Work state — 2026-11-04

## Done

- Brainstorm Gate recorded in `ANALYSIS-20261104.md`.
- Implemented provider-neutral planner adapter with deterministic fallback.
- Implemented disposable Docker runner with network, filesystem, memory, CPU, PID, timeout,
  secret-hygiene, and lifecycle controls.
- Added minimal web demo and JSON receipts.
- Added containment tests for destructive code, timeout, network isolation, host-path isolation,
  secret hygiene, and artifacts (7 tests).
- Added Vultr deployment notes, Docker Compose/cloud-init starters, and submission video/slide outline.

## Remaining before submission

- Copy/push this directory into `Schultzenator/HCTN/vultr-agent-rush-2026/` from the writable
  HCTN checkout and make the GitHub repo public.
- Provision the Vultr VM and set the three LLM adapter env vars to Vultr Serverless Inference.
- Record the video using `DEMO-MATERIALS.md`, export the 7-slide deck, and add URLs to the lablab
  dashboard.
- PW performs the lablab submission before 2026-11-08 14:00 UTC.

## Verification

`python3 -m unittest discover -s tests -v` passes: 7 tests, including real Docker network
isolation, timeout cleanup/cap, destructive-code policy rejection, host-path isolation, secret
hygiene, and artifact reporting. Workers now also run as UID 65534 with all Linux capabilities
dropped, `no-new-privileges`, and a file-descriptor limit.
Python compilation and an HTTP smoke test also passed; the smoke test returned `summary.json`
as bounded inline artifact metadata in the receipt, then removed the temporary staging file as
designed. `pytest` is declared in `requirements-dev.txt`, but is not installed in this workspace,
so the equivalent unittest suite was used for local verification.
Docker image pulls may be required on a fresh machine. No payment, account creation, or external
submission was performed by this worker.

## Session boundary

The available HCTN checkout is outside this workspace's write scope, so this session could not
copy, commit, or push the directory. The complete source tree is in the current workspace and is
ready to be copied to `HCTN/vultr-agent-rush-2026/` by a workspace with write access.
