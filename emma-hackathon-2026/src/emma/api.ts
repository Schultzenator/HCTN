// emma API adapter. Everything the fleet agent does against real
// multi-cloud infrastructure goes through the `EmmaApi` interface.
//
// - MockEmmaApi: deterministic, offline, no key needed (default).
// - RestEmmaApi: thin REST client for the real emma API (EMMA_MODE=live,
//   EMMA_API_KEY, EMMA_API_BASE). Endpoint paths live in ENDPOINTS below;
//   verify them against the official emma developer docs before the first
//   live run (see RESEARCH.md, section 2).

import type {
  CreateInstanceRequest,
  GpuOffer,
  Instance,
  InstanceState,
} from "../types.js";
import { MOCK_CATALOG } from "./fixtures.js";

/** Deterministic simulated clock (hours). Mock mode only. */
export class SimClock {
  nowHours: number;
  constructor(start = 0) {
    this.nowHours = start;
  }
  advance(hours: number): void {
    this.nowHours += hours;
  }
}

export interface EmmaApi {
  listOffers(): Promise<GpuOffer[]>;
  listInstances(): Promise<Instance[]>;
  createInstance(request: CreateInstanceRequest): Promise<Instance>;
  terminateInstance(id: string): Promise<void>;
}

export class MockEmmaApi implements EmmaApi {
  readonly clock = new SimClock();
  private readonly catalog: GpuOffer[];
  private readonly instances: Instance[] = [];
  private seq = 0;

  constructor(catalog: GpuOffer[] = MOCK_CATALOG) {
    this.catalog = catalog.map((o) => ({ ...o }));
  }

  /**
   * Simulated market event: a provider changes a node price. Used by the
   * CLI demo scenario to show cost re-balancing when spot prices move.
   */
  applyMarketEvent(offerId: string, newPricePerNodeHour: number): GpuOffer {
    const offer = this.catalog.find((o) => o.id === offerId);
    if (!offer) throw new Error("unknown offer: " + offerId);
    offer.pricePerNodeHour = newPricePerNodeHour;
    return { ...offer };
  }

  async listOffers(): Promise<GpuOffer[]> {
    return this.catalog.map((o) => ({ ...o }));
  }

  async listInstances(): Promise<Instance[]> {
    return this.instances.map((i) => ({ ...i }));
  }

  async createInstance(request: CreateInstanceRequest): Promise<Instance> {
    const offer = this.catalog.find((o) => o.id === request.offerId);
    if (!offer) throw new Error("unknown offer: " + request.offerId);
    if (offer.availableGpus < offer.gpusPerNode) {
      throw new Error("no capacity: " + request.offerId);
    }
    offer.availableGpus -= offer.gpusPerNode;
    this.seq += 1;
    const instance: Instance = {
      id: "i-" + offer.provider + "-" + String(this.seq).padStart(3, "0"),
      offer: { ...offer },
      state: "provisioning",
      createdAtHours: this.clock.nowHours,
    };
    this.instances.push(instance);
    return { ...instance };
  }

  async terminateInstance(id: string): Promise<void> {
    const instance = this.instances.find((i) => i.id === id);
    if (!instance) throw new Error("unknown instance: " + id);
    if (instance.state === "terminated") return;
    instance.state = "terminated";
    instance.terminatedAtHours = this.clock.nowHours;
    const offer = this.catalog.find((o) => o.id === instance.offer.id);
    if (offer) offer.availableGpus += offer.gpusPerNode;
  }

  /**
   * Effective state: instances provision for the first simulated hour, then
   * run; terminated is sticky. Real mode gets this from the API.
   */
  effectiveState(instance: Instance): InstanceState {
    if (instance.state === "terminated") return "terminated";
    return this.clock.nowHours - instance.createdAtHours >= 1 ? "running" : "provisioning";
  }
}

/**
 * REST adapter for the real emma API. Endpoint paths are collected here so
 * a mismatch with the official docs is a one-place fix. Auth uses a bearer
 * token from EMMA_API_KEY (adjust `authHeaders` if docs say otherwise).
 */
export class RestEmmaApi implements EmmaApi {
  private readonly base: string;
  private readonly key: string;

  constructor(env: { baseUrl?: string; apiKey?: string } = {}) {
    this.base = (env.baseUrl ?? process.env.EMMA_API_BASE ?? "https://api.emma-go.com").replace(/\/+$/, "");
    this.key = env.apiKey ?? process.env.EMMA_API_KEY ?? "";
    if (this.key === "") {
      throw new Error("EMMA_API_KEY is required in live mode (EMMA_MODE=live)");
    }
  }

  // Verify these paths against the emma developer docs (RESEARCH.md 2).
  private static readonly ENDPOINTS = {
    offers: "/v1/offers",
    instances: "/v1/instances",
    terminate: (id: string) => "/v1/instances/" + encodeURIComponent(id),
  };

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(this.base + path, {
      ...init,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: "Bearer " + this.key,
        ...init?.headers,
      },
    });
    if (!res.ok) {
      throw new Error("emma API " + path + " -> HTTP " + res.status);
    }
    return (await res.json()) as T;
  }

  async listOffers(): Promise<GpuOffer[]> {
    const rows = await this.request<unknown[]>(RestEmmaApi.ENDPOINTS.offers);
    return rows.map((row) => this.toOffer(row as Record<string, unknown>));
  }

  async listInstances(): Promise<Instance[]> {
    const rows = await this.request<unknown[]>(RestEmmaApi.ENDPOINTS.instances);
    return rows.map((row) => this.toInstance(row as Record<string, unknown>));
  }

  async createInstance(request: CreateInstanceRequest): Promise<Instance> {
    const row = await this.request<Record<string, unknown>>(RestEmmaApi.ENDPOINTS.instances, {
      method: "POST",
      body: JSON.stringify(request),
    });
    return this.toInstance(row);
  }

  async terminateInstance(id: string): Promise<void> {
    await this.request<unknown>(RestEmmaApi.ENDPOINTS.terminate(id), { method: "DELETE" });
  }

  /** Field mapping to verify against docs; tolerates camelCase variants. */
  private toOffer(row: Record<string, unknown>): GpuOffer {
    const pick = <T>(...keys: string[], fallback?: T): T =>
      keys.reduce<T | undefined>((acc, k) => acc ?? (row[k] as T | undefined), undefined) ?? (fallback as T);
    const id = pick<string>("id", "offerId");
    const provider = pick<string>("provider", "vendor").toLowerCase() as GpuOffer["provider"];
    return {
      id,
      provider,
      region: pick<string>("region", "location"),
      gpuType: pick<string>("gpuType", "gpu", "gpu_type"),
      vramGbPerGpu: pick<number>("vramGbPerGpu", "vram_gb", "vramGb"),
      gpusPerNode: pick<number>("gpusPerNode", "gpus_per_node", "gpuCount", 1),
      pricePerNodeHour: pick<number>("pricePerNodeHour", "price_per_hour", "price", 0),
      availableGpus: pick<number>("availableGpus", "available", "stock", 0),
    };
  }

  private toInstance(row: Record<string, unknown>): Instance {
    const pick = <T>(...keys: string[]): T | undefined =>
      keys.reduce<T | undefined>((acc, k) => acc ?? (row[k] as T | undefined), undefined);
    return {
      id: pick<string>("id", "instanceId") ?? "",
      offer: this.toOffer((row.offer as Record<string, unknown>) ?? {}),
      state: (pick<string>("state", "status") as Instance["state"]) ?? "running",
      createdAtHours: 0,
    };
  }
}

/**
 * Factory: EMMA_MODE=live + EMMA_API_KEY => real API; anything else (or a
 * missing key in live mode) => the deterministic mock. All call sites go
 * through this. `live` tells the caller which mode is active.
 */
export function createEmmaApi(env: { mode?: string; apiKey?: string; baseUrl?: string } = {}): { api: EmmaApi; live: boolean } {
  const mode = env.mode ?? process.env.EMMA_MODE ?? "mock";
  if (mode === "live") {
    try {
      return { api: new RestEmmaApi(env), live: true };
    } catch {
      return { api: new MockEmmaApi(), live: false };
    }
  }
  return { api: new MockEmmaApi(), live: false };
}
