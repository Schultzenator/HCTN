// AgentCart config — SANDBOX HARD-LOCKED (GT-3 legal verdict: no live credentials ever).
import "dotenv/config";

export interface Config {
  port: number;
  mockPaypal: boolean;
  paypalBase: string; // always the sandbox host; live hosts are unreachable by design
  paypalClientId?: string;
  paypalClientSecret?: string;
  agentMode: "scripted" | "openai" | "mistral";
  openaiApiKey?: string;
  mistralApiKey?: string;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function loadConfig(): Config {
  const mockPaypal = (process.env.MOCK_PAYPAL ?? "1") !== "0";
  const env = (process.env.PAYPAL_ENV ?? "sandbox").toLowerCase();
  if (env !== "sandbox") {
    // Hard guard: this app must never talk to the live PayPal API.
    throw new Error("PAYPAL_ENV must be 'sandbox' (hard-locked by competition constraints).");
  }
  const agentMode = (process.env.AGENT_MODE ?? "scripted") as Config["agentMode"];
  if (!["scripted", "openai", "mistral"].includes(agentMode)) {
    throw new Error(`Invalid AGENT_MODE: ${agentMode}`);
  }
  return {
    port: Number(process.env.PORT ?? 3000),
    mockPaypal,
    paypalBase: "https://api-m.sandbox.paypal.com",
    paypalClientId: mockPaypal ? undefined : requireEnv("PAYPAL_CLIENT_ID"),
    paypalClientSecret: mockPaypal ? undefined : requireEnv("PAYPAL_CLIENT_SECRET"),
    agentMode,
    openaiApiKey: process.env.OPENAI_API_KEY,
    mistralApiKey: process.env.MISTRAL_API_KEY,
  };
}
