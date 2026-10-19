# AgentCart 🤖🛒

**Demo video:** <https://youtu.be/h5UkuMXQs9g>

**An autonomous shopping agent that turns a goal into a completed PayPal purchase.**

Give it a natural-language mission like *"set up a home office for $300"* and watch it:
plan the purchase, pick items within budget, create a PayPal order, get buyer approval,
capture the payment, and handle after-sales (out-of-stock substitution, partial refund) —
end to end, fully autonomously.

> Built for the **PayPal AI Hackathon 2026** (sandbox only — no real money is ever moved).
> AI-assisted development is disclosed transparently: the agent layer itself is the product.

## Quickstart

```bash
npm install
cp .env.example .env        # defaults work out of the box (mock mode)
npm run demo                # → http://localhost:3000
```

Default mode needs **no keys at all**:

- `MOCK_PAYPAL=1` — a simulated PayPal Orders API (same request/response shapes as the real one).
- `AGENT_MODE=scripted` — deterministic planner, no LLM key required.

### Real PayPal sandbox (recommended for full fidelity)

1. Log in at <https://developer.paypal.com> (a personal account is enough).
2. **Apps & Credentials → Sandbox → Create App** → copy Client ID / Secret.
3. Put them in `.env` (`MOCK_PAYPAL=0`, fill `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`).
4. Use the sandbox **personal** test account (from Developers → Sandbox → Accounts)
   to approve the order when the agent asks.

Sandbox credentials are fake by design (no real money); sharing sandbox test creds is
explicitly allowed by the hackathon rules.

### Optional: LLM brain

`AGENT_MODE=openai` or `AGENT_MODE=mistral` + the matching API key switches the planner
from deterministic rules to an LLM tool-calling loop. The scripted mode remains the
zero-dependency fallback so judges can always run the demo.

## Demo script (3 minutes)

1. Open http://localhost:3000, enter: `Set up a home office for $300`.
2. Agent plans: desk, lamp, keyboard, mouse… picks items, stays under budget.
3. Agent creates a PayPal order → click the approval link (sandbox buyer login or mock).
4. Agent captures the payment → live receipt with PayPal capture ID.
5. Curveball: one item goes out of stock → agent substitutes it within budget.
6. After-sales: partial refund flows through the PayPal API — visibly on the receipt.

## Project layout

```
src/
  server.ts          # Express app + API routes + static UI
  config.ts          # env parsing (sandbox hard-locked)
  store/catalog.ts   # demo merchant catalog
  paypal/client.ts   # PayPalGateway interface + Live (Orders v2) + Mock implementations
  agent/scripted.ts  # deterministic planner (default brain)
public/index.html    # single-page demo UI
docs/                # demo script, submission draft, evidence
```

## Tools used

- **AI-assisted development** (disclosed per hackathon rules): planning/pair-programming
  sessions with LLM agents; all code reviewed and committed by the entrant.
- Runtime: Node.js 20+, TypeScript, Express. No database, no external services.

## License

MIT (see LICENSE).
