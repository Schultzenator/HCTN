#!/usr/bin/env node
import { deduplicate, federate, FixtureSource, GitHubSource, MockModelProvider, OpenAIModelProvider, rankOpportunities, renderMarkdown } from './index.js';
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: opportunity-radar [--live] [--model mock|openai] [--profile "typescript agents data"]\nDefault: offline fixtures + deterministic mock. --live enables GitHub only.');
    return;
  }
  let live = false;
  let modelName = 'mock';
  let profile = 'typescript agents data open-source';
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--live') live = true;
    else if (arg === '--model' || arg === '--profile') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      if (arg === '--model') modelName = value; else profile = value;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!['mock', 'openai'].includes(modelName)) throw new Error('--model must be mock or openai');
  const warnings: string[] = [];
  const model = modelName === 'mock' ? new MockModelProvider() : new OpenAIModelProvider({
    baseUrl: process.env.MODEL_BASE_URL ?? '', apiKey: process.env.MODEL_API_KEY ?? '', model: process.env.MODEL_NAME ?? '',
  });
  const sources = [new FixtureSource('hackathons'), new FixtureSource('bounties'), live ? new GitHubSource({ onWarning: warning => warnings.push(warning) }) : new FixtureSource('github')];
  const result = await federate(sources);
  warnings.push(...result.warnings);
  const unique = deduplicate(result.opportunities);
  const ranked = await rankOpportunities(unique, model, profile);
  console.log(renderMarkdown(ranked, {
    mode: live ? 'GitHub live + synthetic hackathon/bounty fixtures (fallback disclosed below)' : 'offline demo — all opportunities are synthetic fixtures',
    model: model.name, profile, fetched: result.opportunities.length, deduplicated: unique.length, warnings,
  }));
}
main().catch((error: unknown) => { console.error(`Opportunity Radar: ${error instanceof Error ? error.message : 'unexpected failure'}`); process.exitCode = 1; });
