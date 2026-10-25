/**
 * Deterministic scripted agent run for the offline demo.
 *
 * This is the "brain" shown in the 90-second video: a fixed sequence of user
 * intents executed through the same agent tools an MCP client would call. It
 * exists because the demo must be reproducible frame-for-frame; the tool layer
 * it drives is the exact same layer a real LLM client drives over MCP.
 */

import type { EmmaClient } from '../types.js';
import type { ToolContext, ToolResult } from './tools.js';
import { createTools } from './tools.js';
import { MockEmmaClient } from '../emma/mock.js';

export interface ScenarioStep {
  /** User intent shown in the transcript. */
  user: string;
  tool: string;
  args: Record<string, unknown>;
  output: string;
}

export interface ScenarioRun {
  steps: ScenarioStep[];
}

export async function runScenario(client: EmmaClient): Promise<ScenarioRun> {
  const context: ToolContext = { client };
  const tools = createTools();
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const steps: ScenarioStep[] = [];

  const call = async (user: string, tool: string, args: Record<string, unknown>) => {
    const handler = byName.get(tool);
    if (!handler) {
      throw new Error(`unknown tool in scenario: ${tool}`);
    }
    const result: ToolResult = await handler.run(args, context);
    steps.push({ user, tool, args, output: result.content[0]?.text ?? '' });
  };

  await call(
    'Show me the federated H100 inventory.',
    'gpu.list_offers',
    { gpuType: 'H100' },
  );

  await call(
    'I need to fine-tune a 70B model: 8x H100 80GB on one node, interruption-tolerant, under 35 USD/h. Plan it.',
    'gpu.plan_workload',
    {
      name: 'llama3-70b-finetune',
      image: 'ghcr.io/ml/finetune:latest',
      minVramGb: 80,
      gpusPerNode: 8,
      nodes: 1,
      interruptionTolerant: true,
      maxPricePerHour: 35,
      hours: 72,
    },
  );

  await call(
    'Deploy it.',
    'gpu.deploy_workload',
    {
      name: 'llama3-70b-finetune',
      image: 'ghcr.io/ml/finetune:latest',
      minVramGb: 80,
      gpusPerNode: 8,
      nodes: 1,
      interruptionTolerant: true,
      maxPricePerHour: 35,
      hours: 72,
    },
  );

  await call('How is the fleet doing?', 'gpu.fleet_status', {});

  // Market refresh: a neocloud flashes cheap spot capacity; a hyperscaler
  // spot pool sells out. Only meaningful for the mock client.
  if (client instanceof MockEmmaClient) {
    client.setMarketTick(1);
    steps.push({
      user: '(market refresh: spotwave flash capacity appears, gcp spot sells out)',
      tool: '',
      args: {},
      output: '',
    });
  }

  await call(
    'Prices move all the time. Check my fleet for savings.',
    'gpu.optimize_costs',
    {},
  );

  const statusAfterOptimization = await context.client.listInstances();
  const running = statusAfterOptimization.find(
    (instance) => instance.status === 'running' && instance.workload === 'llama3-70b-finetune',
  );
  if (running) {
    await call(
      `The run is done, shut ${running.id} down.`,
      'gpu.terminate_instance',
      { instanceId: running.id },
    );
  }

  return { steps };
}
