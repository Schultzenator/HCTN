// MCP tool surface: the multi-cloud GPU fleet as agent tools, wired to
// the emma API (mock or live through createEmmaApi).

import type { DeploymentPlan } from "../types.js";
import { createEmmaApi, type EmmaApi } from "../emma/api.js";
import { priceSpread, searchCatalog } from "../core/catalog.js";
import { planDeployment } from "../core/planner.js";
import { FleetStore } from "../core/fleet.js";
import { optimizeFleet } from "../core/optimizer.js";
import type { ToolDef } from "./jsonrpc.js";

export interface FleetOpsState {
  api: EmmaApi;
  live: boolean;
  fleet: FleetStore;
  plans: Map<string, DeploymentPlan>;
}

/**
 * One state object per process: the in-memory fleet, plan cache and emma
 * adapter. Stateless JSON mode means no MCP session; this singleton keeps
 * tool calls coherent inside a single server process.
 */
export function createFleetOpsState(env: { mode?: string; apiKey?: string; baseUrl?: string } = {}): FleetOpsState {
  const { api, live } = createEmmaApi(env);
  return { api, live, fleet: new FleetStore(api), plans: new Map() };
}

export function buildTools(state: FleetOpsState): ToolDef[] {
  const { api, fleet, plans } = state;

  return [
    {
      name: "catalog_search",
      description:
        "Search the multi-cloud GPU catalog (all providers) by GPU type, VRAM, region and price cap. Returns offers sorted by USD per GPU-hour, cheapest first, with a price spread across providers.",
      inputSchema: {
        type: "object",
        properties: {
          gpu_type: { type: "string", description: "GPU accelerator, e.g. H100, A100, L40S" },
          min_vram_gb: { type: "number", description: "Minimum VRAM per GPU in GB", minimum: 0 },
          region: { type: "string", description: "Exact region id, e.g. us-east-1" },
          max_gpu_hour_price: { type: "number", description: "Maximum USD per GPU-hour", minimum: 0 },
          limit: { type: "integer", description: "Max rows to return", minimum: 1, maximum: 50, default: 10 },
        },
      },
      run: async (args) => {
        const rows = searchCatalog(await api.listOffers(), {
          gpuType: args.gpu_type as string | undefined,
          minVramGbPerGpu: args.min_vram_gb as number | undefined,
          region: args.region as string | undefined,
          maxGpuHourPrice: args.max_gpu_hour_price as number | undefined,
          limit: args.limit as number,
        });
        return {
          matches: rows.length,
          priceSpreadAcrossProviders: priceSpread(rows),
          offers: rows.map((r) => ({
            offer_id: r.offer.id,
            provider: r.offer.provider,
            region: r.offer.region,
            gpu_type: r.offer.gpuType,
            vram_gb_per_gpu: r.offer.vramGbPerGpu,
            gpus_per_node: r.offer.gpusPerNode,
            price_per_node_hour_usd: r.offer.pricePerNodeHour,
            gpu_hour_price_usd: Math.round(r.gpuHourPrice * 100) / 100,
            available_gpus: r.offer.availableGpus,
          })),
        };
      },
    },
    {
      name: "plan_deployment",
      description:
        "Turn a workload spec (GPU count, hours, budget, optional region preference) into a cost-optimal, explainable deployment plan across the multi-cloud catalog. Deterministic: the same spec and catalog produce the same plan, with rejected alternatives and reasons.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Workload name, e.g. 'LoRA fine-tune 8B'" },
          gpus_required: { type: "integer", description: "Total GPUs needed", minimum: 1, maximum: 1024 },
          hours: { type: "number", description: "Planned runtime in hours", minimum: 0.1, maximum: 10000 },
          gpu_type: { type: "string", description: "Required GPU type, e.g. H100" },
          min_vram_gb: { type: "number", description: "Minimum VRAM per GPU in GB", minimum: 0 },
          max_budget_usd: { type: "number", description: "Hard budget cap in USD for the whole run", minimum: 0 },
          preferred_regions: { type: "array", items: "string", description: "Region allowlist (e.g. for data residency)" },
        },
        required: ["name", "gpus_required", "hours"],
      },
      run: async (args) => {
        const spec = {
          name: args.name as string,
          gpusRequired: args.gpus_required as number,
          hours: args.hours as number,
          gpuType: args.gpu_type as string | undefined,
          minVramGbPerGpu: args.min_vram_gb as number | undefined,
          maxBudgetUsd: args.max_budget_usd as number | undefined,
          preferredRegions: args.preferred_regions as string[] | undefined,
        };
        const plan = planDeployment(spec, await api.listOffers());
        if (plan.entries.length > 0) plans.set(plan.planId, plan);
        return plan;
      },
    },
    {
      name: "deploy_workload",
      description:
        "Deploy a previously planned workload (from plan_deployment) through the emma API. Budget and capacity were validated at planning time; returns the created instance ids.",
      inputSchema: {
        type: "object",
        properties: {
          plan_id: { type: "string", description: "Plan id returned by plan_deployment" },
        },
        required: ["plan_id"],
      },
      run: async (args) => {
        const plan = plans.get(args.plan_id as string);
        if (!plan) {
          throw new Error("unknown plan_id: " + String(args.plan_id) + " (call plan_deployment first)");
        }
        const instances = await fleet.deployPlan(plan);
        return {
          deployed: instances.length,
          instances: instances.map((i) => ({ id: i.id, provider: i.offer.provider, region: i.offer.region, gpu_type: i.offer.gpuType, state: i.state })),
          rationale: plan.rationale,
        };
      },
    },
    {
      name: "fleet_status",
      description:
        "Fleet briefing: every instance (active and terminated), billed hours, cost per instance, active burn rate per hour and total spend. In mock mode hours_now advances the simulated clock.",
      inputSchema: {
        type: "object",
        properties: {
          hours_now: { type: "number", description: "Mock mode only: simulated hours since fleet epoch", minimum: 0 },
        },
      },
      run: async (args) => fleet.status(args.hours_now as number | undefined),
    },
    {
      name: "optimize_costs",
      description:
        "Scan active instances for cheaper equivalents in the multi-cloud catalog (same GPU type and VRAM, lower USD per GPU-hour, capacity available). Dry run by default; apply=true migrates through the emma API and reports savings per day.",
      inputSchema: {
        type: "object",
        properties: {
          apply: { type: "boolean", description: "Actually migrate (default false: dry run)" },
          preferred_regions: { type: "array", items: "string", description: "Restrict targets to these regions" },
          hours_now: { type: "number", description: "Mock mode only: simulated hours since fleet epoch", minimum: 0 },
        },
      },
      run: async (args) => {
        const result = await optimizeFleet(api, fleet, {
          apply: Boolean(args.apply),
          preferredRegions: args.preferred_regions as string[] | undefined,
        });
        return result;
      },
    },
    {
      name: "teardown_fleet",
      description:
        "Terminate instances through the emma API: by explicit id list, or every active instance when all=true. Returns the terminated ids and the fleet's total spend.",
      inputSchema: {
        type: "object",
        properties: {
          instance_ids: { type: "array", items: "string", description: "Instance ids to terminate" },
          all: { type: "boolean", description: "Terminate every active instance" },
        },
      },
      run: async (args) => {
        const ids = args.instance_ids as string[] | undefined;
        const all = Boolean(args.all);
        if (!ids && !all) {
          throw new Error("pass instance_ids or all=true");
        }
        const terminated = await fleet.teardown(all ? undefined : ids);
        const status = await fleet.status();
        return { terminated, totalSpendUsd: status.totalSpendUsd };
      },
    },
  ];
}
