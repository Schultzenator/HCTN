import { readFileSync, existsSync } from "node:fs";

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*([^#]*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

export interface Config { apiKey?: string; baseUrl: string; forceMock: boolean; }

export function getConfig(): Config {
  loadEnvFile(process.env.META_ENV_FILE ?? "/home/schultze/Factory/secrets/meta.env");
  const apiKey = process.env.META_API_KEY ?? process.env.MODEL_API_KEY;
  return {
    apiKey,
    baseUrl: (process.env.META_API_BASE ?? "https://api.meta.ai/v1").replace(/\/$/, ""),
    forceMock: process.env.META_MOCK === "1" || !apiKey,
  };
}
