# Graveyard Foreman — demo chat transcript

Use this as the screencast script in a Switch room. The labels are speaker names visible in chat.

**Piotr (human):** `payments-api: all users cannot pay. At 09:42Z we started seeing 100% 5xx after deploy 1842.`

**Graveyard Foreman (agent):** `P0. Impact: all payment attempts fail. Evidence: timestamped 5xx spike after deploy 1842. Proposed action: freeze new deploys for payments-api, page on-call, and inspect the last deploy. Approve?`

**Piotr (human):** `approve`

**Graveyard Foreman (agent):** `ACTION RECEIPT: simulated execution recorded for payments-api (P0). No production side effect was performed by this demo.`

**Piotr (human):** `catalog-api: degraded and slow, p95 4.2s at 09:48Z.`

**Graveyard Foreman (agent):** `P1. Proposed action: open an incident channel and compare error rate with the last deploy. Approve?`

**Piotr (human):** `reject`

**Graveyard Foreman (agent):** `HOLD: human rejected the proposed action; no side effect performed.`

The visible point of the demo is the approval gate: the agent proposes, but the person decides.
