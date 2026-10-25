import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Studio } from '../core/state.js';
import { page, uiScript } from './panel.js';
import { styles } from './styles.js';

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk as Buffer);
    size += buffer.length;
    if (size > 4096) throw new Error('Request too large');
    chunks.push(buffer);
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected JSON object');
  return value as Record<string, unknown>;
}
export function createStudioServer(studio: Studio, playFixture?: () => void) {
  const moderatorKey = randomBytes(32).toString('hex');
  const clients = new Set<ServerResponse>();
  let revision = 0;
  let pending: ReturnType<typeof setTimeout> | undefined;
  const snapshot = () => ({ ...studio.snapshot(), revision, serverTime: Date.now() });
  const send = (response: ServerResponse): void => {
    if (response.writableLength > 256 * 1024) { response.destroy(); clients.delete(response); return; }
    response.write(`id: ${revision}\nevent: state\ndata: ${JSON.stringify(snapshot())}\n\n`);
  };
  const unsubscribe = studio.subscribe(() => {
    revision++;
    if (pending) return;
    pending = setTimeout(() => { pending = undefined; for (const client of clients) send(client); }, 50);
  });
  const timer = setInterval(() => studio.tick(), 100);
  const heartbeat = setInterval(() => { for (const client of clients) client.write(': heartbeat\n\n'); }, 15_000);
  const server = createServer((request, response) => {
    void handle(request, response).catch(() => {
      if (!response.headersSent && !response.destroyed) json(response, 500, { error: 'Internal server error' });
      else response.end();
    });
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  const json = (response: ServerResponse, status: number, body: unknown): void => {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(body));
  };
  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const address = server.address();
    if (!address || typeof address === 'string') { json(response, 503, { error: 'Not listening' }); return; }
    const hosts = [`127.0.0.1:${address.port}`, `localhost:${address.port}`];
    const host = request.headers.host ?? '';
    if (!hosts.includes(host)) { json(response, 403, { error: 'Local Host required' }); return; }
    if (request.headers.origin && !hosts.some(h => request.headers.origin === `http://${h}`)) {
      json(response, 403, { error: 'Local Origin required' }); return;
    }
    const pathname = new URL(request.url ?? '/', `http://${host}`).pathname;
    if (request.method === 'GET') {
      if (pathname === '/events') {
        if (clients.size >= 32) { json(response, 503, { error: 'Too many overlay clients' }); return; }
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
        response.flushHeaders(); clients.add(response); send(response);
        response.on('close', () => clients.delete(response)); return;
      }
      if (pathname === '/api/state') { json(response, 200, snapshot()); return; }
      if (pathname === '/health') { json(response, 200, { ok: true, mode: studio.mode }); return; }
      const content = pathname === '/' ? page(false, moderatorKey) : pathname === '/overlay' ? page(true)
        : pathname === '/ui.js' ? uiScript : pathname === '/styles.css' ? styles : null;
      if (content !== null) {
        const mime = pathname.endsWith('.js') ? 'text/javascript' : pathname.endsWith('.css') ? 'text/css' : 'text/html';
        response.writeHead(200, { 'Content-Type': `${mime}; charset=utf-8` }); response.end(content); return;
      }
    }
    if (request.method === 'POST' && pathname === '/api/command') {
      const token = request.headers['x-moderator-key'];
      if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || !timingSafeEqual(Buffer.from(token), Buffer.from(moderatorKey))) {
        json(response, 403, { error: 'Moderator key required' }); return;
      }
      if (request.headers['content-type'] !== 'application/json') { json(response, 415, { error: 'Use application/json' }); return; }
      if (Number(request.headers['content-length'] ?? 0) > 4096) { json(response, 413, { error: 'Request too large' }); request.resume(); return; }
      try {
        const payload = await readJson(request);
        if (typeof payload.action !== 'string') throw new Error('Action required');
        if (payload.action === 'fixture') {
          if (!playFixture || studio.mode !== 'fixture') throw new Error('Fixture mode is disabled');
          playFixture();
        } else studio.command(payload.action, payload);
        json(response, 200, snapshot());
      } catch (error) { json(response, 400, { error: error instanceof Error ? error.message : 'Invalid command' }); }
      return;
    }
    json(response, 404, { error: 'Not found' });
  }
  function cleanup(): void {
    clearInterval(timer); clearInterval(heartbeat); clearTimeout(pending); unsubscribe();
    for (const client of clients) client.end();
    clients.clear();
  }
  server.on('close', cleanup);
  return { server, close: () => {
    cleanup();
    server.close();
    // Aborted SSE readers can leave an HTTP connection active; do not hang on exit.
    server.closeAllConnections();
  } };
}
