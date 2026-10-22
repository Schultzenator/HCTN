import assert from 'node:assert/strict';
import { test } from 'node:test';

import { marketAt, MockEmmaClient } from '../emma/mock.js';

test('baseline market contains the multi-provider inventory', () => {
  const offers = marketAt(0);
  assert.ok(offers.length >= 9);
  const providers = new Set(offers.map((offer) => offer.provider));
  assert.ok(providers.has('aws'));
  assert.ok(providers.has('gcp'));
  assert.ok(providers.has('lambda'));
  assert.ok(providers.has('ovhcloud'));
});

test('tick 1 deterministically changes the market', () => {
  const before = marketAt(0);
  const after = marketAt(1);
  const beforeIds = new Set(before.map((offer) => offer.id));
  assert.ok(!beforeIds.has('spotwave-h100-80-x8-usw'));
  const spotwave = after.find((offer) => offer.id === 'spotwave-h100-80-x8-usw');
  assert.ok(spotwave);
  assert.equal(spotwave.spotPricePerHour, 15.75);
  const gcp = after.find((offer) => offer.id === 'gcp-h100-80-x8-usc1');
  assert.ok(gcp);
  assert.equal(gcp.spotPricePerHour, null);
  // The baseline market itself is not mutated by later ticks.
  const unchanged = marketAt(0).find((offer) => offer.id === 'gcp-h100-80-x8-usc1');
  assert.ok(unchanged);
  assert.equal(unchanged.spotPricePerHour, 27.99);
});

test('createInstance assigns sequential ids and stores instances', async () => {
  const client = new MockEmmaClient();
  const first = await client.createInstance({
    offerId: 'lambda-h100-80-x8-usw2',
    workload: 'w1',
    useSpot: true,
    image: 'img',
  });
  const second = await client.createInstance({
    offerId: 'nebius-a100-80-x8-eun',
    workload: 'w2',
    useSpot: false,
    image: 'img',
  });
  assert.equal(first.id, 'gpu-0001');
  assert.equal(second.id, 'gpu-0002');
  assert.equal(first.useSpot, true);
  assert.equal(first.pricePerHour, 18.99);
  assert.equal(second.useSpot, false);
  assert.equal(second.pricePerHour, 22.4);
  const instances = await client.listInstances();
  assert.equal(instances.length, 2);
  assert.equal(instances.every((instance) => instance.status === 'running'), true);
});

test('createInstance rejects unknown offers and unavailable spot', async () => {
  const client = new MockEmmaClient();
  await assert.rejects(
    () =>
      client.createInstance({
        offerId: 'does-not-exist',
        workload: 'w',
        useSpot: false,
        image: 'img',
      }),
    /unknown offer/,
  );
  await assert.rejects(
    () =>
      client.createInstance({
        offerId: 'nebius-a100-80-x8-eun',
        workload: 'w',
        useSpot: true,
        image: 'img',
      }),
    /no spot capacity/,
  );
});

test('terminateInstance flips status and rejects double termination', async () => {
  const client = new MockEmmaClient();
  const instance = await client.createInstance({
    offerId: 'lambda-h100-80-x8-usw2',
    workload: 'w',
    useSpot: true,
    image: 'img',
  });
  const result = await client.terminateInstance(instance.id);
  assert.deepEqual(result, { terminated: true, instanceId: instance.id });
  await assert.rejects(
    () => client.terminateInstance(instance.id),
    /already terminated/,
  );
  await assert.rejects(() => client.terminateInstance('gpu-9999'), /unknown instance/);
});

test('listInstances returns copies (no external mutation)', async () => {
  const client = new MockEmmaClient();
  const instance = await client.createInstance({
    offerId: 'lambda-h100-80-x8-usw2',
    workload: 'w',
    useSpot: true,
    image: 'img',
  });
  const listed = await client.listInstances();
  listed[0].status = 'terminated';
  const fresh = await client.listInstances();
  assert.equal(fresh[0].status, 'running');
  assert.equal(instance.status, 'running');
});
