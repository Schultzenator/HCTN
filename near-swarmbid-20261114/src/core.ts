export type Risk = "low" | "medium" | "high";

export interface Job {
  id: string;
  title: string;
  budget: number;
  maxRisk: Risk;
  requiredCapability: string;
}

export interface Agent {
  id: string;
  reputation: number;
  capabilities: string[];
  dailySpend: number;
  spendLimit: number;
  status: "active" | "quarantined";
}

export interface Bid {
  id: string;
  jobId: string;
  agentId: string;
  amount: number;
  etaSeconds: number;
  risk: Risk;
  createdAt: string;
}

export interface PolicyDecision {
  allowed: boolean;
  reasons: string[];
}

export interface SettlementReceipt {
  receiptId: string;
  jobId: string;
  winnerId: string;
  amount: number;
  network: "near-testnet-simulated";
  policy: PolicyDecision;
  proof: string;
  timestamp: string;
}

const riskRank: Record<Risk, number> = { low: 0, medium: 1, high: 2 };

export function evaluateBid(job: Job, agent: Agent, bid: Bid): PolicyDecision {
  const reasons: string[] = [];
  if (bid.jobId !== job.id) reasons.push("bid targets a different job");
  if (agent.status !== "active") reasons.push("agent is quarantined");
  if (!agent.capabilities.includes(job.requiredCapability)) reasons.push("capability mismatch");
  if (bid.amount > job.budget) reasons.push("bid exceeds job budget");
  if (agent.dailySpend + bid.amount > agent.spendLimit) reasons.push("agent spend limit exceeded");
  if (riskRank[bid.risk] > riskRank[job.maxRisk]) reasons.push("risk exceeds job policy");
  if (agent.reputation < 70) reasons.push("reputation below policy floor");
  return { allowed: reasons.length === 0, reasons: reasons.length ? reasons : ["all policy checks passed"] };
}

export function selectWinner(job: Job, agents: Map<string, Agent>, bids: Bid[]): { bid: Bid; decision: PolicyDecision } | null {
  const eligible = bids
    .filter((bid) => agents.has(bid.agentId))
    .map((bid) => ({ bid, decision: evaluateBid(job, agents.get(bid.agentId)!, bid) }))
    .filter(({ decision }) => decision.allowed)
    .sort((a, b) => a.bid.amount - b.bid.amount || a.bid.etaSeconds - b.bid.etaSeconds);
  return eligible[0] ?? null;
}

export function settle(job: Job, winner: Bid, decision: PolicyDecision): SettlementReceipt {
  const canonical = `${job.id}|${winner.agentId}|${winner.amount}|${winner.createdAt}`;
  const proof = Buffer.from(canonical).toString("base64url");
  return {
    receiptId: `receipt-${job.id}-${winner.id}`,
    jobId: job.id,
    winnerId: winner.agentId,
    amount: winner.amount,
    network: "near-testnet-simulated",
    policy: decision,
    proof,
    timestamp: new Date().toISOString(),
  };
}
