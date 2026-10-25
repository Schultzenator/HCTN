# Tortoise - a slow-and-steady daily planner

> One anchor a day. Slow and steady ships.

Tortoise is a tiny CLI that turns your messy markdown backlog into a *small,
deliberate* daily plan: exactly **one anchor task** plus at most two support
tasks, hard-capped by your focus budget. An open-weight model (**Gemma**)
chooses the day's anchor; deterministic guardrails make sure it can never
invent work, overspend your budget, or break the "slow and steady" rules.

Built for the DEV Hacktoberfest Week 3 challenge: **"Slow and Steady"**
(productivity) - a small, narrowly scoped tool that bets on consistency over
intensity.

## Why

Most productivity tools optimize for squeezing more in. Tortoise optimizes for
the opposite: a plan you can actually finish, every day, until the backlog is
done. The streak counter rewards showing up, not grinding.

## How it works

```
backlog.md ──> parse ──> Gemma (open weights) ──> guardrails ──> plan-YYYY-MM-DD.md
   (your own tasks)          selects 1 anchor        validate or      + streak log
                              + <=2 supports          fall back to
                                                       deterministic
                                                       planner
```

Guardrails (the model proposes, the deterministic layer disposes):

- every selected id must exist in **your** backlog and be open - no invented tasks;
- exactly one anchor; at most two supports (max 3 items/day);
- the anchor may not exceed 60% of the budget;
- the total may not exceed the budget;
- effort estimates always come from the backlog, never from the model.

If the model output violates any rule - or the API is down - Tortoise silently
falls back to a deterministic "smallest open task first" planner. It never
produces a bad plan.

## Install

Requires Node >= 22.6 (zero npm dependencies).

```bash
git clone https://github.com/Schultzenator/HCTN.git
cd HCTN/dev-hf26-week3
```

## Usage

Offline demo, no API key needed (deterministic mock provider):

```bash
npm run demo
# node --experimental-strip-types src/cli.ts plan examples/backlog.md --provider mock --budget 120
```

With Gemma via the Google Generative Language API (free key from Google AI
Studio; Gemma models are open-weight):

```bash
export GEMMA_API_KEY=your-key
node --experimental-strip-types src/cli.ts plan examples/backlog.md --provider gemma --budget 120
```

Fully local open weights via Ollama (e.g. `ollama pull gemma3:4b`):

```bash
node --experimental-strip-types src/cli.ts plan examples/backlog.md --provider ollama --budget 90
```

Complete a task and keep the streak alive:

```bash
node --experimental-strip-types src/cli.ts done examples/backlog.md t7
node --experimental-strip-types src/cli.ts streak
```

Sample output (`npm run demo`, see `examples/plan-sample.md`):

```
# Tortoise plan - 2026-10-22

Budget: 120 min | Source: mock

- [A] (ANCHOR, 10m) Update dependency lockfile
    why: smallest concrete step that moves work forward today (10m)
- [ ] (support, 20m) Reply to the three partner emails
    why: small enough to fit after the anchor (20m)
- [ ] (support, 30m) Rewrite onboarding email #2
    why: small enough to fit after the anchor (30m)

Total planned: 60m of 120m. Everything else waits. That is the point.

Deferred (not today): t1, t2, t6
```

## Backlog format

Any markdown file with checkbox lines; optional effort in minutes:

```markdown
- [ ] Fix flaky checkout test (40m)
- [x] Ship README quickstart
- [ ] Reply to partner emails        # defaults to 25m
```

## Tests

```bash
npm test   # 43 assertions, zero dependencies
```

## Layout

```
src/types.ts     Task / Plan / Provider types
src/backlog.ts   markdown backlog parser + serializer
src/planner.ts   guardrails, deterministic fallback, plan rendering
src/providers.ts Gemma (Google API), Ollama, deterministic mock; prompt + JSON extraction
src/streak.ts    consecutive-day streak math
src/cli.ts       plan | done | streak commands
test/run-tests.ts zero-dependency test suite (43 assertions)
```

## Scope discipline

Intentionally not included: calendars, integrations, notifications, a UI.
Tortoise does one thing - a small honest daily plan - and is done.
