export type OpportunityKind = 'hackathon' | 'bounty' | 'issue';
export interface Evidence { url: string; source: string }
export interface Opportunity {
  id: string;
  title: string;
  description: string;
  kind: OpportunityKind;
  tags: string[];
  evidence: Evidence[];
}
export interface SourceProvider {
  readonly name: string;
  fetch(): Promise<Opportunity[]>;
}
export interface Assessment { id: string; score: number; reason: string }
export interface ModelProvider {
  readonly name: string;
  rank(opportunities: readonly Opportunity[], profile: string): Promise<Assessment[]>;
}
export interface RankedOpportunity extends Opportunity { score: number; reason: string }
export interface FederationResult { opportunities: Opportunity[]; warnings: string[] }
