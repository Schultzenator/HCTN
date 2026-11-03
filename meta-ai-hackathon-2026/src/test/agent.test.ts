import test from "node:test";
import assert from "node:assert/strict";
import { MockMetaClient } from "../meta-client.js";
import { runHouseholdOps } from "../agent.js";

test("mock smoke: produces a traceable multi-model household plan", async () => {
  const client = new MockMetaClient();
  const result = await runHouseholdOps({ evening: "dinner", people: 2, constraints: [], inventory: ["pasta"], imageUrl: "data:image/png;base64,fixture" }, client);
  assert.equal(result.mode, "mock");
  assert.deepEqual(result.models, ["sam-3.1", "muse-spark-1.3", "muse-image-1.0"]);
  assert.deepEqual(client.calls, result.models);
  assert.equal(result.plan.steps.length, 3);
  assert.equal(result.plan.detectedObjects[0]?.label, "pantry item");
  assert.deepEqual(result.trace.map(item => item.stage), ["perception", "planning", "visualization"]);
});

test("mock smoke without photo remains usable", async () => {
  const result = await runHouseholdOps({ evening: "calm evening", people: 1, constraints: [], inventory: [] }, new MockMetaClient());
  assert.equal(result.plan.detectedObjects.length, 0);
  assert.match(result.plan.summary, /Use what is already/);
});
