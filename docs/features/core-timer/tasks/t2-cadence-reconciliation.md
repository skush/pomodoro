---
id: T2
title: "Implement phase cadence and backgrounding reconciliation (settle/getSnapshot)"
layer: "domain"
deps: ["T1"]
blocks: ["T3", "T4"]
acs: ["AC-04", "AC-05", "AC-07"]
files_hint: ["src/logic/index.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
context_budget: "M"
status: "done"
---

# T2 — Implement phase cadence and backgrounding reconciliation (settle/getSnapshot)

## Place in the sequence

- **Blocked by:** T1 — Implement engine control state machine. **Blocks:** T3 — Unit tests for the engine state machine, T4 — UI layer rendering + control wiring. **Wave:** 1 (same file as T1, second in sequence — needs T1's `start`/`pause`/`reset` skeleton to hang the deadline-check into).
- **Lane:** shares `src/logic/index.js` with T1 — serialized.

## Why (user story)

> **As a** User
> **I want** the timer to switch to the correct next phase (short break, long break, or back to focus) whenever a phase finishes
> **So that** I never have to track the 4-focus-sessions-then-long-break pattern myself
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

This task implements the deadline-check (`settle`) that advances at most one phase boundary per query, driving both the automatic cadence and the backgrounding-return reconciliation.

## Inlined context

> **Chosen:** Option 2, absolute wall-clock deadline. It makes drift structurally impossible between renders (each read is independent, no accumulated error) and gives AC-05's reconciliation a simple rule: on return, if `now >= deadlineAt`, exactly one phase boundary is crossed and the next phase starts at its full duration, waiting for Start — any further overshoot is discarded by construction, because the new phase is idle (not running), and no `deadlineAt` for it exists until the User presses Start again.
>
> — `docs/features/core-timer/adr/0001-wall-clock-deadline-timing.md, Decision outcome, verbatim` · full text: [adr/0001](../adr/0001-wall-clock-deadline-timing.md)

> ```mermaid
> sequenceDiagram
>     actor User
>     participant UI as UI layer
>     participant Engine as Timer engine
>     User->>UI: returns to tab (visibilitychange / focus)
>     UI->>Engine: getSnapshot(now)
>     alt now >= deadlineAt (the phase's duration fully elapsed)
>         Engine-->>UI: next phase per cadence, at full duration, not running
>         UI-->>User: shows the new phase waiting for Start — any further overshoot discarded, no auto-start
>     else now < deadlineAt
>         Engine-->>UI: same phase, remaining = deadlineAt - now
>         UI-->>User: shows the same phase still running with the correct remaining time
>     end
> ```
>
> — `sad.md §6, "Backgrounding / return reconciliation" flow, verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/0001](../adr/0001-wall-clock-deadline-timing.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-04 — domain invariant

> **Given** the User has just completed their 4th focus session within the current cycle
> **When** that focus phase's countdown reaches zero
> **Then** the system switches to the long-break phase (never a short break), preserving the rule that exactly every 4th completed focus session is followed by a long break
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-05 — cross-context

> **Given** a focus or break phase is running and the User backgrounds, minimizes, or the machine itself sleeps for any length of real time
> **When** the User returns to the tab
> **Then** the system reflects at most one completed phase boundary: if the true elapsed wall-clock time was enough to finish the running phase, the system now shows the correct next phase per the classic cadence at that next phase's full duration, waiting for the User to press Start — any additional elapsed time beyond that single completed phase is discarded and never triggers a second, unattended transition, even if far more real time actually passed
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-07 — domain invariant

> **Given** any phase's countdown reaches zero while running
> **When** the phase completes
> **Then** the system switches the displayed phase label to the correct next one per the classic cadence, shows that phase's full remaining time, and waits for the User to press Start — it does not begin counting down the next phase on its own
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [x] Implement `settle(now)`: advance at most one phase boundary when `now >= deadlineAt`, else no-op — `src/logic/index.js`
- [x] Wire the classic cadence (Focus → Short break ×3, then Focus → Long break on the 4th) and reset `focusCount` on entering Long break — `src/logic/index.js`
- [x] Call `settle(now)` at the top of `start`, `pause`, `reset`, and `getSnapshot` so every entry point reconciles first (AC-05, AC-07) — `src/logic/index.js`
- [x] New phase after a boundary starts idle (`running: false`) at full duration, never auto-starts — `src/logic/index.js`

## Edge cases

| Case | Behaviour |
|---|---|
| Far more real time elapsed than one phase duration (long sleep) | Exactly one boundary crossed; remainder discarded (AC-05) |
| 4th focus session completes | Next phase is Long break, never Short break (AC-04) |
| A break phase (not Focus) completes | Advances to Focus, `focusCount` unaffected by breaks |
| Phase completes while paused | Cannot occur — `deadlineAt` only exists while running |

## Definition of Done

- [x] Unit tests for AC-04, AC-05, AC-07 pass, including a "long absence still only advances one boundary" case
- [x] every Hard Rule inlined above still holds
- [x] lint + vet clean
