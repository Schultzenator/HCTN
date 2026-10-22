#!/usr/bin/env node
/**
 * Tortoise CLI - a slow-and-steady daily planner.
 *
 * Usage:
 *   node --experimental-strip-types src/cli.ts plan examples/backlog.md --provider mock --budget 120
 *   node --experimental-strip-types src/cli.ts done examples/backlog.md t3
 *   node --experimental-strip-types src/cli.ts streak
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { parseBacklog, serializeBacklog, findTask } from './backlog.ts';
import { buildPlan, renderPlan } from './planner.ts';
import { providerByName } from './providers.ts';
import { computeStreak, todayIso } from './streak.ts';

const DEFAULT_LOG = 'log.jsonl';

function usage(): never {
  console.log(`Tortoise - one anchor a day.

  plan <backlog.md> [--provider gemma|ollama|mock] [--budget MIN]  build today's plan
  done <backlog.md> <taskId> [--log log.jsonl]                     complete a task, update streak log
  streak [--log log.jsonl]                                        show the current streak`);
  process.exit(0);
}

function parseArgs(argv: string[]): { cmd: string; positional: string[]; opts: Record<string, string> } {
  const positional: string[] = [];
  const opts: Record<string, string> = {};
  let cmd = '';
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        opts[key] = next;
        i += 2;
      } else {
        opts[key] = 'true';
        i += 1;
      }
    } else {
      if (cmd === '') cmd = a;
      else positional.push(a);
    }
  }
  return { cmd, positional, opts };
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === 'help' || argv[0] === '--help') usage();
  const { cmd, positional, opts } = parseArgs(argv);
  const today = todayIso(new Date());

  if (cmd === 'plan') {
    const file = positional[0];
    if (!file) usage();
    const budgetMin = parseInt(opts.budget ?? '120', 10);
    const providerName = opts.provider ?? 'gemma';
    const provider = providerByName(providerName);
    const tasks = parseBacklog(readFileSync(file, 'utf8'));
    const plan = await buildPlan(provider, tasks, budgetMin, today);
    const out = renderPlan(plan);
    const planFile = `plan-${today}.md`;
    writeFileSync(planFile, out);
    console.log(out);
    console.log(`Saved to ${planFile} | provider: ${providerName} | plan source: ${plan.source}`);
    return 0;
  }

  if (cmd === 'done') {
    const file = positional[0];
    const id = positional[1];
    if (!file || !id) usage();
    const tasks = parseBacklog(readFileSync(file, 'utf8'));
    const task = findTask(tasks, id);
    if (!task) {
      console.error(`No task with id ${id} in ${file}`);
      return 1;
    }
    task.done = true;
    writeFileSync(file, serializeBacklog(tasks));
    const logFile = opts.log ?? DEFAULT_LOG;
    appendFileSync(logFile, JSON.stringify({ date: today, taskId: id, title: task.title }) + '\n');
    const logDates = existsSync(logFile)
      ? readFileSync(logFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).date)
      : [];
    console.log(`Done: ${task.title}`);
    console.log(`Streak: ${computeStreak(logDates, today)} day(s)`);
    return 0;
  }

  if (cmd === 'streak') {
    const logFile = opts.log ?? DEFAULT_LOG;
    if (!existsSync(logFile)) {
      console.log('Streak: 0 day(s) - nothing logged yet.');
      return 0;
    }
    const logDates = readFileSync(logFile, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l).date);
    console.log(`Streak: ${computeStreak(logDates, today)} day(s)`);
    return 0;
  }

  usage();
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error(String(err));
  process.exit(1);
});
