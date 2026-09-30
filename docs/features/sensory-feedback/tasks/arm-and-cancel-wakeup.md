---
id: T10
title: "Arm the wake-up on Start/Resume and after an early wake; cancel on Pause/Reset; build"
layer: "wiring"
deps: ["T7", "T9"]
blocks: ["T12"]
acs: ["AC-06", "AC-06b"]
files_hint: ["src/ui/index.js", "index.html"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
context_budget: "M"   # measured: 42 inlined lines
status: "todo"
---

<!-- Inline of upstream text is a snapshot taken at breakdown time; the source named in each signature always wins. Work from what is inlined. If a slice is insufficient, ambiguous, or contradicts the code in front of you, open the named file for the full text and follow that. Do not invent the missing part. -->

# T10 — Arm the wake-up on Start/Resume and after an early wake; cancel on Pause/Reset; build

## Place in the sequence

- **Blocked by:** T7 — Build the inline wake-up worker and rework the message-channel source scan; T9 — Play the chime or show the notice at completion; unlock sound in Start/Resume · **Blocks:** T12 — e2e: exactly-once chime, no chime on controls, hidden-tab timing, sound-unavailable notice, no permission or network · **Wave:** 6, after its dependencies.
- **Lane:** shares files with T8 via `src/ui/index.js`, T9 via `src/ui/index.js` — serialized by `files_hint` overlap (already ordered by `deps` where needed).

## Why (user story)

> **As a** User
> **I want** the chime to play on time even while the timer's tab is in the background
> **So that** I can work in another tab and still stop and start on time
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

Connects the worker to the timer so a hidden tab is woken at the deadline, and covers the after-sleep path through the same render.

## Inlined context

> Flow 1 — worker wake at the deadline: `getSnapshot(now)`; if now is still before the deadline (early wake): still running, `justCompleted` null, arm again for the remaining time; else the completion path. Flow 3 — after a sleep, lock or frozen tab: whichever wake source runs first (overdue worker timeout, render tick, visibilitychange) settles once; one chime or one notice; a second wake source finds `justCompleted` null.
>
> — `sad.md §6, «Critical flow 1» and «Critical flow 3», abridged` · full text: [sad.md](../sad.md)

> Start/Resume unlock sound and arm the wake-up; Pause/Reset cancel it. `arm` is called after Start/Resume with `delayMs = snapshot.remainingMs`.
>
> — `sad.md §5 (src/ui/index.js) + adr/0001 «Shape», abridged` · full text: [adr/](../adr/)

> `index.html` at the repo root is **generated**, not hand-edited. Run `npm run build` after any change under `src/`, and commit the regenerated `index.html` alongside the source change — the two must never drift.
>
> — `CLAUDE.md, «The build-then-commit workflow», abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

> **Hard rule:** The engine still changes only through its six control methods, called only from User-driven handlers in `src/ui/`. The one message channel in `src/` is the private page↔worker channel in `src/ui/wakeup.js`. Its handler sits on the page's own `Worker` object, never on `window`, and may only call `onWake` (= `render()`, a read), never a control method.
>
> — `sad.md §8, «Input guard», abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** Every cue derives from the engine's wall-clock deadline. The render loop and the worker only decide *when to look*, never *whether a phase completed*
>
> — `sad.md §8, «Timing source», verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

— `data-model.md, «No schema change», verbatim` · full text: [data-model.md](../data-model.md)

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-06 — happy path

> **Given** a phase is running in a desktop browser (§3), the timer's tab is in the background, and the device stays awake — for any length of time
> **When** the phase reaches its Phase completion
> **Then** the Completion chime plays within 1 second of that moment and never before it, and by the time it starts the tab title already shows the next phase waiting for Start
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-06b — domain invariant

> **Given** a phase was running and the device slept or locked past the moment that phase would have completed
> **When** the page runs again — as soon as the page's code runs again, whether the tab is visible or still in the background
> **Then** the Completion chime for that phase plays exactly once at that moment, the tab title shows the next phase waiting for Start, and no further chimes follow — the next phase never starts on its own, so it cannot complete unattended; if sound cannot be played at that moment, AC-11 applies and the chime is not held back to play later
>
> — `spec.md §5, AC-06b, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `src/ui/index.js`: create one `createWakeup(render)`; after Start/Resume call `arm(snapshot.remainingMs)` using the last rendered snapshot (no second `getSnapshot()` call), on Pause/Reset call `cancel()`.
- [ ] In the render path: when the phase is still running and the wake arrived early, re-arm for `remainingMs`.
- [ ] Confirm `visibilitychange` and the 250 ms tick still trigger the same render (after-sleep path).
- [ ] `npm run build`; commit the regenerated `index.html` with the source.

## Edge cases

| Case | Behaviour |
|---|---|
| Early or stale wake-up | Only runs `render()`; re-arms for the remainder; nothing completes early. |
| Pause/Reset then a wake in flight | Render only; not running, no completion, no chime. |
| Device slept past the deadline | First wake source that runs settles once: one chime (late) or one notice, next phase idle, nothing further. |
| Worker unavailable | Main-thread fallback; still one chime, possibly late while hidden. |

## Definition of Done

- [ ] `npm run build` succeeds and the committed `index.html` matches `src/`.
- [ ] Existing tests and e2e green; the T12 real-time hidden-page e2e passes.
- [ ] every Hard Rule inlined above still holds
- [ ] lint clean
