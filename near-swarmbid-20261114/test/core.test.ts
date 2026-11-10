import assert from "node:assert/strict";
import test from "node:test";
import { Agent, Bid, Job, evaluateBid, selectWinner, settle } from "../src/core.js";

const job: Job = { id: "j", title: "test", budget: 20, maxRisk: "low", requiredCapability: "compute" };
const agent: Agent = { id: "a", reputation: 90, capabilities: ["compute"], dailySpend: 0, spendLimit: 30, status: "active" };
const bid: Bid = { id: "b", jobId: "j", agentId: "a", amount: 12, etaSeconds: 5, risk: "low", createdAt: "2026-11-09T00:00:00Z" };

test("allows a compliant bid", () => assert.equal(evaluateBid(job, agent, bid).allowed, true));

test("rejects a high-risk bid for a low-risk job", () => {
  assert.deepEqual(evaluateBid(job, agent, { ...bid, risk: "high" }), { allowed: false, reasons: ["risk exceeds job policy"] });
});

test("rejects a bid that targets a different job", () => {
  assert.deepEqual(evaluateBid(job, agent, { ...bid, jobId: "other-job" }), { allowed: false, reasons: ["bid targets a different job"] });
});

test("rejects a bid over the agent spend limit", () => {
  assert.equal(evaluateBid(job, { ...agent, dailySpend: 25 }, bid).reasons[0], "agent spend limit exceeded");
});

test("selects the cheapest policy-compliant bid and creates a receipt", () => {
  const agents = new Map([[agent.id, agent], ["b", { ...agent, id: "b" }]]);
  const bids = [bid, { ...bid, id: "b2", agentId: "b", amount: 10 }];
  const winner = selectWinner(job, agents, bids);
  assert.equal(winner?.bid.agentId, "b");
  const receipt = settle(job, winner!.bid, winner!.decision);
  assert.equal(receipt.network, "near-testnet-simulated");
  assert.match(receipt.proof, /^[A-Za-z0-9_-]+$/);
});
