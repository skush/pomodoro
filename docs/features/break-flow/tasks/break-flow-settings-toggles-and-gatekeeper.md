---
id: T5
title: "Add the Auto-start breaks and Allow pausing focus toggles with a third storage gatekeeper"
layer: "ui"
deps: ["T1", "T2"]
blocks: ["T6", "T7"]
acs: ["AC-07", "AC-09", "AC-12", "AC-17"]
files_hint: ["src/ui/index.js", "src/styles.css", "test/logic/write-guard.test.js", "test/logic/break-flow-settings.test.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "M"
context_budget: "M"
status: "todo"
---

<!-- Inline slices are snapshots taken at breakdown time; the source file named in each signature always wins. To the executing agent: work from what is inlined; if a slice is insufficient, ambiguous or contradicts the code, open the named file for the full text. Do not invent the missing part. -->

# T5 — Add the Auto-start breaks and Allow pausing focus toggles with a third storage gatekeeper

## Place in the sequence

- **Blocked by:** T1 — Add pure On-time, Skip-guard and stored-toggle rules in src/logic/controls.js; T2 — Extend the engine: startedAt, startFocus(now), setAllowPausingFocus(on) and the focus-pause policy · **Blocks:** T6 — Replace Start/Pause/Reset with the phase-labelled slots and route every action to the engine; T7 — Auto-start the break after an On-time Focus completion (backdated start in render) · **Wave:** 3.
- **Lane:** shares `src/ui/index.js`, `src/styles.css`, `test/logic/write-guard.test.js` with T6, T7 — serialized (ordered by the dependency chain).

## Why (user story)

> **As a** User
> **I want** to turn Auto-start breaks on or off, and have that choice remembered
> **So that** I can go back to breaks that wait for me when that suits my day better
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

Gives the User the two remembered, fail-soft settings and keeps the engine's pause policy in sync with the toggle.

## Inlined context

> Auto-start breaks lives in `src/ui/` memory, because only the UI's auto-start branch reads it. Allow pausing focus is pushed into the engine with `setAllowPausingFocus` at mount and on every toggle, and that's the only place it lives (decision 4). Both are read from local storage only at mount (AC-12: another tab's saved values apply at the next load), through a new `persistBreakFlowSettings` / `readPersistedBreakFlowSettings` pair shaped like the two existing gatekeepers.
>
> — `sad.md §4, decision 7, verbatim` · full text: [sad.md](../sad.md)

> A third gatekeeper, `persistBreakFlowSettings(storage, {autoStartBreaks, allowPausingFocus})`, is the only writer of `break-flow:auto-start-breaks` and `break-flow:allow-pausing-focus` and always writes both, as `'true'`/`'false'`. `readPersistedBreakFlowSettings(storage)` validates each key on its own through `validateStoredToggle(raw, fallback)` and does no write-back; the next toggle writes the full pair. `write-guard.test.js` is extended to allow it.
>
> — `sad.md §8, Persistence, abridged` · full text: [sad.md](../sad.md)

> Two labelled checkbox toggles, Auto-start breaks and Allow pausing focus, placed next to the duration settings in the same settings area (SCR-07). A toggle applies immediately and never alters a phase already running, paused or waiting.
>
> — `sad.md §8, Settings UI, abridged` · full text: [sad.md](../sad.md)

> Fail-soft. Unreadable, missing or invalid saved value → that setting's default (Auto-start breaks on, Allow pausing focus off). A refused write is swallowed, and the in-memory value applies for the rest of the page load. No error is ever shown (AC-09).
>
> — `sad.md §8, Error handling, abridged` · full text: [sad.md](../sad.md)

> The engine changes only through methods called by `src/ui/` from this page's own controls, toggles and duration/cycle commits, plus the auto-start branch. There is no `message`/`storage` listener and no `BroadcastChannel`.
>
> — `sad.md §8, Input guard, abridged` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

| Key (localStorage) | Value | Constraints | Change |
|---|---|---|---|
| `break-flow:auto-start-breaks` | `'true'`/`'false'` | scalar; invalid/missing → default on | added |
| `break-flow:allow-pausing-focus` | `'true'`/`'false'` | scalar; invalid/missing → default off | added |

— `sad.md §8, Persistence + §4 decision 7, abridged` · full text: [sad.md](../sad.md)

No DB changes (no datastore; two scalar keys only).

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-07 (US-04) — happy path

> **Given** the User opens the settings
> **When** they look for, then change, Auto-start breaks
> **Then** the setting is shown next to the duration settings, is on the first time the app is used, keeps the User's choice across reloads, and takes effect at the next Focus completion — a Focus phase already running follows whatever the setting is at the moment it ends; changing the setting never alters a phase already running, paused or waiting
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

### AC-09 (US-04, US-07) — error

> **Given** the saved value of Auto-start breaks or Allow pausing focus is missing, unreadable or not a valid on/off value, or the browser refuses to save it
> **When** the page loads, or the User changes the setting
> **Then** the page treats that setting as its default — Auto-start breaks on, Allow pausing focus off — when nothing valid can be read, and a change the browser couldn't save still applies for the rest of this page load; the page never shows an error or stops working because of it
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

### AC-12 (US-01, US-02, US-03, US-04, US-07) — authorization

> **Given** a User's page is open
> **When** an input arrives that did not come from that page's own controls, its own two settings, or its own duration and cycle-length commits — for example a message from another tab, or another tab saving different setting values
> **Then** the page ignores it: the timer and the settings in use change only in direct response to this page's own inputs (core-timer AC-03's guard, extended to the new controls and settings); values of Auto-start breaks and Allow pausing focus that another tab saved are picked up only on this page's next load, while saved Configured durations and cycle length keep the read points adjustable-durations already set — page load, and before each fresh start, which now includes a break that auto-starts and a Focus started with Start focus
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-17 (US-07) — domain invariant

> **Given** the User changes Allow pausing focus
> **When** a Focus phase is running, paused or waiting at that moment
> **Then** the setting is shown next to Auto-start breaks, is off the first time the app is used, keeps the User's choice across reloads, and applies from the next control state it affects without ever altering a phase already in progress — a Focus phase paused before the setting was turned off stays paused and can still be resumed or reset; a Focus phase running when the setting is turned on immediately offers Pause focus, and a Focus phase running when it is turned off loses Pause focus at once and keeps running (keyboard focus moves as in AC-11)
>
> — `spec.md §5, AC-17, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] In `src/ui/index.js` add exported `persistBreakFlowSettings(storage, settings)` (writes both keys, swallows write errors, returns success) and `readPersistedBreakFlowSettings(storage)` (per-key `validateStoredToggle`, reuse `safeGetItem`, no write-back).
- [ ] In `mount()` read the settings once, call `engine.setAllowPausingFocus(allowPausingFocus)`, and hold `autoStartBreaks` in memory.
- [ ] Add two labelled checkboxes next to the durations group; on change apply to memory + engine, persist the full pair, `render()`. Never alter a phase in progress.
- [ ] Add toggle styling in `src/styles.css` (existing tokens, dark-mode only).
- [ ] Extend `test/logic/write-guard.test.js` to allow the third gatekeeper for the two keys; add `test/logic/break-flow-settings.test.js` (fake + throwing storage, per-key fallback, full-pair write).

## Edge cases

| Case | Behaviour |
|---|---|
| Stored value missing / `'maybe'` / storage getter throws | That setting's default (auto-start on, pausing off); no error shown |
| Browser refuses the write | New value still applies for this page load |
| Another tab saved different values | Ignored until this page reloads (no storage listener) |
| Toggle Allow pausing focus off while Focus is paused | Phase stays paused; resumable and resettable |
| Toggle Auto-start breaks while Focus runs | Phase unchanged; the value at the Focus end decides |

## Definition of Done

- [ ] Unit tests with a fake and a throwing storage pass: persistBreakFlowSettings always writes both keys as 'true'/'false', readPersistedBreakFlowSettings falls back per key without writing back, and write-guard.test.js allows only that gatekeeper to write the two keys; the built page shows both toggles next to the durations, pushes allowPausingFocus to the engine at mount and on every toggle, and defaults to on/off.
- [ ] every Hard Rule inlined above still holds
- [ ] `npm test` and `npm run lint` clean; `npm run build` regenerated
