---
status: Draft
owner: "sergii.kushnir@gmail.com"
reviewers: ["Tech Lead"]
updated_at: "2026-09-05"
feature_size: "XS"
---

# Spec — core-timer

> **Glossary:** [CONTEXT](../../../CONTEXT.md)
> **Reference module / docs / channels used:** None — only the interview + CONTEXT + `docs/idea-brief.md` + `docs/roadmap.md` + `docs/architecture-map.md`.

## 1. Context

There's no engine yet behind the pomodoro-timer idea: right now the repo has a scaffolded skeleton with a placeholder UI and no actual timer logic. This step builds the part everything else depends on — a User who wants to run a focused work session needs a timer that reliably follows the classic Pomodoro cadence (25 min focus, 5 min short break, 15 min long break every 4th focus session) using only Start/Pause/Reset, and that stays correct even if they switch away from the tab mid-session.

There's no external trigger beyond the roadmap itself: this is the first unblocked step after the greenfield scaffold, and every later step (session tracking, adjustable durations, sensory feedback) depends on this engine existing first.

The committed approach: a pure, framework-free state machine (`src/logic/`) drives phase transitions and remaining time from real elapsed wall-clock time rather than a naive tick counter, wired to a minimal text-based UI (`src/ui/`) with three controls. Visual polish, persistence, and configurable durations are explicitly out of this step (see §3).

## 2. Goals

- A User can run a complete classic Pomodoro cycle (4 focus phases, 3 short breaks between them, then 1 long break) end to end using only Start, Pause, and Reset — no manual phase or duration bookkeeping.
- The displayed countdown never drifts from real elapsed time by more than a trivial rendering tolerance, including after the browser tab was backgrounded or throttled.
- Every control's enabled/disabled state always correctly reflects what the User can currently do, with no way to reach an inconsistent or stuck state.

## 3. Non-goals

- **Visual progress ring, tab-title countdown mirror, and completion chime** — deferred to the later "Sensory feedback" roadmap step; this step ships a plain text/numeric display only, to keep this increment small and walkable.
- **Persisting a daily completed-session counter across page reloads** — deferred to "Session tracking"; this step counts completed focus sessions only in memory, for the current page load, purely to decide short-break vs. long-break.
- **Adjustable focus/break durations** — deferred to "Adjustable durations"; this step uses the fixed classic values (25/5/15) as constants, avoiding coupling to the still-open question of mid-session duration-change behavior (`docs/roadmap.md` D1).
- **Task-label input** — deferred to "Session tracking"; unrelated to the timer engine itself.

## 4. User stories

### US-01: Start a focus session

**As a** User
**I want** to start the timer
**So that** I can begin the current phase counting down from its full duration

### US-02: Pause and resume

**As a** User
**I want** to pause and later resume the running phase
**So that** I can step away briefly without losing my place in the phase

### US-03: Reset the current phase

**As a** User
**I want** to reset the current phase back to its full duration
**So that** I can start that phase over without disturbing the rest of the cycle or my session count

### US-04: See which phase is active

**As a** User
**I want** to see clearly which phase is running and how much time is left in it
**So that** I always know whether I'm focusing or on a break, and for how much longer

### US-05: Follow the classic cadence automatically

**As a** User
**I want** the timer to switch to the correct next phase (short break, long break, or back to focus) whenever a phase finishes
**So that** I never have to track the 4-focus-sessions-then-long-break pattern myself

### US-06: Trust the countdown when I'm away from the tab

**As a** User
**I want** the countdown to stay accurate even if I switch tabs or minimize the browser
**So that** the phase ends at the correct real-world time, not late because the tab was backgrounded

## 5. Acceptance criteria

### AC-01 (US-01) — happy path

**Given** a User has the app open with a phase loaded at its full duration and not running
**When** the User starts the timer
**Then** the system begins counting the phase down from its full duration and shows the User that it is running, displaying the current phase's label and its remaining time

### AC-02 (US-02) — error

**Given** the timer is not currently running
**When** the User looks at the controls
**Then** the Pause control is shown as disabled/unavailable, so the User can see there is nothing to pause right now

### AC-02b (US-02) — error (concurrent edge)

**Given** the timer is not currently running
**When** a pause action is nonetheless requested (e.g. bypassing the disabled control)
**Then** the underlying engine takes no action — the timer remains not-running with no change to elapsed time or phase

### AC-03 (US-01, US-02, US-03) — authorization

**Given** a User's pomodoro page instance is running
**When** an input arrives that did not come from that page's own Start/Pause/Reset controls (e.g. a message from another tab/origin, or any input not wired to a control)
**Then** the system ignores it — the timer's state changes only in direct response to that page's own control presses, never from any other source

### AC-04 (US-05) — domain invariant

**Given** the User has just completed their 4th focus session within the current cycle
**When** that focus phase's countdown reaches zero
**Then** the system switches to the long-break phase (never a short break), preserving the rule that exactly every 4th completed focus session is followed by a long break

### AC-05 (US-06) — cross-context

**Given** a focus or break phase is running and the User backgrounds or minimizes the browser tab for longer than the time remaining in that phase
**When** the User returns to the tab
**Then** the system has already switched the displayed phase to the correct next one per the classic cadence and is waiting for the User to press Start — reflecting the true wall-clock time that passed, not merely the update ticks that fired while the tab was backgrounded

### AC-06 (US-03) — happy path

**Given** a phase is running with some time already elapsed
**When** the User resets it
**Then** the system returns that phase to its full duration and stops it, while leaving the current phase type, the cycle position, and the in-memory completed-focus-session count unchanged

### AC-07 (US-04, US-05) — domain invariant

**Given** any phase's countdown reaches zero while running
**When** the phase completes
**Then** the system switches the displayed phase label to the correct next one per the classic cadence, shows that phase's full remaining time, and waits for the User to press Start — it does not begin counting down the next phase on its own

## 6. Non-functional requirements

| Aspect | Target | Measurement |
|---|---|---|
| Countdown drift after backgrounding | ≤ 1s versus true wall-clock elapsed time | manual check: background the tab for 5 min mid-phase, compare displayed remaining time to a stopwatch on return |
| Countdown display update rate | ≥ 1 update per second while a phase is running and the tab is foreground/visible | manual/visual check during a running phase |
| Time to interactive | ≤ 500ms from `index.html` load to Start being clickable | manual load check in a modern browser |
| Concurrency / state safety | at most one phase is ever "running" at a time; no double-counted elapsed time | enforced by unit tests on the state machine |

## 6.1 Security / privacy

- **Data classification:** internal — the only data is ephemeral in-memory timer state for the current page load; nothing is persisted or transmitted by this step.
- **Personal data touched:** none.
- **AuthZ/AuthN impact:** none — there are no accounts or roles; the only access boundary is the browser's own page/tab isolation (see AC-03), which the app relies on rather than implements.
- **Abuse cases:**
  - cross-tab/cross-origin control of the timer: denied by the browser's execution-context isolation (AC-03) — no app-level handling needed beyond relying on this platform guarantee.
  - a User editing the fixed duration constants via their own browser devtools: accepted — it's their own local copy of the page, not an action against another party.
  - rapid/spam pressing of Start/Pause/Reset: the state machine treats redundant presses (e.g. Start while already running) as no-ops — no rate limit needed since no shared resource is at risk.
- **Security review:** N/A — no backend, no accounts, no persisted or transmitted personal data; a static client-side page the User runs themselves.

## 7. Metrics / KPIs

- **Countdown accuracy after backgrounding** — baseline: unverified (0), target: ≤1s drift confirmed via the manual NFR check, before this step is marked done.
- **Cycle correctness** — baseline: unverified (0), target: a full 4-focus + 1-long-break cycle completes with zero mis-ordered phase transitions, verified by unit tests on the state machine before this step is marked done.
- **Control correctness** — baseline: unverified (0), target: 100% of invalid control presses (e.g. Pause while stopped) are no-ops with no state corruption, verified by unit tests before this step is marked done.

## 8. Open questions

- [ ] Should the active phase be visually distinguished beyond its text label (e.g. color-coding) in this step? Default now: plain text label only; color-coding deferred to the "Sensory feedback" step. — owner: PM (sergii.kushnir@gmail.com), due: before `design`
- [ ] Exact wording/layout of the phase label and countdown text (e.g. "Focus — 24:59" as one string vs. separate elements)? Default now: implementer's choice at `design`/`screens` time, kept to plain text. — owner: Tech Lead, due: before `screens`/`design`
