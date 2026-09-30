---
id: T2
title: "Extend the engine snapshot with phaseFullMs and a one-shot justCompleted for every phase type"
layer: "domain"
deps: []
blocks: ["T3", "T7", "T8"]
acs: ["AC-05", "AC-06b", "AC-07", "AC-08", "AC-10"]
files_hint: ["src/logic/index.js", "test/logic/timer-engine.test.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "M"
context_budget: "M"   # measured: 62 inlined lines
status: "todo"
---

<!-- Inline of upstream text is a snapshot taken at breakdown time; the source named in each signature always wins. Work from what is inlined. If a slice is insufficient, ambiguous, or contradicts the code in front of you, open the named file for the full text and follow that. Do not invent the missing part. -->

# T2 — Extend the engine snapshot with phaseFullMs and a one-shot justCompleted for every phase type

## Place in the sequence

- **Blocked by:** none · **Blocks:** T3 — Add the pure cue rules: tone data, ringFraction and tabTitle; T7 — Build the inline wake-up worker and rework the message-channel source scan; T8 — Render the ring, Tab title mirror and sound-unavailable notice from the snapshot in mount() · **Wave:** 1, no dependencies, can start immediately.
- **Lane:** shares files with T3 via `src/logic/index.js`, T7 via `test/logic/timer-engine.test.js` — serialized by `files_hint` overlap (already ordered by `deps` where needed).

## Why (user story)

> **As a** User
> **I want** a soft chime with a different tone for a Focus end and a break end
> **So that** I know whether to take a break or get back to work without looking
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

Gives the UI the one fact it needs to pick the right tone exactly once: which phase completed and when, plus the pinned length the ring measures against.

## Inlined context

> `getSnapshot(now)` gains `phaseFullMs` (ms, the value `clampRemaining` already bounds by) and `justCompleted` (`{phase: 'focus'|'short_break'|'long_break', at: <true deadline ms>}` or `null`).
> `justCompleted` is latched in `settle()` beside the existing `justCompletedFocusAt` and cleared by the `getSnapshot()` that returns it, the same one-shot rule. Because `start`/`pause`/`reset` also call `settle()`, a completion detected inside a control call survives until the next render.
> `justCompletedFocusAt` is **unchanged**. **No new control method.** The engine's frozen method set stays at six.
>
> — `adr/0002-extend-engine-snapshot-with-phase-length-and-completion-record.md, «Decision outcome → Shape», abridged` · full text: [adr/](../adr/)

> `src/logic/index.js` … `createTimerEngine()` → frozen {start, pause, reset, getSnapshot, setConfiguredDurations, setCycleLength}; snapshot {phase, running, idle, remainingMs, focusCount, justCompletedFocusAt}; private phaseFullMs pinned per phase (not in the snapshot); settle(now) advances at most one boundary and only when now ≥ deadlineAt.
>
> — `sad.md §3, brownfield note (HEAD 61700da), abridged` · full text: [sad.md](../sad.md)

> `test/logic/timer-engine.test.js` pins the snapshot shape; ADR-0002 adds two fields — mechanical amendment in the same PR.
>
> — `sad.md §11, risk row 5, abridged` · full text: [sad.md](../sad.md)

> A wake-up before `deadlineAt` yields `justCompleted === null`.
>
> — `sad.md §10, QG-1 «How verify», abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** `render()` is the single `getSnapshot()` caller in `src/ui/`. Both `justCompletedFocusAt` and `justCompleted` are consumed there, in a fixed order: title → ring → chime/notice → Session counter
>
> — `sad.md §8, «One-shot consumption», verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

— `data-model.md, «No schema change», verbatim` · full text: [data-model.md](../data-model.md)

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-05 — happy path

> **Given** a phase is running
> **When** it reaches a Phase completion
> **Then** a Focus completion plays the Focus-end tone, and a Short break or Long break completion plays the break-end tone — the two tones are distinguishable by construction: they differ in melodic direction (one rising, one falling) or in their number of notes, and neither exceeds the §6 loudness ceiling
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-06b — domain invariant

> **Given** a phase was running and the device slept or locked past the moment that phase would have completed
> **When** the page runs again — as soon as the page's code runs again, whether the tab is visible or still in the background
> **Then** the Completion chime for that phase plays exactly once at that moment, the tab title shows the next phase waiting for Start, and no further chimes follow — the next phase never starts on its own, so it cannot complete unattended; if sound cannot be played at that moment, AC-11 applies and the chime is not held back to play later
>
> — `spec.md §5, AC-06b, verbatim` · full text: [spec.md](../spec.md)

### AC-07 — domain invariant

> **Given** the User is using the timer
> **When** they press Start, Pause, Resume or Reset, or commit a duration or cycle-length change
> **Then** no chime plays — the Completion chime plays only at a Phase completion, and exactly once per completion (never again when the User returns to the tab); a Pause or Reset pressed an instant before zero means that phase does not complete, so its chime never plays
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

### AC-08 — domain invariant

> **Given** a phase is running or paused, and the User commits a new Configured duration for that same phase type
> **When** the phase keeps running, or is resumed
> **Then** the ring keeps measuring against the length that phase started with — it neither jumps nor sticks, and stays in step with the unchanged countdown; after Reset, the full ring corresponds to the new Configured duration
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

### AC-10 — cross-context

> **Given** a Focus phase is running
> **When** it reaches its Phase completion
> **Then** the Focus-end chime plays, and that same completion is credited to the Session counter exactly as session-tracking decides (`docs/features/session-tracking/spec.md` AC-04 and AC-06) — normally today's count goes up by exactly one; a completion whose true moment fell before a midnight that has since passed still chimes but is not carried into the new day's count; a break completion chimes and never changes the Session counter
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `src/logic/index.js`: return `phaseFullMs` (the already-pinned value) from `getSnapshot(now)`.
- [ ] `src/logic/index.js`: latch `justCompleted = {phase, at: deadlineAt}` in `settle()` for every phase type when a running phase reaches its deadline; clear it in the `getSnapshot()` that returns it. Leave `justCompletedFocusAt` and the six control methods untouched.
- [ ] `test/logic/timer-engine.test.js`: amend the pinned snapshot shape to include the two new fields (mechanical).
- [ ] `test/logic/timer-engine.test.js`: new tests for one-shot across completion inside a control call, repeated reads, a late read after sleep, early read (`now < deadlineAt` → `null`), Pause/Reset an instant before zero (no completion), and `phaseFullMs` staying pinned across a mid-phase duration commit and changing after Reset.

## Edge cases

| Case | Behaviour |
|---|---|
| Wake-up or read before `deadlineAt` | `justCompleted` is `null`; phase keeps running. |
| Completion detected inside `start`/`pause`/`reset` | Latched; returned by the next `getSnapshot()` exactly once. |
| Second `getSnapshot()` after a completion | `justCompleted` is `null`. |
| Device slept past the deadline | One completion with `at` = the true deadline, not the read time; next phase idle. |
| Pause or Reset pressed before zero | No completion, `justCompleted` stays `null`. |
| Break completion | Latched with the break phase type; `justCompletedFocusAt` stays unset. |

## Definition of Done

- [ ] Unit tests over `settle()`/`getSnapshot()` pass for every case in the table above.
- [ ] The amended snapshot-shape test passes; `justCompletedFocusAt` behaviour and the six-method surface are unchanged (existing tests green).
- [ ] every Hard Rule inlined above still holds
- [ ] lint clean
