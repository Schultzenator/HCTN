// Cost optimizer: watch the fleet, find cheaper equivalents for running
// instances, recommend or apply migrations through the emma API.

import type {
  GpuOffer,
  Instance,
  MigrationRecommendation,
  OptimizationResult,
} from "../types.js";
import { gpuHourPrice } from "../emma/fixtures.js";
import type { EmmaApi } from "../emma/api.js";
import type { FleetStore } from "./fleet.js";

export async function optimizeFleet(
  api: EmmaApi,
  fleet: FleetStore,
  opts: { apply?: boolean; preferredRegions?: string[] } = {}
): Promise<OptimizationResult> {
  const [offers, instances] = await Promise.all([api.listOffers(), api.listInstances()]);
  const active: Instance[] = instances.filter((i) => i.state === "running" || i.state === "provisioning");
  const recommendations: MigrationRecommendation[] = [];

  for (const instance of active) {
    const currentGpuHour = gpuHourPrice(instance.offer);
    const candidates = offers
      .filter((offer) => {
        if (offer.gpuType !== instance.offer.gpuType) return false;
        if (offer.vramGbPerGpu < instance.offer.vramGbPerGpu) return false;
        if (opts.preferredRegions && opts.preferredRegions.length > 0 && !opts.preferredRegions.includes(offer.region)) return false;
        if (gpuHourPrice(offer) >= currentGpuHour) return false;
        if (offer.availableGpus < instance.offer.gpusPerNode) return false;
        return true;
      })
      .sort((a, b) => gpuHourPrice(a) - gpuHourPrice(b));
    const best = candidates[0];
    if (!best) continue;
    const nodes = Math.ceil(instance.offer.gpusPerNode / best.gpusPerNode);
    const savingsPerDayUsd = round2(
      (currentGpuHour - gpuHourPrice(best)) * instance.offer.gpusPerNode * 24
    );
    recommendations.push({
      instanceId: instance.id,
      from: {
        provider: instance.offer.provider,
        region: instance.offer.region,
        gpuType: instance.offer.gpuType,
        gpuHourPrice: round2(currentGpuHour),
      },
      to: {
        offerId: best.id,
        provider: best.provider,
        region: best.region,
        gpuType: best.gpuType,
        gpuHourPrice: round2(gpuHourPrice(best)),
      },
      nodes,
      savingsPerDayUsd,
    });
  }

  const actions: string[] = [];
  if (opts.apply) {
    for (const rec of recommendations) {
      await fleet.terminateOne(rec.instanceId);
      const replacement = await api.createInstance({ offerId: rec.to.offerId });
      actions.push(
        "migrated " +
          rec.instanceId +
          " (" +
          rec.from.provider +
          " " +
          rec.from.region +
          ", $" +
          rec.from.gpuHourPrice.toFixed(2) +
          "/GPU-h) -> " +
          replacement.id +
          " (" +
          rec.to.provider +
          " " +
          rec.to.region +
          ", $" +
          rec.to.gpuHourPrice.toFixed(2) +
          "/GPU-h)"
      );
    }
  }

  const totalSavingsPerDayUsd = round2(recommendations.reduce((sum, r) => sum + r.savingsPerDayUsd, 0));
  return {
    scanned: active.length,
    recommendations,
    applied: Boolean(opts.apply),
    actions,
    totalSavingsPerDayUsd,
    note:
      recommendations.length === 0
        ? "no cheaper equivalent found for any active instance"
        : opts.apply
          ? "migrations applied; new instances bill at the lower rate"
          : "dry run: pass apply=true to migrate",
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
