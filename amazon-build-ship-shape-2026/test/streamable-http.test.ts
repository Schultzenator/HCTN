import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { household, isoWeekNumber } from "../src/state.js";

const PORT = 3987;
const BASE = "http://127.0.0.1:" + PORT;

async function rpc(body: unknown): Promise<any> {
  const res = await fetch(BASE + "/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify(body),
  });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /application\/json/);
  return res.json();
}

test("Streamable HTTP lifecycle: initialize, tools/list, tools/call round-trip", async (t) => {
  const child = spawn(process.execPath, ["dist/src/server.js"], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });
  t.after(() => child.kill("SIGTERM"));

  const deadline = Date.now() + 10000;
  let up = false;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(BASE + "/healthz");
      if (r.ok) { up = true; break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  assert.ok(up, "server did not come up in time");

  // 1. initialize handshake
  const init = await rpc({
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "alexa-sim", version: "1.0.0" },
    },
  });
  assert.equal(init.jsonrpc, "2.0");
  assert.equal(init.id, 1);
  assert.ok(typeof init.result.protocolVersion === "string" && init.result.protocolVersion.length > 0);
  assert.equal(init.result.serverInfo.name, "household-ops-mcp");

  // 2. notifications/initialized (202 Accepted in stateless JSON mode)
  const notif = await fetch(BASE + "/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  });
  assert.ok([200, 202].includes(notif.status));

  // 3. tools/list
  const tools = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const names = tools.result.tools.map((x: any) => x.name).sort();
  assert.deepEqual(names, ["add_grocery_item", "assign_chores", "get_shopping_list", "household_summary", "plan_movie_night"]);

  // 4. tools/call: add item
  const add = await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "add_grocery_item", arguments: { item: "oat milk", quantity: 2 } } });
  assert.equal(add.result.content[0].type, "text");
  assert.ok(add.result.content[0].text.includes("oat milk"));

  // 5. tools/call: read back state
  const list = await rpc({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "get_shopping_list", arguments: {} } });
  assert.ok(list.result.content[0].text.includes("oat milk"));

  // 6. tools/call: movie night planner
  const pick = await rpc({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "plan_movie_night", arguments: { max_minutes: 100 } } });
  assert.ok(pick.result.content[0].text.includes("title"));

  // 7. spec-correct: GET /mcp in stateless mode -> 405
  const get = await fetch(BASE + "/mcp");
  assert.equal(get.status, 405);
});

test("deterministic planning core", () => {
  household.reset();
  const a = household.assignChores("2026-10-19");
  const b = household.assignChores("2026-10-19");
  assert.deepEqual(a, b);
  assert.equal(isoWeekNumber(new Date("2026-10-19T00:00:00Z")), 43);

  const m1 = household.planMovieNight("comedy", 90);
  const m2 = household.planMovieNight("comedy", 90);
  assert.deepEqual(m1, m2);
  assert.ok("pick" in m1);

  const err = household.planMovieNight("horror", 20);
  assert.ok("error" in err);
});
