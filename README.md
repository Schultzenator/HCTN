# HCTN - bounties

Public workspace for open-source bounty and hackathon projects.

## Projects

| Directory | Project | Stack |
|  | SwarmBid - policy-gated swarm coordination market: agents bid for jobs, containment-first policy engine rejects risky bids, cheapest compliant bid wins with auditable receipt (NEAR Hackathon 2026, AI Swarms + Security tracks) | TypeScript, near-api-js, testnet RPC |
|---|---|---|
| `agentcart/` | AgentCart - autonomous shopping agent, end-to-end PayPal sandbox purchase flow (PayPal AI Hackathon 2026) | Express, TypeScript |
| `amazon-build-ship-shape-2026/` | Household Ops MCP - self-hosted MCP server, Streamable HTTP, Alexa+ track (Amazon Build, Ship, Shape 2026) | TypeScript, MCP |
| `aws-cds-agentic-hackathon-2026/` | OmniLoop - agentic omnichannel commerce agent on AWS CDS (EUM SMS/RCS, WhatsApp, SES + Bedrock) | TypeScript, AWS SDK |
| `open-agent-hackathon-2026/` | Opportunity Radar - evidence-first opportunity federation, dedup and LLM ranking with audit evidence (Open Agent Hackathon 2026, genai.works) | TypeScript, Node 22 |
| `dev-hf26-week3/` | Tortoise - slow-and-steady daily planner: Gemma picks one anchor task, deterministic guardrails decide, streak counter rewards consistency (DEV Hacktoberfest Week 3 2026, "Slow and Steady") | TypeScript, zero deps |
| `twitchcon-chat-relay-2026/` | Chat Relay Studio - cooperative Twitch chat story engine: viewers vote, a moderator approves, an OBS overlay plays the next chapter (Codex x TwitchCon Hackathon 2026) | Node.js 22, TypeScript, WebSocket/SSE |

See each project directory for its own README, quickstart and demo.

## Chat Relay Studio (Codex x TwitchCon Hackathon submission) - how to set up and run

Full instructions: [twitchcon-chat-relay-2026/README.md](twitchcon-chat-relay-2026/README.md).

Quickstart with the bundled fixture (Node 22, no accounts needed):

```bash
git clone https://github.com/Schultzenator/HCTN.git
cd HCTN/twitchcon-chat-relay-2026
npm install
npm test
npm run typecheck
npm run demo
```

Open **http://127.0.0.1:3210**. The fixture starts a 15-second voting round automatically; after the countdown click **Approve winning scene** in the moderator panel.

To connect a real Twitch channel: `cp .env.example .env`, fill `TWITCH_CHANNEL`, `TWITCH_USERNAME` and `TWITCH_OAUTH_TOKEN` (user token, scope `chat:read`, implicit flow, redirect `http://localhost:3210`), then `npm run build && npm start`. OBS overlay: browser source `http://127.0.0.1:3210/overlay` (1920x1080). Details: [project README](twitchcon-chat-relay-2026/README.md).
