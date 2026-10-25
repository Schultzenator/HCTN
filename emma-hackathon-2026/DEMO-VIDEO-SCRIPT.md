# FleetPilot — 90-second screen demo script

Owner: PW records and uploads. Screen plus voiceover; no camera required.
This executable rehearsal shows the current offline prototype. It is not yet an
eligible live emma submission: see the live replacement instructions below.

## Prepare before recording

From the repository root:

```bash
cd emma-hackathon-2026
npm install --cache .npm-cache
npm test
npx tsc --noEmit
```

Use an editor with `src/agent/scripted.ts`, `src/optimizer/planner.ts`,
`src/agent/tools.ts` and `TESTS.md` open. Increase terminal/editor font size;
turn off notifications. Hide credentials. Run this rehearsal command in the
terminal at 00:09, with the editor alongside it:

```bash
env -u EMMA_API_KEY node dist/cli.js
```

This forces mock mode even if the shell has a key. The command executes real
local code and prints the complete scenario after it finishes; scroll its output
at the indicated times. Do not pretend these are interactive chat turns, an LLM
session, actual provisioning, or a completed model-training job. Keep the
“offline mock” label visible. Pause between sentences to fit each scene.

## Timeline and exact rehearsal voiceover

| Time | Screen action | Voiceover |
|---|---|---|
| 00:00–00:09 | Title: “FleetPilot — offline prototype”. Show source and terminal. | “GPU prices vary across providers. FleetPilot turns workload constraints into an inspectable placement decision. This is the current offline prototype, running real local code.” |
| 00:09–00:21 | Execute the command above. Show `runScenario` calling named tools; scroll to inventory. | “I run the scripted scenario. These intents call the same handlers exposed through MCP. The inventory and prices here are deterministic fixtures, not live cloud offers.” |
| 00:21–00:35 | Show planner shape filters and sorted prices, then the plan output. | “The request needs eight GPUs with at least eighty gigabytes each, allows interruptions, and caps cost at thirty-five dollars per hour. The planner checks constraints, then selects the cheapest compliant offer.” |
| 00:35–00:48 | Highlight `gpu.deploy_workload`, `gpu-0001`, and fleet cost. Show its tool handler. | “The deployment handler creates one mock instance. Fleet status reports eighteen dollars ninety-nine per hour. The request constrains memory and GPU count; a specific GPU-model filter is still missing.” |
| 00:48–01:03 | Scroll to market refresh and optimization output. | “A simulated market refresh reveals cheaper capacity. FleetPilot proposes a like-for-like placement at fifteen dollars seventy-five. That is three dollars twenty-four per hour in potential savings. It does not execute a migration.” |
| 01:03–01:15 | Highlight monthly estimate, then termination output. | “At seven hundred thirty hours, the projected saving is two thousand three hundred sixty-five dollars and twenty cents. This is fixture math, not realized savings. The final tool terminates the mock instance.” |
| 01:15–01:24 | Show TESTS.md counts and terminal test summary from preparation. | “Sixteen tests pass across the mock and planner files, and TypeScript checking passes. Live API behavior and actual workload execution still need validation.” |
| 01:24–01:30 | Show project URL and `src/emma/rest.ts` verification note. | “Next: validate the emma adapter and capture real provisioning and first-run evidence. Code and limitations are in the repository.” |

Total: 90 seconds. Capture the actual terminal run, not a fabricated output slide.
PW should rehearse the voiceover and shorten pauses to the marked timings.

## Replace rehearsal with the final live submission

Do not submit the rehearsal as proof of real emma execution. The published
[Showcases requirements](https://hackathon.emma.ms/) require real provisioning
and first run through emma's API/SDK.

Before recording the final take:

1. Validate auth, base URL, endpoints and response mapping with the official
   emma contract and approved sandbox. Replace the placeholder image with an
   accessible, runnable workload. Add readiness checking and first-run output.
2. Make mode selection truthful and consistent. Today `EMMA_API_KEY` selects
   REST; `--live` alone only changes the printed label. Provision only after the
   adapter is reconciled. Configure credentials privately, off camera.
3. Validate a genuinely cross-provider inventory, record the actual selected
   offer, resource ID, readiness and a real workload result (for example, GPU
   detection plus a small computation). Confirm cleanup. The existing scenario
   terminates its resource before printing, so it needs adjustment to capture
   first-run evidence before teardown.
4. Keep the same 90-second structure: 00:00–00:21 problem, prompt and real
   inventory; 00:21–00:35 decision; 00:35–01:03 actual provisioning and first
   result; 01:03–01:15 cleanup; 01:15–01:30 verification and repo. Use observed
   prices and output in the voiceover. Replace all mock claims accordingly.
   Drop the simulated market refresh to prioritize the required first run.
5. Record an uninterrupted end-to-end execution. If it exceeds the time budget,
   reduce workload scope and rehearse again; do not imply that a pre-created
   resource or hidden wait was provisioned inside ninety seconds. Caption any
   clearly disclosed time compression only if organizers explicitly permit it.

No exact live command or output is promised here: the required live adapter and
first-run path do not yet exist as verified functionality. PW records the video;
this iteration provides the runnable rehearsal and the final-take requirements.
