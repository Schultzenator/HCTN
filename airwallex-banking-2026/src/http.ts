import type { IncomingMessage, Server, ServerResponse } from 'node:http';
export async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []; let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length; if (bytes > 262144) throw new Error('Body too large');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}
export function json(res: ServerResponse, status: number, value: unknown): void { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); }
export async function listen(server: Server, port = 0): Promise<string> {
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Invalid listen address');
  return `http://127.0.0.1:${address.port}`;
}
export async function close(server: Server): Promise<void> { server.closeIdleConnections(); await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())); }
