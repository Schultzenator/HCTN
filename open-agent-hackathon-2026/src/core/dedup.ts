import type { Opportunity } from '../types.js';
import { canonicalUrl } from './evidence.js';
/** Merge connected components of shared canonical evidence, including bridge records.
 * Titles alone are deliberately insufficient to identify an event or issue.
 */
export function deduplicate(records: readonly Opportunity[]): Opportunity[] {
  const parents = records.map((_, index) => index);
  const find = (index: number): number => {
    let root = index;
    while (parents[root] !== root) root = parents[root]!;
    while (parents[index] !== index) { const next = parents[index]!; parents[index] = root; index = next; }
    return root;
  };
  const owners = new Map<string, number>();
  records.forEach((record, index) => {
    for (const evidence of record.evidence) {
      const url = canonicalUrl(evidence.url);
      if (!url) continue;
      const owner = owners.get(url);
      if (owner === undefined) owners.set(url, index);
      else parents[find(index)] = find(owner);
    }
  });
  const groups = new Map<number, Opportunity[]>();
  records.forEach((record, index) => {
    const root = find(index);
    groups.set(root, [...(groups.get(root) ?? []), record]);
  });
  return [...groups.values()].map(group => {
    const first = [...group].sort((a, b) => a.id.localeCompare(b.id))[0]!;
    const evidence = new Map<string, Opportunity['evidence'][number]>();
    for (const record of group) for (const item of record.evidence) {
      const url = canonicalUrl(item.url);
      if (url && item.source.trim()) evidence.set(`${url}\n${item.source}`, { url, source: item.source });
    }
    return {
      ...first,
      description: [...group].sort((a, b) => b.description.length - a.description.length || a.id.localeCompare(b.id))[0]!.description,
      tags: [...new Set(group.flatMap(record => record.tags.map(tag => tag.trim().toLowerCase())).filter(Boolean))].sort(),
      evidence: [...evidence.values()].sort((a, b) => a.url.localeCompare(b.url) || a.source.localeCompare(b.source)),
    };
  }).sort((a, b) => a.id.localeCompare(b.id));
}
