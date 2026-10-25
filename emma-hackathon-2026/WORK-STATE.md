# FleetPilot work state

Updated: 2026-10-22 — iteration 2. Implementation and documentation complete; requested commit BLOCKED;
hackathon submission remains BLOCKED on live integration and PW deliverables.
Deadline: 2026-12-01 23:59 CET (Warsaw).

| Step | Status | Evidence / outcome |
|---|---|---|
| Install dependencies | PASS | Default cache failed ENOENT; `npm install --cache .npm-cache` succeeded, 3 packages added, audit 0 vulnerabilities. Lockfile added; local cache ignored. |
| Run/fix tests | PASS | `npm test`: 16 passed, 0 failed; mock file 6, planner file 10. Node formal suites: 0. No source fixes needed. See TESTS.md. |
| Type check | PASS | `npx tsc --noEmit`: exit 0, no diagnostics. Existing legacy-file exclusions retained and disclosed. |
| Offline smoke demo | PASS | `npm run demo`: exit 0, plan/deploy/status/savings proposal/termination. No real provisioning. |
| Submission kit | DONE | SUBMISSION-KIT.md: verified portal fields, solo Showcases instructions, repo link, paste-ready text, judging rubric, final-delivery uncertainty. |
| 90-second video script | DONE | DEMO-VIDEO-SCRIPT.md: timed screen-only coding rehearsal with exact voiceover, plus live submission replacement steps. |
| Commit | BLOCKED | `git add -A -- .` and requested `git commit` both failed: `.git/index.lock` cannot be created (read-only filesystem). No files staged and no commit created. |
| Record/upload/submit | PW / NOT DONE | PW owns recording. No application, email, upload, GitHub push or final submission performed. |

## Current blockers and honest limitations

- The workspace permits reading `.git` but not writing it. Staging and committing
  fail with `Read-only file system`. This session cannot change that permission.
  PW must run the commit commands below in a writable checkout.

- Official Showcases rules require real emma provisioning and first run. Current
  verified behavior is an offline mock; it does not meet that requirement yet.
- REST adapter endpoints, auth and schema are unverified assumptions. No API
  credential or sandbox was used. Placeholder image, missing readiness/first-run
  execution and cleanup verification must be addressed for a live demo.
- CLI `--live` changes the label, while EMMA_API_KEY controls client selection.
  Never use the label as evidence of live execution.
- Planner has no GPU-model constraint; it filters VRAM/count/region/budget.
  Cost optimization only proposes placements. No migration or training result
  was demonstrated. Savings and provider market changes are fixtures.
- Tests cover two files only. MCP transport, REST adapter and external LLM
  integration were not verified. Prior “5 suites” statement was incorrect.
- Public portal exposes an application, not a final-delivery form. Its HTML
  currently uses a placeholder Web3Forms key. PW must obtain organizer-confirmed
  submission/video-host instructions and retain confirmation.
- Candidate repo link is derived from the existing origin. Public availability
  and a push containing this iteration are not verified.

## Research and environment correction

The previous session's execution/network restrictions are historical, not current
blockers. This iteration successfully installed dependencies, ran Node/TypeScript,
and read https://hackathon.emma.ms/ and https://hackathon.emma.ms/main.js.
SUBMISSION-KIT.md supersedes RESEARCH.md's offline hackathon assumptions. API
assumptions remain unresolved; passing tests must not be read as live validation.

## PW next actions

1. Push the committed project and check public repo access.
2. Apply solo in Showcases; resolve any portal failure via the published contact.
3. Reconcile the real emma adapter and implement/validate provisioning plus first run.
4. Rehearse, record and upload the actual 90-second demo using the script.
5. Confirm final delivery channel, submit before the deadline and save receipt.

## Complete the blocked commit (PW, writable checkout)

From the repository root, scope staging to the authorized project:

```bash
cd emma-hackathon-2026
git add -A -- .
git diff --cached --check
git commit -m "emma iter2: tests+tsc+submission-kit+demo-script"
```

The project was initially untracked, so this commit will include its existing
source files as well as iteration-2 documents and the lockfile. Unrelated logs
and review files at the repository root must remain unstaged.
