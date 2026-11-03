import type { MetaClient } from "./types.js";
import type { AgentResult, HouseholdInput, HouseholdPlan, Segment } from "./types.js";

function textOf(response: unknown): string {
  const r = response as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  return r.output_text ?? r.output?.flatMap(item => item.content ?? []).map(item => item.text ?? "").join("") ?? "";
}

function jsonOf<T>(value: string): T {
  const cleaned = value.replace(/^```json\s*|\s*```$/g, "").trim();
  return JSON.parse(cleaned) as T;
}

export async function runHouseholdOps(input: HouseholdInput, client: MetaClient): Promise<AgentResult> {
  const trace: AgentResult["trace"] = [];
  const stages = (stage: string, model: string, note: string) => trace.push({ stage, model, status: client.mode === "meta" ? "live" : "mock", note });

  let detectedObjects: Segment[] = [];
  if (input.imageUrl) {
    const samResponse = await client.respond("sam-3.1", [{ role: "user", content: [{ type: "input_text", text: "Find household items and food products" }, { type: "input_image", image_url: input.imageUrl }] }]);
    try { detectedObjects = jsonOf<Segment[]>(textOf(samResponse)); } catch { detectedObjects = []; }
    stages("perception", "sam-3.1", `${detectedObjects.length} objects`);
  } else stages("perception", "sam-3.1", "skipped: no photo");

  const prompt = `You are Household Ops Agent. Return JSON only with title, summary, steps (time, owner, task, why), assumptions. Plan ${input.evening} for ${input.people} people. Constraints: ${input.constraints.join(", ") || "none"}. Inventory: ${input.inventory.join(", ") || "unknown"}. Detected objects: ${JSON.stringify(detectedObjects)}.`;
  const planResponse = await client.respond("muse-spark-1.3", prompt, { reasoning: { effort: "medium" } });
  const generated = jsonOf<Omit<HouseholdPlan, "detectedObjects" | "visual">>(textOf(planResponse));
  stages("planning", "muse-spark-1.3", `${generated.steps.length} steps with reasons`);

  const visualPrompt = `A warm, realistic editorial illustration of this household plan: ${generated.title}. ${generated.summary}. No text, no logos.`;
  const imageDataUrl = await client.generateImage(visualPrompt);
  stages("visualization", "muse-image-1.0", imageDataUrl ? "image generated" : "mock/fallback, no image");

  return { mode: client.mode, models: ["sam-3.1", "muse-spark-1.3", "muse-image-1.0"], plan: { ...generated, detectedObjects, visual: { title: "Evening plan visual", description: visualPrompt, imageDataUrl } }, trace };
}
