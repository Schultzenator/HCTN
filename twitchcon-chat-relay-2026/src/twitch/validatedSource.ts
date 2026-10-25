import type { ChatEvent, ChatSource, StatusHandler } from './chatSource.js';
export async function validateToken(token: string, username: string, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<number> {
  const response = await fetcher('https://id.twitch.tv/oauth2/validate', {
    headers: { Authorization: `OAuth ${token.replace(/^oauth:/, '')}` },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error('Twitch token validation failed; reauthorize and restart');
  const value: unknown = await response.json();
  if (!value || typeof value !== 'object') throw new Error('Invalid token validation response');
  const data = value as Record<string, unknown>;
  if (typeof data.login !== 'string' || data.login.toLowerCase() !== username.toLowerCase()) throw new Error('Token does not belong to TWITCH_USERNAME');
  if (!Array.isArray(data.scopes) || !data.scopes.includes('chat:read')) throw new Error('Token requires chat:read scope');
  if (typeof data.expires_in !== 'number' || !Number.isFinite(data.expires_in) || data.expires_in < 1) throw new Error('Twitch token expired');
  return data.expires_in;
}
/** Validates before connecting, then at least hourly and before known expiry. */
export class ValidatedSource implements ChatSource {
  private controller: AbortController | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;
  constructor(private readonly inner: ChatSource, private readonly token: string, private readonly username: string,
    private readonly fetcher: typeof fetch = fetch, private readonly validationMs = 3_600_000) {}
  start(onEvent: (event: ChatEvent) => void, onStatus: StatusHandler): void {
    if (this.controller) return;
    const controller = new AbortController(); this.controller = controller;
    const generation = ++this.generation;
    onStatus('connecting', 'Validating Twitch token');
    const check = async (initial: boolean): Promise<void> => {
      try {
        const expiry = await validateToken(this.token, this.username, this.fetcher, controller.signal);
        if (generation !== this.generation) return;
        if (initial) this.inner.start(onEvent, onStatus);
        this.timer = setTimeout(() => { void check(false); }, Math.max(100, Math.min(this.validationMs, expiry * 1000 - 1000)));
      } catch {
        if (generation !== this.generation) return;
        this.stop();
        onStatus('error', 'Twitch token validation failed (expired, revoked, wrong login/scope, or network error). Check credentials and restart.');
      }
    };
    void check(true);
  }
  stop(): void { this.generation++; this.controller?.abort(); this.controller = undefined; clearTimeout(this.timer); this.inner.stop(); }
}
