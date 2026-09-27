---
id: T7
title: "Dedicated edge-case coverage: transition-source latch, write-integrity KPI"
layer: "tests"
deps: ["T1", "T2", "T3", "T4", "T5", "T6"]
blocks: []
acs: ["AC-06", "AC-07"]
files_hint: ["test/logic/timer-engine.test.js", "test/logic/session-tracking.test.js", "test/logic/write-guard.test.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
context_budget: "S"
status: "todo"
---

# T7 — Dedicated edge-case coverage: transition-source latch, write-integrity KPI

## Place in the sequence

- **Blocked by:** T1 through T6 — this task hardens coverage across the whole feature once it's wired end-to-end. · **Blocks:** none — last task in the graph. · **Wave:** 4.
- **Lane:** own lane — test-only changes, no production-code files.

## Why (user story)

> **As a** User
> **I want** the completed-session count to correctly start over at the beginning of a new day
> **So that** yesterday's sessions never inflate today's count
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

> **As a** User
> **I want** the saved count and label to change only because of my own completed sessions and my own typing
> **So that** I can rely on what the app shows me as accurate
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

This task closes the two risks `sad.md` §11 flagged as easy to under-test if left to each task's own everyday-case tests.

## Inlined context

> The completion latch (ADR-0001) can be set by `start`/`pause`/`reset`, not only `getSnapshot` — a caught-during-review subtlety, easy to under-test. **Mitigation:** Dedicated unit test for the "transition triggered via start/pause/reset, consumed by the next getSnapshot" path specifically, not only the everyday "completed during a getSnapshot poll" path.
>
> — `sad.md §11, Risks and technical debt, verbatim` · full text: [sad.md](../sad.md)

> **QG-3. Persisted-state write integrity** ... **Then:** 100% of external write attempts are confirmed to trigger no app logic, and confirmed overwritten by the app's own next legitimate write ... **How verify:** unit tests on the centralized write function and the source-level guard, mirroring core-timer's own AC-03 test style.
>
> — `sad.md §10, QG-3, abridged` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([sad.md](../sad.md) · [spec.md](../spec.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-06 — cross-context

> **Given** the tab is left open, backgrounded, or the machine sleeps across local midnight, whether mid-session or between sessions
> **When** the count is next read (on page load, on the tab becoming visible, on any display refresh, or right before crediting a completed session — see AC-04) and local midnight has passed since the count was last reset
> **Then** the system resets the count to zero for the new calendar day before doing anything else with it — the previous day's count, and any session whose true completion fell before that midnight, is not carried into the new day's count
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-07 — authorization

> **Given** the app's saved daily count and task label
> **When** a write attempt arrives from anything other than this page's own Focus-completion event, its own task-label commit, or its own daily-rollover check (for example a message from another tab or origin, a change made in another same-origin tab, or a devtools edit)
> **Then** the system's write guard ignores that attempt as a trigger for its own logic, and the next time one of those three legitimate paths writes, it writes the app's own current in-memory value — overwriting, never adopting, whatever the saved value had become in the meantime; only those three paths, carrying the app's own state, ever determine what ends up saved
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add/confirm a test asserting `justCompletedFocusAt` is reported on the *next* `getSnapshot()` call after a transition triggered via `start`, `pause`, and `reset` individually (three cases, not one) — `test/logic/timer-engine.test.js`
- [ ] Add/confirm a test simulating the sleep-across-midnight interaction end-to-end: a Focus session's true completion before midnight, detected after — assert the rollover fires first and the completion is NOT credited — `test/logic/session-tracking.test.js`
- [ ] Add/confirm the AC-07 source-scan test still passes after T5/T6 landed their own `src/ui/index.js` changes (no new direct `localStorage.setItem` call site was introduced) — `test/logic/write-guard.test.js`
- [ ] Full suite run: `npm test` — all tests green, including the pre-existing 27 core-timer tests

## Edge cases

| Case | Behaviour |
|---|---|
| `settle()` fires inside `start()` specifically | Latch is set; next `getSnapshot()` reports it |
| `settle()` fires inside `pause()` specifically | Latch is set; next `getSnapshot()` reports it |
| `settle()` fires inside `reset()` specifically | Latch is set; next `getSnapshot()` reports it |
| T5/T6's added UI code accidentally calls `localStorage.setItem` outside T4's function | Source-scan test fails, catching the regression before it ships |

## Definition of Done

- [ ] `npm test` passes in full, with the three start/pause/reset-triggered latch cases and the sleep-across-midnight end-to-end case all present and green
- [ ] The AC-07 source-scan test still passes with T5 and T6's final code in place
- [ ] Every Hard Rule inlined above still holds
- [ ] lint + vet clean
