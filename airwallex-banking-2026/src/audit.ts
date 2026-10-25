import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, openSync, fsyncSync, closeSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { canonical } from './domain.js';
export interface AuditEvent { seq: number; timestamp: string; type: string; requestId: string; data: any; previousHash: string; hash: string }
export class Audit {
  constructor(readonly path: string, readonly now: () => number = Date.now) { mkdirSync(dirname(path), { recursive: true }); }
  read(requestId?: string): AuditEvent[] {
    if (!existsSync(this.path)) return [];
    const raw = readFileSync(this.path, 'utf8');
    if (raw && !raw.endsWith('\n')) throw new Error('Truncated audit: refusing unsafe replay');
    const events: AuditEvent[] = raw.split('\n').filter(Boolean).map(line => JSON.parse(line));
    let previousHash = 'GENESIS';
    for (let n = 0; n < events.length; n++) {
      const event = events[n]!; const { hash, ...unsigned } = event;
      if (event.seq !== n + 1 || event.previousHash !== previousHash || hash !== createHash('sha256').update(canonical(unsigned)).digest('hex')) throw new Error('Audit integrity failure');
      previousHash = hash;
    }
    return requestId ? events.filter(e => e.requestId === requestId) : events;
  }
  append(type: string, requestId: string, data: unknown, evaluatedAt = this.now()): AuditEvent {
    const rows = this.read();
    const unsigned = { seq: rows.length + 1, timestamp: new Date(evaluatedAt).toISOString(), type, requestId, data, previousHash: rows.at(-1)?.hash ?? 'GENESIS' };
    const event = { ...unsigned, hash: createHash('sha256').update(canonical(unsigned)).digest('hex') };
    appendFileSync(this.path, JSON.stringify(event) + '\n', { mode: 0o600 });
    const fd = openSync(this.path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
    return event;
  }
  async exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const lock = this.path + '.lock';
    try { mkdirSync(lock); } catch { throw new Error('Audit busy: another operation holds the lock (after a crash, reconcile before removing .lock)'); }
    try { return await fn(); } finally { rmSync(lock, { recursive: true }); }
  }
}
