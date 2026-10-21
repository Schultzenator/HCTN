import type { RankedOpportunity } from '../types.js';
function escape(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').replace(/[\\`*_{}\[\]()<>#!|]/g, '\\$&');
}
function linkUrl(value: string): string { return value.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/</g, '%3C').replace(/>/g, '%3E'); }
export interface ReportContext { mode: string; model: string; profile: string; fetched: number; deduplicated: number; warnings: readonly string[] }
export function renderMarkdown(records: readonly RankedOpportunity[], context: ReportContext): string {
  const lines = [
    '# Opportunity Radar', '',
    `Mode: ${escape(context.mode)} | Model: ${escape(context.model)}`, '',
    `Profile: ${escape(context.profile)}`, '',
    `Pipeline: ${context.fetched} federated → ${context.deduplicated} deduplicated → ${records.length} evidence-backed recommendations.`, '',
    '> Scores measure profile relevance, not verified eligibility or payment. Evidence links record provenance; review the original source before applying.', '',
  ];
  if (context.warnings.length) lines.push('## Source notices', '', ...context.warnings.map(warning => `- ${escape(warning)}`), '');
  if (!records.length) lines.push('No opportunities with valid evidence links.', '');
  records.forEach((record, index) => {
    lines.push(`## ${index + 1}. ${escape(record.title)} — ${record.score}/100`, '',
      `Type: ${record.kind} | Tags: ${record.tags.map(escape).join(', ') || 'none'}`, '',
      escape(record.description), '', `**Why:** ${escape(record.reason)}`, '', '**Evidence:**', '',
      ...record.evidence.map(item => `- [${escape(item.source)}](${linkUrl(item.url)})`), '');
  });
  return lines.join('\n');
}
