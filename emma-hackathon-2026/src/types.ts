/**
 * Core domain types for FleetPilot.
 *
 * Everything emma-facing is expressed through these shapes; the REST adapter
 * and the mock client both satisfy EmmaClient, so the agent, optimizer, MCP
 * server and tests are cloud-agnostic and run fully offline.
 */

/** A single GPU offer in the federated emma inventory. */
export interface GpuOffer {
  /** Stable offer id used by the emma API. */
  id: string;
  /** Underlying cloud provider, e.g. "aws", "lambda". */
  provider: string;
  /** Provider region, e.g. "us-west-2". */
  region: string;
  /** GPU model including VRAM, e.g. "NVIDIA H100 80GB". */
  gpuType: string;
  /** GPUs per instance (node). */
  gpuCount: number;
  /** VRAM per single GPU in GB. */
  vramGbPerGpu: number;
  /** On-demand price in USD per hour for the whole instance. */
  pricePerHour: number;
  /** Spot price in USD per hour, or null when the offer has no spot support. */
  spotPricePerHour: number | null;
  /** vCPUs of the instance. */
  cpuCores: number;
  /** RAM in GB. */
  ramGb: number;
}

/** A workload the user wants to run on the federated GPU cloud. */
export interface WorkloadRequest {
  /** Workload name, e.g. "llama3-finetune". */
  name: string;
  /** Container image to launch, e.g. "ghcr.io/ml/finetune:latest". */
  image: string;
  /** Minimum VRAM per GPU in GB. */
  minVramGb: number;
  /** Required GPUs per node (must match an offer shape exactly). */
  gpusPerNode: number;
  /** Number of nodes to deploy. */
  nodes: number;
  /** Whether the workload tolerates spot interruptions. */
  interruptionTolerant: boolean;
  /** Optional total budget cap in USD per hour across all nodes. */
  maxPricePerHour?: number;
  /** Optional region constraint. */
  region?: string;
  /** Optional planned duration in hours, used for cost projection. */
  hours?: number;
}

/** A running GPU instance created through emma. */
export interface Instance {
  id: string;
  /** Workload name the instance was created for. */
  workload: string;
  offerId: string;
  provider: string;
  region: string;
  gpuType: string;
  gpuCount: number;
  /** Effective price actually paid per hour (spot or on-demand). */
  pricePerHour: number;
  useSpot: boolean;
  /** Fixed ISO timestamp (deterministic in mock mode). */
  startedAt: string;
  status: 'running' | 'terminated';
}

export interface CreateInstanceRequest {
  offerId: string;
  workload: string;
  useSpot: boolean;
  image: string;
  command?: string[];
}

export interface TerminateResult {
  terminated: true;
  instanceId: string;
}

/** The only emma-facing contract in the codebase. */
export interface EmmaClient {
  listOffers(): Promise<GpuOffer[]>;
  listInstances(): Promise<Instance[]>;
  createInstance(request: CreateInstanceRequest): Promise<Instance>;
  terminateInstance(instanceId: string): Promise<TerminateResult>;
}

/** A rejected candidate offer with a human-readable reason. */
export interface PlanRejection {
  offerId: string;
  reason: string;
}

export interface PlanCandidate {
  offerId: string;
  provider: string;
  region: string;
  gpuType: string;
  useSpot: boolean;
  pricePerHourPerNode: number;
  totalPricePerHour: number;
}

export interface DeploymentPlanOk {
  ok: true;
  request: WorkloadRequest;
  offer: GpuOffer;
  useSpot: boolean;
  pricePerHourPerNode: number;
  totalPricePerHour: number;
  /** Estimated session cost when the request declared a duration. */
  estimatedSessionCost: number | null;
  /** Ordered, human-readable evidence for the decision. */
  rationale: string[];
  /** Shape-matching offers that were not selected, with reasons. */
  rejected: PlanRejection[];
}

export interface DeploymentPlanFailed {
  ok: false;
  request: WorkloadRequest;
  reason: string;
}

export type DeploymentPlan = DeploymentPlanOk | DeploymentPlanFailed;

/** A single cost-optimization action for a running instance. */
export interface SavingsAction {
  instanceId: string;
  from: string;
  to: string;
  savingPerHour: number;
  estimatedMonthlySaving: number;
  rationale: string;
}

export interface FleetOptimization {
  actions: SavingsAction[];
  currentCostPerHour: number;
  optimizedCostPerHour: number;
  projectedMonthlySaving: number;
}

export interface ProviderCost {
  provider: string;
  instances: number;
  costPerHour: number;
}

export interface FleetReport {
  running: number;
  terminated: number;
  costPerHour: number;
  projectedMonthlyCost: number;
  byProvider: ProviderCost[];
}

export const HOURS_PER_MONTH = 730;

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
