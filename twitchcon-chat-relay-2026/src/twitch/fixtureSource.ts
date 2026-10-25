import { readFileSync } from 'node:fs';
import { isChatEvent, type ChatEvent, type ChatSource, type StatusHandler } from './chatSource.js';
interface FixtureRecord { delayMs: number; event: ChatEvent }
export class FixtureSource implements ChatSource {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = true;
  private status: StatusHandler = () => {};
  private readonly records: FixtureRecord[];
  constructor(path: string, private readonly runId = 'fixture') {
    this.records = readFileSync(path, 'utf8').split(/\r?\n/).filter(line => line.trim()).map((line, i) => {
      const value: unknown = JSON.parse(line);
      if (!value || typeof value !== 'object') throw new Error(`Invalid fixture line ${i + 1}`);
      const r = value as Record<string, unknown>;
      if (!isChatEvent(r.event) || typeof r.delayMs !== 'number' || !Number.isFinite(r.delayMs) || r.delayMs < 0 || r.delayMs > 60_000)
        throw new Error(`Invalid fixture line ${i + 1}`);
      return { delayMs: r.delayMs, event: r.event };
    });
  }
  start(onEvent: (event: ChatEvent) => void, onStatus: StatusHandler): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.status = onStatus;
    onStatus('connected', 'Synthetic fixture playback');
    let index = 0;
    const next = (): void => {
      if (this.stopped) return;
      const record = this.records[index++];
      if (!record) { this.stopped = true; onStatus('finished'); return; }
      this.timer = setTimeout(() => {
        if (this.stopped) return;
        onEvent({ ...record.event, id: `${this.runId}:${record.event.id}` });
        next();
      }, record.delayMs);
    };
    next();
  }
  stop(): void { this.stopped = true; clearTimeout(this.timer); this.status('stopped'); }
}
