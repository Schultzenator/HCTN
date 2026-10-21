import type { ModelProvider, Opportunity, RankedOpportunity } from '../types.js';
import { canonicalUrl } from './evidence.js';
export async function rankOpportunities(records: readonly Opportunity[], model: ModelProvider, profile: string): Promise<RankedOpportunity[]> {
  const eligible = records.map(record => ({ ...record, evidence: record.evidence.filter(item => item.source.trim() && canonicalUrl(item.url)) }))
    .filter(record => record.evidence.length > 0);
  if (new Set(eligible.map(record => record.id)).size !== eligible.length) throw new Error('Opportunity IDs must be unique after deduplication');
  if (!eligible.length) return [];
  const assessments = await model.rank(eligible, profile);
  if (!Array.isArray(assessments) || assessments.length !== eligible.length) throw new Error('Model must assess every eligible opportunity exactly once');
  const byId = new Map(assessments.map(item => [item.id, item]));
  if (byId.size !== eligible.length) throw new Error('Model returned duplicate assessments');
  return eligible.map(record => {
    const assessment = byId.get(record.id);
    if (!assessment || !Number.isFinite(assessment.score) || assessment.score < 0 || assessment.score > 100 || typeof assessment.reason !== 'string' || !assessment.reason.trim()) {
      throw new Error(`Invalid model assessment for ${record.id}`);
    }
    return { ...record, score: assessment.score, reason: assessment.reason.trim() };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
