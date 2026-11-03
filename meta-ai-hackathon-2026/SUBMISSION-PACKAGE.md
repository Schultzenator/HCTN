# Submission package — Household Ops Agent

## Elevator pitch

Household Ops Agent is a multimodal evening planner for the work that happens after work: it looks at what is already in the home, explains the smallest useful sequence of actions, and produces a visual plan the household can actually follow. SAM 3.1 supplies grounded perception, Muse Spark supplies the agent's reasoning and prioritization, and Muse Image makes the result tangible rather than another wall of text.

## Project description (about 4,000 characters)

Everyday household operations are full of tiny decisions: what can we cook with what is already here, which room should be reset first, how do two people divide the work, and what can wait until tomorrow? These decisions are individually small but collectively expensive when people are tired. Household Ops Agent is a focused multimodal agent for exactly that moment.

The user gives the agent a plain-language goal such as “make dinner and leave the kitchen calm in 90 minutes”, a few constraints, and optionally a photo of the pantry or kitchen. The agent turns that context into a short plan with an order, an owner for each action, and a reason for each choice. The output is designed to be used, not admired: three or four concrete steps, explicit assumptions, and a visual of the evening that can be shared with another person.

The interesting part is the division of labor between Meta models. SAM 3.1 is used for perception, not as a decorative image feature: it identifies relevant household objects in the user's photo and supplies grounded evidence to the planner. Muse Spark 1.3 then acts as the reasoning core. It combines the user's goal, constraints, available inventory and detected objects into an ordered plan, while explaining why the order reduces decisions, waste or last-minute work. Muse Image 1.0 converts that plan into a warm, text-free visual so the intended state of the evening is easy to understand at a glance.

The Node/TypeScript implementation keeps these responsibilities visible in an execution trace. A reviewer can see the three model stages and whether each stage was live or mock. The Meta Model API adapter uses the documented OpenAI-compatible base URL and bearer authentication. A deterministic mock adapter has the same interface, which means the entire smoke scenario, including the perception-to-planning handoff, works without a key. This makes the project testable during the hackathon and honest in a recorded demo: mock output is labeled as mock rather than implying a successful network call.

This is a “Build for Your World” project. The workflow comes from the builder's own need to operate a home while attention and energy are limited. It is intentionally narrow: the goal is not to automate a household or make high-stakes decisions, but to turn a fuzzy evening into a shared, explainable next step. The same orchestration can later connect to a calendar, shopping list or household MCP, but the submitted slice is self-contained and works from a single request.

The code is MIT-licensed, has no committed secrets, uses Node's built-in fetch, and has node:test coverage for both a photo-assisted path and a no-photo fallback. The current CLI is a reproducible demo harness; a thin UI can pass user-entered input and a browser-uploaded image into the exported `runHouseholdOps` function.

## What I built / how Meta models were used

- TypeScript/Node ESM agent orchestration with a stable `MetaClient` interface.
- `sam-3.1`: optional image perception of pantry/household objects; its structured detections are passed into planning.
- `muse-spark-1.3`: multi-constraint household planning with ordered steps and a reason for every step.
- `muse-image-1.0`: a visual summary of the plan, generated from the plan rather than from a generic prompt.
- Mock/fallback adapter, stage trace, smoke test, typecheck, and no-secret repository setup.

## Repository

Public repository URL: `TBD — paste the public GitHub URL here after PW publishes the repository.`

## Demo video plan (60–90 seconds)

| Time | Frame / action | Voiceover or on-screen text |
|---|---|---|
| 0–06s | Title card, then a tired-evening prompt appears. | “After work, even dinner and a reset can become a decision problem.” |
| 06–18s | Show the input: two people, 90 minutes, no shopping, inventory and a kitchen photo. | “I give Household Ops Agent the goal, constraints and what is already at home.” |
| 18–30s | Show the perception stage and highlighted pantry objects. | “SAM 3.1 grounds the plan in the actual scene instead of guessing from a blank prompt.” |
| 30–48s | Show the generated steps, owners and reasons one by one. | “Muse Spark turns those signals into an ordered, explainable plan.” |
| 48–60s | Show the visual card generated for the evening. | “Muse Image makes the target state easy to share and remember.” |
| 60–72s | Show the trace: SAM, Spark, Muse Image; live/mock badge. | “The trace makes every model contribution visible—and labels fallback mode honestly.” |
| 72–84s | Quick terminal test output: all green. | “The complete flow runs locally with a mock, and the same adapter switches to Meta inference when the key is present.” |
| 84–90s | End card with repo URL and Indie / Build for Your World. | “Household Ops Agent: fewer decisions, more calm, built for my world.” |

Operator note: if live credentials are unavailable during recording, keep the mock badge visible and say so explicitly; do not claim that mock responses came from Meta.
