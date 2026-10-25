/**
 * Deterministic workload planner: given a workload request and the federated
 * emma inventory, produce a cost-optimal deployment plan with human-readable,
 * auditable rationale. No heuristics, no randomness - the same inputs always
 * yield the same plan, which is what makes the demo and tests reproducible.
 */

import {
  round2,
  type DeploymentPlan,
  type GpuOffer,
  type PlanRejection,
  type WorkloadRequest,
} from '../types.js';

/** Offers that pass the hard shape filters (VRAM, GPUs/node, region). */
function shapeMatches(offer: GpuOffer, request: WorkloadRequest): boolean {
  if (offer.vramGbPerGpu < request.minVramGb) {
    return false;
  }
  if (offer.gpuCount !== request.gpusPerNode) {
    return false;
  }
  if (request.region !== undefined && offer.region !== request.region) {
    return false;
  }
  return true;
}

export function effectivePrice(offer: GpuOffer, interruptionTolerant: boolean): number {
  if (interruptionTolerant && offer.spotPricePerHour !== null) {
    return offer.spotPricePerHour;
  }
  return offer.pricePerHour;
}

export function planWorkload(request: WorkloadRequest, offers: GpuOffer[]): DeploymentPlan {
  const matching = offers.filter((offer) => shapeMatches(offer, request));
  if (matching.length === 0) {
    return {
      ok: false,
      request,
      reason:
        `no offer provides >= ${request.minVramGb} GB VRAM per GPU on ` +
        `${request.gpusPerNode} GPU/node` +
        (request.region !== undefined ? ` in region ${request.region}` : ''),
    };
  }

  const rejected: PlanRejection[] = [];
  const budget = request.maxPricePerHour;

  const affordable = matching.filter((offer) => {
    const pricePerNode = effectivePrice(offer, request.interruptionTolerant);
    const total = pricePerNode * request.nodes;
    if (budget !== undefined && total > budget) {
      rejected.push({
        offerId: offer.id,
        reason:
          `total ${round2(total)} USD/h exceeds budget ` +
          `${round2(budget)} USD/h`,
      });
      return false;
    }
    return true;
  });

  if (affordable.length === 0) {
    return {
      ok: false,
      request,
      reason: `every matching offer exceeds the budget of ${round2(budget ?? 0)} USD/h`,
    };
  }

  const sorted = [...affordable].sort((a, b) => {
    const priceA = effectivePrice(a, request.interruptionTolerant) * request.nodes;
    const priceB = effectivePrice(b, request.interruptionTolerant) * request.nodes;
    if (priceA !== priceB) {
      return priceA - priceB;
    }
    return a.id.localeCompare(b.id);
  });

  const best = sorted[0];
  const useSpot =
    request.interruptionTolerant && best.spotPricePerHour !== null;
  const pricePerNode = useSpot ? (best.spotPricePerHour as number) : best.pricePerHour;
  const totalPrice = pricePerNode * request.nodes;

  const rationale: string[] = [
    `Requirement: >= ${request.minVramGb} GB VRAM per GPU, ${request.gpusPerNode} GPUs/node, ${request.nodes} node(s)` +
      (request.region !== undefined ? `, region ${request.region}` : '') +
      '.',
    useSpot
      ? 'Spot is allowed because the workload is interruption-tolerant; spot capacity is available for the selected offer.'
      : request.interruptionTolerant
        ? 'On-demand selected: the cheapest matching offers have no spot capacity.'
        : 'On-demand selected: the workload is not interruption-tolerant, so spot is excluded.',
    `Cheapest compliant shape: ${best.provider} ${best.region} ${best.gpuType} x${best.gpuCount} at ${round2(pricePerNode)} USD/h per node.`,
    `Total: ${round2(totalPrice)} USD/h for ${request.nodes} node(s)` +
      (budget !== undefined ? `, within the ${round2(budget)} USD/h budget` : '') +
      '.',
  ];
  if (request.hours !== undefined && request.hours > 0) {
    rationale.push(
      `Projected session cost: ${round2(totalPrice * request.hours)} USD over ${request.hours} h.`,
    );
  }

  return {
    ok: true,
    request,
    offer: best,
    useSpot,
    pricePerHourPerNode: pricePerNode,
    totalPricePerHour: totalPrice,
    estimatedSessionCost:
      request.hours !== undefined && request.hours > 0
        ? round2(totalPrice * request.hours)
        : null,
    rationale,
    rejected,
  };
}
