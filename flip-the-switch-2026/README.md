# Graveyard Foreman

Human-approved incident triage in a Switch room.

Graveyard Foreman is a small Track 1 reference workflow for teams that receive noisy watchdog alerts after hours. A person reports an incident in the team chat; the Foreman classifies it as P0/P1/P2, explains the evidence, and proposes one safe next action. It never executes a consequential action until a human replies with `approve`.

## Why Switch matters

Switch is the shared room and audit trail: the operator, the Foreman agent, and any future specialist agent see the same report, proposal, decision, and receipt in the chat where the team already works. Without Switch, the human approval and agent handoff would be split across a private bot and an opaque automation log.

This repository contains a deterministic local demo plus a Switch room template. The local demo does not pretend to be a live Discord/Telegram bridge; it is designed to be reproducible without a paid model or production credentials. The room template can be loaded into Switch Console and the same instructions can be used with Codex, Claude Code, or another compatible agent.

## Run the demo

```bash
cd flip-the-switch-2026
python3 foreman.py demo
python3 -m unittest -v
```

The demo shows the complete safety-critical sequence:

`human report → triage → proposed action → human approval → action receipt`

It also includes a rejected action and an incomplete report. The engine refuses to execute in both cases.

## Switch setup

1. Start Switch Console and connect a supported chat bridge (Mattermost is suitable for a local demo; Discord/Slack/Teams are supported by Switch).
2. Import or adapt [`switch-room.yaml`](switch-room.yaml).
3. Configure the provider placeholder for the agent you already use.
4. Post the incident from [`demo/CHAT-TRANSCRIPT.md`](demo/CHAT-TRANSCRIPT.md) in the room.
5. Record the visible human approval and receipt for the submission demo.

The YAML deliberately leaves credentials and provider names as placeholders. No secrets belong in this repository.

## Project shape

- `foreman.py` — pure-Python state machine and transcript runner;
- `test_foreman.py` — tests the triage and approval guardrails;
- `switch-room.yaml` — Switch room/agent template;
- `demo/CHAT-TRANSCRIPT.md` — screencast-ready chat script;
- `SUBMISSION-KIT.md` — one-pass submission copy and checklist.

## Limitations

This is a hackathon reference implementation, not a production incident automation system. The action receipt is simulated and intentionally side-effect free. A production adapter should add authentication, idempotency, durable storage, and an explicit allow-list of actions.

## License

MIT
