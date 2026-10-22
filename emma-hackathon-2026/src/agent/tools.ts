/**
 * Agent tools. One implementation, two consumers:
 * - the MCP server exposes them over stdio to any MCP-capable LLM client,
 * - the CLI uses the same handlers for the deterministic offline demo.
 *
 * Arguments are validated with small hand-rolled guards (zero dependencies);
 * invalid input returns an error result instead of throwing.
 */

import {
  round2,
  type DeploymentPlan,
  type EmmaClient,
  type Instance,
  type WorkloadRequest,
} from '../types.js';
import { planWorkload } from '../optimizer/planner.js';
import { fleetStatus, rebalanceFleet } from '../optimizer/rebalance.js';

export interface ToolContext {
  client: EmmaClient;
}

export interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
  structured?: unknown;
}

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run(args: unknown, context: ToolContext): Promise<ToolResult>;
}

export function textResult(
  lines: string[],
  structured?: unknown,
  isError?: boolean,
): ToolResult {
  return {
    content: [{ type: 'text', text: lines.join('\n') }],
    ...(isError ? { isError: true } : {}),
    ...(structured !== undefined ? { structured } : {}),
  };
}

// ---------------------------------------------------------------------------
// Argument guards
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getString(record: Record<string, unknown>, key: string, fallback: string): string {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function getNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function getRequiredNumber(
  record: Record<string, unknown>,
  key: string,
): { ok: true; value: number } | { ok: false; message: string } {
  const value = getNumber(record, key);
  if (value === undefined) {
    return { ok: false, message: `missing or invalid number field: ${key}` };
  }
  return { ok: true, value };
}

function getBool(record: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = record[key];
  return typeof value === 'boolean' ? value : fallback;
}

function parseWorkloadRequest(args: unknown):
  | { ok: true; request: WorkloadRequest }
  | { ok: false; message: string } {
  const record = asRecord(args);
  for (const key of ['minVramGb', 'gpusPerNode', 'nodes']) {
    const parsed = getRequiredNumber(record, key);
    if (!parsed.ok) {
      return parsed;
    }
  }
  const minVramGb = getRequiredNumber(record, 'minVramGb');
  const gpusPerNode = getRequiredNumber(record, 'gpusPerNode');
  const nodes = getRequiredNumber(record, 'nodes');
  if (!minVramGb.ok || !gpusPerNode.ok || !nodes.ok) {
    return { ok: false, message: 'unreachable' };
  }
  const request: WorkloadRequest = {
    name: getString(record, 'name', 'workload'),
    image: getString(record, 'image', 'ghcr.io/ml/workload:latest'),
    minVramGb: minVramGb.value,
    gpusPerNode: gpusPerNode.value,
    nodes: nodes.value,
    interruptionTolerant: getBool(record, 'interruptionTolerant', false),
    maxPricePerHour: getNumber(record, 'maxPricePerHour'),
    region: typeof record.region === 'string' ? record.region : undefined,
    hours: getNumber(record, 'hours'),
  };
  return { ok: true, request };
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

function describeOffer(offer: {
  id: string;
  provider: string;
  region: string;
  gpuType: string;
  gpuCount: number;
  pricePerHour: number;
  spotPricePerHour: number | null;
}): string {
  const spot =
    offer.spotPricePerHour === null
      ? 'no spot'
      : `spot ${round2(offer.spotPricePerHour)} USD/h`;
  return `${offer.provider} ${offer.region} ${offer.gpuType} x${offer.gpuCount} - on-demand ${round2(offer.pricePerHour)} USD/h, ${spot} [${offer.id}]`;
}

const listOffersTool: AgentTool = {
  name: 'gpu.list_offers',
  description:
    'List the federated GPU inventory across all cloud providers with on-demand and spot prices. Optional filters: gpuType (substring), provider, region.',
  inputSchema: {
    type: 'object',
    properties: {
      gpuType: { type: 'string', description: 'Substring match on the GPU type, e.g. "H100"' },
      provider: { type: 'string' },
      region: { type: 'string' },
    },
  },
  async run(args, context) {
    const record = asRecord(args);
    const gpuType = getString(record, 'gpuType', '');
    const provider = getString(record, 'provider', '');
    const region = getString(record, 'region', '');
    const offers = await context.client.listOffers();
    const filtered = offers.filter(
      (offer) =>
        (gpuType === '' || offer.gpuType.includes(gpuType)) &&
        (provider === '' || offer.provider === provider) &&
        (region === '' || offer.region === region),
    );
    return textResult(
      [`${filtered.length} GPU offer(s):`, ...filtered.map(describeOffer)],
      { offers: filtered },
    );
  },
};

const planWorkloadTool: AgentTool = {
  name: 'gpu.plan_workload',
  description:
    'Plan a GPU workload against the current inventory without deploying anything. Returns the cheapest compliant placement with the full cost rationale, or a failure reason when nothing matches.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      image: { type: 'string' },
      minVramGb: { type: 'number', description: 'Minimum VRAM per GPU in GB' },
      gpusPerNode: { type: 'number', description: 'Required GPUs per node (exact shape match)' },
      nodes: { type: 'number', description: 'Number of nodes to deploy' },
      interruptionTolerant: { type: 'boolean', description: 'Allow spot capacity' },
      maxPricePerHour: { type: 'number', description: 'Optional total budget cap in USD/h' },
      region: { type: 'string' },
      hours: { type: 'number', description: 'Optional planned duration for cost projection' },
    },
    required: ['minVramGb', 'gpusPerNode', 'nodes'],
  },
  async run(args, context) {
    const parsed = parseWorkloadRequest(args);
    if (!parsed.ok) {
      return textResult([parsed.message], undefined, true);
    }
    const offers = await context.client.listOffers();
    const plan = planWorkload(parsed.request, offers);
    return textResult(planLines(plan), plan);
  },
};

const deployWorkloadTool: AgentTool = {
  name: 'gpu.deploy_workload',
  description:
    'Plan and deploy a GPU workload: picks the cheapest compliant placement and creates the instances through the emma API. Returns the plan rationale and the created instances.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      image: { type: 'string' },
      minVramGb: { type: 'number' },
      gpusPerNode: { type: 'number' },
      nodes: { type: 'number' },
      interruptionTolerant: { type: 'boolean' },
      maxPricePerHour: { type: 'number' },
      region: { type: 'string' },
      hours: { type: 'number' },
    },
    required: ['minVramGb', 'gpusPerNode', 'nodes'],
  },
  async run(args, context) {
    const parsed = parseWorkloadRequest(args);
    if (!parsed.ok) {
      return textResult([parsed.message], undefined, true);
    }
    const offers = await context.client.listOffers();
    const plan = planWorkload(parsed.request, offers);
    if (!plan.ok) {
      return textResult([`Deployment failed: ${plan.reason}`], plan, true);
    }
    const created: Instance[] = [];
    for (let index = 0; index < parsed.request.nodes; index += 1) {
      const instance = await context.client.createInstance({
        offerId: plan.offer.id,
        workload: parsed.request.name,
        useSpot: plan.useSpot,
        image: parsed.request.image,
      });
      created.push(instance);
    }
    return textResult(
      [
        ...planLines(plan),
        `Deployed ${created.length} instance(s): ${created.map((i) => i.id).join(', ')}`,
      ],
      { plan, created },
    );
  },
};

const fleetStatusTool: AgentTool = {
  name: 'gpu.fleet_status',
  description: 'Report the current fleet: running instances, hourly cost, projected monthly cost and per-provider breakdown.',
  inputSchema: { type: 'object', properties: {} },
  async run(_args, context) {
    const instances = await context.client.listInstances();
    const report = fleetStatus(instances);
    const lines = [
      `Fleet: ${report.running} running, ${report.terminated} terminated`,
      `Cost: ${report.costPerHour} USD/h -> ~${report.projectedMonthlyCost} USD/mo`,
      ...report.byProvider.map(
        (entry) =>
          `  ${entry.provider}: ${entry.instances} instance(s), ${entry.costPerHour} USD/h`,
      ),
    ];
    return textResult(lines, report);
  },
};

const optimizeCostsTool: AgentTool = {
  name: 'gpu.optimize_costs',
  description:
    'Compare every running instance against the current inventory and propose like-for-like migrations that lower cost. Spot is proposed only for instances already running on spot. No side effects.',
  inputSchema: { type: 'object', properties: {} },
  async run(_args, context) {
    const [instances, offers] = await Promise.all([
      context.client.listInstances(),
      context.client.listOffers(),
    ]);
    const optimization = rebalanceFleet(instances, offers);
    const lines = [
      `Current fleet cost: ${optimization.currentCostPerHour} USD/h`,
      `Optimizable to: ${optimization.optimizedCostPerHour} USD/h (saves ~${optimization.projectedMonthlySaving} USD/mo)`,
      ...optimization.actions.map(
        (action) => `  ${action.instanceId}: ${action.from} -> ${action.to} (${action.rationale})`,
      ),
    ];
    return textResult(lines, optimization);
  },
};

const terminateInstanceTool: AgentTool = {
  name: 'gpu.terminate_instance',
  description: 'Terminate a running GPU instance by id through the emma API.',
  inputSchema: {
    type: 'object',
    properties: { instanceId: { type: 'string' } },
    required: ['instanceId'],
  },
  async run(args, context) {
    const record = asRecord(args);
    const instanceId = getString(record, 'instanceId', '');
    if (instanceId === '') {
      return textResult(['missing field: instanceId'], undefined, true);
    }
    const result = await context.client.terminateInstance(instanceId);
    return textResult([`Terminated ${result.instanceId}.`], result);
  },
};

export function planLines(plan: DeploymentPlan): string[] {
  if (!plan.ok) {
    return [`No compliant placement: ${plan.reason}`];
  }
  return [
    `Plan for "${plan.request.name}": ${plan.offer.provider} ${plan.offer.region} ${plan.offer.gpuType} x${plan.offer.gpuCount}${plan.useSpot ? ' (spot)' : ' (on-demand)'}`,
    ...plan.rationale,
    ...plan.rejected.map((rejection) => `  rejected ${rejection.offerId}: ${rejection.reason}`),
  ];
}

export function createTools(): AgentTool[] {
  return [
    listOffersTool,
    planWorkloadTool,
    deployWorkloadTool,
    fleetStatusTool,
    optimizeCostsTool,
    terminateInstanceTool,
  ];
}
