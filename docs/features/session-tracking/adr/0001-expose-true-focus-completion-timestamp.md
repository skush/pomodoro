---
status: Accepted
owner: "sergii.kushnir@gmail.com"
reviewers: []
updated_at: "2026-09-28"
feature_size: "XS"
ticket: "docs/roadmap.md step 3"
---

# 0001 — Extend the timer engine's snapshot with a true Focus-completion timestamp

- **Status:** Accepted
- **Date:** 2026-09-28
- **Deciders:** Architect (sergii.kushnir@gmail.com), during `design`'s Socratic pass

## Context

session-tracking must credit a completed Focus session to the calendar day it **actually** finished
on, not the day the app happens to notice the completion — resolved during `clarify` specifically for
the case where the machine sleeps across local midnight (`spec.md` AC-04, AC-06). core-timer's
`createTimerEngine()` currently exposes only `getSnapshot(now) → {phase, running, remainingMs,
focusCount}` (a fresh explorer scan of `src/logic/index.js`, 2026-09-28) — nothing in that shape tells
a caller *when* a just-ended Focus phase's deadline actually passed. This decision fixes how
`src/logic/` exposes that moment to `src/ui/`, at the same architectural seam where core-timer's own
[`core-timer/adr/0001-wall-clock-deadline-timing`](../../core-timer/adr/0001-wall-clock-deadline-timing.md)
fixed the timing mechanism itself.

A subtlety this ADR must also settle: `start(now)`, `pause(now)`, and `reset(now)` each call the same
internal `settle(now)` that `getSnapshot(now)` does (confirmed against the current source,
`src/logic/index.js`), so the transition that completes a Focus phase can fire inside **any** of the
four public methods — not only `getSnapshot`. A design that only reports the completion from inside
`getSnapshot` itself would silently drop it whenever the User happens to click Start, Pause, or Reset
in the moment the deadline passes, before the next render tick's `getSnapshot` call.

## Decision drivers

- `spec.md` AC-04 / AC-06: a session must be credited to the calendar day it truly finished, and that
  day's rollover must be evaluated using the same true-completion attribution — not the moment the
  count happens to be read.
- `docs/roadmap.md`'s own dependency graph: step 3 "needs the phase-completion event to
  increment/display against" — this decision is exactly that event.
- `CLAUDE.md` / `architecture-map.md`: `src/logic/` must stay pure (no DOM, no browser APIs) and
  `src/ui/` imports from `src/logic/`, never the reverse — whatever mechanism is chosen must fit
  inside that boundary.
- [`core-timer/adr/0002-structural-encapsulation-control-guard`](../../core-timer/adr/0002-structural-encapsulation-control-guard.md)
  (core-timer): the engine's public surface is deliberately minimal — `{start, pause, reset,
  getSnapshot}` and nothing else. Any new mechanism should not widen that surface with a new kind of
  export (a listener/callback registration) if a narrower option exists.

## Considered options

1. **Latch the completion internally in `settle()`, expose it via `getSnapshot(now)`'s return shape as
   a `justCompletedFocusAt` field** — `settle()` records the true deadline timestamp the instant it
   detects a Focus-phase transition, regardless of which public method (`start`, `pause`, `reset`, or
   `getSnapshot`) triggered that call; `getSnapshot()` then consumes and clears the latch, returning it
   exactly once (`null` on every other call).
2. **Add a completion callback to `createTimerEngine()`** — e.g. `createTimerEngine({onFocusComplete})`
   — invoked once, internally, at the moment `settle()` detects the transition, from inside whichever
   public method triggered it.
3. **Reconstruct the true deadline independently in `src/ui/`** — remember, from the last snapshot
   where `running` was `true`, the deadline that snapshot implied (`snapshot's own now + remainingMs`);
   when a transition is next observed, use that remembered deadline as the true completion time,
   without any change to `src/logic/`.

## Decision outcome

**Chosen:** Option 1, latching the completion in `settle()` and exposing it through `getSnapshot()`'s
return shape. It is purely additive — no existing caller of `getSnapshot()` breaks, and no new *kind*
of export is introduced (it remains the same one of core-timer's four allowed methods, ADR-0002's
guard is untouched). It keeps all deadline/timing math single-sourced in the module that already owns
it (`src/logic/`), rather than duplicating a shadow copy of that math in `src/ui/`. Latching inside
`settle()` itself (not inside `getSnapshot()` specifically) is what makes it correct regardless of
which of the four public methods actually triggers the transition — a User clicking Pause the instant
a phase completes still gets that completion reported on the *next* `getSnapshot()` call, because the
latch was set when `settle()` ran, not lost because it ran from inside `pause()`. Because core-timer's
engine already guarantees "at most one phase boundary per query"
([`core-timer/adr/0001-wall-clock-deadline-timing`](../../core-timer/adr/0001-wall-clock-deadline-timing.md)),
at most one latched value can ever be pending at a time — no risk of two transitions colliding before
either is consumed.

Option 2 was rejected: a callback changes the shape of the engine's contract more than a return-value
field does (subscription bookkeeping, multiple-subscriber questions, a genuinely new kind of surface)
for no benefit this feature needs — `getSnapshot()` is already polled every render tick, so a callback
buys nothing a return value doesn't already give for free, and it would need the exact same internal
latch-in-`settle()` mechanism underneath it anyway.

Option 3 was rejected, not because it's unworkable — a careful implementation of it can genuinely
recover the true deadline — but because it duplicates the engine's own deadline math as a second,
parallel timing implementation in a different module, and it inherits the *same* start/pause/reset
subtlety Option 1 had to solve (the UI's own poll loop can equally miss a transition that happened
inside a button-click handler rather than a render tick), so it does not actually avoid that problem,
it just relocates it to a second place that would need to solve it independently.

## Consequences

**Positive**
- The true-completion moment is available for free on the same call the UI already makes every
  render tick — no new polling, no new timer.
- `src/logic/`'s contract stays purely functional and query-based; no listener/subscription machinery
  is added anywhere in the codebase.
- Correct regardless of which public method actually triggers the transition — the latch lives in
  `settle()`, shared by all four methods, not bolted onto `getSnapshot()` alone.
- The change is testable in exact isolation: a unit test can assert `justCompletedFocusAt` is
  reported on the very next `getSnapshot()` call after a transition triggered via `start`, `pause`,
  `reset`, *or* `getSnapshot` itself, and is `null` on every call after that.

**Negative**
- `getSnapshot()`'s return shape grows by one field, meaning any code that asserts on the object's
  exact key set (e.g. via `Object.keys`) must be updated — a small, mechanical, one-time cost.
- The field's meaning ("non-null exactly once, on whichever call consumes it") is a subtler contract
  than the other three fields (which are always-valid state, not a one-shot latch) — worth a clear
  doc comment at the call site so a future reader doesn't mistake it for persistent state, and worth
  a dedicated test for the "latched during start/pause/reset, consumed by the next getSnapshot" path
  specifically, not just the everyday "completed during a getSnapshot poll" path.

**Neutral**
- If a future feature needs to react to a *break*-phase completion too (not just Focus), this same
  pattern extends naturally (e.g. a parallel `justCompletedBreakAt` field) without revisiting this
  decision.

## Links

- Spec: [[../spec.md]] §5 AC-04, AC-06
- SAD: [[../sad.md]] §4, §5, §6
- Related ADR: core-timer's [[../../core-timer/adr/0001-wall-clock-deadline-timing]] and
  [[../../core-timer/adr/0002-structural-encapsulation-control-guard]]; sibling
  [[0002-centralize-session-tracking-writes]]
