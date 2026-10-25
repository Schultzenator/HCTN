/**
 * Live emma REST adapter.
 *
 * IMPORTANT (verification note): the endpoint map below was written offline
 * because network access was unavailable in the development session. Before
 * using live mode, reconcile it with the official emma OpenAPI spec
 * (see RESEARCH.md, section 4). The whole API surface is concentrated in this
 * file and expressed through the EmmaClient interface, so remapping endpoints
 * requires no changes anywhere else in the codebase.
 */

import type {
  CreateInstanceRequest,
  EmmaClient,
  GpuOffer,
  Instance,
  TerminateResult,
} from '../types.js';

export interface RestConfig {
  baseUrl: string;
  apiKey: string;
  /** Optional fetch override for tests. Defaults to global fetch (Node 22). */
  fetchImpl?: typeof fetch;
}

/** The single place where emma endpoints are named. Verify against the docs. */
export const ENDPOINTS = {
  offers: '/offers',
  instances: '/instances',
  instance: (id: string) => `/instances/${encodeURIComponent(id)}`,
} as const;

export class EmmaRestClient implements EmmaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: RestConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private async request(path: string, init?: RequestInit): Promise<unknown> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new Error(`emma API ${path} failed: HTTP ${response.status}`);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async listOffers(): Promise<GpuOffer[]> {
    const payload = await this.request(ENDPOINTS.offers);
    const items = asArray(payload);
    return items.map(parseOffer);
  }

  async listInstances(): Promise<Instance[]> {
    const payload = await this.request(ENDPOINTS.instances);
    const items = asArray(payload);
    return items.map(parseInstance);
  }

  async createInstance(request: CreateInstanceRequest): Promise<Instance> {
    const body: Record<string, unknown> = {
      offerId: request.offerId,
      workload: request.workload,
      useSpot: request.useSpot,
      image: request.image,
    };
    if (request.command) {
      body.command = request.command;
    }
    const payload = await this.request(ENDPOINTS.instances, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return parseInstance(payload);
  }

  async terminateInstance(instanceId: string): Promise<TerminateResult> {
    await this.request(ENDPOINTS.instance(instanceId), { method: 'DELETE' });
    return { terminated: true, instanceId };
  }
}

function asArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (isRecord(payload) && Array.isArray(payload.items)) {
    return payload.items;
  }
  if (isRecord(payload) && Array.isArray(payload.data)) {
    return payload.data;
  }
  throw new Error('unexpected emma API response shape: expected an array');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Defensive mapping: missing fields become explicit errors, not NaNs. */
function parseOffer(raw: unknown): GpuOffer {
  if (!isRecord(raw)) {
    throw new Error('offer payload is not an object');
  }
  return {
    id: String(raw.id ?? raw.offerId ?? ''),
    provider: String(raw.provider ?? raw.cloud ?? ''),
    region: String(raw.region ?? ''),
    gpuType: String(raw.gpuType ?? raw.gpu_type ?? ''),
    gpuCount: Number(raw.gpuCount ?? raw.gpu_count ?? 1),
    vramGbPerGpu: Number(raw.vramGbPerGpu ?? raw.vram_gb ?? 0),
    pricePerHour: Number(raw.pricePerHour ?? raw.price_per_hour ?? NaN),
    spotPricePerHour:
      raw.spotPricePerHour === undefined || raw.spotPricePerHour === null
        ? null
        : Number(raw.spotPricePerHour),
    cpuCores: Number(raw.cpuCores ?? raw.cpu ?? 0),
    ramGb: Number(raw.ramGb ?? ramField(raw) ?? 0),
  };
}

function ramField(raw: Record<string, unknown>): unknown {
  return raw.ramGb ?? raw.ram_gb ?? raw.memoryGb;
}

function parseInstance(raw: unknown): Instance {
  if (!isRecord(raw)) {
    throw new Error('instance payload is not an object');
  }
  return {
    id: String(raw.id ?? raw.instanceId ?? ''),
    workload: String(raw.workload ?? raw.name ?? ''),
    offerId: String(raw.offerId ?? ''),
    provider: String(raw.provider ?? raw.cloud ?? ''),
    region: String(raw.region ?? ''),
    gpuType: String(raw.gpuType ?? raw.gpu_type ?? ''),
    gpuCount: Number(raw.gpuCount ?? raw.gpu_count ?? 0),
    pricePerHour: Number(raw.pricePerHour ?? raw.price_per_hour ?? NaN),
    useSpot: Boolean(raw.useSpot ?? raw.spot ?? false),
    startedAt: String(raw.startedAt ?? raw.created_at ?? ''),
    status: raw.status === 'terminated' ? 'terminated' : 'running',
  };
}
