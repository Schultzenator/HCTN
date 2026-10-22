/**
 * FleetPilot CLI.
 *
 * - default: deterministic offline demo scenario through the mock client
 * - --live: same scenario against the real emma API (requires EMMA_API_KEY)
 * - --mcp: start the MCP stdio server for LLM clients
 */

import { createClient } from './emma/client.js';
import { runScenario } from './agent/scripted.js';
import { createMcpState, runStdioServer } from './mcp/server.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const wantsMcp = args.includes('--mcp');
  const wantsLive = args.includes('--live');

  const client = createClient();
  const mode = wantsLive ? 'live emma API' : 'offline mock';

  if (wantsMcp) {
    const state = createMcpState(client);
    console.error(`FleetPilot MCP server ready (${mode}; MCP over stdio, protocol 2025-06-18)`);
    await runStdioServer(state, process.stdin, process.stdout);
    return;
  }

  console.log(`FleetPilot - agentic GPU fleet ops over emma (${mode})`);
  console.log('='.repeat(72));
  console.log();

  const scenario = await runScenario(client);
  for (const step of scenario.steps) {
    if (step.user.startsWith('(')) {
      console.log(`--- ${step.user} ---`);
      console.log();
      continue;
    }
    console.log(`> ${step.user}`);
    console.log(`  [tool: ${step.tool}]`);
    for (const line of step.output.split('\n')) {
      console.log(`  ${line}`);
    }
    console.log();
  }

  console.log('='.repeat(72));
  console.log('Scenario complete. The same tools are exposed over MCP: npx fleetpilot --mcp');
}

main().catch((error: unknown) => {
  console.error(`FleetPilot failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
