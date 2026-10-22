/**
 * Streak logic. A log entry is one line of JSON: {"date":"YYYY-MM-DD","taskId":"t3"}.
 * The streak counts consecutive days (ending today, or yesterday if today is
 * not logged yet) on which at least one task was completed.
 */

export function dayNumber(isoDate: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) throw new Error(`invalid date: ${isoDate}`);
  const [y, mo, d] = [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
  // Days since epoch, purely local-calendar based (no timezone math).
  return Math.floor(Date.UTC(y, mo - 1, d) / 86400000);
}

export function computeStreak(logDates: string[], today: string): number {
  const days = new Set<number>();
  for (const d of logDates) days.add(dayNumber(d));

  const todayNum = dayNumber(today);
  let cursor = days.has(todayNum) ? todayNum : todayNum - 1;
  if (!days.has(cursor)) return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}

export function todayIso(now: Date): string {
  return now.toISOString().slice(0, 10);
}
