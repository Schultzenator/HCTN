MIT licensed — see [LICENSE](LICENSE).

# IntentPay

An agent can propose a purchase. Only a deterministic TypeScript policy engine can authorize it, within an owner's Ed25519-signed intent. IntentPay combines a locked FX quote, a cumulative base-currency budget, exact merchant allowlists, human escalation, JIT single-use virtual cards, payouts, and a replayable file audit. No LLM participates in authorization.

Built for the Airwallex Agentic Banking Hackathon, Variant A + JIT cards hybrid. Node 22, TypeScript, no database. Streamable HTTP MCP follows the stateless JSON transport pattern from Household Ops MCP in this HCTN repository.

## Run the complete demo

```bash
cd airwallex-banking-2026
npm ci
npm run typecheck
npm test
npm run demo
```

The demo needs no credentials, external services, or manual input. It starts real local HTTP servers for Airwallex contracts and MCP, makes MCP tool calls, asserts the results, then closes both servers and exits 0. It explicitly uses mock mode even if your shell contains sandbox credentials. Policy inputs, IDs, FX, keys, decisions, and audit timestamps are fixed; only the unique audit directory and ephemeral ports vary.

Expected story:

1. Owner signs a USD 150 intent for EUR purchases at `monitor-store`, expiring at 13:00 UTC.
2. Agent proposes EUR 108. Locked fixture rate 0.90 EUR/USD means USD 120: **APPROVE**. Issue a single-use virtual card with a USD 120 native authorization limit, EUR-only transactions and intent expiry; simulate an allowed authorization.
3. Agent proposes EUR 180, costing USD 200, against USD 30 remaining: **REJECT_BUDGET_EXCEEDED**. No payment occurs; console human approval request appears.
4. Simulated owner records approval and signs a **new** USD 220 intent. The original rejection remains in the audit.
5. A new request under the replacement intent executes a quote-bound **payout**, returning `SENT`.
6. Reconcile transactions, ingest an authenticated webhook, retrieve the audit through MCP, and replay all three decisions with `match=true`.

Each run writes `data/demo-<run>/audit.jsonl`, its signed envelope and public key. The output prints the exact replay command. The fixture private key in `src/fixtures.ts` is public test material; the server never trusts it by default.

## Owner keys and a purchase

Generate a fresh owner key pair, edit the example's expiry to a future timestamp with an explicit UTC offset, and sign it. Use new UUIDs for new intents and new purchases.

```bash
npm run intent -- keygen
# Edit examples/intent.json: expiry, budget, currencies and merchants.
npm run intent -- sign examples/intent.json data/envelope.json
export INTENTPAY_PUBLIC_KEY_PATH=data/owner-public.pem
npm run purchase -- data/envelope.json examples/purchase.json
npm run audit -- query
npm run audit -- replay
```

With neither Airwallex credential set, this CLI starts a local HTTP mock automatically. The mock supports USD→EUR at 0.90 and same-currency fixtures. Real sandbox supports pairs enabled on your account. The example uses the card rail; change `rail` to `payout` and use a new purchase UUID to exercise payouts. A purchase selects exactly one rail; issuing a card and paying a transfer for the same purchase would duplicate spending.

Private key generation refuses to overwrite existing keys. Keep `data/owner-private.pem` with the owner, separate from the agent and MCP server. The server needs only the trusted public key. Signature input is UTF-8 compact JSON of the normalized `intent` object with recursively sorted object keys, original array order, and every schema field included (including `feeReserveMinor`, default `"0"`). Signature is a base64-encoded Ed25519 signature. The public key is never supplied by the caller.

[schemas/signed-intent.schema.json](schemas/signed-intent.schema.json) documents the signed wire format; `src/domain.ts` is the runtime schema and policy source. Amounts are **integer strings in minor units**, not floating-point prices: USD `"15000"` = USD 150, JPY `"150"` = JPY 150, KWD `"1234"` = KWD 1.234. Supported currency exponents are explicit; unknown currencies fail validation. Quote source costs round **up** to the smallest supported base unit. Expiry is exclusive and compared as an absolute timestamp, including across DST offsets.

`budgetMinor` is the cumulative cap per immutable intent ID, `merchants` uses exact case-sensitive IDs, `targetCurrency` is the purchase currency, `expiresAt` is the deadline, `humanAboveMinor` optionally requests review above a per-purchase base cost, and `feeReserveMinor` reserves additional base units for each action. Budget cost is quoted base amount plus fee reserve. The transfer requests beneficiary-paid fees; the beneficiary may receive less than the face amount. Rail/network fees beyond configured reserves are not independently estimated by this demo.

## Real Airwallex sandbox

Export variables in the shell; `.env.example` is a reference and is **not** loaded automatically.

```bash
export AIRWALLEX_CLIENT_ID='your-sandbox-client-id'
export AIRWALLEX_API_KEY='your-sandbox-api-key'
export AIRWALLEX_BASE_URL='https://api.sandbox.airwallex.com'
export AIRWALLEX_CARDHOLDER_ID='existing-sandbox-cardholder-id'
export AIRWALLEX_MERCHANT_BRANDS_JSON='{"monitor-store":["existing-airwallex-merchant-brand-id"]}'
export AIRWALLEX_BENEFICIARIES_JSON='{"monitor-store":"existing-sandbox-beneficiary-id"}'
# For a scoped key covering multiple accounts, if required:
# export AIRWALLEX_LOGIN_AS='target-account-id'
export INTENTPAY_PUBLIC_KEY_PATH=data/owner-public.pem
npm run purchase -- data/envelope.json examples/purchase.json
```

Use a funded sandbox account with transactional FX, transfers and/or issuing permissions enabled, a compatible issuing program, existing cardholder and merchant-brand controls entitlement for the card rail, and a pre-provisioned beneficiary valid for LOCAL EUR transfers for the payout rail. Beneficiary destinations and merchant-brand mappings come from trusted configuration, never agent input. Look up brand IDs through Airwallex's Merchant Brands API, then map each exact gateway merchant ID in `AIRWALLEX_MERCHANT_BRANDS_JSON`. Card creation fails closed when its merchant lacks a nonempty mapping; it never issues an unrestricted card as fallback. Account-specific onboarding and entitlements remain Airwallex prerequisites. Authentication exchanges client ID/API key for a cached expiring token. Requests use API version `2024-09-27`, a 10-second timeout, and purchase UUIDs as idempotent request IDs.

When both credentials are absent, `configuredAirwallex()` starts the local contract mock. Partial credentials or sandbox HTTP failures fail visibly; a failed real payment is never silently replaced by a mock success. Live credentials were not available during development: automated validation uses actual local HTTP requests and documented payloads, not a verified live-account transaction.

The adapter uses these [documented Airwallex APIs](https://www.airwallex.com/docs/api):

| Capability | Method and `/api/v1` path | Behavior |
| --- | --- | --- |
| [Authentication](https://www.airwallex.com/docs/api/2022-02-16/authentication/api_access_token/login) | POST `/authentication/login` | `x-client-id`, `x-api-key`, optional `x-login-as`; reuse token until expiry |
| [Locked FX quote](https://www.airwallex.com/docs/api/2024-08-07/transactional_fx/quotes) | POST `/fx/quotes/create` | Buy exact target amount, `MIN_1`; bind pair, amount, validity and quote ID |
| [JIT issuing](https://www.airwallex.com/docs/api/issuing/cards/api) | POST `/issuing/cards/create` | Virtual, native mapped merchant brands, single-use, currency, deadline and base-currency spend limits |
| Update card controls | POST `/issuing/cards/{id}/update` | Adapter method for owner-side controls updates |
| [Payout](https://www.airwallex.com/docs/payouts/transfers/create-a-transfer) | POST `/transfers/create` | Trusted beneficiary, `quote_id`, matching currencies, beneficiary-paid fees |
| Audit reconciliation | GET `/financial_transactions` | Adapter returns first page, including `has_more` |
| [Payment acceptance attempts](https://www.airwallex.com/docs/api/2024-08-07/payments/payment_attempts) | GET `/pa/payment_attempts` | Read adapter; this is a separate product from payouts |

**Correction to the task's proposed route:** `POST /pa/payment_attempts` is not a documented payout endpoint. Real mode uses `/transfers/create`. The mock additionally implements the requested POST alias and GET `/pa/transactions` as compatibility fixtures only; these are not sent to Airwallex. The mock simulator `POST /mock/authorizations` is also IntentPay-only.

### Two enforcement layers

The gateway verifies the exact merchant allowlist, owner signature, expiry, currency, cumulative budget, and fresh quote **before any card/payment action**. A payout consumes the quote ID, fixing its conversion rate. Native card controls enforce the mapped merchant brand IDs for the selected merchant, single use, permitted currency, active deadline, and both per-transaction and all-time limits in the **base currency**, set to the reserved quoted cost.

A card authorization and later settlement use their own FX calculations; a locked quote used to evaluate a card purchase does **not** lock the card's eventual conversion. Rate drift can cause a card authorization to decline. This demo does not claim settlement-level FX protection. Exact merchant names/IDs in the intent are **gateway-enforced**. The adapter translates the selected merchant through a trusted configuration map to native `authorization_controls.allowed_merchant_brands.ids`, supported by the [Cards API](https://www.airwallex.com/docs/api/issuing/cards/api). Brand IDs identify brands rather than individual stores; they are a separate network enforcement layer, not an exact match against an agent's merchant string. The mock uses `monitor-store` → `mock-brand-monitor` and exercises the same native controls field. No PAN/CVV is returned to agents or stored in the audit; building a merchant checkout and synchronous issuing authorization callback is outside this build.

## MCP server

```bash
export INTENTPAY_PUBLIC_KEY_PATH=data/owner-public.pem
export MCP_TOKEN="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
npm start
```

Binds to `127.0.0.1:3001` (override `PORT`); `GET /healthz` reports mock/sandbox mode. `POST /mcp` uses the official MCP SDK's Streamable HTTP transport, stateless JSON responses. Supply `Authorization: Bearer <MCP_TOKEN>` and `Accept: application/json, text/event-stream`. A fresh transport/server is connected for each request; GET/DELETE streams/sessions return 405. Browser-origin calls are rejected. An SDK integration test covers initialize, tools/list, tools/call and shutdown.

Tools:

- `propose_purchase({envelope, purchase})`: decision + exactly one card/payment action, or decision + pending human review. Identical retries return the original result. Reusing a request ID with altered inputs fails.
- `check_policy({envelope, purchase})`: read-only fresh quote and deterministic decision; no budget reservation or payment.
- `get_audit_trail({requestId?})`: verified audit events, optionally filtered by request UUID.

For a direct MCP call using the generated files:

```bash
node --input-type=module - <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const load = path => JSON.parse(readFileSync(path, 'utf8'));
writeFileSync('data/mcp-request.json', JSON.stringify({
  jsonrpc: '2.0', id: 1, method: 'tools/call', params: {
    name: 'propose_purchase', arguments: {
      envelope: load('data/envelope.json'), purchase: load('examples/purchase.json')
    }
  }
}));
JS
curl http://127.0.0.1:3001/mcp \
  -H "Authorization: Bearer $MCP_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  --data-binary @data/mcp-request.json
```

An agent MCP client can initialize and discover the tool schemas directly.

## Human approval

Set `SLACK_WEBHOOK_URL` to an incoming Slack webhook for approval notifications. Valid signed out-of-envelope requests and `NEEDS_HUMAN_APPROVAL` create `approval_requested`, then attempt Slack; missing URL, failed response or network timeout prints the request in the console. Signature failures are never escalated as overridable approvals.

The owner resolves requests via the **local operator CLI**, with the same `AUDIT_PATH` as the server:

```bash
npm run audit -- approve REQUEST_UUID alice 'Approve a new USD 220 envelope'
# Or:
npm run audit -- deny REQUEST_UUID alice 'Keep the original budget'
```

Resolution appends reviewer, reason, timestamp and outcome. The agent has no approval tool, and Slack notifications are not interactive callbacks. The local CLI trusts the OS operator; reviewer names are labels, not separate authenticated identities. Approval does not mutate or bypass a signed intent. To execute, the owner signs a new envelope with a new intent ID and appropriate budget/merchant/expiry/threshold, then submits a new purchase UUID. Original decisions and approvals remain visible. The deterministic demo simulates this owner step automatically for recording.

## Audit and webhooks

```bash
export AUDIT_PATH=data/audit.jsonl
npm run audit -- query                   # all events
npm run audit -- query REQUEST_UUID      # one request
npm run audit -- replay                  # hash-chain check + result summary
# INTENTPAY_PUBLIC_KEY_PATH enables actual policy re-evaluation at recorded times.
```

JSONL events include intent, purchase, quote, decision, durable budget reservation, action/result, approval, and reconciliation/webhook timestamps. Every event has a sequence, previous hash and SHA-256 hash. Replay verifies hashes and re-evaluates policy with the recorded quote/time and cumulative reservations when the owner public key is supplied. Without the key it explicitly reports `policyVerified: false`.

An exclusive filesystem lock serializes writers across processes sharing the same audit path. A reservation is flushed to disk before an external write and retained even after an uncertain timeout. Retrying an incomplete operation fails until an operator reconciles the external state. No automatic reservation release is provided. After a crash, inspect/reconcile Airwallex state before manually removing a stale `<AUDIT_PATH>.lock` directory. Use one shared local audit file for all server/CLI processes controlling a budget. This is a small single-host file ledger, not a distributed payment coordinator. Hash chaining detects modified rows and partial writes; protecting against whole-file deletion or a privileged rewrite requires external checkpoints/backups.

For [Airwallex webhook delivery](https://www.airwallex.com/docs/developer-tools/webhooks/listen-for-webhook-events), set `AIRWALLEX_WEBHOOK_SECRET` and forward a sandbox notification URL to `POST /webhooks/airwallex` using a tunnel/proxy to the loopback service. Signature verification uses HMAC-SHA256 over `x-timestamp + raw_body`, the documented millisecond timestamp, constant-time comparison, and a five-minute freshness window. Event IDs deduplicate retries. Invalid signatures never enter the audit. Webhooks only record evidence; they cannot grant approvals or release budget. `bank.transactions()` exposes transaction reads for reconciliation; the demo records a snapshot. Pagination beyond the first page is left to the caller in this small demo.

To run the standalone contract mock: `npm run mock` (port 4010 by default). It expects `mock-client` / `mock-key`, validates auth and contract fields, supplies deterministic FX, deduplicates actions and simulates card controls. Default server/CLI fallback configures it automatically. The fixed-time demo starts its own mock instead of using this standalone process.

## Validation and recording plan

`npm test` runs policy unit tests and HTTP integration tests. Coverage includes signature tampering/wrong owner, malformed inputs, exact merchant/currency matching, FX binding, expiry and DST offsets, malformed offsets, Airwallex timestamp normalization, native merchant brand controls, fractional-cent rounding, zero/three-decimal currencies, fees, human thresholds, cumulative caps, concurrent requests, restart recovery, uncertain execution, Slack/console approval, card limits, quote-bound payout, MCP SDK interoperability, HMAC/replay protection and audit tampering/truncation.

Suggested video (under five minutes, recorded later): 0:00 problem and signed envelope; 0:40 approved FX-aware card purchase; 1:30 rejected overspend; 2:00 owner approval and replacement signature; 2:45 quote-bound payout; 3:15 audit replay and policy tests; 4:00 show sandbox configuration and distinguish native controls from gateway enforcement. The current deliverable is the working CLI/MCP demo and source; no video is included.

Files: `domain.ts` (schema/signing/pure policy), `airwallex.ts` (sandbox client), `mock.ts` (HTTP fixtures), `service.ts` (policy orchestration/approvals/replay), `audit.ts` (file ledger), `server.ts` (MCP/webhooks), and the CLI/demo entry points under `src/`.
