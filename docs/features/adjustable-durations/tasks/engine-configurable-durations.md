---
id: T1
title: "Make the engine's three phase durations configurable at runtime, with idle vs running/paused semantics"
layer: "domain"
deps: []
blocks: ["T2","T5"]
acs: ["AC-03","AC-04","AC-04b","AC-05","AC-07"]
files_hint: ["src/logic/index.js","test/logic/timer-engine.test.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "M"
context_budget: "M"
status: "todo"
---

<!-- Self-contained task. To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or contradicts the code in front of you, open the named file for the full text and follow that. Do not invent the missing part. The source always wins over an inline. -->

# T1 — Make the engine's three phase durations configurable at runtime, with idle vs running/paused semantics

## Place in the sequence

- **Blocked by:** — · **Blocks:** T2 — Make the engine's cycle length configurable and read it at completion time, T5 — Add the three duration fields (Numeric setting field) with commit on blur/Enter and inline validation · **Wave:** 1.
- **Lane:** shares `src/logic/index.js` with T2 and T3 — serialized (natural order T3, T1, T2).

## Why (user story)

> **As a** User
> **I want** a duration change to leave a phase I'm currently running untouched
> **So that** editing my settings never causes a surprise countdown jump mid-session
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

The engine half of the story: `setConfiguredDurations` leaves a running or paused phase's remaining time untouched and only updates an idle phase.

## Inlined context

> │   └── index.js   <createTimerEngine() extended: returned object grows two new methods,
> │                   setConfiguredDurations({focus, shortBreak, longBreak}) and
> │                   setCycleLength(n) (ADR-0001) — updates the idle phase's remainingMs
> │                   immediately if the target phase type is currently idle, defers to the
> │                   next fresh start otherwise; settle()'s Long-break decision reads the
> │                   current cycle length at completion time, not a value baked in earlier
> │                   (AC-13). "Idle" here means the phase has never been started since its
> │                   last reset AND remainingMs still equals the full duration it was given
> │                   AT THAT START/RESET moment — not the live current config — so a config
> │                   change while a phase is genuinely running or paused is distinguishable
> │                   from one while it's idle without a new boolean flag (see ADR-0001
> │                   Amendment for the full reasoning and clampRemaining()/durationFor()'s
> │                   corrected contract). New pure functions, no engine-state access:
> │                   per-setting stored-value fallback validation (validateStoredDuration(raw),
> │                   validateStoredCycleLength(raw)) and input-commit validation
> │                   (validateDurationInput / validateCycleLengthInput), mirroring
> │                   validateStoredCount's existing shape.>
>
> — `sad.md §5, src/logic/index.js building block, verbatim` · full text: [sad.md](../sad.md)

> 4. **Engine configuration surface: extend `createTimerEngine()`'s returned object with two new
>    methods, `setConfiguredDurations({focus, shortBreak, longBreak})` and `setCycleLength(n)`, rather
>    than recreating the engine instance on every commit or pushing config-awareness into `src/ui/`.** →
>    [ADR-0001](adr/0001-extend-engine-surface-with-configurable-durations.md). The engine currently
>    closes over four private, immutable constants (`FOCUS_DURATION_MS`, `SHORT_BREAK_DURATION_MS`,
>    `LONG_BREAK_DURATION_MS`, `FOCUS_SESSIONS_PER_CYCLE`) set once at construction. This decision
>    extends [`core-timer/adr/0002-structural-encapsulation-control-guard`](../core-timer/adr/0002-structural-encapsulation-control-guard.md)'s
>    frozen-object public surface with two new legitimate control methods — the "fourth input"
>    `spec.md` §1 itself names — so the engine, which already owns `remainingMs`/`deadlineAt`/
>    `running`/`focusCount` privately, can correctly decide idle-updates-now vs.
>    running/paused-defers-to-next-fresh-start (AC-03/AC-04/AC-05), Reset-always-shows-current-config
>    (AC-04b), and cycle-length-evaluated-at-next-completion-not-retroactively (AC-13) — without
>    exposing that private state to any caller.
>
> — `sad.md §4, decision 4, verbatim` · full text: [sad.md](../sad.md)

> - **The engine has no dedicated `paused` boolean — idle and paused both read as `running === false`.**
>   The Decision outcome above said "the engine has direct, private access to `remainingMs`/
>   `deadlineAt`/`running`/`focusCount`, so it alone can correctly decide 'update now' vs 'defer to next
>   fresh start'" without stating *how* it tells idle from paused, since both currently share the same
>   `running === false` state. The corrected rule: **idle** means the phase type has never been started
>   since its last reset (equivalently: `remainingMs` still equals the full duration that was in effect
>   the moment it was last reset/created — not the live current config); **paused** means
>   `remainingMs` is *less than* that captured full-duration snapshot, because some countdown already
>   happened before Pause was pressed. `setConfiguredDurations`/`setCycleLength` use exactly this
>   comparison — against the *snapshotted* value, never a live re-read of the current config — to decide
>   whether to update `remainingMs` immediately (idle) or defer to the next fresh start (paused).
> - **`clampRemaining()`/`durationFor()`'s existing contract must be corrected, not left as-is.** As
>   scanned pre-feature, both helpers read the *current* value of `durationFor(phase)` on every call,
>   including inside `pause()` and `getSnapshot()` for an already-running phase. If `durationFor()`
>   starts resolving against the newly-configurable value unmodified, lowering a phase type's Configured
>   duration while that same phase is actively running or paused would retroactively clamp its
>   in-progress `remainingMs` down to the new (possibly smaller) ceiling on the very next call — directly
>   violating AC-04/AC-05's "byte-for-byte unchanged" guarantee. The corrected contract:
>   `clampRemaining()`'s upper bound for an already-started phase must use the full duration **captured
>   at that phase's own last start/reset moment**, not a live read of the current Configured duration;
>   only a phase's *next fresh start* reads the live current value. This is a small, mechanical
>   correction to `durationFor()`'s call sites inside `pause()`/`getSnapshot()`/`reset()` (pin the value
>   read at start-time into the phase's own state, the same way `deadlineAt` is already pinned at
>   start-time per [`core-timer/adr/0001-wall-clock-deadline-timing`](../../core-timer/adr/0001-wall-clock-deadline-timing.md)),
>   not a reopening of this ADR's chosen option.
>
> — `adr/0001 Amendment (2026-09-29), first two bullets, verbatim` · full text: [adr/](../adr/)

> | Running/paused isolation | 100% of duration commits while that same phase type is running or paused leave its current remaining time byte-for-byte unchanged (AC-04/AC-05); a commit while idle updates the display immediately instead (AC-03); Reset after such a change shows the current Configured duration, not the one that was running (AC-04b) — all three behaviors verified | unit test |
>
> — `spec.md §6, NFR «Running/paused isolation», verbatim` · full text: [spec.md](../spec.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/) · [screens.md](../screens.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-03 (US-04) — happy path (idle immediate update)

> **Given** a phase type is currently idle, displaying its previous Configured duration
> **When** the User commits a new Configured duration for that same phase type
> **Then** the system updates that phase's idle display to the new duration immediately, without requiring the User to start it first
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-04 (US-02) — domain invariant

> **Given** a phase is currently running
> **When** the User commits a new Configured duration for that same phase type
> **Then** the system does not alter the running phase's remaining time in any way — it keeps counting down exactly as it was — and the new duration only takes effect the next time that phase type starts fresh
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-04b (US-02) — domain invariant (Reset)

> **Given** the User changed a phase type's Configured duration while that phase was running or paused, per AC-04/AC-05
> **When** the User then presses Reset
> **Then** the now-idle phase reflects the current Configured duration (not whatever duration it was running or paused with) — Reset returns the phase to its fresh, idle state, and idle always shows the currently configured value, the same as AC-03
>
> — `spec.md §5, AC-04b, verbatim` · full text: [spec.md](../spec.md)

### AC-05 (US-05) — domain invariant

> **Given** a phase is currently paused, with a specific amount of time frozen as its remaining time
> **When** the User commits a new Configured duration for that same phase type
> **Then** the system leaves the paused phase's frozen remaining time exactly as it was, so resuming continues counting down from that same frozen value, and the new duration only takes effect the next time that phase type starts fresh
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-07 (US-07) — cross-context

> **Given** a User commits a new Configured duration or Configured cycle length
> **When** that commit happens
> **Then** the system leaves the in-cycle focus count and today's completed-session count (`docs/features/session-tracking/spec.md`) exactly as they were at that moment — a commit never advances, resets, or otherwise alters progress already made (AC-13 separately governs how a new cycle length shapes the *next* Long-break decision, a distinct point in time from the commit itself)
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Pin the full duration captured at each phase's own start/reset into that phase's state; make `clampRemaining()`/`durationFor()` use that pinned value for an already-started phase, and the live Configured duration only at a fresh start — `src/logic/index.js`
- [ ] Replace the private `FOCUS_DURATION_MS`/`SHORT_BREAK_DURATION_MS`/`LONG_BREAK_DURATION_MS` constants with classic defaults (25/5/15, exported for T3) plus a mutable configured set — `src/logic/index.js`
- [ ] Add `setConfiguredDurations({focus, shortBreak, longBreak})` to the frozen returned object: update `remainingMs` at once for an idle phase type, defer for running/paused (idle = `remainingMs` equals the pinned full duration) — `src/logic/index.js`
- [ ] Make `reset()` return the phase to idle at the current Configured duration — `src/logic/index.js`
- [ ] Amend the pinned `Object.keys(engine)` assertion to include `setConfiguredDurations` — `test/logic/timer-engine.test.js`
- [ ] Add unit tests: idle update; running untouched; paused with a partially-elapsed `remainingMs` (distinct from idle); lowering the duration while paused/running (no retroactive clamp); Reset shows current config; focus count and session count unchanged — `test/logic/timer-engine.test.js`

## Edge cases

| Case | Behaviour |
|---|---|
| Duration lowered below the elapsed time of a running phase | Running phase keeps its remaining time and original deadline; the lower value applies only at the next fresh start (AC-04) |
| Duration changed while paused with a partial `remainingMs` | Frozen `remainingMs` byte-for-byte unchanged; resume continues from it (AC-05) |
| Commit for a phase type that is not the current phase | Stored for its next fresh start; the current phase is untouched |
| Reset after a running/paused change | Idle at the current Configured duration, not the value it ran with (AC-04b) |
| Commit of any duration | In-cycle focus count and completed-session count unchanged (AC-07) |

## Definition of Done

- [ ] Unit tests for idle, running, paused, Reset, and counts-untouched pass
- [ ] `Object.keys(engine)` assertion amended and green
- [ ] Every Hard Rule inlined above still holds (frozen public surface; `src/logic/` has no DOM/storage access)
- [ ] `npm test` and `npm run lint` clean
