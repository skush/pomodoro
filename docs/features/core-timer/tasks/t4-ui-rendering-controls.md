---
id: T4
title: "UI layer: render phase + countdown, wire Start/Pause/Reset, disabled states"
layer: "ui"
deps: ["T1", "T2"]
blocks: ["T5"]
acs: ["AC-02", "AC-04", "AC-05", "AC-07", "AC-08"]
files_hint: ["src/ui/index.js", "src/styles.css"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
context_budget: "S"
status: "todo"
---

# T4 — UI layer: render phase + countdown, wire Start/Pause/Reset, disabled states

## Place in the sequence

- **Blocked by:** T1 — Implement engine control state machine, T2 — Implement phase cadence and backgrounding reconciliation (needs a working `getSnapshot`/`start`/`pause`/`reset` to render and call). **Blocks:** T5 — Wire main.js + regenerate index.html. **Wave:** 2 (parallel with T3; both consume T1+T2 but touch disjoint files).
- **Lane:** own files (`src/ui/index.js`, `src/styles.css`) — no overlap with T1/T2/T3.

## Why (user story)

> **As a** User
> **I want** to see clearly which phase is running and how much time is left in it
> **So that** I always know whether I'm focusing or on a break, and for how much longer
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

This task builds the DOM layer that renders that visibility and is the only caller wired to the three controls (AC-03's other half, from the UI side).

## Inlined context

> `mount(root)` — the only caller of the logic factory's methods. Container(ui, "UI layer", "JS module (DOM)", "Renders phase + countdown; wires Start/Pause/Reset; reads tab visibility").
>
> — `sad.md §5, Building block view + C4 Container, abridged` · full text: [sad.md](../sad.md)

> User->>UI: clicks Start / UI->>Engine: start(now) / Engine-->>UI: snapshot (running, ...) / UI-->>User: shows phase label + counting-down time, Pause enabled ... User->>UI: clicks Pause / UI-->>User: shows frozen time, Pause disabled.
>
> — `sad.md §6, "Start → running countdown" flow, abridged` · full text: [sad.md](../sad.md)

> Reconcile against real elapsed time as soon as the tab becomes visible again (AC-05), rather than waiting for the next interval tick.
>
> — `sad.md §6, "Backgrounding / return reconciliation" flow note, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** Error handling: fail-soft in `src/ui/` only — clamp invalid input, never throw to the User.
>
> — `sad.md §2, Conventions, verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-02 — error

> **Given** the timer is not currently running
> **When** the User looks at the controls
> **Then** the Pause control is shown as disabled/unavailable, so the User can see there is nothing to pause right now
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-04 — domain invariant (display-facing)

> **Given** the User has just completed their 4th focus session within the current cycle
> **When** that focus phase's countdown reaches zero
> **Then** the system switches to the long-break phase (never a short break) ...
>
> — `spec.md §5, AC-04, abridged` · full text: [spec.md](../spec.md)

### AC-05 — cross-context (display-facing)

> **Given** a focus or break phase is running and the User backgrounds, minimizes, or the machine itself sleeps for any length of real time
> **When** the User returns to the tab
> **Then** the system reflects at most one completed phase boundary ... waiting for the User to press Start ...
>
> — `spec.md §5, AC-05, abridged` · full text: [spec.md](../spec.md)

### AC-07 — domain invariant (display-facing)

> **Given** any phase's countdown reaches zero while running
> **When** the phase completes
> **Then** the system switches the displayed phase label to the correct next one per the classic cadence, shows that phase's full remaining time, and waits for the User to press Start
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

### AC-08 — domain invariant (display-facing)

> **Given** the app has just been opened (a fresh page load, no prior interaction)
> **When** the User first sees it
> **Then** the system shows the Focus phase at its full duration, not running, with the in-cycle focus count at zero
>
> — `spec.md §5, AC-08, abridged` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `mount(root)` builds the phase label, countdown (`aria-live="polite"`), and Start/Pause/Reset buttons — `src/ui/index.js`
- [ ] `render()` reads `engine.getSnapshot(Date.now())`, sets label/countdown text, toggles `startBtn.disabled`/`pauseBtn.disabled` per `snapshot.running` (AC-02) — `src/ui/index.js`
- [ ] Wire each button's click handler to call the matching engine method with `Date.now()` then re-render — `src/ui/index.js`
- [ ] Add a `document.visibilitychange` listener that re-renders immediately on return-to-visible (AC-05) — `src/ui/index.js`
- [ ] Recurring render on an interval (≥1/sec, spec §6 NFR display update rate) while foreground — `src/ui/index.js`
- [ ] Base styling for phase card, countdown, and control buttons — `src/styles.css`

## Edge cases

| Case | Behaviour |
|---|---|
| Page first loads | Focus phase, full duration, Start enabled, Pause disabled (AC-08, AC-02) |
| Tab returns to visible mid-phase | Immediate re-render reflects reconciled snapshot, no stale display (AC-05) |
| Phase completes while tab is foreground | Next render tick shows new phase idle, waiting for Start (AC-07) |

## Definition of Done

- [ ] Manual check: opening the page shows Focus/full-duration/Pause-disabled (AC-08, AC-02)
- [ ] Manual check: backgrounding then returning mid-phase updates immediately without waiting for the next interval tick (AC-05)
- [ ] every Hard Rule inlined above still holds
- [ ] lint + vet clean
