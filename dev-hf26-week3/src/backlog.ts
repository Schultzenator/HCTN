import type { Task } from './types.ts';

const CHECKBOX_RE = /^[-*]\s+\[([ xX])\]\s+(.*)$/;
const EFFORT_RE = /\((\d+)\s*(?:m|min|mins|minutes)\)\s*$/i;
export const DEFAULT_EFFORT_MIN = 25;

/**
 * Parse a markdown backlog. Each task is one checkbox line:
 *
 *   - [ ] Rewrite the onboarding email (40m)
 *   - [x] Ship README quickstart
 *
 * Missing effort is treated as DEFAULT_EFFORT_MIN minutes.
 */
export function parseBacklog(text: string): Task[] {
  const tasks: Task[] = [];
  let n = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const m = CHECKBOX_RE.exec(line);
    if (!m) continue;
    const done = m[1].toLowerCase() === 'x';
    let title = m[2];
    let effortMin = DEFAULT_EFFORT_MIN;
    const em = EFFORT_RE.exec(title);
    if (em) {
      effortMin = parseInt(em[1], 10);
      title = title.slice(0, em.index).trim();
    }
    n += 1;
    tasks.push({ id: `t${n}`, title, done, effortMin });
  }
  return tasks;
}

export function serializeBacklog(tasks: Task[]): string {
  const lines = tasks.map(
    (t) => `- [${t.done ? 'x' : ' '}] ${t.title} (${t.effortMin}m)`
  );
  return lines.join('\n') + '\n';
}

export function findTask(tasks: Task[], id: string): Task | undefined {
  return tasks.find((t) => t.id === id);
}
