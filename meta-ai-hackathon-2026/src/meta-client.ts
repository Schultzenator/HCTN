import type { Config } from "./config.js";
import type { MetaClient } from "./types.js";

export class HttpMetaClient implements MetaClient {
  readonly mode = "meta" as const;
  constructor(private readonly config: Config) {
    if (!config.apiKey) throw new Error("META_API_KEY or MODEL_API_KEY is required for live mode");
  }

  async respond(model: string, input: unknown, options: Record<string, unknown> = {}): Promise<unknown> {
    const response = await fetch(`${this.config.baseUrl}/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model, input, ...options }),
    });
    if (!response.ok) throw new Error(`Meta Model API ${response.status}: ${await response.text()}`);
    return response.json();
  }

  async generateImage(prompt: string): Promise<string | undefined> {
    const response = await fetch(`${this.config.baseUrl}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "muse-image-1.0", prompt, response_format: "b64_json", size: "1024x1024" }),
    });
    if (!response.ok) throw new Error(`Muse Image ${response.status}: ${await response.text()}`);
    const body = await response.json() as { data?: Array<{ b64_json?: string; url?: string }> };
    const item = body.data?.[0];
    return item?.b64_json ? `data:image/png;base64,${item.b64_json}` : item?.url;
  }
}

export class MockMetaClient implements MetaClient {
  readonly mode = "mock" as const;
  readonly calls: string[] = [];
  async respond(model: string, _input: unknown): Promise<unknown> {
    this.calls.push(model);
    if (model === "sam-3.1") return { output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify([{ label: "pantry item", confidence: 0.97, box: [0.16, 0.18, 0.52, 0.74] }]) }] }] };
    return { output_text: JSON.stringify({ title: "Calm evening, zero chaos", summary: "Use what is already at home first, then split tasks by time and energy.", steps: [{ time: "18:00", owner: "host", task: "Prep the dinner base from what is on hand", why: "Fewer shopping trips and no last-minute decisions." }, { time: "19:00", owner: "everyone", task: "Twenty focused minutes resetting one zone", why: "A small, closed time-box shows a visible result." }, { time: "20:00", owner: "host", task: "Close the day with a short plan for tomorrow", why: "The morning starts from a ready-made decision." }], assumptions: ["The photo shows a sample kitchen zone."] }) };
  }
  async generateImage(_prompt: string): Promise<string | undefined> {
    this.calls.push("muse-image-1.0");
    return undefined;
  }
}
