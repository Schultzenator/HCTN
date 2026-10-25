import type { Plan, PlanItem, Provider, ProviderSelection, Task } from './types.ts';

/** The anchor may never eat more than this share of the daily budget. */
export const ANCHOR_SHARE_CAP = 0.6;
/** Hard cap on planned items per day: one anchor plus at most two supports. */
export const MAX_ITEMS = 3;

/**
 * Guardrails. The model proposes, the deterministic layer disposes:
 * - every selected id must exist in the backlog and be open;
 * - exactly one anchor; at most two supports;
 * - the anchor alone must fit within ANCHOR_SHARE_CAP of the budget;
 * - the total estimate must fit within the budget;
 * - estimates always come from the backlog, never from the model.
 *
 * Returns a list of violations; empty list means the selection is usable.
 */
export function validateSelection(
  selection: ProviderSelection,
  tasks: Task[],
  budgetMin: number
): string[] {
  const errors: string[] = [];
  const open = tasks.filter((t) => !t.done);
  const byId = new Map(tasks.map((t) => [t.id, t]));

  if (!selection.anchor || !selection.anchor.id) {
    errors.push('missing anchor');
    return errors;
  }
  const anchorTask = byId.get(selection.anchor.id);
  if (!anchorTask) errors.push(`unknown task id ${selection.anchor.id}`);
  else if (anchorTask.done) errors.push(`task ${selection.anchor.id} is already done`);

  const supportIds = (selection.supports ?? []).map((s) => s.id);
  if (new Set(supportIds).size !== supportIds.length) {
    errors.push('duplicate support ids');
  }
  if (supportIds.includes(selection.anchor.id)) {
    errors.push('anchor repeated as support');
  }
  if (supportIds.length > MAX_ITEMS - 1) {
    errors.push(`too many supports (${supportIds.length} > ${MAX_ITEMS - 1})`);
  }

  for (const s of selection.supports ?? []) {
    const t = byId.get(s.id);
    if (!t) errors.push(`unknown task id ${s.id}`);
    else if (t.done) errors.push(`task ${s.id} is already done`);
  }

  if (errors.length > 0) return errors;

  const items = [selection.anchor, ...(selection.supports ?? [])];
  const totalMin = items.reduce((sum, s) => sum + (byId.get(s.id)?.effortMin ?? 0), 0);
  if (totalMin > budgetMin) {
    errors.push(`plan (${totalMin}m) exceeds budget (${budgetMin}m)`);
  }
  const anchorMin = byId.get(selection.anchor.id)!.effortMin;
  if (anchorMin > budgetMin * ANCHOR_SHARE_CAP) {
    errors.push(
      `anchor (${anchorMin}m) exceeds ${ANCHOR_SHARE_CAP * 100}% of budget (${budgetMin}m)`
    );
  }
  if (open.length > 0 && items.length > open.length) {
    errors.push('planned more items than there are open tasks');
  }
  return errors;
}

/**
 * Deterministic fallback used whenever the model is unavailable or its
 * selection violates the guardrails. "Steady" heuristics, in order:
 * smallest effort first, then oldest (earliest in the backlog). It picks
 * at most one anchor and as many supports as the budget allows.
 */
export function fallbackSelection(
  tasks: Task[],
  budgetMin: number
): ProviderSelection {
  const open = tasks
    .filter((t) => !t.done)
    .slice()
    .sort((a, b) => a.effortMin - b.effortMin || a.id.localeCompare(b.id));

  const supports: Array<{ id: string; reason: string }> = [];
  let anchor: { id: string; reason: string } | null = null;
  let used = 0;

  for (const t of open) {
    if (anchor === null) {
      if (t.effortMin <= budgetMin * ANCHOR_SHARE_CAP) {
        anchor = {
          id: t.id,
          reason: `smallest open task that fits as the anchor (${t.effortMin}m)`,
        };
        used += t.effortMin;
      }
      continue;
    }
    if (supports.length >= MAX_ITEMS - 1) break;
    if (used + t.effortMin <= budgetMin) {
      supports.push({
        id: t.id,
        reason: `fits the remaining budget (${budgetMin - used}m left)`,
      });
      used += t.effortMin;
    }
  }

  if (!anchor && open.length > 0) {
    // Degenerate case: every open task is bigger than the anchor cap.
    // Schedule the smallest one anyway; the CLI warns the user.
    anchor = {
      id: open[0].id,
      reason: `no task fits the anchor cap; scheduling the smallest open task (${open[0].effortMin}m)`,
    };
  }

  return { anchor: anchor!, supports };
}

export function selectionToPlan(
  selection: ProviderSelection,
  tasks: Task[],
  budgetMin: number,
  date: string
): Plan {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const items: PlanItem[] = [
    {
      taskId: selection.anchor.id,
      title: byId.get(selection.anchor.id)!.title,
      role: 'anchor',
      estimateMin: byId.get(selection.anchor.id)!.effortMin,
      reason: selection.anchor.reason || 'no reason provided',
    },
    ...selection.supports.map((s) => ({
      taskId: s.id,
      title: byId.get(s.id)!.title,
      role: 'support' as const,
      estimateMin: byId.get(s.id)!.effortMin,
      reason: s.reason || 'no reason provided',
    })),
  ];
  const planned = new Set(items.map((i) => i.taskId));
  return {
    date,
    budgetMin,
    items,
    deferredIds: tasks.filter((t) => !t.done && !planned.has(t.id)).map((t) => t.id),
    source: 'model',
  };
}

/**
 * Build today's plan: ask the provider, validate its selection, and fall
 * back to the deterministic planner if the model misbehaves. The model can
 * only ever choose from the user's own backlog - it cannot invent tasks.
 */
export async function buildPlan(
  provider: Provider,
  tasks: Task[],
  budgetMin: number,
  date: string
): Promise<Plan> {
  const open = tasks.filter((t) => !t.done);
  if (open.length === 0) {
    return { date, budgetMin, items: [], deferredIds: [], source: 'fallback' };
  }
  let selection: ProviderSelection;
  let source = provider.name;
  try {
    selection = await provider.select(tasks, budgetMin);
    const errors = validateSelection(selection, tasks, budgetMin);
    if (errors.length > 0) {
      selection = fallbackSelection(tasks, budgetMin);
      source = 'fallback';
    }
  } catch {
    selection = fallbackSelection(tasks, budgetMin);
    source = 'fallback';
  }
  const plan = selectionToPlan(selection, tasks, budgetMin, date);
  plan.source = source;
  return plan;
}

export function renderPlan(plan: Plan): string {
  const lines: string[] = [];
  lines.push(`# Tortoise plan - ${plan.date}`);
  lines.push('');
  lines.push(`Budget: ${plan.budgetMin} min | Source: ${plan.source}`);
  lines.push('');
  if (plan.items.length === 0) {
    lines.push('Backlog is empty. Rest is also a plan.');
    lines.push('');
    return lines.join('\n');
  }
  const roleLabel = { anchor: 'ANCHOR', support: 'support' } as const;
  for (const item of plan.items) {
    lines.push(`- [${item.role === 'anchor' ? 'A' : ' '}] (${roleLabel[item.role]}, ${item.estimateMin}m) ${item.title}`);
    lines.push(`    why: ${item.reason}`);
  }
  const total = plan.items.reduce((s, i) => s + i.estimateMin, 0);
  lines.push('');
  lines.push(`Total planned: ${total}m of ${plan.budgetMin}m. Everything else waits. That is the point.`);
  if (plan.deferredIds.length > 0) {
    lines.push('');
    lines.push(`Deferred (not today): ${plan.deferredIds.join(', ')}`);
  }
  lines.push('');
  return lines.join('\n');
}
