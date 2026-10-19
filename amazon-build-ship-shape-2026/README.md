# Household Ops MCP - Alexa+ track (Amazon Build, Ship, Shape 2026)

A self-hosted **MCP server** (Model Context Protocol, spec 2025-11-25 and later, **Streamable HTTP transport**) that gives Alexa+ a deterministic, useful set of household tools: a shared shopping list, a fair weekly chore roster, and a family-safe movie night planner.

MCP is the open standard that powers Alexa+ integrations. This server is fully self-contained: no external services, no API keys, no secrets - a brand-new integration can run and be evaluated end to-end in minutes.

## Why this project

- **Real work, deterministic core.** Every tool is pure and reproducible: same arguments give the same result. Great for a voice assistant: predictable, explainable, testable.
- **Streamable HTTP, not stdio.** Alexa+ talks to self-hosted MCP servers over HTTP. We implement the spec-correct surface: `POST /mcp` (JSON-RPC), `GET /mcp` returns 405 in stateless mode, `DELETE /mcp` terminates sessions.
- **Household-first design.** Tools are modeled the way families actually talk: "add oat milk", "who has kitchen this week?", "plan a movie under 90 minutes for everyone".

## Tools

| Tool | What it does |
|---|---|
| `household_summary` | One-call morning briefing: members, shopping list, chore roster |
| `add_grocery_item` | Add/bump an item on the shared shopping list |
| `get_shopping_list` | Read the shared shopping list |
| `assign_chores` | Deterministic, fair weekly chore rotation (same week => same roster) |
| `plan_movie_night` | Family-safe movie pick from the house catalog with reason and backup |

## Quickstart

```bash
npm install
npm run build
PORT=3001 npm start   # -> http://localhost:3001  (POST /mcp)
```

Open `http://localhost:3001/` for a landing page, and run a simulated Alexa+ turn:

```bash
bash demo/demo-alexa-turn.sh
```

## Test

```bash
npm test
```

The suite covers the full Streamable HTTP lifecycle: `initialize` handshake, `notifications/initialized`, `tools/list`, `tools/call` (state round-trip), determinism of the chore roster and movie planner, plus spec-correct `405` behavior for `GET /mcp` in stateless mode.

## Project structure

```
src/server.ts   # Streamable HTTP transport wiring (node:http, stateless JSON mode)
src/tools.ts    # MCP tool registrations (zod schemas)
src/state.ts     # Deterministic household state & planning core
test/            # integration + unit tests (node:test)
demo/            # simulated Alexa+ turn script
```

## Built for

Amazon "Build, Ship, Shape" Developer Hackathon 2026 - **Alexa+ track**: build a self-hosted MCP server (spec 2025-11-25 or later, Streamable HTTP). AI-assisted development is disclosed transparently; the agent-facing tool design is the product.
