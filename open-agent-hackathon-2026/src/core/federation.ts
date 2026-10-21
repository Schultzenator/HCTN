import type { FederationResult, SourceProvider } from '../types.js';
export async function federate(sources: readonly SourceProvider[]): Promise<FederationResult> {
  const results = await Promise.allSettled(sources.map(source => Promise.resolve().then(() => source.fetch())));
  const opportunities: FederationResult['opportunities'] = [];
  const warnings: string[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') opportunities.push(...result.value);
    else warnings.push(`${sources[index]?.name ?? 'Unknown source'} failed: ${result.reason instanceof Error ? result.reason.message : 'unknown error'}`);
  });
  return { opportunities, warnings };
}
