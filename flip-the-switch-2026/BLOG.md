# A human-gated incident agent in a Switch room: a first-timer's walkthrough

If you have ever been on call, you know the shape of the problem. A watchdog alert fires at 2 AM, and the hardest question is not "what happened?" but "what is safe to do about it right now?". Autonomous agents make that question scarier, not easier — an LLM with write access to your cluster at 2 AM is not a workflow, it is a liability.

For the Flip the Switch Hackathon we built **Graveyard Foreman**: an incident triage agent that joins the team chat through Switch, classifies incoming reports, proposes exactly one safe next action, and refuses to do anything consequential until a human replies `approve`. This post walks through what we built, how we set it up with Switch, and what we learned — written for someone who has never used Switch before.

## What Switch actually is (30 seconds)

Switch is open-source infrastructure for putting AI agents into team chat. Each channel becomes a **room**, and agents join rooms like teammates — with their own name, avatar, and instructions. The agent protocol is deliberately small: server-sent events in, HTTP out. Anything that speaks it can join a room, whatever it was built with.

Switch ships no agents and no models. You bring your own — Claude Code, Codex, OpenCode, or a custom one like ours — and Switch connects it to Slack, Microsoft Teams, Discord, Telegram, or Mattermost. Switch Console, the desktop app, runs your agents, starts a local server in Docker, and bridges your chat apps.

## What we built

Graveyard Foreman is a triage agent for small ops teams that receive noisy watchdog alerts after hours. An operator posts an incident in the room. The Foreman then:

1. restates the report in one line,
2. classifies it **P0 / P1 / P2** and shows the evidence it used,
3. proposes **exactly one** safe next action — never a menu, never two — and waits.

Nothing consequential executes until a human replies `approve`. A `reject` puts the action on HOLD with no side effect. Every report, proposal, decision, and receipt stays in the room, so the channel itself becomes the audit trail:

```
Piotr · human     payments-api: all users cannot pay. 100% 5xx after deploy 1842 at 09:42Z.

Foreman · agent   P0. Evidence: 100% 5xx on /v1/charge, started 09:42Z, one deploy at 09:40Z.
                  Proposed action: freeze deploys and page on-call. Approval required.

Piotr · human     approve

Foreman · agent   Executed. Deploys frozen, on-call paged. Receipt #r-882 written to this room.
```

The rejected path matters as much as the happy one. A second exchange in our demo ends with `reject` — the Foreman replies `Action on HOLD. No changes made.` and the room keeps the full record of a decision *not* to act, which is exactly the thing that is impossible to reconstruct from shell history.

## Setup, step by step (what we actually did)

1. **Start Switch Console.** It runs a local server in Docker. For the chat side we used the Mattermost instance bundled with Switch — which means the entire demo runs without a company workspace, without asking anyone for admin access, and without touching production Slack.
2. **Create the room.** One channel on the bridge: `#graveyard-foreman`.
3. **Import the room template.** `switch-room.yaml` in the repo declares the agent (name, description, addressing, instructions) and the room (name, bridge, agents, users). The YAML deliberately leaves provider names and credentials as placeholders — no secrets in a public repo.
4. **Point the provider at your agent.** The template is written for Codex or Claude Code in production. For the recorded demo we went one step more boring: a pure-Python state machine (`foreman.py`), so the run is deterministic, reproducible, and needs no API key at all.
5. **Post the incident.** Paste the report from `demo/CHAT-TRANSCRIPT.md` into the room and watch the gate work: triage, proposal, approval, receipt.

## The pattern worth stealing: the approval gate

The transferable idea is not the triage — it is the discipline around the moment of action:

- **One action per proposal.** A single recommendation forces prioritization and keeps the human decision simple.
- **An explicit approve/reject vocabulary.** No "sure, go ahead" ambiguity; the agent only recognizes the exact words.
- **A receipt written back to the room.** If the action does not leave a note in the same channel it was approved in, you will not find it at 9 AM.
- **Reject means HOLD, not failure.** The agent must be able to hear "no" without breaking the workflow.

This is what makes the room metaphor more than cosmetic: report, decision, and receipt live where the team already talks, instead of being split across a private bot DM and an opaque automation log.

## What we learned

- **The room is the unit of work.** Agents showing up as members with roles and instructions — rather than opaque side-channel bots — is what convinced the teammate in our demo that the transcript is the audit trail.
- **The bundled Mattermost is quietly the best onboarding feature.** Building and recording a realistic demo without asking anyone for workspace access removes the single biggest friction in agent-at-work experiments.
- **The protocol is small enough to be boring, in the best way.** A ~200-line deterministic Python agent could join a room with no framework lock-in. That is the test of an open protocol.

What we would want next from Switch: a **first-class approval-gate primitive** — a room-level object for actions that require human sign-off, with built-in approve/reject and a receipt — so every team does not reinvent this pattern in prompt text; and room templates that ship one command away from the agent's first reply, to shorten the gap between importing a room and seeing it work.

## Run it yourself (two minutes)

```bash
git clone https://github.com/Schultzenator/HCTN
cd HCTN/flip-the-switch-2026
python3 foreman.py demo
python3 -m unittest -v
```

The demo plays the full safety-critical sequence — human report, triage, proposed action, human approval, action receipt — plus a rejected action and an incomplete report. The engine refuses to execute in both failure cases, and the tests pin that behavior down.

Switch's pitch for this hackathon was "turn your solo agent into a teammate". After a weekend of dogfooding it, our honest summary: the room metaphor is what makes human-in-the-loop automation feel safe enough to actually deploy — and the moment you stop letting the agent improvise consequential actions is the moment your teammates stop muting it.
