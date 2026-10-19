// AgentCart server — Express API + single-page demo UI.
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { MockGateway } from "./paypal/client.js";
import type { PayPalGateway } from "./paypal/client.js";
import { LiveSandboxGateway } from "./paypal/client.js";
import { ScriptedAgent } from "./agent/scripted.js";
import type { Agent } from "./agent/scripted.js";
import { LlmAgent } from "./agent/llm.js";

const cfg = loadConfig();
const paypal: PayPalGateway = cfg.mockPaypal
  ? new MockGateway()
  : new LiveSandboxGateway(cfg.paypalClientId!, cfg.paypalClientSecret!);

// Agent factory: the brain is swappable — deterministic scripted logic by default,
// or an LLM tool-calling loop (AGENT_MODE=openai|mistral, BYO key from .env).
function makeAgent(): Agent {
  switch (cfg.agentMode) {
    case "openai":
      if (!cfg.openaiApiKey) {
        throw new Error("AGENT_MODE=openai requires OPENAI_API_KEY in .env (BYO key, gitignored).");
      }
      return new LlmAgent("openai", cfg.openaiApiKey, paypal);
    case "mistral":
      if (!cfg.mistralApiKey) {
        throw new Error("AGENT_MODE=mistral requires MISTRAL_API_KEY in .env (BYO key, gitignored).");
      }
      return new LlmAgent("mistral", cfg.mistralApiKey, paypal);
    default:
      return new ScriptedAgent(paypal);
  }
}

const app = express();
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, paypal: paypal.kind, agentMode: cfg.agentMode });
});

app.post("/api/agent/goal", async (req, res) => {
  const { goal } = req.body ?? {};
  if (typeof goal !== "string" || goal.trim().length < 3) {
    res.status(400).json({ error: "Provide a 'goal' string, e.g. 'Set up a home office for $300'." });
    return;
  }
  try {
    const agent = makeAgent();
    const result = await agent.run(goal.trim());
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Mock-only: simulates the buyer approving the order on paypal.com.
if (paypal instanceof MockGateway) {
  app.post("/mock/paypal/approve/:orderId", (req, res) => {
    const ok = paypal.approve(req.params.orderId);
    if (!ok) {
      res.status(404).json({ error: "Unknown or already-captured mock order." });
      return;
    }
    res.json({ ok: true, orderId: req.params.orderId, status: "APPROVED" });
  });
}

app.post("/api/paypal/capture/:orderId", async (req, res) => {
  try {
    const capture = await paypal.captureOrder(req.params.orderId);
    res.json(capture);
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

app.post("/api/paypal/refund/:orderId", async (req, res) => {
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "Provide a positive numeric 'amount'." });
    return;
  }
  try {
    const r = await paypal.refundCapture(req.params.orderId, amount);
    res.json(r);
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

const port = cfg.port;
app.listen(port, () => {
  console.log(`AgentCart running on http://localhost:${port} (paypal: ${paypal.kind}, agent: ${cfg.agentMode})`);
});
