export type AgentMode = "meta" | "mock";

export interface HouseholdInput {
  evening: string;
  people: number;
  constraints: string[];
  inventory: string[];
  imageUrl?: string;
}

export interface Segment {
  label: string;
  confidence: number;
  box: [number, number, number, number];
  mask?: string;
}

export interface VisualPlan {
  title: string;
  description: string;
  imageDataUrl?: string;
}

export interface HouseholdPlan {
  title: string;
  summary: string;
  steps: Array<{ time: string; owner: string; task: string; why: string }>;
  assumptions: string[];
  detectedObjects: Segment[];
  visual: VisualPlan;
}

export interface AgentResult {
  mode: AgentMode;
  models: string[];
  plan: HouseholdPlan;
  trace: Array<{ stage: string; model: string; status: "live" | "mock"; note: string }>;
}

export interface MetaClient {
  readonly mode: AgentMode;
  respond(model: string, input: unknown, options?: Record<string, unknown>): Promise<unknown>;
  generateImage(prompt: string): Promise<string | undefined>;
}
