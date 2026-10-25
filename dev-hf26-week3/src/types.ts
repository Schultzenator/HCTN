export interface Task {
  id: string;
  title: string;
  done: boolean;
  /** Rough effort estimate in minutes, taken from the backlog line, e.g. "(40m)". */
  effortMin: number;
}

export type PlanRole = 'anchor' | 'support';

export interface PlanItem {
  taskId: string;
  title: string;
  role: PlanRole;
  estimateMin: number;
  reason: string;
}

export interface Plan {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  budgetMin: number;
  items: PlanItem[];
  /** Ids of open backlog tasks deliberately not scheduled today. */
  deferredIds: string[];
  /** Name of the provider whose selection was accepted (e.g. "mock", "gemma-api"), or "fallback". */
  source: string;
}

/** What a provider (Gemma, Ollama or the deterministic mock) is allowed to return. */
export interface ProviderSelection {
  anchor: { id: string; reason: string };
  supports: Array<{ id: string; reason: string }>;
}

export interface Provider {
  name: string;
  select(tasks: Task[], budgetMin: number): Promise<ProviderSelection>;
}
