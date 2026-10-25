/**
 * Zero-dependency test runner: `npm test`
 * (node --experimental-strip-types test/run-tests.ts)
 */
import { parseBacklog, serializeBacklog } from '../src/backlog.ts';
import {
  validateSelection,
  fallbackSelection,
  buildPlan,
  renderPlan,
  selectionToPlan,
} from '../src/planner.ts';
import { extractJson, parseSelection, buildPrompt, mockProvider } from '../src/providers.ts';
import { computeStreak, dayNumber } from '../src/streak.ts';
import type { Provider, ProviderSelection, Task } from '../src/types.ts';

let passed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean): void {
  if (cond) passed++;
  else failures.push(name);
}

function assertEq(name: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else failures.push(`${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// ---------- backlog ----------
const md = [
  '# Backlog',
  '',
  '- [ ] Fix flaky checkout test (40m)',
  '- [x] Ship README quickstart',
  '- [ ] Reply to partner emails',
  'some prose that is not a task',
  '* [ ] Update lockfile (10m)',
].join('\n');
const tasks = parseBacklog(md);
assertEq('parse ids', tasks.map((t) => t.id), ['t1', 't2', 't3', 't4']);
assertEq('parse done flags', tasks.map((t) => t.done), [false, true, false, false]);
assertEq('parse efforts', tasks.map((t) => t.effortMin), [40, 25, 25, 10]);
assertEq('parse titles', tasks[2].title, 'Reply to partner emails');
const roundTrip = parseBacklog(serializeBacklog(tasks));
assertEq('serialize round-trip ids', roundTrip.map((t) => t.id), tasks.map((t) => t.id));
assertEq('serialize round-trip done', roundTrip.map((t) => t.done), tasks.map((t) => t.done));
assertEq('serialize round-trip effort', roundTrip.map((t) => t.effortMin), tasks.map((t) => t.effortMin));

// ---------- validation ----------
const budget = 120;
const okSel: ProviderSelection = {
  anchor: { id: 't1', reason: 'most concrete blocker' },
  supports: [{ id: 't4', reason: 'tiny win to warm up' }],
};
assertEq('valid selection passes', validateSelection(okSel, tasks, budget), []);

assertEq('unknown id rejected', validateSelection(
  { anchor: { id: 't99', reason: '' }, supports: [] }, tasks, budget).length > 0, true);
assertEq('done task rejected', validateSelection(
  { anchor: { id: 't2', reason: '' }, supports: [] }, tasks, budget).length > 0, true);
assertEq('anchor repeated as support rejected', validateSelection(
  { anchor: { id: 't1', reason: '' }, supports: [{ id: 't1', reason: '' }] }, tasks, budget).length > 0, true);
assertEq('duplicate supports rejected', validateSelection(
  { anchor: { id: 't1', reason: '' }, supports: [{ id: 't3', reason: '' }, { id: 't3', reason: '' }] }, tasks, budget).length > 0, true);
const bigTasks: Task[] = [
  { id: 'a1', title: 'Big A', done: false, effortMin: 50 },
  { id: 'a2', title: 'Big B', done: false, effortMin: 50 },
  { id: 'a3', title: 'Big C', done: false, effortMin: 50 },
];
assertEq('too many supports rejected', validateSelection(
  { anchor: { id: 'a1', reason: '' }, supports: [{ id: 'a2', reason: '' }, { id: 'a3', reason: '' }, { id: 'a4', reason: '' }] },
  [...bigTasks, { id: 'a4', title: 'Big D', done: false, effortMin: 10 }], 300).length > 0, true);

// Budget: anchor 40 + supports 40+40 = 120 == budget, but anchor cap is 60% -> ok at 40.
// Now force over-budget:
assertEq('over-budget rejected', validateSelection(
  { anchor: { id: 'a1', reason: '' }, supports: [{ id: 'a2', reason: '' }, { id: 'a3', reason: '' }] },
  bigTasks, 100).length > 0, true);
assertEq('anchor cap rejected', validateSelection(
  { anchor: { id: 'a1', reason: '' }, supports: [] }, bigTasks, 50).length > 0, true);

// ---------- fallback ----------
const fb = fallbackSelection(tasks, budget);
assertEq('fallback anchor is smallest open task', fb.anchor.id, 't4');
assertEq('fallback picks anchor then supports', fb.supports.map((s) => s.id), ['t3', 't1']);
const degenerate = fallbackSelection(
  [{ id: 'b1', title: 'Huge', done: false, effortMin: 300 }], 60);
assertEq('fallback degenerate schedules smallest anyway', degenerate.anchor.id, 'b1');

// ---------- buildPlan: provider throws -> fallback ----------
const boom: Provider = {
  name: 'boom',
  async select(): Promise<ProviderSelection> {
    throw new Error('API down');
  },
};
const planB = await buildPlan(boom, tasks, budget, '2026-10-22');
check('provider failure falls back', planB.source === 'fallback' && planB.items.length > 0);

// ---------- buildPlan: provider returns garbage -> fallback ----------
const garbage: Provider = {
  name: 'garbage',
  async select(): Promise<ProviderSelection> {
    return { anchor: { id: 't99', reason: 'hallucinated' }, supports: [] };
  },
};
const planG = await buildPlan(garbage, tasks, budget, '2026-10-22');
check('invalid model selection falls back', planG.source === 'fallback');
assertEq('fallback plan keeps tasks verbatim',
  planG.items.map((i) => i.title).every((t) => tasks.some((x) => x.title === t)), true);

// ---------- buildPlan: mock provider ----------
const planM = await buildPlan(mockProvider(), tasks, budget, '2026-10-22');
check('mock provider produces valid plan', planM.source === 'mock' && planM.items.length === 3);
assertEq('plan total within budget',
  planM.items.reduce((s, i) => s + i.estimateMin, 0) <= budget, true);
assertEq('exactly one anchor', planM.items.filter((i) => i.role === 'anchor').length, 1);
assertEq('deferred is empty when all open tasks fit', planM.deferredIds, []);
check('deferred excludes done tasks', !planM.deferredIds.includes('t2'));

// empty backlog
const planE = await buildPlan(mockProvider(), [], budget, '2026-10-22');
assertEq('empty backlog -> empty plan', planE.items.length, 0);

// ---------- renderPlan smoke ----------
const rendered = renderPlan(planM);
check('render contains date and total', rendered.includes('2026-10-22') && rendered.includes('Total planned'));

// ---------- selectionToPlan ----------
const sel2 = { anchor: { id: 't1', reason: 'r' }, supports: [{ id: 't4', reason: 'r2' }] };
const plan2 = selectionToPlan(sel2, tasks, budget, '2026-10-22');
assertEq('roles assigned', plan2.items.map((i) => i.role), ['anchor', 'support']);
assertEq('deferred computed', plan2.deferredIds, ['t3']);

// ---------- providers: prompt + JSON extraction ----------
const prompt = buildPrompt(tasks, 90);
check('prompt lists all tasks', tasks.every((t) => prompt.includes(`${t.id} |`)));
check('prompt forbids inventing tasks', prompt.includes('Do not invent tasks'));
assertEq('extractJson plain', extractJson('{"a":1}'), { a: 1 });
assertEq('extractJson fenced', extractJson('```json\n{"a":2}\n```'), { a: 2 });
assertEq('extractJson with prose', extractJson('Sure! Here you go:\n{"a":3}\nHope that helps.'), { a: 3 });
check('extractJson unbalanced throws', (() => { try { extractJson('{"a":1'); return false; } catch { return true; } })());
assertEq('parseSelection normalizes missing reasons',
  parseSelection({ anchor: { id: 'x' }, supports: [{ id: 'y' }] }),
  { anchor: { id: 'x', reason: '' }, supports: [{ id: 'y', reason: '' }] });

// ---------- streak ----------
assertEq('dayNumber', dayNumber('2026-10-22') - dayNumber('2026-10-21'), 1);
assertEq('streak consecutive', computeStreak(['2026-10-20', '2026-10-21', '2026-10-22'], '2026-10-22'), 3);
assertEq('streak counts from yesterday if today missing',
  computeStreak(['2026-10-20', '2026-10-21'], '2026-10-22'), 2);
assertEq('streak broken', computeStreak(['2026-10-19', '2026-10-21'], '2026-10-22'), 1);
assertEq('streak empty', computeStreak([], '2026-10-22'), 0);
assertEq('streak duplicates ignored',
  computeStreak(['2026-10-22', '2026-10-22', '2026-10-21'], '2026-10-22'), 2);

// ---------- report ----------
console.log(`Tests: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  for (const f of failures) console.error(`FAIL: ${f}`);
  process.exit(1);
}
