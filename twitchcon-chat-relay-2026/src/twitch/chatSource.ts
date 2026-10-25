export interface ChatEvent {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  timestamp: number;
}
export type SourceStatus = 'connecting' | 'connected' | 'reconnecting' | 'finished' | 'stopped' | 'error';
export type StatusHandler = (status: SourceStatus, detail?: string) => void;
export interface ChatSource {
  start(onEvent: (event: ChatEvent) => void, onStatus: StatusHandler): void;
  stop(): void;
}
export function isChatEvent(value: unknown): value is ChatEvent {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return ['id', 'userId', 'displayName', 'text'].every(key => typeof e[key] === 'string')
    && typeof e.id === 'string' && e.id.length > 0 && e.id.length <= 256
    && typeof e.userId === 'string' && e.userId.length > 0 && e.userId.length <= 128
    && typeof e.displayName === 'string' && e.displayName.length <= 128
    && typeof e.text === 'string' && e.text.length <= 2000
    && typeof e.timestamp === 'number' && Number.isFinite(e.timestamp);
}
