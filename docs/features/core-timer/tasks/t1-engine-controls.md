---
id: T1
title: "Implement engine control state machine (start/pause/reset + no-op guards)"
layer: "domain"
deps: []
blocks: ["T2", "T3", "T4"]
acs: ["AC-01", "AC-01b", "AC-02b", "AC-02c", "AC-03", "AC-06", "AC-08"]
files_hint: ["src/logic/index.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
context_budget: "M"
status: "todo"
---

# T1 — Implement engine control state machine (start/pause/reset + no-op guards)

## Place in the sequence

- **Blocked by:** none — first task in the feature. **Blocks:** T2 — Implement phase cadence + backgrounding reconciliation, T3 — Unit tests for the engine state machine, T4 — UI layer rendering + control wiring. **Wave:** 1 (nothing upstream; the pure engine module everything else calls into).
- **Lane:** shares `src/logic/index.js` with T2 — serialized (same file, sequential edits).

## Why (user story)

> **As a** User
> **I want** to start the timer
> **So that** I can begin the current phase counting down from its full duration
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

This task builds the `start`/`pause`/`reset` operations and their redundant-press no-ops that US-01/US-02/US-03 depend on.

## Inlined context

> The committed approach: a pure, framework-free state machine (`src/logic/`) drives phase transitions and remaining time from real elapsed wall-clock time rather than a naive tick counter, wired to a minimal text-based UI (`src/ui/`) with three controls.
>
> — `spec.md §1, committed approach, verbatim` · full text: [spec.md](../spec.md)

> `createTimerEngine() → { start, pause, reset, getSnapshot }` — no other exports. `src/logic/` (domain — the pure phase/cycle state machine) → `src/ui/` (infra — DOM rendering, control wiring) → `src/main.js`. `src/logic/` never imports `src/ui/`.
>
> — `sad.md §5, Building block view, abridged` · full text: [sad.md](../sad.md)

> **Chosen:** Option 1, structural encapsulation only. `src/logic/` exports exactly one factory returning `{ start, pause, reset, getSnapshot }` and no other symbol; `src/ui/` is the only module that ever calls them ... The page never registers a `window` `'message'` listener or any other global input channel.
>
> — `docs/features/core-timer/adr/0002-structural-encapsulation-control-guard.md, Decision outcome, abridged` · full text: [adr/0002](../adr/0002-structural-encapsulation-control-guard.md)

> **Hard rule:** Error handling: fail-soft in `src/ui/` only — clamp invalid input, never throw to the User.
>
> — `sad.md §2, Conventions, verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-01 — happy path

> **Given** a User has the app open with a phase loaded at its full duration and not running
> **When** the User starts the timer
> **Then** the system begins counting the phase down from its full duration and shows the User that it is running, displaying the current phase's label and its remaining time
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-01b — error (concurrent edge)

> **Given** the timer is already running
> **When** the User presses Start again
> **Then** the system takes no action — the running phase continues uninterrupted from wherever it currently is, with no reset and no double-counted elapsed time
>
> — `spec.md §5, AC-01b, verbatim` · full text: [spec.md](../spec.md)

### AC-02b — error (concurrent edge)

> **Given** the timer is not currently running
> **When** a pause action is nonetheless requested (e.g. bypassing the disabled control)
> **Then** the underlying engine takes no action — the timer remains not-running with no change to elapsed time or phase
>
> — `spec.md §5, AC-02b, verbatim` · full text: [spec.md](../spec.md)

### AC-02c — happy path

> **Given** a phase is paused with some remaining time (it had not yet reached zero when paused)
> **When** the User presses Start
> **Then** the system resumes counting that phase down from exactly the remaining time it had when paused — never restarting it at full duration
>
> — `spec.md §5, AC-02c, verbatim` · full text: [spec.md](../spec.md)

### AC-03 — authorization

> **Given** a User's pomodoro page instance is running
> **When** an input arrives that did not come from that page's own Start/Pause/Reset controls being activated ... — for example a message from another tab/origin, or any input not wired to a control
> **Then** the engine enforces an explicit guard that ignores it — the timer's state changes only in direct response to that page's own three controls, never from any other source; this is a built, testable behavior, not merely an assumption about browser isolation
>
> — `spec.md §5, AC-03, abridged` · full text: [spec.md](../spec.md)

### AC-06 — happy path

> **Given** a phase in any state — running with elapsed time, paused with elapsed time, or already at its full duration
> **When** the User resets it
> **Then** the system returns that phase to its full duration and stops it, while leaving the current phase type, the cycle position, and the in-cycle focus count unchanged
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-08 — domain invariant

> **Given** the app has just been opened (a fresh page load, no prior interaction)
> **When** the User first sees it
> **Then** the system shows the Focus phase at its full duration, not running, with the in-cycle focus count at zero — this is the only valid starting state
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Define `PHASES` enum and per-phase fixed durations (25/5/15 min) — `src/logic/index.js`
- [ ] Implement `createTimerEngine()` initial state per AC-08 (Focus, full duration, not running, focusCount 0) — `src/logic/index.js`
- [ ] Implement `start(now)` with the AC-01b no-op guard and AC-02c resume-from-remaining behavior — `src/logic/index.js`
- [ ] Implement `pause(now)` with the AC-02b no-op guard — `src/logic/index.js`
- [ ] Implement `reset(now)` preserving phase/cycle/focusCount per AC-06 — `src/logic/index.js`
- [ ] Freeze the returned object to exactly `{ start, pause, reset, getSnapshot }`, no other exported mutator (AC-03) — `src/logic/index.js`

## Edge cases

| Case | Behaviour |
|---|---|
| Start called while already running | No-op — phase continues uninterrupted (AC-01b) |
| Pause called while not running | No-op — no state change (AC-02b) |
| Reset called on a phase already at full duration | Still returns full duration, stopped, no-op-equivalent (AC-06) |
| Any caller other than `src/ui/`'s wired controls | Structurally cannot reach the engine — no `window` message listener exists (AC-03, ADR-0002) |

## Definition of Done

- [ ] Unit tests for AC-01, AC-01b, AC-02b, AC-02c, AC-06, AC-08 pass
- [ ] `createTimerEngine()` exports exactly `{ start, pause, reset, getSnapshot }`, verified by inspection/test (AC-03)
- [ ] every Hard Rule inlined above still holds
- [ ] lint + vet clean
