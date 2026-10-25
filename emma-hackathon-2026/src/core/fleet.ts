// Fleet lifecycle on top of an EmmaApi: deploy plans, accrue cost on a
// simulated clock (mock) or read live state (real mode), teardown.

import type {
  DeploymentPlan,
  InstanceCost,
  Instance,
} from "../types.js";
import type { EmmaApi, MockEmmaApi } from "../emma/api.js";

export interface FleetStatus {
  nowHours: number;
  instances: InstanceCost[];
  activeCount: number;
  activeCostPerHourUsd: number;
  totalSpendUsd: number;
}

export class FleetStore {
  private readonly api: EmmaApi;
  private readonly clock;

  constructor(api: EmmaApi) {
    this.api = api;
    this.clock = api instanceof MockEmmaApi ? api.clock : undefined;
  }

  async deployPlan(plan: DeploymentPlan): Promise<Instance[]> {
    const created: Instance[] = [];
    for (const entry of plan.entries) {
      for (let i = 0; i < entry.nodes; i++) {
        created.push(await this.api.createInstance({ offerId: entry.offer.id }));
      }
    }
    if (created.length === 0) {
      throw new Error("plan has nothing to deploy (no fitting offer)");
    }
    return created;
  }

  async status(nowHours?: number): Promise<FleetStatus> {
    if (this.clock && nowHours !== undefined) {
      this.clock.nowHours = nowHours;
    }
    const instances = await this.api.listInstances();
    const now = this.clock ? this.clock.nowHours : 0;
    const costs: InstanceCost[] = instances.map((instance) => {
      const end = instance.state === "terminated" ? (instance.terminatedAtHours ?? now) : now;
      const hoursBilled = Math.max(0, end - instance.createdAtHours);
      return {
        instance,
        hoursBilled: round2(hoursBilled),
        costUsd: round2(hoursBilled * instance.offer.pricePerNodeHour),
      };
    });
    const active = costs.filter((c) => c.instance.state !== "terminated");
    return {
      nowHours: now,
      instances: costs,
      activeCount: active.length,
      activeCostPerHourUsd: round2(active.reduce((sum, c) => sum + c.instance.offer.pricePerNodeHour, 0)),
      totalSpendUsd: round2(costs.reduce((sum, c) => sum + c.costUsd, 0)),
    };
  }

  async teardown(ids?: string[]): Promise<string[]> {
    const instances = await this.api.listInstances();
    const targets = instances.filter(
      (i) => i.state !== "terminated" && (ids === undefined || ids.includes(i.id))
    );
    for (const t of targets) {
      await this.api.terminateInstance(t.id);
    }
    return targets.map((t) => t.id);
  }

  async terminateOne(id: string): Promise<void> {
    await this.api.terminateInstance(id);
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
