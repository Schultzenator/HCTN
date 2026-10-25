import type { Provider, ProviderSelection, Task } from './types.ts';

/**
 * Providers. Tortoise is model-agnostic but tuned for open-weight Gemma:
 * - "gemma"    -> Google Generative Language API (Gemma models are served
 *                  there for free with a Google AI Studio API key)
 * - "ollama"   -> fully local open weights via Ollama (e.g. gemma3:4b)
 * - "mock"     -> deterministic offline provider for tests and demos
 */

export function buildPrompt(tasks: Task[], budgetMin: number): string {
  const lines = [
    'You are the planning brain of a "slow and steady" productivity tool.',
    `The user has ${budgetMin} minutes of focus time today.`,
    'Pick exactly ONE anchor task (the single most meaningful open item) and',
    'at most two small support tasks. Do not invent tasks. Do not rename tasks.',
    'Smaller, concrete, older tasks beat big vague ones. Prefer finishing',
    'over starting.',
    '',
    'Backlog (id | done | effort | title):',
    ...tasks.map((t) => `${t.id} | ${t.done ? 'x' : ' '} | ${t.effortMin}m | ${t.title}`),
    '',
    'Respond with ONLY this JSON shape, no prose, no code fences:',
    '{"anchor":{"id":"<task id>","reason":"<one short sentence>"},"supports":[{"id":"<task id>","reason":"<one short sentence>"}]}',
  ];
  return lines.join('\n');
}

/** Extract the first balanced JSON object from model output (handles ``` fences). */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  if (start === -1) throw new Error('no JSON object in model output');
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
  }
  throw new Error('unbalanced JSON in model output');
}

export function parseSelection(raw: unknown): ProviderSelection {
  if (typeof raw !== 'object' || raw === null) throw new Error('selection is not an object');
  const obj = raw as Record<string, unknown>;
  const anchorObj = obj.anchor as Record<string, unknown> | undefined;
  if (!anchorObj || typeof anchorObj.id !== 'string') throw new Error('missing anchor id');
  const supportsRaw = Array.isArray(obj.supports) ? obj.supports : [];
  const supports = supportsRaw.map((s) => {
    const so = s as Record<string, unknown>;
    if (typeof so.id !== 'string') throw new Error('support without id');
    return { id: so.id, reason: typeof so.reason === 'string' ? so.reason : '' };
  });
  return {
    anchor: { id: anchorObj.id, reason: typeof anchorObj.reason === 'string' ? anchorObj.reason : '' },
    supports,
  };
}

interface RemoteModelConfig {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  extract: (data: any) => string;
}

async function callRemoteModel(cfg: RemoteModelConfig): Promise<string> {
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...cfg.headers },
    body: JSON.stringify(cfg.body),
  });
  if (!res.ok) {
    throw new Error(`model API error ${res.status}: ${await res.text()}`);
  }
  const data: any = await res.json();
  return cfg.extract(data);
}

export function buildGemmaApiProvider(model = 'gemma-3-12b-it', apiKey = process.env.GEMMA_API_KEY ?? process.env.GEMINI_API_KEY ?? ''): Provider {
  return {
    name: 'gemma-api',
    async select(tasks: Task[], budgetMin: number): Promise<ProviderSelection> {
      if (!apiKey) throw new Error('GEMMA_API_KEY (Google AI Studio) not set');
      const text = await callRemoteModel({
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        headers: { 'x-goog-api-key': apiKey },
        body: {
          contents: [{ parts: [{ text: buildPrompt(tasks, budgetMin) }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
        },
        extract: (d) => d.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
      });
      return parseSelection(extractJson(text));
    },
  };
}

export function buildOllamaProvider(model = 'gemma3:4b', baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'): Provider {
  return {
    name: 'ollama',
    async select(tasks: Task[], budgetMin: number): Promise<ProviderSelection> {
      const text = await callRemoteModel({
        url: `${baseUrl}/api/chat`,
        headers: {},
        body: {
          model,
          stream: false,
          options: { temperature: 0.4 },
          messages: [{ role: 'user', content: buildPrompt(tasks, budgetMin) }],
        },
        extract: (d) => d.message?.content ?? '',
      });
      return parseSelection(extractJson(text));
    },
  };
}

/**
 * Deterministic offline provider. Same choice policy as the fallback planner
 * (smallest open task first), but with Gemma-style reasons, so `npm run demo`
 * shows a realistic plan without any network or API key.
 */
export function mockProvider(): Provider {
  return {
    name: 'mock',
    async select(tasks: Task[], budgetMin: number): Promise<ProviderSelection> {
      const open = tasks
        .filter((t) => !t.done)
        .slice()
        .sort((a, b) => a.effortMin - b.effortMin || a.id.localeCompare(b.id));
      if (open.length === 0) throw new Error('no open tasks');
      const anchor = open[0];
      const supports: Array<{ id: string; reason: string }> = [];
      let used = anchor.effortMin;
      for (const t of open.slice(1)) {
        if (supports.length >= 2) break;
        if (used + t.effortMin <= budgetMin) {
          supports.push({ id: t.id, reason: `small enough to fit after the anchor (${t.effortMin}m)` });
          used += t.effortMin;
        }
      }
      return {
        anchor: {
          id: anchor.id,
          reason: `smallest concrete step that moves work forward today (${anchor.effortMin}m)`,
        },
        supports,
      };
    },
  };
}

export function providerByName(name: string): Provider {
  if (name === 'gemma') return buildGemmaApiProvider();
  if (name === 'ollama') return buildOllamaProvider();
  if (name === 'mock') return mockProvider();
  throw new Error(`unknown provider: ${name} (use gemma | ollama | mock)`);
}
