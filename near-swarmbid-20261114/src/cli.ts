import { Agent, Bid, Job, evaluateBid, selectWinner, settle } from "./core.js";
import { readTestnetStatus } from "./near.js";

const job: Job = {
  id: "job-001",
  title: "Classify 10k support events",
  budget: 24,
  maxRisk: "low",
  requiredCapability: "text-classification",
};

const agents = new Map<string, Agent>([
  ["agent-fast", { id: "agent-fast", reputation: 92, capabilities: ["text-classification"], dailySpend: 10, spendLimit: 50, status: "active" }],
  ["agent-cheap", { id: "agent-cheap", reputation: 88, capabilities: ["text-classification"], dailySpend: 8, spendLimit: 50, status: "active" }],
  ["agent-risky", { id: "agent-risky", reputation: 96, capabilities: ["text-classification"], dailySpend: 0, spendLimit: 50, status: "active" }],
]);

const bids: Bid[] = [
  { id: "bid-fast", jobId: job.id, agentId: "agent-fast", amount: 20, etaSeconds: 18, risk: "low", createdAt: "2026-11-09T09:00:01Z" },
  { id: "bid-cheap", jobId: job.id, agentId: "agent-cheap", amount: 16, etaSeconds: 30, risk: "low", createdAt: "2026-11-09T09:00:02Z" },
  { id: "bid-risky", jobId: job.id, agentId: "agent-risky", amount: 9, etaSeconds: 7, risk: "high", createdAt: "2026-11-09T09:00:03Z" },
];

console.log("\nSWARMBID — policy-gated agent coordination\n");
console.log(`JOB     ${job.id}: ${job.title} | budget ${job.budget} NEAR | risk <= ${job.maxRisk}`);
for (const bid of bids) {
  const agent = agents.get(bid.agentId)!;
  const decision = evaluateBid(job, agent, bid);
  const outcome = decision.allowed ? "ALLOW" : `REJECT (${decision.reasons.join(", ")})`;
  console.log(`BID     ${bid.agentId.padEnd(12)} ${bid.amount} NEAR | ETA ${bid.etaSeconds}s | risk ${bid.risk} | ${outcome}`);
}

const result = selectWinner(job, agents, bids);
if (!result) throw new Error("No policy-compliant winner");
const receipt = settle(job, result.bid, result.decision);
console.log(`\nWINNER  ${receipt.winnerId} at ${receipt.amount} NEAR`);
console.log(`POLICY  ALLOW — ${receipt.policy.reasons[0]}`);
console.log(`RECEIPT ${receipt.receiptId}`);
console.log(`PROOF   ${receipt.proof}`);

try {
  const status = await readTestnetStatus();
  console.log(`NEAR    ${status.chainId} read-only RPC, block ${status.latestBlockHeight}`);
} catch (error) {
  console.log(`NEAR    RPC unavailable (demo remains deterministic): ${(error as Error).message}`);
}
