---
status: Accepted
owner: "sergii.kushnir@gmail.com"
reviewers: []
updated_at: "2026-09-05"
feature_size: "XS"
ticket: "docs/roadmap.md step 2"
---

# 0002 — Enforce AC-03's control-input guard through structural encapsulation, not a runtime token

- **Status:** Accepted
- **Date:** 2026-09-05
- **Deciders:** Architect (sergii.kushnir@gmail.com), during `design`'s Socratic pass

## Context

AC-03 requires that the timer engine only ever changes state in direct response to its own page's
Start/Pause/Reset controls — explicitly calling out a message from another tab/origin, or any input
not wired to a control, as inputs the engine must ignore via "an explicit guard ... not merely an
assumption about browser isolation." This decision fixes how `src/logic/` and `src/ui/` jointly
implement that guard.

## Decision drivers

- AC-03 (US-01/02/03): non-control input must be a no-op, verified by a built, testable behavior.
- `CLAUDE.md` layering rule: `src/ui/` imports from `src/logic/`, never the reverse — the guard
  can't require `src/logic/` to know about DOM event sources.
- Spec §6.1 abuse cases: cross-tab/cross-origin control is explicitly named as denied by the AC-03
  guard, "reinforced by" (not replaced by) the browser's own execution-context isolation.

## Considered options

1. **Structural encapsulation only** — `src/logic/` exports exactly one factory returning
   `{ start, pause, reset, getSnapshot }` and no other symbol; `src/ui/` is the only module that
   ever calls them, wired once from the three controls' click/keyboard handlers; the page never
   registers a `window` `'message'` listener or any other global input channel. No other code path
   to reach the engine exists.
2. **Structural encapsulation + a runtime trusted-call token** — same encapsulation, plus each
   control function requires a sentinel value (e.g. a `Symbol` created once in `src/main.js`) and
   early-returns if it's missing or wrong.

## Decision outcome

**Chosen:** Option 1, structural encapsulation only. It fully satisfies AC-03's scenarios without
adding an API-surface cost: a test can dispatch a `MessageEvent` at `window` and assert no state
change (nothing listens, so nothing happens — directly exercising the "message from another
tab/origin" scenario), and the existing AC-01b ("Start while running is a no-op") and AC-02b
("Pause while not running is a no-op") unit tests already cover "an unwired/redundant input reaches
a control function" from the inside. A separate token adds ceremony to every call site for a page
that structurally cannot open the channel AC-03 is worried about.

## Consequences

**Positive**
- Zero extra parameters on `start`/`pause`/`reset` — the public API stays exactly the three
  User-facing operations `screens`/`tasks` need to wire.
- The guard is provable by code review (grep for `addEventListener('message'` finds nothing) and by
  the dispatched-`MessageEvent` test, not just an assumption.
- Reuses the idempotency tests AC-01b/AC-02b already require — no duplicated test logic.

**Negative**
- The guard isn't one dedicated, named function a reviewer can point to — it's an absence (no
  listener registered) plus two other ACs' tests doing double duty. A future reader unfamiliar with
  this ADR could plausibly ask "where's the AC-03 guard?" and need to be pointed here.

**Neutral**
- If a future feature genuinely needs a cross-tab/window channel (e.g. syncing state across two
  open tabs), that feature reopens this decision — it does not retrofit silently, since adding any
  listener at all changes the premise this ADR relies on.

## Amendment (2026-09-27)

Two clarifications surfaced by `review`, neither reversing the decision above:

- **"No other symbol" (Option 1, Decision outcome) meant no other *stateful* symbol.**
  `src/logic/index.js` also exports `PHASES` (a frozen constant) and `formatDuration` /
  `controlStates` (pure functions with no closure over engine state) — none of these can reach or
  mutate a `createTimerEngine()` instance, so the guard holds in substance. The wording is corrected
  here and in `sad.md` §5 to: *`src/logic/` exports exactly one stateful factory
  (`createTimerEngine`); any other export must be a frozen constant or a pure function with no
  access to engine state.*
- **The verifying test is a source-level scan, not a dispatched `MessageEvent`.** This repo has no
  DOM/jsdom test environment (`node:test` only), so "a test can dispatch a `MessageEvent` at
  `window`" (Decision outcome) was not literally buildable without adding a new test dependency.
  `test/logic/timer-engine.test.js` ("engine surface (AC-03)") instead asserts, by scanning every
  `.js` file under `src/`, that no `addEventListener('message'`, `onmessage`, `postMessage`, or
  `BroadcastChannel` exists anywhere — the same structural guarantee (no input channel exists to
  reach the engine through), verified statically instead of by simulating an event that would have
  had nothing to land on anyway.

## Amendment (2026-09-30, sensory-feedback)

The premise above ("no listener registered") is reopened, as this ADR's Neutral consequence
requires, by [sensory-feedback ADR-0001](../../sensory-feedback/adr/0001-wake-the-page-at-the-deadline-from-an-inline-worker.md)
("Amends core-timer ADR-0002"). A single private channel is allowed, between the page and a worker
it creates itself, in `src/ui/wakeup.js` only. Its handler may only trigger a render (a read),
never an engine control method. `window`/global `message` and `storage` listeners and
`BroadcastChannel` remain forbidden everywhere. The AC-03 source scan in
`test/logic/timer-engine.test.js` is reworked to allow exactly that file. The guarantee that no
input channel reaches the engine's control methods is unchanged.

## Links

- Spec: [[../spec.md]] §5 AC-03, §6.1
- SAD: [[../sad.md]] §4, §8
- Related ADR: [[0001-wall-clock-deadline-timing]]

## Amendment (sensory-feedback, 2026-09-30)

The "no input channel" scan in `test/logic/timer-engine.test.js` now permits `postMessage(` and
`onmessage` in exactly one file, `src/ui/wakeup.js`: the private page-to-worker channel of the
wake-up clock. Window/global `message` listeners, `storage` listeners and `BroadcastChannel` remain
forbidden in every file. No engine control method is reachable from that channel. See
[sensory-feedback ADR-0001](../../sensory-feedback/adr/0001-wake-the-page-at-the-deadline-from-an-inline-worker.md),
"Amends core-timer ADR-0002".
