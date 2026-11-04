# Containment Foreman — Vultr Agent Rush 2026

Containment-first agent that plans useful work and executes each step in a disposable Docker
sandbox. The app is intentionally small enough to deploy on one Vultr VM and uses an
OpenAI-compatible LLM adapter, so Vultr Serverless Inference is selected by environment only.
Each response includes a receipt with exit status, timing, output hashes, policy facts, and
bounded inline artifact metadata; temporary worker files are removed after every step. Workers
run unprivileged with all Linux capabilities dropped and `no-new-privileges` enabled.

## Quick start

```bash
python3 -m app.server
# open http://127.0.0.1:8080
```

Run the checks with `python3 -m unittest discover -s tests -v` (or `pytest -q` after installing
`requirements-dev.txt`). Docker must be available for execution tests.

See [DEMO-MATERIALS.md](DEMO-MATERIALS.md), [deploy/README.md](deploy/README.md), and
[WORK-STATE.md](WORK-STATE.md).
