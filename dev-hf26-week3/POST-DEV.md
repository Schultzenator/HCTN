<!-- DEV post draft - Hacktoberfest Week 3 "Slow and Steady" (2026)
     Publish target: 2026-10-25 by 12:00 CET. Challenge closes 2026-10-25 23:59 PDT.
     Before publishing: replace [SCREENSHOT-*] placeholders, verify tags against the
     challenge page, and fill the "Submission details" section per the official template.
-->

---

title: "Tortoise: I Built a Productivity Tool That Plans *Less*, Not More (with an Open-Weight Model)"
tags: hf26challenge, devchallenge, gemma, productivity
canonical_url: ""
description: "A zero-dependency CLI that turns your backlog into one anchor task a day. Gemma picks, deterministic guardrails decide, and a streak counter rewards showing up."
cover_image: ""

---

Every productivity tool I have ever used has the same failure mode: it plans too much. Todo apps let you add infinite items. Calendars show you beautiful blocks of ambition that collapse the moment a meeting runs long. AI schedulers are worse - they will happily generate an eleven-hour "optimized" day and call it helpful.

Then October hits, Hacktoberfest comes around, and the Week 3 theme of the DEV challenge - **"Slow and Steady"** - asks for exactly the opposite: productivity through consistency, not intensity.

So I built a tool with a deliberately anti-hustle bias: **Tortoise**, a small CLI that turns your markdown backlog into a *tiny* daily plan - exactly one anchor task plus at most two small support tasks, hard-capped by a focus budget you set. A Gemma model picks the anchor. Deterministic guardrails make sure the model can't cheat. A streak counter rewards the only thing that actually compounds: showing up again tomorrow.

This post walks through what I built, why an open-weight model was the right call, and - the part I care about most - why the "boring" deterministic half of the design is the half that makes the whole thing trustworthy.

## The problem: tools that optimize for the wrong thing

Productivity software almost universally optimizes for *throughput*: how many tasks can we help you capture, organize, schedule, and cram in? The result is a backlog that grows faster than you can shrink it, and a daily plan that is a wish rather than a commitment.

The "slow and steady" insight is old - the tortoise beat the hare, consistency beats sprints, compound interest beats windfalls - but tooling rarely encodes it. What would a tool look like if it took the idea literally?

- It would **cap** your day, not expand it.
- It would prefer **finishing** over starting.
- It would value **yesterday's completed work** over today's ambitions.
- It would be small enough that you never argue with it.

That's the whole spec for Tortoise.

## What Tortoise does

Tortoise is a zero-dependency Node CLI. Your backlog is a plain markdown file:

```markdown
# Backlog

- [ ] Draft the Q4 pricing page copy (50m)
- [ ] Fix flaky checkout test (40m)
- [x] Ship README quickstart
- [ ] Reply to the three partner emails (20m)
- [ ] Rewrite onboarding email #2 (30m)
- [ ] Sketch ideas for the conference talk (90m)
- [ ] Update dependency lockfile (10m)
```

You give it today's focus budget and it produces a plan:

```bash
node --experimental-strip-types src/cli.ts plan examples/backlog.md --budget 120
```

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

[SCREENSHOT-1: terminal showing `npm run demo` with the plan output above]

Read that output again, because the interesting part is what it did **not** do: it did not schedule the 90-minute conference talk. It did not fill the full 120-minute budget. It picked the 10-minute lockfile update as the anchor, two small tasks as support, and explicitly listed everything else as *deferred*. Sixty planned minutes out of one hundred twenty available, by design.

When you finish something, you check it off and the streak updates:

```bash
$ node --experimental-strip-types src/cli.ts done examples/backlog.md t7
Done: Update dependency lockfile
Streak: 4 day(s)
```

That's the entire user experience. Three commands: `plan`, `done`, `streak`. There is no sync, no dashboard, no notifications. Deliberately.

## Why an open-weight model (Gemma) is the right tool here

Task selection sounds like a trivial problem - until you look at what actually makes a good "anchor" for a day. It's a judgment call: which open item, out of everything you've written down, is *the* thing that would make today count? Effort matters, but so does momentum ("prefer finishing over starting"), staleness, and how concrete the item is.

That judgment call is exactly what small language models are decent at, and it's a great fit for open-weight Gemma:

- **It's a constrained choice problem.** The model gets a numbered list with effort estimates and must return strict JSON: one anchor id plus up to two support ids. Small models handle this reliably. You don't need a frontier model to pick `t7`.
- **Open weights mean optionality.** The same prompt works against Google's hosted Gemma endpoint (free API key from AI Studio), or against a local Ollama instance with `gemma3:4b` running on a laptop - no GPU cluster, no subscription, no vendor lock-in. For a personal tool that reads your task list, "runs fully offline" is a feature, not a footnote.
- **The domain is small, so the model stays small.** This is the "slow and steady" philosophy applied to model choice too: don't reach for the biggest weights on the shelf when a 4B-parameter model does the job. Consistent, cheap, boring - on purpose.

The prompt is explicit about the philosophy, too. Tortoise tells the model: *smaller, concrete, older tasks beat big vague ones; prefer finishing over starting; do not invent tasks; do not rename tasks.*

## Model proposes, guardrails dispose

Here is the part of the design I actually want to convince you of.

An LLM in the critical path of your daily plan is a liability. It can hallucinate a task id. It can schedule a 90-minute anchor into a 20-minute gap. It can decide you deserve five tasks today. Any of those erodes the one thing a planning tool needs: that you trust the plan.

So Tortoise treats the model as an *advisor with zero authority*. Every selection it returns passes through deterministic guardrails:

- every selected id must exist in **your** backlog and be open - the model cannot invent work;
- exactly one anchor, at most two supports - three items a day, hard cap;
- the anchor may not exceed 60% of the budget - the day can't be devoured by one task;
- the total may not exceed the budget - no wishful plans;
- effort estimates always come from the backlog, never from the model - it can't "estimate optimistically".

If the output violates any rule - or the API is down, or the key expired, or the JSON is malformed - Tortoise doesn't error out or ask you to retry. It **silently falls back** to a deterministic planner: smallest open task as the anchor, then small tasks that fit the remaining budget. It's a naive heuristic, and that's exactly why it's safe: it cannot fail in a creative way.

The plan file even tells you which path produced it (`Source: mock`, `Source: gemma-api` or `Source: ollama` when the model's selection was accepted, `Source: fallback` when the deterministic planner took over), so you can tell when the model earned its keep.

This "LLM proposes, code disposes" pattern is, I think, the underrated recipe for putting open-weight models into real tools. The model adds judgment; the code adds guarantees. You get the interesting half of AI without the fragility.

## The lazy payoff: why the fallback is a feature

There's a lazy-person's argument for this architecture, and it's a strong one. The fallback planner is maybe twenty lines of sorting. The guardrail validator is maybe thirty. Together they mean:

- I never have to debug "the model did something weird" at 9am before coffee - I just get the deterministic plan.
- The test suite (43 assertions, zero dependencies) can cover every failure mode with mock providers, including a provider that throws, one that returns hallucinated ids, and one that returns garbage JSON.
- The tool degrades the way infrastructure should degrade: smaller, quieter, still working.

The "slow and steady" payoff isn't just the streak counter. It's that a tool you can trust on a bad day is a tool you still use on day forty. Fancy output you have to babysit is a tool you abandon in week two. Consistency compounds - for backlogs and for software design alike.

## Streaks: measuring the only thing that matters

The `streak` command reads a one-line-per-completion log (`log.jsonl`) and counts consecutive days with at least one completed task. If today isn't logged yet, it counts from yesterday - the streak is never "broken" before the day is over.

That's the entire gamification. No points, no levels, no streak-freeze monetization. Just a number that goes up only if you keep showing up, and which resets to zero after a gap. It's the honest version of the mechanic: the number has no value except the value you give it, and you give it value precisely by not wanting to see it reset.

A ten-day streak of one finished anchor per day is one hundred ten minutes of real, compounding progress (10m + 20m + 30m... well, roughly - the math is yours to make honest). A ten-day streak of over-planned days is usually zero finished work and a growing resentment of your to-do app. The streak counter makes the difference visible.

## How to run it

Everything is in the repo, under `dev-hf26-week3/`:

```bash
git clone https://github.com/Schultzenator/HCTN.git
cd HCTN/dev-hf26-week3

# offline demo, no API key (deterministic mock provider)
npm run demo

# with Gemma via the Google Generative Language API
export GEMMA_API_KEY=your-google-ai-studio-key
node --experimental-strip-types src/cli.ts plan examples/backlog.md --provider gemma --budget 120

# fully local open weights (ollama pull gemma3:4b)
node --experimental-strip-types src/cli.ts plan examples/backlog.md --provider ollama --budget 90

# tests: 43 assertions, zero dependencies
npm test
```

No install step beyond cloning - Tortoise has **zero npm dependencies**, using only Node's standard library (22.6+, for native TypeScript stripping). For a tool meant to be the last thing you run before starting work, "npm install resolves nothing" is its own kind of quiet.

[SCREENSHOT-2: editor with backlog.md open next to the generated plan-2026-10-22.md]

## What I deliberately left out

Scope discipline is the "slow and steady" theme turned inward:

- **No calendar integration.** The budget is a number you type, not a negotiation with your calendar.
- **No notifications.** The tool runs when you run it.
- **No server, no account, no cloud.** Your tasks are a markdown file; your log is a JSONL file.
- **No multi-agent anything.** One small model, one clear job.

Each of those would have been a weekend of fun code and a permanent liability. The narrowness is what made it possible to build the guardrails properly and to test every path the model can't be trusted with.

## Submission details

* **Project name:** Tortoise - a slow-and-steady daily planner
* **What it does:** turns a markdown backlog into a minimal daily plan (one anchor + up to two support tasks, hard budget cap), with a streak counter for consecutive finished days
* **Open model used:** Gemma (open weights) via the Google Generative Language API (`gemma-3-12b-it`), with a fully-local Ollama option (`gemma3:4b`) and a deterministic offline provider for tests/demos
* **Tech:** TypeScript, Node >= 22.6, zero npm dependencies
* **Repo:** https://github.com/Schultzenator/HCTN/tree/main/dev-hf26-week3
* **Demo:** clone, run `npm run demo` (offline, deterministic); or run with your own `GEMMA_API_KEY` / local Ollama for live model selection

## Wrapping up

"Slow and steady" usually gets presented as a virtue - patience, persistence, modest expectations. Tortoise is my attempt to encode it as *mechanics*: a planner that structurally cannot over-plan, that defers greed to the deterministic layer, and that counts days instead of hours.

The interesting design lesson for me was the division of labor: give the open-weight model the judgment call (what matters most today), and give boring, typed, well-tested code all the authority (budgets, caps, existence checks, fallbacks). The model makes the plan interesting; the guardrails make the plan *true*.

If you want to try it, the quickstart above is genuinely all there is - clone, run, done. And if you're building with open models this Hacktoberfest, I'd encourage stealing the pattern wholesale: small model, narrow job, deterministic veto. It's the slow, steady way to ship AI tools that don't bite.

The tortoise had it right all along. It just needed better tooling.

---

*Happy Hacktoberfest - see you in the backlog.*
