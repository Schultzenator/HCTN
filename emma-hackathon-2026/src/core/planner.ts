// Deterministic deployment planner: turn a workload spec into a
// cost-optimal, explainable multi-cloud deployment plan.

import type {
  DeploymentPlan,
  GpuOffer,
  PlanAlternative,
  PlanEntry,
  WorkloadSpec,
} from "../types.js";
import { gpuHourPrice } from "../emma/fixtures.js";

/** FNV-1a 32-bit hash; deterministic plan ids without crypto. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function canonicalSpecKey(spec: WorkloadSpec): string {
  const sortedRegions = [...(spec.preferredRegions ?? [])].sort();
  return JSON.stringify([
    spec.name,
    spec.gpuType ?? null,
    spec.minVramGbPerGpu ?? null,
    spec.gpusRequired,
    spec.hours,
    spec.maxBudgetUsd ?? null,
    sortedRegions,
  ]);
}

function validateSpec(spec: WorkloadSpec): void {
  if (typeof spec.name !== "string" || spec.name.length === 0) {
    throw new Error("workload name is required");
  }
  if (!Number.isInteger(spec.gpusRequired) || spec.gpusRequired < 1) {
    throw new Error("gpusRequired must be a positive integer");
  }
  if (typeof spec.hours !== "number" || !Number.isFinite(spec.hours) || spec.hours <= 0) {
    throw new Error("hours must be a positive number");
  }
  if (spec.maxBudgetUsd !== undefined && (typeof spec.maxBudgetUsd !== "number" || spec.maxBudgetUsd < 0)) {
    throw new Error("maxBudgetUsd must be a non-negative number");
  }
}

/**
 * Pick the cheapest single offer that can satisfy the whole workload.
 * Single-provider plans keep operations simple; alternatives show what was
 * rejected and why. Deterministic: same spec + catalog => same plan.
 */
export function planDeployment(spec: WorkloadSpec, offers: GpuOffer[]): DeploymentPlan {
  validateSpec(spec);

  const eligible = offers
    .filter((offer) => {
      if (spec.gpuType && offer.gpuType.toLowerCase() !== spec.gpuType.toLowerCase()) return false;
      if (spec.minVramGbPerGpu !== undefined && offer.vramGbPerGpu < spec.minVramGbPerGpu) return false;
      if (spec.preferredRegions && spec.preferredRegions.length > 0) {
        if (!spec.preferredRegions.includes(offer.region)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const pa = gpuHourPrice(a);
      const pb = gpuHourPrice(b);
      if (pa !== pb) return pa - pb;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

  const planId = "plan-" + fnv1a(canonicalSpecKey(spec));
  const alternatives: PlanAlternative[] = [];
  let chosen: PlanEntry | undefined;

  for (const offer of eligible) {
    const nodes = Math.ceil(spec.gpusRequired / offer.gpusPerNode);
    const gpus = nodes * offer.gpusPerNode;
    const totalCostUsd = round2(nodes * offer.pricePerNodeHour * spec.hours);
    const entry: PlanEntry = { offer, nodes, gpus, nodeHours: nodes * spec.hours, costUsd: totalCostUsd };
    const hasCapacity = offer.availableGpus >= gpus;
    const fitsBudget = spec.maxBudgetUsd === undefined || totalCostUsd <= spec.maxBudgetUsd;
    if (!chosen && hasCapacity && fitsBudget) {
      chosen = entry;
    } else {
      alternatives.push({
        offerId: offer.id,
        provider: offer.provider,
        region: offer.region,
        gpuType: offer.gpuType,
        gpuHourPrice: round2(gpuHourPrice(offer)),
        totalCostUsd,
        note: !hasCapacity ? "insufficient capacity" : !fitsBudget ? "over budget" : "not cheapest",
      });
    }
    if (alternatives.length >= 4 && chosen) break;
  }

  if (!chosen) {
    const cheapest = alternatives[0];
    const rationale =
      alternatives.length === 0
        ? "no offer matches the workload constraints"
        : cheapest.note === "over budget"
          ? "cheapest matching offer (" +
            cheapest.provider +
            " " +
            cheapest.region +
            ", $" +
            cheapest.totalCostUsd.toFixed(2) +
            ") exceeds the budget"
          : "no matching offer has capacity for " + spec.gpusRequired + " GPUs";
    return {
      planId,
      spec,
      entries: [],
      totalCostUsd: 0,
      fitsBudget: false,
      rationale,
      alternatives: alternatives.slice(0, 4),
    };
  }

  const totalCostUsd = round2(chosen.costUsd);
  const fitsBudget = spec.maxBudgetUsd === undefined || totalCostUsd <= spec.maxBudgetUsd;
  const gpuHour = round2(gpuHourPrice(chosen.offer));
  const worst = alternatives.length > 0 ? alternatives[alternatives.length - 1] : undefined;
  const rationale =
    "Chose " +
    chosen.nodes +
    "x " +
    chosen.offer.provider +
    " " +
    chosen.offer.region +
    " (" +
    chosen.gpus +
    "x " +
    chosen.offer.gpuType +
    ", " +
    chosen.offer.vramGbPerGpu +
    "GB) at $" +
    gpuHour.toFixed(2) +
    "/GPU-hour - the cheapest provider with capacity for " +
    spec.gpusRequired +
    " GPUs" +
    (worst
      ? "; the priciest alternative (" +
        worst.provider +
        " " +
        worst.region +
        ") would cost " +
        round2((worst.gpuHourPrice / gpuHour) * 100 - 100) +
        "% more per GPU-hour"
      : "") +
    ".";

  return {
    planId,
    spec,
    entries: [chosen],
    totalCostUsd,
    fitsBudget,
    rationale,
    alternatives: alternatives.slice(0, 4),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
