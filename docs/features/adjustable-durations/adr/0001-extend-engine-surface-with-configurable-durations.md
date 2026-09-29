---
status: Accepted
owner: "sergii.kushnir@gmail.com"
reviewers: []
updated_at: "2026-09-29"
feature_size: "S"
ticket: "docs/roadmap.md step 4"
---

# 0001 — Extend the timer engine's public surface with runtime-configurable durations and cycle length

- **Status:** Accepted
- **Date:** 2026-09-29
- **Deciders:** Architect (sergii.kushnir@gmail.com), during `design`'s Socratic pass

## Context

`createTimerEngine()` (`src/logic/index.js`) currently closes over four private, immutable
constants — `FOCUS_DURATION_MS`, `SHORT_BREAK_DURATION_MS`, `LONG_BREAK_DURATION_MS`,
`FOCUS_SESSIONS_PER_CYCLE` — set once at module load and never changed for the lifetime of an
engine instance (confirmed against current `HEAD` by a fresh explorer scan, 2026-09-29). This
feature requires a User to change any of the four at runtime, with precise, asymmetric effects
depending on the target phase's current state: an idle phase reflects the new duration immediately
(`spec.md` AC-03), a running or paused phase is left byte-for-byte untouched until its next fresh
start (AC-04/AC-05), Reset always shows the *current* configured duration rather than whatever the
phase was running/paused with (AC-04b), and a cycle-length change is evaluated against the very next
Focus completion rather than retroactively or on commit (AC-13). This decision fixes how
`src/logic/` exposes that mutability to `src/ui/`, at the same architectural seam where core-timer's
own [`core-timer/adr/0002-structural-encapsulation-control-guard`](../../core-timer/adr/0002-structural-encapsulation-control-guard.md)
fixed the engine's public surface in the first place.

## Decision drivers

- `spec.md` AC-03/AC-04/AC-04b/AC-05/AC-13: five distinct, precisely-timed effects of a
  duration/cycle-length change, each needing direct access to the engine's private
  `remainingMs`/`deadlineAt`/`running`/`focusCount` state to implement correctly.
- [`core-timer/adr/0002-structural-encapsulation-control-guard`](../../core-timer/adr/0002-structural-encapsulation-control-guard.md):
  the engine is a frozen object exposing exactly one stateful factory and no internal-state getters
  — any new mechanism must extend that surface, not read around it.
- `CLAUDE.md` / `architecture-map.md`: `src/logic/` must stay pure (no DOM, no browser APIs) and
  `src/ui/` imports from `src/logic/`, never the reverse.
- `spec.md` §1: "A duration or cycle-length commit is a new kind of input that changes the timer
  engine's own state ... outside of Start/Pause/Reset ... a legitimate fourth input alongside the
  original three" — the spec itself frames this as a control-surface extension, not a workaround.

## Considered options

1. **Extend the engine's public API with two new methods** — `setConfiguredDurations({focus,
   shortBreak, longBreak})` and `setCycleLength(n)`, added alongside `start`/`pause`/`reset`/
   `getSnapshot` on the same frozen returned object. The engine itself decides, using its own private
   state, whether to update the idle phase's `remainingMs` immediately or defer the new value to the
   next fresh start, and reads the current cycle length at the moment a Focus phase completes rather
   than baking it in earlier.
2. **Recreate the engine instance via factory parameters on every commit** —
   `createTimerEngine(focusMs, shortMs, longMs, cycleLen)` accepts config only at construction; each
   duration/cycle-length commit constructs a new instance and the UI manually copies the old
   instance's running/paused state (`deadlineAt`, `remainingMs`, `focusCount`) into it.
3. **Push config-awareness entirely into `src/ui/`** — the engine stores no config at all;
   `start()`/`reset()` accept an explicit duration parameter per call, and `settle()`/`getSnapshot()`
   accept a cycle-length parameter on every call, with `src/ui/` supplying the current value each
   time from its own copy of the settings.

## Decision outcome

**Chosen:** Option 1, extend the engine's public API. It keeps all deadline/duration/cycle-length
decision logic single-sourced in `src/logic/`, the same module that already owns it, and is purely
additive to the existing public surface — no existing caller of `start`/`pause`/`reset`/
`getSnapshot` changes. It is the same "extend, don't rebuild" shape
[`session-tracking/adr/0001-expose-true-focus-completion-timestamp`](../../session-tracking/adr/0001-expose-true-focus-completion-timestamp.md)
already used to grow this same engine's contract once before, and it satisfies AC-03/AC-04/AC-04b/
AC-05/AC-13 naturally: the engine has direct, private access to `remainingMs`/`deadlineAt`/`running`/
`focusCount`, so it alone can correctly decide "update now" vs "defer to next fresh start" without
exposing that state to any caller.

Option 2 was rejected: it would need the UI to read `deadlineAt`/`remainingMs`/`focusCount` out of
the old instance to transplant them into the new one, which either breaks
[`core-timer/adr/0002-structural-encapsulation-control-guard`](../../core-timer/adr/0002-structural-encapsulation-control-guard.md)'s
"frozen object, no internal-state getters" guarantee by adding exactly the getters that guard was
written to avoid, or requires a second, parallel state-transfer mechanism that ends up larger and
riskier than Option 1's two setters — a missed field in the copy would silently corrupt a running
countdown or the daily completed-session count, with no existing test positioned to catch it.

Option 3 was rejected: passing config on every call (`start(now, durationMs)`,
`settle(now, cycleLength)`, `getSnapshot(now, cycleLength)`) widens the signature of methods that
have nothing to do with configuration, forces `src/ui/` to independently track and correctly pass
the right value on every single call site, and still doesn't solve AC-03 (the idle-display-updates-
immediately case) without `src/ui/` re-deriving "is this phase currently idle" logic that the engine
already has for free — duplicating a piece of engine-internal state tracking in the caller for no
benefit over Option 1.

## Consequences

**Positive**
- All deadline/duration/cycle-length math stays single-sourced in `src/logic/`, the same module that
  already owns `settle()`, `clampRemaining()`, and `durationFor()` — no shadow copy of that logic
  anywhere else.
- Purely additive: `Object.freeze({start, pause, reset, getSnapshot})` grows to
  `Object.freeze({start, pause, reset, getSnapshot, setConfiguredDurations, setCycleLength})` with no
  breaking change to any existing caller or test.
- AC-03/AC-04/AC-04b/AC-05/AC-13 each become a small, independently unit-testable branch inside the
  two new setters (and inside `settle()`, for the cycle-length-at-completion-time read), mirroring
  how `ADR-0001` (session-tracking) made `justCompletedFocusAt` independently testable.

**Negative**
- The engine's public surface grows from 4 methods to 6 — more API for a reviewer to hold in mind,
  and two more entries in the AC-03-style source-level scan that already verifies no other input
  channel exists.
- The "idle vs running vs paused" branching now lives inside the two new setters in addition to the
  three original controls — a second place a future reader has to check when reasoning about how a
  phase's duration can change.

**Neutral**
- If a future feature needs another runtime-configurable engine setting, it extends this same
  pattern (a new setter on the frozen object) rather than reopening this decision.

## Amendment (2026-09-29)

A gap surfaced by the `design` critic pass, corrected here rather than reopening the decision above:

- **The engine has no dedicated `paused` boolean — idle and paused both read as `running === false`.**
  The Decision outcome above said "the engine has direct, private access to `remainingMs`/
  `deadlineAt`/`running`/`focusCount`, so it alone can correctly decide 'update now' vs 'defer to next
  fresh start'" without stating *how* it tells idle from paused, since both currently share the same
  `running === false` state. The corrected rule: **idle** means the phase type has never been started
  since its last reset (equivalently: `remainingMs` still equals the full duration that was in effect
  the moment it was last reset/created — not the live current config); **paused** means
  `remainingMs` is *less than* that captured full-duration snapshot, because some countdown already
  happened before Pause was pressed. `setConfiguredDurations`/`setCycleLength` use exactly this
  comparison — against the *snapshotted* value, never a live re-read of the current config — to decide
  whether to update `remainingMs` immediately (idle) or defer to the next fresh start (paused).
  *(The detection mechanism in this bullet is superseded by Amendment 2 below; the idle/paused
  semantics it states still hold.)*
- **`clampRemaining()`/`durationFor()`'s existing contract must be corrected, not left as-is.** As
  scanned pre-feature, both helpers read the *current* value of `durationFor(phase)` on every call,
  including inside `pause()` and `getSnapshot()` for an already-running phase. If `durationFor()`
  starts resolving against the newly-configurable value unmodified, lowering a phase type's Configured
  duration while that same phase is actively running or paused would retroactively clamp its
  in-progress `remainingMs` down to the new (possibly smaller) ceiling on the very next call — directly
  violating AC-04/AC-05's "byte-for-byte unchanged" guarantee. The corrected contract:
  `clampRemaining()`'s upper bound for an already-started phase must use the full duration **captured
  at that phase's own last start/reset moment**, not a live read of the current Configured duration;
  only a phase's *next fresh start* reads the live current value. This is a small, mechanical
  correction to `durationFor()`'s call sites inside `pause()`/`getSnapshot()`/`reset()` (pin the value
  read at start-time into the phase's own state, the same way `deadlineAt` is already pinned at
  start-time per [`core-timer/adr/0001-wall-clock-deadline-timing`](../../core-timer/adr/0001-wall-clock-deadline-timing.md)),
  not a reopening of this ADR's chosen option.
- Both points are additionally tracked as §11 risk rows in `sad.md` and must be covered by a dedicated
  unit test (config change while paused with a partially-elapsed `remainingMs`, distinct from the
  idle case) before this feature's `implement` stage is considered done.

## Amendment 2 (2026-09-29, from review)

Raised by the independent review (`_review/review-2026-09-29.md`, finding #5). The chosen option is
unchanged; only the idle/paused detection mechanism in Amendment 1's first bullet is corrected to
match what was built.

- **Idle vs paused is tracked by a private `phaseStarted` flag, not by comparing `remainingMs`.**
  `phaseStarted` is set by `start()` and cleared whenever a phase becomes fresh (`reset()`, and
  `settle()` entering the next phase). **Idle** = `!phaseStarted`; **paused** = `phaseStarted &&
  !running`. The `remainingMs`-comparison rule would misclassify a phase paused at the same instant it
  started (no time elapsed yet, so `remainingMs` still equals the pinned full duration) as idle, and a
  later commit would then change its frozen time — violating AC-05. A dedicated unit test covers that
  case.
- **The snapshot exposes the flag as `idle`** (`getSnapshot().idle === !phaseStarted`), so the UI can
  tell a fresh Start from a Resume (the pre-start correction runs only on a fresh start — AC-06/AC-08)
  without a second engine query. This adds a read-only snapshot field; the frozen method surface is
  unchanged.
- **The setters enforce the valid ranges themselves** (whole minutes 1–180; cycle length 2–8), ignoring
  anything else fail-soft, so the AC-06 "never shorter than its valid minimum" invariant does not rest
  on the callers alone.
- Amendment 1's second bullet (the full duration pinned at start/reset — `phaseFullMs` — as
  `clampRemaining()`'s upper bound) is implemented as written.

## Links

- Spec: [[../spec.md]] §5 AC-03, AC-04, AC-04b, AC-05, AC-13
- SAD: [[../sad.md]] §4, §5
- Related ADR: core-timer's [[../../core-timer/adr/0002-structural-encapsulation-control-guard]];
  session-tracking's [[../../session-tracking/adr/0001-expose-true-focus-completion-timestamp]]
