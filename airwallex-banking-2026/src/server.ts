import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { signedSchema, purchaseSchema } from './domain.js';
import { configuredAirwallex, verifyWebhook } from './airwallex.js';
import { Audit } from './audit.js';
import { IntentPay } from './service.js';
import { readBody, json, listen, close } from './http.js';
export function createMcp(service: IntentPay): McpServer {
  const mcp = new McpServer({ name: 'intentpay', version: '1.0.0' });
  const args = { envelope: signedSchema, purchase: purchaseSchema };
  const result = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value) }] });
  mcp.registerTool('propose_purchase', { description: 'Verify signed owner intent, lock FX and execute exactly one payment rail, or request human review.', inputSchema: args }, async ({ envelope, purchase }) => result(await service.propose(envelope, purchase)));
  mcp.registerTool('check_policy', { description: 'Read-only deterministic policy check with fresh FX quote. Does not reserve or pay.', inputSchema: args }, async ({ envelope, purchase }) => result(await service.check(envelope, purchase)));
  mcp.registerTool('get_audit_trail', { description: 'Read verified append-only audit events.', inputSchema: { requestId: z.string().uuid().optional() } }, async ({ requestId }) => result(service.audit.read(requestId)));
  return mcp;
}
function equalSecret(value: string, expected: string): boolean {
  const a = Buffer.from(value), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function startServer(service: IntentPay, options: { token: string; webhookSecret?: string; port?: number }) {
  if (options.token.length < 16) throw new Error('MCP_TOKEN must contain at least 16 characters');
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url ?? '/', 'http://localhost').pathname;
      if (path === '/healthz') return json(res, 200, { status: 'ok', mode: service.bank.config.mock ? 'mock' : 'sandbox' });
      if (path === '/webhooks/airwallex' && req.method === 'POST') {
        const raw = await readBody(req), timestamp = String(req.headers['x-timestamp'] ?? ''), signature = String(req.headers['x-signature'] ?? '');
        if (!options.webhookSecret || !verifyWebhook(raw, timestamp, signature, options.webhookSecret, service.now())) return json(res, 401, { error: 'Invalid webhook signature or timestamp' });
        const event = JSON.parse(raw);
        if (typeof event.id !== 'string' || !event.id || typeof event.name !== 'string') return json(res, 400, { error: 'Missing event id/name' });
        await service.audit.exclusive(async () => {
          if (!service.audit.read().some(row => row.type === 'webhook' && row.data.id === event.id)) service.audit.append('webhook', event.id, event);
        });
        return json(res, 200, { received: true });
      }
      if (path !== '/mcp') return json(res, 404, { error: 'Use POST /mcp' });
      if (!equalSecret(String(req.headers.authorization ?? ''), `Bearer ${options.token}`)) return json(res, 401, { error: 'Unauthorized' });
      if (req.headers.origin) return json(res, 403, { error: 'Browser origins are disabled' });
      if (req.method !== 'POST') { res.setHeader('allow', 'POST'); return json(res, 405, { error: 'Stateless mode supports POST only' }); }
      const raw = await readBody(req);
      let body: unknown;
      try { body = JSON.parse(raw); } catch { return json(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      const mcp = createMcp(service);
      res.on('close', () => { void transport.close(); void mcp.close(); });
      await mcp.connect(transport); await transport.handleRequest(req, res, body);
    } catch (err) {
      if (!res.headersSent) json(res, 400, { error: String(err) }); else res.end();
    }
  });
  return { url: await listen(server, options.port ?? 0), close: () => close(server) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.INTENTPAY_PUBLIC_KEY_PATH || !process.env.MCP_TOKEN) throw new Error('Set INTENTPAY_PUBLIC_KEY_PATH and MCP_TOKEN; see README');
  const bank = await configuredAirwallex();
  const audit = new Audit(process.env.AUDIT_PATH ?? 'data/audit.jsonl');
  const service = new IntentPay(bank.client, audit, readFileSync(process.env.INTENTPAY_PUBLIC_KEY_PATH, 'utf8'), Date.now, { slackWebhook: process.env.SLACK_WEBHOOK_URL });
  const server = await startServer(service, { token: process.env.MCP_TOKEN, webhookSecret: process.env.AIRWALLEX_WEBHOOK_SECRET, port: Number(process.env.PORT ?? 3001) });
  console.log(`IntentPay ${bank.client.config.mock ? 'MOCK' : 'SANDBOX'}: ${server.url}/mcp`);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, async () => { await server.close(); await bank.close(); process.exit(0); });
}
