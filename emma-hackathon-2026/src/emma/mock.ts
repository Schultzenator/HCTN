/**
 * Deterministic offline emma client.
 *
 * Implements EmmaClient against an in-memory, fixed multi-provider GPU market
 * so the whole agent (planner, MCP server, CLI, tests, demo video) runs without
 * an API key and produces identical output on every run.
 *
 * The market has two deterministic states ("ticks") used by the demo scenario:
 * tick 0 is the baseline market; from tick 1 a neocloud spot flash capacity
 * appears and one hyperscaler spot pool sells out. Tests control the tick with
 * setMarketTick().
 */

import type {
  CreateInstanceRequest,
  EmmaClient,
  GpuOffer,
  Instance,
  TerminateResult,
} from '../types.js';

/** Deterministic "now" for reproducible startedAt timestamps. */
const MOCK_NOW = '2026-11-20T10:00:00.000Z';

interface OfferSpec {
  id: string;
  provider: string;
  region: string;
  gpuType: string;
  gpuCount: number;
  vramGbPerGpu: number;
  pricePerHour: number;
  spotPricePerHour: number | null;
  cpuCores: number;
  ramGb: number;
}

const BASE_MARKET: OfferSpec[] = [
  {
    id: 'aws-a100-80-x1-use1',
    provider: 'aws',
    region: 'us-east-1',
    gpuType: 'NVIDIA A100 80GB',
    gpuCount: 1,
    vramGbPerGpu: 80,
    pricePerHour: 3.21,
    spotPricePerHour: 1.93,
    cpuCores: 48,
    ramGb: 384,
  },
  {
    id: 'aws-a100-80-x8-use1',
    provider: 'aws',
    region: 'us-east-1',
    gpuType: 'NVIDIA A100 80GB',
    gpuCount: 8,
    vramGbPerGpu: 80,
    pricePerHour: 25.68,
    // Stays above the neocloud H100 spot (18.99) so the planner prefers
    // neoclouds, matching the tests' expected baseline ordering.
    spotPricePerHour: 20.53,
    cpuCores: 384,
    ramGb: 3072,
  },
  {
    id: 'azure-a100-80-x4-eus',
    provider: 'azure',
    region: 'eastus',
    gpuType: 'NVIDIA A100 80GB',
    gpuCount: 4,
    vramGbPerGpu: 80,
    pricePerHour: 12.84,
    spotPricePerHour: null,
    cpuCores: 192,
    ramGb: 1536,
  },
  {
    id: 'gcp-h100-80-x8-usc1',
    provider: 'gcp',
    region: 'us-central1',
    gpuType: 'NVIDIA H100 80GB',
    gpuCount: 8,
    vramGbPerGpu: 80,
    pricePerHour: 51.84,
    spotPricePerHour: 27.99,
    cpuCores: 224,
    ramGb: 1792,
  },
  {
    id: 'lambda-h100-80-x8-usw2',
    provider: 'lambda',
    region: 'us-west-2',
    gpuType: 'NVIDIA H100 80GB',
    gpuCount: 8,
    vramGbPerGpu: 80,
    pricePerHour: 31.9,
    spotPricePerHour: 18.99,
    cpuCores: 208,
    ramGb: 1664,
  },
  {
    id: 'coreweave-l40s-48-x1-use',
    provider: 'coreweave',
    region: 'us-east',
    gpuType: 'NVIDIA L40S 48GB',
    gpuCount: 1,
    vramGbPerGpu: 48,
    pricePerHour: 1.49,
    spotPricePerHour: 0.74,
    cpuCores: 24,
    ramGb: 128,
  },
  {
    id: 'nebius-a100-80-x8-eun',
    provider: 'nebius',
    region: 'eu-north',
    gpuType: 'NVIDIA A100 80GB',
    gpuCount: 8,
    vramGbPerGpu: 80,
    pricePerHour: 22.4,
    spotPricePerHour: null,
    cpuCores: 192,
    ramGb: 1536,
  },
  {
    id: 'tensorwave-l40s-48-x4-usc',
    provider: 'tensorwave',
    region: 'us-central',
    gpuType: 'NVIDIA L40S 48GB',
    gpuCount: 4,
    vramGbPerGpu: 48,
    pricePerHour: 5.76,
    spotPricePerHour: 3.17,
    cpuCores: 96,
    ramGb: 512,
  },
  {
    id: 'ovh-rtx4090-24-x1-euw',
    provider: 'ovhcloud',
    region: 'eu-west',
    gpuType: 'NVIDIA RTX 4090 24GB',
    gpuCount: 1,
    vramGbPerGpu: 24,
    pricePerHour: 0.94,
    spotPricePerHour: null,
    cpuCores: 16,
    ramGb: 64,
  },
];

/** Market changes that appear from tick 1 (the "market refresh" in the demo). */
interface MarketChange {
  /** New offers appearing in the market. */
  added: OfferSpec[];
  /** Overrides for existing offer ids. */
  updated: Record<string, Partial<OfferSpec>>;
}

const TICK_1_CHANGES: MarketChange = {
  added: [
    {
      id: 'spotwave-h100-80-x8-usw',
      provider: 'spotwave',
      region: 'us-west',
      gpuType: 'NVIDIA H100 80GB',
      gpuCount: 8,
      vramGbPerGpu: 80,
      pricePerHour: 28.5,
      spotPricePerHour: 15.75,
      cpuCores: 208,
      ramGb: 1664,
    },
  ],
  updated: {
    // Hyperscaler spot pool sells out - only on-demand remains.
    'gcp-h100-80-x8-usc1': { spotPricePerHour: null },
  },
};

function toOffer(spec: OfferSpec): GpuOffer {
  return { ...spec };
}

/** Returns the federated market at a given tick (0 = baseline). */
export function marketAt(tick: number): GpuOffer[] {
  const specs = BASE_MARKET.map((spec) => ({ ...spec }));
  if (tick >= 1) {
    for (const added of TICK_1_CHANGES.added) {
      specs.push({ ...added });
    }
    for (const [id, patch] of Object.entries(TICK_1_CHANGES.updated)) {
      const target = specs.find((spec) => spec.id === id);
      if (target) {
        Object.assign(target, patch);
      }
    }
  }
  return specs.map(toOffer);
}

export interface MockOptions {
  /** Initial market tick; default 0 (baseline). */
  marketTick?: number;
}

export class MockEmmaClient implements EmmaClient {
  private tick: number;
  private instances: Instance[] = [];
  private nextId = 1;

  constructor(options?: MockOptions) {
    this.tick = options?.marketTick ?? 0;
  }

  /** Advances the deterministic market scenario (used by the demo/tests). */
  setMarketTick(tick: number): void {
    this.tick = tick;
  }

  getMarketTick(): number {
    return this.tick;
  }

  async listOffers(): Promise<GpuOffer[]> {
    return marketAt(this.tick);
  }

  async listInstances(): Promise<Instance[]> {
    return this.instances.map((instance) => ({ ...instance }));
  }

  async createInstance(request: CreateInstanceRequest): Promise<Instance> {
    const offer = marketAt(this.tick).find((candidate) => candidate.id === request.offerId);
    if (!offer) {
      throw new Error(`unknown offer: ${request.offerId}`);
    }
    if (request.useSpot && offer.spotPricePerHour === null) {
      throw new Error(`offer ${offer.id} has no spot capacity`);
    }
    const instance: Instance = {
      id: `gpu-${String(this.nextId).padStart(4, '0')}`,
      workload: request.workload,
      offerId: offer.id,
      provider: offer.provider,
      region: offer.region,
      gpuType: offer.gpuType,
      gpuCount: offer.gpuCount,
      pricePerHour: request.useSpot ? (offer.spotPricePerHour as number) : offer.pricePerHour,
      useSpot: request.useSpot,
      startedAt: MOCK_NOW,
      status: 'running',
    };
    this.nextId += 1;
    this.instances.push({ ...instance });
    return { ...instance };
  }

  async terminateInstance(instanceId: string): Promise<TerminateResult> {
    const instance = this.instances.find((candidate) => candidate.id === instanceId);
    if (!instance) {
      throw new Error(`unknown instance: ${instanceId}`);
    }
    if (instance.status === 'terminated') {
      throw new Error(`instance ${instanceId} is already terminated`);
    }
    instance.status = 'terminated';
    return { terminated: true, instanceId };
  }
}
