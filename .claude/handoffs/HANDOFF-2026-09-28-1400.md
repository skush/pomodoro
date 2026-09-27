# Handoff — pomodoro-timer, session-tracking feature (SDD pipeline)
Date: 2026-09-28 14:00   Branch: master   Last commit: b94f20a "design: session-tracking sad (quick)"

## Goal

Build a single self-contained `index.html` Pomodoro timer (vanilla JS, no framework, no backend),
following the SDD plugin's pipeline (`specify → clarify → ux-flows → design → sequences →
data-model → api → screens → tasks → implement → review → ship`) per `docs/roadmap.md`. Working
through the roadmap's steps one at a time.

## Current state

**Step 2 (core-timer) — fully shipped.** Spec through ship all done, working, pushed to
`origin/master`, live on GitHub Pages (https://skush.github.io/pomodoro/). `src/logic/index.js`
(`createTimerEngine`, `controlStates`, `formatDuration`, `PHASES`) and `src/ui/index.js` (`mount`)
are the real, tested, shipped implementation — 27 unit tests in `test/logic/timer-engine.test.js`,
all passing. Do not need to revisit unless a future step requires changing the engine.

**Step 3 (session-tracking) — mid-pipeline, at `design` → `sequences`.**
- `docs/features/session-tracking/spec.md` — done, clarified. 5 user stories, 10 ACs (AC-01,
  AC-01b, AC-02, AC-03, AC-04, AC-04b, AC-05, AC-06, AC-06b, AC-07), all §8 open questions resolved.
- `docs/features/session-tracking/ux-flows.md` — done. 4 flows drawn (US-01..US-04), US-05 (the
  write-guard story) explicitly out of scope for a UI flow (no user action reaches it).
- `docs/features/session-tracking/sad.md` — done, 12 Arc42 sections, `target_surfaces:
  [web-frontend]`. Went through a full critic pass that caught and fixed real logic bugs (see
  Decisions/Dead ends below) — the design on disk now is the corrected version.
- `docs/features/session-tracking/adr/0001-expose-true-focus-completion-timestamp.md` — Accepted.
- `docs/features/session-tracking/adr/0002-centralize-session-tracking-writes.md` — Accepted.
- **`/sdd:sequences session-tracking` was invoked but the user said "stop" / "cancel" immediately**
  — the skill had only just loaded its own instructions and read nothing, drew nothing. `sad.md §6`
  is untouched (still just the 2 flows `design` seeded: "Focus completion → true-day credit" and
  "Task-label commit and reload restore"). **Nothing to undo — no files were touched.**

No code has been written for session-tracking yet — `src/logic/index.js` and `src/ui/index.js` on
disk are still exactly core-timer's shipped versions. The two ADRs above describe changes the code
does NOT yet have (the `justCompletedFocusAt` field, the centralized write function) — those land
during `implement`, after `tasks` runs.

## Decisions made (and why)

- **Daily counter resets at local midnight**, not a rolling 24h window — resolved `docs/roadmap.md`
  open decision D2 during `specify`.
- **Task label commits on blur/Enter**, not every keystroke — resolved during `clarify` after the
  first draft assumed live-save; user explicitly preferred blur/Enter.
- **Over-limit task-label input hard-stops at 100 chars** (never accepts a 101st character), not
  "type freely then reject on blur" — resolved during `clarify`.
- **A session's true completion is credited to the day it actually finished**, not the day the app
  notices (matters for the sleep-across-midnight edge case) — resolved during `clarify`. This is
  the single decision that drove the most design complexity (see ADR-0001).
- **External writes to storage (another tab, devtools) are never adopted** — the app's own next
  legitimate write always overwrites them. Resolved during `clarify` as AC-07; `design` (ADR-0002)
  decided *how*: one centralized write function, not three independent inline writers, because the
  spec explicitly elevated this to a testable acceptance criterion, not just an assumption.
- **ADR-0001**: extend `createTimerEngine()`'s `getSnapshot(now)` with a `justCompletedFocusAt`
  field, latched inside the engine's internal `settle()` (not just inside `getSnapshot()`) —
  because `start`/`pause`/`reset` also call `settle()` internally, so a completion can fire from
  any of the four public methods, not only from a render-tick `getSnapshot()` poll. Rejected: a
  completion callback (bigger API surface for no benefit); reconstructing the deadline independently
  in `src/ui/` (duplicates the engine's own timing math in a second module).
- **Pure rollover/validation logic lives in `src/logic/`**, not `src/ui/`, even though it's "just for
  storage" — because this repo's test convention (`test/logic/` only, no DOM/jsdom environment) can
  only unit-test pure functions, mirroring how core-timer put `formatDuration`/`controlStates` in
  `src/logic/` for the same reason.
- **No PR workflow** — this repo has no branch/PR history; every SDD stage commits and pushes
  straight to `master` (confirmed explicitly with the user during core-timer's `ship` stage).

## Dead ends

- **First draft of `sad.md §6` Flow 1 (Focus completion → daily credit) had a real logic bug**: it
  compared "stored date vs. the *completing session's own* day" to decide rollover. That's wrong —
  rollover must compare "stored date vs. **now** (the actual current moment)"; crediting the session
  is a *separate*, second comparison ("the session's true day" vs. "the tracked day, after any
  rollover"). Conflating them meant every branch credited the wrong day (a critic-pass catch, not
  caught during the Socratic walk itself). Fixed in the committed version — see `sad.md §6` Flow 1,
  which now has two explicit `alt` blocks in sequence.
- **ADR-0001's first draft only latched the completion inside `getSnapshot()`** — missed that
  `start`/`pause`/`reset` call the same internal `settle()`. A user clicking a button in the instant
  a phase completes would have silently lost that completion. Fixed: the latch lives in `settle()`
  itself, shared by all four public methods; `getSnapshot()` just consumes-and-clears it.
- **ADR-0001's first draft had a strawman "Option 3"** (UI-side snapshot-diffing, described as
  "credit whichever day is current at detection" — a case the spec already ruled out, so not a real
  alternative). Rewritten as the honest version (reconstruct the deadline independently in
  `src/ui/`) and rejected for a real reason (duplicated timing logic across two modules).
- **First draft of both ADRs linked to core-timer's ADRs with the wrong relative path**
  (`../../adr/...` instead of `../core-timer/adr/...` from `sad.md`, or `../../core-timer/adr/...`
  from inside `adr/*.md`) — all fixed and verified to resolve on disk.

## Open problems

None currently blocking. Two things worth knowing:

1. `docs/architecture-map.md` is stale (`reflects_commit: 9c8717e`, predates core-timer's actual
   implementation entirely). `design` explicitly worked around this with a fresh `sdd:explorer`
   scan instead of trusting the map, and logged it as a Medium risk in `sad.md §11` recommending a
   `/sdd:survey` refresh. Not blocking, but worth doing at some point so future stages don't have to
   re-scan from scratch.
2. `sad.md §11` also flags (Medium) that the new completion-latch mechanism (ADR-0001) needs a
   dedicated test for the "transition triggered via start/pause/reset, not getSnapshot" path
   specifically — easy to under-test if `implement`/`test-author` only thinks of the everyday case.

## Next steps

1. **Run `/sdd:sequences session-tracking`** — draw the full runtime view into `sad.md §6` (the
   AC-coverage floor requires every one of the 10 spec ACs to map to a flow, a branch, or an
   explicit non-runtime N/A; only 2 flows exist today, seeded by `design`, not yet AC-complete).
2. Then continue the pipeline per its own handoff logic: `data-model` (likely N/A — no schema, no
   backend, per `docs/adr/0002-no-backend-for-v1.md` — but let the skill's own gate decide), then
   `api` (likely N/A — no contract, no backend), then `screens` (this feature has a UI surface, so
   probably runs), then `tasks`, then `implement`, `review`, `ship`.
3. Remember to ask the user before pushing each stage's commits — they've asked for an explicit
   "push it" each time so far rather than auto-pushing.

## Key files

- `docs/roadmap.md` — the master step list + status; step 3 = session-tracking, currently mid-pipeline.
- `docs/features/session-tracking/spec.md` — source of truth for all 10 ACs `sequences` must cover.
- `docs/features/session-tracking/sad.md` — §5 (participants: Timer engine / UI layer / Local
  storage) and §6 (2 seeded flows) are what `sequences` reads and extends.
- `docs/features/session-tracking/adr/0001-*.md`, `0002-*.md` — the two Accepted ADRs `sequences`'
  flows should stay consistent with (esp. the two-step rollover-then-credit logic in ADR context).
- `CONTEXT.md` (repo root) — canonical glossary; has `Task label` and `Session counter` entries
  already reconciled.
- `src/logic/index.js`, `src/ui/index.js` — current shipped core-timer code; `getSnapshot()` still
  returns `{phase, running, remainingMs, focusCount}` only — the `justCompletedFocusAt` field from
  ADR-0001 does not exist in code yet.

## Commands

- `npm test` — `node --test`, runs `test/logic/*.test.js` (27 tests, all passing on current code).
- `npm run lint` — ESLint.
- `npm run build` — esbuild, regenerates the committed root `index.html` from `src/`.
- Mermaid validation used throughout this session: `npx -y @mermaid-js/mermaid-cli -i <file>.md -o
  /tmp/_check.md` then delete the generated `.svg` files it drops next to wherever you ran it from.

## Gotchas

- This repo has **no PR workflow** — every stage pushes straight to `master`. Don't create a branch
  or open a PR unless the user asks.
- `.claude/sdd.local.md`: `interview_depth: easy` is the saved default — most SDD skills will
  recommend "Easy" first; that's expected, not a bug.
- `docs/architecture-map.md` is known-stale (see Open problems) — don't trust it over a fresh
  source read for this feature.
- `.claude/skills/handoff/SKILL.md` and `.claude/{sdd.local.md,settings.local.json}` show as
  untracked/gitignored local state — not part of feature work, don't commit them as part of a
  feature commit.
- The SDD plugin skills are invoked via the `Skill` tool with names like `sdd:sequences`,
  `sdd:design`, etc. — the user also just types the bare command name (e.g. "sequences
  session-tracking") which maps to the same skill.
