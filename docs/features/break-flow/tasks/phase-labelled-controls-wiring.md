---
id: T6
title: "Replace Start/Pause/Reset with the phase-labelled slots and route every action to the engine"
layer: "ui"
deps: ["T2", "T3", "T4", "T5"]
blocks: ["T7", "T8"]
acs: ["AC-04", "AC-05", "AC-06", "AC-15", "AC-16"]
files_hint: ["src/ui/index.js", "src/logic/index.js", "src/styles.css", "test/logic/write-guard.test.js", "test/logic/timer-engine.test.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "M"
context_budget: "M"
status: "todo"
---

<!-- Inline slices are snapshots taken at breakdown time; the source file named in each signature always wins. To the executing agent: work from what is inlined; if a slice is insufficient, ambiguous or contradicts the code, open the named file for the full text. Do not invent the missing part. -->

# T6 — Replace Start/Pause/Reset with the phase-labelled slots and route every action to the engine

## Place in the sequence

- **Blocked by:** T2 — Extend the engine: startedAt, startFocus(now), setAllowPausingFocus(on) and the focus-pause policy; T3 — Add the pure controlLayout(snapshot, now) rule and phase-named CONTROL_LABELS; T4 — Build createControls(onAction): three fixed slot buttons and the keyboard-focus rule; T5 — Add the Auto-start breaks and Allow pausing focus toggles with a third storage gatekeeper · **Blocks:** T7 — Auto-start the break after an On-time Focus completion (backdated start in render); T8 — Move the existing e2e helpers and scripts to the phase-labelled controls · **Wave:** 4.
- **Lane:** shares `src/ui/index.js`, `src/logic/index.js`, `src/styles.css`, `test/logic/write-guard.test.js`, `test/logic/timer-engine.test.js` with T1, T2, T5, T7 — serialized (ordered by the dependency chain).

## Why (user story)

> **As a** User
> **I want** to pause, resume, reset or start the break with controls that say "break"
> **So that** I can manage my rest without ever starting Focus by accident
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

Wires the pure layout and the slot buttons into the page so every control names its phase and acts only on that phase.

## Inlined context

> `mount(root, engine)`: builds the controls from `ui/controls.js` instead of the Start/Pause/Reset buttons … `prepareStart()` learns that Start focus from a break is a fresh Focus start. The Start focus, Start break and Resume focus/break handlers call `unlockSound()` synchronously first, the presses that now unlock audio in place of the old Start (sensory-feedback AC-11), so a later auto-start can chime. Still the ONLY caller of the engine's methods (core-timer ADR-0002).
>
> — `sad.md §5, src/ui/index.js, abridged` · full text: [sad.md](../sad.md)

> Start focus: `unlockSound` inside this press → pre-start correction for the fresh Focus (running break untouched) → `engine.startFocus(now)` → no-op inside the guard, else Focus running, no chime → arm the wake-up for Focus → render. Start break: unlockSound → pre-start correction → `start(now)` → arm. Pause: `pause(now)` → cancel wake-up. Resume: unlockSound → `start(now)` → arm. Reset: `reset()` → cancel.
>
> — `sad.md §6, Flows 2–4, abridged` · full text: [sad.md](../sad.md)

> `write-guard.test.js` is amended: … the pre-start correction call-site pins (prepareStart only via refreshConfigFromStorage, called exactly once, from the startBtn handler, before engine.start) are re-pinned to the three legitimate triggers: the Start break and Start focus handlers and the auto-start step. … `controlStates` and `refocusIfStranded` are removed, along with their tests.
>
> — `sad.md §5 + adr/0003 Consequences, abridged` · full text: [sad.md](../sad.md)

> The UI forwards every Start focus press to the engine and never decides the guard itself. The greyed-out look can trail by up to one 250 ms render tick, but the behaviour is exact (within the §6 ± 0.25 s). … The click is still forwarded to the engine, which enforces the guard (ADR-0002).
>
> — `adr/0002 + adr/0003 Consequences, abridged` · full text: [adr/0002-enforce-skip-guard-and-focus-pause-policy-in-the-engine.md](../adr/0002-enforce-skip-guard-and-focus-pause-policy-in-the-engine.md)

> | Start focus response | Focus shown running ≤ 250 ms after the press | manual check during a running break |
>
> — `spec.md §6, NFR Start focus response, verbatim` · full text: [spec.md](../spec.md)

> The engine changes only through methods called by `src/ui/` from this page's own controls, toggles and duration/cycle commits, plus the auto-start branch. There is no `message`/`storage` listener and no `BroadcastChannel`.
>
> — `sad.md §8, Input guard, abridged` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-04 (US-02) — happy path

> **Given** a Short break or Long break is running, paused, or waiting at full length, and the Skip guard (AC-05) is not active
> **When** the User presses Start focus
> **Then** the break ends at once with no chime, and the next Focus phase starts counting down from the current Configured focus duration — checked and corrected exactly as for any fresh start (adjustable-durations AC-06) — with the phase name, ring and tab title showing Focus running
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-05 (US-02) — error

> **Given** a break has just started — auto-started after an On-time completion (AC-01), or started by the User with Start break
> **When** the User presses Start focus within 3 seconds of that break's start — the Focus phase's true end for an auto-started break, the Start break press for a User-started one — the Skip guard
> **Then** the press does nothing and the break keeps going; for that time Start focus is shown greyed out in the main position, so the User can see it isn't available yet, and it becomes available on its own when the 3 seconds have passed in real time; pausing the break doesn't extend the guard — a break paused inside it keeps Start focus greyed out until the 3 seconds have passed — and Resume break starts no new guard; Reset break leaves the break waiting, where no guard applies; a break waiting at full length has no Skip guard
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-06 (US-03) — happy path

> **Given** a break is shown
> **When** the User uses the break's own controls
> **Then** each acts only on the break: a running break offers Pause break and Reset break; a paused break offers Resume break and Reset break; a waiting break offers Start break; Pause break freezes the remaining time, Resume break continues from exactly that time, Reset break returns the break to its full length — the current Configured duration (adjustable-durations AC-04b) — stopped and waiting, and Start break starts it counting down; none of them ever starts Focus, and Start focus stays offered alongside them in every break state; breaks can always be paused, whatever Allow pausing focus says
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-15 (US-07) — happy path

> **Given** Allow pausing focus is off (the default) and a Focus phase is running
> **When** the User wants to interrupt it
> **Then** no pause control is shown for it; Reset focus discards it — it returns to its full length, waiting for Start focus, and is never counted as a Focus session; a pause requested by any other means (for example bypassing the hidden control) does nothing and the Focus phase keeps running
>
> — `spec.md §5, AC-15, verbatim` · full text: [spec.md](../spec.md)

### AC-16 (US-07) — happy path

> **Given** Allow pausing focus is on and a Focus phase is running
> **When** the User presses Pause focus and later Resume focus
> **Then** the Focus phase freezes at its remaining time and then continues from exactly that time — core-timer's pause and resume (AC-02c), unchanged
>
> — `spec.md §5, AC-16, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] In `mount()` drop `startBtn/pauseBtn/resetBtn`; add `createControls(handleAction)`; `render()` calls `controls.update(controlLayout(snapshot, now))` after the title/ring/cue steps.
- [ ] Write `handleAction(action)`: `startFocus` → `unlockSound`, correction, then `engine.startFocus(now)` (on a waiting Focus use `engine.start`); `startBreak` / `resumeFocus` / `resumeBreak` → `unlockSound` (+ correction only for fresh starts), `engine.start`; `pauseFocus` / `pauseBreak` → `engine.pause`; `resetFocus` / `resetBreak` → `engine.reset`; each then `render()` + `syncWakeup`.
- [ ] Update `prepareStart` so a fresh Focus started from a break counts as a fresh start (still no write on a running break).
- [ ] Remove `controlStates` (`src/logic/index.js`) and `refocusIfStranded`; delete/replace their tests in `test/logic/timer-engine.test.js`.
- [ ] Re-pin `test/logic/write-guard.test.js` call-site assertions to the Start break and Start focus handlers.
- [ ] Set `tabindex="-1"` on the phase name/countdown; add slot layout + greyed (`[aria-disabled="true"]`) styles in `src/styles.css`.

## Edge cases

| Case | Behaviour |
|---|---|
| Start focus clicked inside the Skip guard (greyed) | Engine no-op; break keeps going; no error shown |
| Pause requested for Focus with policy off (programmatic) | Engine no-op; Focus keeps running |
| Start focus on a waiting Focus | Goes through `engine.start`, not `startFocus` |
| Reset break pressed | Break waiting at the current Configured length; Start break in main |
| Saved durations corrupted between load and a fresh start | Corrected and written back by the pre-start correction before the phase begins |

## Definition of Done

- [ ] The built page shows the AC-10 controls for every state; Start focus, Start break and Resume focus/break call unlockSound synchronously and run the pre-start correction exactly once before a fresh start; controlStates and refocusIfStranded are gone with their tests; write-guard.test.js pins the correction call sites to the Start break and Start focus handlers; npm test and npm run lint pass.
- [ ] every Hard Rule inlined above still holds
- [ ] `npm test` and `npm run lint` clean; `npm run build` regenerated
