import WebSocket from 'ws';
import type { ChatEvent, ChatSource, StatusHandler } from './chatSource.js';
export interface IrcConfig {
  channel: string; username: string; token: string;
  url?: string; reconnectMs?: number; maxReconnectMs?: number; idleTimeoutMs?: number;
}
function unescapeTag(value: string): string {
  return value.replace(/\\([s:nr\\])/g, (_, char: string) => ({ s: ' ', ':': ';', n: '\n', r: '\r', '\\': '\\' })[char]!);
}
export function parsePrivmsg(line: string, channel: string): ChatEvent | null {
  const match = /^@([^ ]+) :[^ ]+ PRIVMSG #([^ ]+) :(.*)$/.exec(line);
  if (!match || match[2]!.toLowerCase() !== channel.toLowerCase()) return null;
  const tags = Object.fromEntries(match[1]!.split(';').map(tag => {
    const i = tag.indexOf('=');
    return i < 0 ? [tag, ''] : [tag.slice(0, i), unescapeTag(tag.slice(i + 1))];
  }));
  const timestamp = Number(tags['tmi-sent-ts']);
  if (!tags.id || !tags['user-id'] || !Number.isFinite(timestamp)) return null;
  return { id: tags.id, userId: tags['user-id'], displayName: tags['display-name'] || tags['user-id'],
    text: match[3]!, timestamp };
}
export class IrcSource implements ChatSource {
  private socket: WebSocket | undefined;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private watchdog: ReturnType<typeof setTimeout> | undefined;
  private stopped = true;
  private attempts = 0;
  private emit: (event: ChatEvent) => void = () => {};
  private status: StatusHandler = () => {};
  constructor(private readonly config: IrcConfig) {
    if (!/^[a-z0-9_]{1,25}$/i.test(config.channel) || !/^[a-z0-9_]{1,25}$/i.test(config.username)
      || !/^(oauth:)?[a-z0-9]+$/i.test(config.token)) throw new Error('Invalid Twitch channel, username or token');
  }
  start(onEvent: (event: ChatEvent) => void, onStatus: StatusHandler): void {
    if (!this.stopped) return;
    this.stopped = false; this.emit = onEvent; this.status = onStatus;
    this.connect();
  }
  private armWatchdog(socket: WebSocket): void {
    clearTimeout(this.watchdog);
    this.watchdog = setTimeout(() => socket.terminate(), this.config.idleTimeoutMs ?? 90_000);
  }
  private connect(): void {
    if (this.stopped) return;
    this.status(this.attempts ? 'reconnecting' : 'connecting');
    const socket = new WebSocket(this.config.url ?? 'wss://irc-ws.chat.twitch.tv:443', {
      handshakeTimeout: 10_000, maxPayload: 64 * 1024
    });
    this.socket = socket;
    socket.on('open', () => {
      if (this.stopped) { socket.terminate(); return; }
      socket.send('CAP REQ :twitch.tv/tags twitch.tv/commands\r\n');
      socket.send(`PASS oauth:${this.config.token.replace(/^oauth:/, '')}\r\n`);
      socket.send(`NICK ${this.config.username.toLowerCase()}\r\n`);
      socket.send(`JOIN #${this.config.channel.toLowerCase()}\r\n`);
      this.armWatchdog(socket);
    });
    socket.on('message', data => {
      if (this.stopped) return;
      this.armWatchdog(socket);
      for (const line of data.toString().split(/\r?\n/)) {
        if (line.startsWith('PING ')) { socket.send(`PONG ${line.slice(5)}\r\n`); continue; }
        if (/^:[^ ]+ NOTICE [^ ]+ :(Login authentication failed|Improperly formatted auth|Login unsuccessful)/i.test(line)) {
          this.stop(); this.status('error', 'Twitch authentication failed; check env credentials and chat:read scope'); return;
        }
        if (/^:[^ ]+ RECONNECT(?: |$)/.test(line)) { socket.terminate(); return; }
        if (/^:[^ ]+ 001 /.test(line)) { this.attempts = 0; this.status('connected', 'Twitch authenticated'); }
        if (/^:[^ ]+ NOTICE [^ ]+ :(?:You are banned|Invalid NICK)/i.test(line)) {
          this.stop(); this.status('error', 'Twitch rejected this account or channel'); return;
        }
        const event = parsePrivmsg(line, this.config.channel);
        if (event) this.emit(event);
      }
    });
    socket.on('error', () => { /* close schedules retry; never log token-bearing errors */ });
    socket.on('close', () => {
      clearTimeout(this.watchdog);
      if (this.stopped) return;
      const base = this.config.reconnectMs ?? 1000;
      const delay = Math.min(base * 2 ** Math.min(this.attempts++, 10), this.config.maxReconnectMs ?? 30_000);
      this.status('reconnecting', `Retry in ${delay} ms; Twitch does not backfill missed chat`);
      this.retry = setTimeout(() => this.connect(), delay);
    });
  }
  stop(): void {
    this.stopped = true; clearTimeout(this.retry); clearTimeout(this.watchdog);
    this.socket?.terminate(); this.status('stopped');
  }
}
