import assert from 'node:assert/strict';
import { test } from 'node:test';

import { marketAt } from '../emma/mock.js';
import { effectivePrice, planWorkload } from '../optimizer/planner.js';
import type { WorkloadRequest } from '../types.js';

function request(overrides?: Partial<WorkloadRequest>): WorkloadRequest {
  return {
    name: 'test-workload',
    image: 'ghcr.io/ml/test:latest',
    minVramGb: 80,
    gpusPerNode: 8,
    nodes: 1,
    interruptionTolerant: true,
    ...overrides,
  };
}

test('picks the cheapest compliant offer and uses spot when tolerant', () => {
  const plan = planWorkload(request(), marketAt(0));
  assert.ok(plan.ok);
  // Baseline market: lambda H100 x8 spot at 18.99 is the cheapest 8x H100.
  assert.equal(plan.offer.id, 'lambda-h100-80-x8-usw2');
  assert.equal(plan.useSpot, true);
  assert.equal(plan.pricePerHourPerNode, 18.99);
  assert.equal(plan.totalPricePerHour, 18.99);
  const joined = plan.rationale.join(' ');
  assert.match(joined, /interruption-tolerant/);
});

test('excludes spot for interruption-intolerant workloads', () => {
  const plan = planWorkload(request({ interruptionTolerant: false }), marketAt(0));
  assert.ok(plan.ok);
  // Without spot the cheapest 8x H100 80GB on-demand is nebius at 22.40.
  assert.equal(plan.offer.id, 'nebius-a100-80-x8-eun');
  assert.equal(plan.useSpot, false);
  assert.equal(plan.pricePerHourPerNode, 22.4);
});

test('filters offers with too little VRAM', () => {
  const plan = planWorkload(request({ minVramGb: 100 }), marketAt(0));
  assert.equal(plan.ok, false);
  assert.match(plan.reason, /no offer provides >= 100 GB VRAM/);
});

test('respects the region constraint', () => {
  const plan = planWorkload(request({ region: 'us-central1' }), marketAt(0));
  assert.ok(plan.ok);
  assert.equal(plan.offer.id, 'gcp-h100-80-x8-usc1');
  assert.equal(plan.useSpot, true);
  assert.equal(plan.pricePerHourPerNode, 27.99);
});

test('budget cap rejects over-budget offers with reasons', () => {
  // Budget 20 USD/h: lambda spot 18.99 fits; gcp spot 27.99 is rejected.
  const plan = planWorkload(request({ maxPricePerHour: 20 }), marketAt(0));
  assert.ok(plan.ok);
  assert.equal(plan.offer.id, 'lambda-h100-80-x8-usw2');
  const gcpRejection = plan.rejected.find((entry) => entry.offerId === 'gcp-h100-80-x8-usc1');
  assert.ok(gcpRejection);
  assert.match(gcpRejection.reason, /exceeds budget/);
});

test('fails cleanly when every matching offer exceeds the budget', () => {
  const plan = planWorkload(request({ maxPricePerHour: 1 }), marketAt(0));
  assert.equal(plan.ok, false);
  assert.match(plan.reason, /exceeds the budget of 1 USD\/h/);
});

test('multiplies cost across nodes', () => {
  const plan = planWorkload(request({ nodes: 2 }), marketAt(0));
  assert.ok(plan.ok);
  assert.equal(plan.totalPricePerHour, 37.98);
  assert.match(plan.rationale.join(' '), /2 node\(s\)/);
});

test('projects session cost when hours are declared', () => {
  const plan = planWorkload(request({ hours: 72 }), marketAt(0));
  assert.ok(plan.ok);
  assert.equal(plan.estimatedSessionCost, 1367.28);
});

test('deterministic: same inputs, same plan', () => {
  const first = planWorkload(request(), marketAt(0));
  const second = planWorkload(request(), marketAt(0));
  assert.deepEqual(first, second);
});

test('effectivePrice prefers spot only when available and allowed', () => {
  const offers = marketAt(0);
  const lambda = offers.find((offer) => offer.id === 'lambda-h100-80-x8-usw2');
  const nebius = offers.find((offer) => offer.id === 'nebius-a100-80-x8-eun');
  assert.ok(lambda && nebius);
  assert.equal(effectivePrice(lambda, true), 18.99);
  assert.equal(effectivePrice(lambda, false), 31.9);
  assert.equal(effectivePrice(nebius, true), 22.4);
});
