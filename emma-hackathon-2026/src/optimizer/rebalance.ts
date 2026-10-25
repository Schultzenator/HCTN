/**
 * Fleet cost optimizer and status reporting.
 *
 * rebalanceFleet() compares every running instance against the *current*
 * federated inventory and proposes like-for-like migrations (same GPU type,
 * same GPUs/node) that lower the hourly cost. Spot alternatives are only
 * proposed for instances that already run on spot - an interruption-intolerant
 * workload is never migrated to spot capacity.
 */

import {
  HOURS_PER_MONTH,
  round2,
  type FleetOptimization,
  type FleetReport,
  type GpuOffer,
  type Instance,
  type ProviderCost,
  type SavingsAction,
} from '../types.js';

/** Minimum saving per hour worth acting on (avoids churn on rounding noise). */
const SAVING_EPSILON = 0.01;

function likeForLike(offer: GpuOffer, instance: Instance): boolean {
  return offer.gpuType === instance.gpuType && offer.gpuCount === instance.gpuCount;
}

function bestCurrentPrice(offer: GpuOffer, allowSpot: boolean): number {
  if (allowSpot && offer.spotPricePerHour !== null) {
    return offer.spotPricePerHour;
  }
  return offer.pricePerHour;
}

function describePlacement(
  provider: string,
  region: string,
  useSpot: boolean,
  pricePerHour: number,
): string {
  return `${provider} ${region} ${useSpot ? 'spot' : 'on-demand'} @ ${round2(pricePerHour)} USD/h`;
}

export function rebalanceFleet(
  instances: Instance[],
  offers: GpuOffer[],
  options?: { hoursPerMonth?: number },
): FleetOptimization {
  const hoursPerMonth = options?.hoursPerMonth ?? HOURS_PER_MONTH;
  const running = instances.filter((instance) => instance.status === 'running');
  const actions: SavingsAction[] = [];

  for (const instance of running) {
    const candidates = offers
      .filter((offer) => likeForLike(offer, instance))
      .map((offer) => ({
        offer,
        price: bestCurrentPrice(offer, instance.useSpot),
      }))
      .filter((candidate) => candidate.price + SAVING_EPSILON < instance.pricePerHour)
      .sort((a, b) =>
        a.price !== b.price ? a.price - b.price : a.offer.id.localeCompare(b.offer.id),
      );

    const best = candidates[0];
    if (!best) {
      continue;
    }

    const savingPerHour = round2(instance.pricePerHour - best.price);
    const from = describePlacement(
      instance.provider,
      instance.region,
      instance.useSpot,
      instance.pricePerHour,
    );
    const to = describePlacement(
      best.offer.provider,
      best.offer.region,
      instance.useSpot && best.offer.spotPricePerHour !== null,
      best.price,
    );
    actions.push({
      instanceId: instance.id,
      from,
      to,
      savingPerHour,
      estimatedMonthlySaving: round2(savingPerHour * hoursPerMonth),
      rationale:
        `Like-for-like ${instance.gpuType} x${instance.gpuCount} is now cheaper at ` +
        `${best.offer.provider} ${best.offer.region}` +
        (instance.useSpot ? ' on spot capacity' : ' on demand') +
        `; saves ${savingPerHour} USD/h (~${round2(savingPerHour * hoursPerMonth)} USD/mo).`,
    });
  }

  const currentCostPerHour = round2(
    running.reduce((sum, instance) => sum + instance.pricePerHour, 0),
  );
  const optimizedCostPerHour = round2(
    currentCostPerHour - actions.reduce((sum, action) => sum + action.savingPerHour, 0),
  );

  return {
    actions,
    currentCostPerHour,
    optimizedCostPerHour,
    projectedMonthlySaving: round2(
      actions.reduce((sum, action) => sum + action.savingPerHour, 0) * hoursPerMonth,
    ),
  };
}

export function fleetStatus(
  instances: Instance[],
  options?: { hoursPerMonth?: number },
): FleetReport {
  const hoursPerMonth = options?.hoursPerMonth ?? HOURS_PER_MONTH;
  const running = instances.filter((instance) => instance.status === 'running');
  const terminated = instances.filter((instance) => instance.status === 'terminated');

  const byProviderMap = new Map<string, ProviderCost>();
  for (const instance of running) {
    const entry = byProviderMap.get(instance.provider);
    if (entry) {
      entry.instances += 1;
      entry.costPerHour = round2(entry.costPerHour + instance.pricePerHour);
    } else {
      byProviderMap.set(instance.provider, {
        provider: instance.provider,
        instances: 1,
        costPerHour: round2(instance.pricePerHour),
      });
    }
  }

  const costPerHour = round2(
    running.reduce((sum, instance) => sum + instance.pricePerHour, 0),
  );

  return {
    running: running.length,
    terminated: terminated.length,
    costPerHour,
    projectedMonthlyCost: round2(costPerHour * hoursPerMonth),
    byProvider: [...byProviderMap.values()].sort((a, b) =>
      a.provider.localeCompare(b.provider),
    ),
  };
}
