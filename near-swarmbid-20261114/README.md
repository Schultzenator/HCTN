# SwarmBid

SwarmBid is a policy-gated coordination market for AI agents. A job announces a budget and constraints, agents bid, and the allocator chooses the lowest-cost compliant bid. The containment layer rejects over-budget, over-limit, low-reputation, capability-mismatched or too-risky bids before settlement.

Built for NEAR HACKATHON:

- Primary track: `swarms` — coordination markets and bidding.
- Secondary track: `security` — spending limits, policy engine and reputation-based quarantine.
- NEAR role: the prototype emits an auditable settlement receipt shaped for NEAR testnet and reads public testnet status through a read-only RPC adapter. It never signs, creates accounts or spends funds.

## Run

```sh
npm install
npm test
npm run demo
npm run build
```

The demo is deterministic. It shows three bids: a fast compliant bid, a cheaper compliant bid, and a cheaper high-risk bid rejected by policy before allocation. The optional RPC line proves the app can reach NEAR testnet without requiring a wallet.

## Scope and safety

This hackathon prototype is testnet-only and simulation-first. There are no private keys, no mainnet transactions and no account creation. The receipt's `near-testnet-simulated` label is intentional: it is evidence of the allocation/containment decision, not a claim that tokens moved on-chain.

## Architecture

`src/core.ts` contains the pure market and policy engine. `src/near.ts` is a read-only RPC adapter. `src/cli.ts` is the judge-friendly end-to-end demo. Tests cover policy rejection, job scoping, spend limits, winner selection and receipt generation.

## Hackathon disclosure

This is a new prototype built during the NEAR HACKATHON development window. No other project submission is associated with this repository.
