---
id: T7
title: "Build the inline wake-up worker and rework the message-channel source scan"
layer: "ui"
deps: ["T1", "T2"]
blocks: ["T10"]
acs: ["AC-06"]
files_hint: ["src/ui/wakeup.js", "test/logic/timer-engine.test.js", "docs/features/core-timer/adr/0002-structural-encapsulation-control-guard.md"]
owner: "sergii.kushnir@gmail.com"
estimate: "M"
context_budget: "S"   # measured: 36 inlined lines
status: "todo"
---

<!-- Inline of upstream text is a snapshot taken at breakdown time; the source named in each signature always wins. Work from what is inlined. If a slice is insufficient, ambiguous, or contradicts the code in front of you, open the named file for the full text and follow that. Do not invent the missing part. -->

# T7 — Build the inline wake-up worker and rework the message-channel source scan

## Place in the sequence

- **Blocked by:** T1 — Spike: confirm an inline Blob worker starts from file:// in Chrome, and that the zero-network check ignores blob: URLs; T2 — Extend the engine snapshot with phaseFullMs and a one-shot justCompleted for every phase type · **Blocks:** T10 — Arm the wake-up on Start/Resume and after an early wake; cancel on Pause/Reset; build · **Wave:** 2, after its dependencies.
- **Lane:** shares files with T2 via `test/logic/timer-engine.test.js` — serialized by `files_hint` overlap (already ordered by `deps` where needed).

## Why (user story)

> **As a** User
> **I want** the chime to play on time even while the timer's tab is in the background
> **So that** I can work in another tab and still stop and start on time
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

Provides the page-waking nudge that lets a hidden tab still chime within 1 s of the true completion moment.

## Inlined context

> `wakeup.js` <NEW: createWakeup(onWake) → {arm(delayMs), cancel()}, one inline Blob worker per page, URL revoked after creation, main-thread setTimeout fallback (ADR-0001).>
>
> — `sad.md §5, «src/ui/wakeup.js», verbatim` · full text: [sad.md](../sad.md)

> `arm` is called after Start/Resume with `delayMs = snapshot.remainingMs`. It is also called after a wake-up that arrived before the deadline, for the remainder. `cancel` is called on Pause and Reset. `onWake` is `render`, and nothing else. The worker never calls an engine method and never touches the DOM or storage.
>
> — `adr/0001, «Decision outcome → Shape», abridged` · full text: [adr/](../adr/)

> **Allowed:** exactly one channel, between the page and the `Worker` object it creates itself. It lives in `src/ui/wakeup.js` only. The page-side handler is attached to that `Worker` instance, never to `window` or any global … **Still forbidden everywhere:** `window`/global `message` listeners, `storage` listeners, and `BroadcastChannel`. … **Enforcement:** the AC-03 scan is reworked, not deleted. `postMessage(` / `onmessage` are permitted in `src/ui/wakeup.js` only. … A pointer amendment is added to that ADR.
>
> — `adr/0001, «Amends core-timer ADR-0002», abridged` · full text: [adr/](../adr/)

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

## Checklist

- [ ] `src/ui/wakeup.js`: `createWakeup(onWake)` → `{arm(delayMs), cancel()}`; one worker created from an in-bundle Blob source, URL revoked right after `new Worker(...)`; handler attached to the `Worker` instance and calling only `onWake`.
- [ ] Fallback: if construction throws, use a main-thread `setTimeout` with the same `arm`/`cancel` (fail-soft).
- [ ] `test/logic/timer-engine.test.js`: rework the core-timer AC-03 source scan so `postMessage(` / `onmessage` are allowed in `src/ui/wakeup.js` only, while `window` `message`/`storage` listeners and `BroadcastChannel` stay forbidden in every file.
- [ ] `docs/features/core-timer/adr/0002-structural-encapsulation-control-guard.md`: add the pointer amendment to this feature's ADR-0001.
- [ ] Test `arm`/`cancel` with the fallback path and a fake worker: a cancelled arm never calls `onWake`; re-arming replaces the pending one.

## Edge cases

| Case | Behaviour |
|---|---|
| Worker cannot be constructed | Main-thread `setTimeout` fallback; chime still plays, possibly late in a hidden tab, silently (decision override in `sad.md` §1). |
| Wake arrives before the deadline | `onWake` runs `render()`, which re-arms for the remainder; nothing completes. |
| Wake in flight after Pause/Reset | Only runs a render; not running, so nothing completes and no chime plays. |
| `arm` called twice | Only the latest wake-up is pending. |
| A `message` listener on `window` anywhere in `src/` | The reworked scan fails the build. |

## Definition of Done

- [ ] Fallback and worker paths both covered by tests; cancelled arm never fires.
- [ ] The reworked AC-03 scan passes with `wakeup.js` allowed and fails on a `window` message listener or `BroadcastChannel` elsewhere.
- [ ] Pointer amendment added to core-timer ADR-0002.
- [ ] every Hard Rule inlined above still holds
- [ ] lint clean
