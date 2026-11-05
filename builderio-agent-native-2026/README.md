# Triage Desk

Built for the [Builder.io Agent-Native Hackathon](https://builder.io/hackathon) (November 2026).

**One shared queue. The agent drafts. You approve.**

Triage Desk is a support inbox for a small coffee-shop business. Incoming mail lands in one queue.
An AI agent classifies every message (category, priority, next step) and drafts a reply.
A human reviews the draft, edits it if needed, and approves — or rejects with a note.
The desk UI and the agent operate on the same queue through the same actions, so you can watch the
agent work live while you keep full control.

## The agent-native idea

Every capability is defined once with `defineAction()` and shared by the React UI and the agent:

| Action | Who calls it |
|---|---|
| `list-items` | UI (queue view) + agent |
| `queue-stats` | UI (filter counters) |
| `add-incoming-items` | UI ("Simulate incoming mail" button) |
| `record-triage` | agent (writes category, priority, suggested action, draft reply) |
| `update-draft` | UI (human edits the agent's draft) |
| `approve-item` | UI only — the agent never sends |
| `reject-item` | UI only — the agent never rejects |

The agent can classify and draft, but only a human can approve and send. That split is the product.

## Demo

Public Clips recording: https://clips.agent-native.com/r/0lA6SPG56KEZ

The demo shows: the pending queue, new mail arriving, the agent triaging in chat (tool calls visible),
cards flipping to "reviewed" with drafts, a human editing a draft, and approving one message.

## Stack

- [Agent-Native](https://agent-native.com) framework (@agent-native/core) — actions, agent chat, live sync
- React + Vite, TypeScript
- Mistral (mistral-large-latest) via the built-in AI SDK provider

## Run locally

```bash
pnpm install
echo "MISTRAL_API_KEY=your-mistral-api-key" > .env
echo "AUTH_DISABLED=true" >> .env
pnpm dev
```

Open http://localhost:8081/desk for the queue, or chat with the agent at http://localhost:8081/ .

## Try it

1. Press **Simulate incoming mail** a few times.
2. Tell the agent in chat: *"Triage the pending support queue now"* — it will call `list-items` and `record-triage` for each message.
3. Switch to **Needs review** on the desk, edit any draft, then **Approve & send**.

Author: Piotr Szutt (solo).
