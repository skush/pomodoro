---
id: T2
title: "Extend the engine: startedAt, startFocus(now), setAllowPausingFocus(on) and the focus-pause policy"
layer: "domain"
deps: ["T1"]
blocks: ["T5", "T6", "T7"]
acs: ["AC-01", "AC-02", "AC-03", "AC-04", "AC-04b", "AC-05", "AC-15", "AC-16"]
files_hint: ["src/logic/index.js", "test/logic/timer-engine.test.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "M"
context_budget: "M"
status: "todo"
---

<!-- Inline slices are snapshots taken at breakdown time; the source file named in each signature always wins. To the executing agent: work from what is inlined; if a slice is insufficient, ambiguous or contradicts the code, open the named file for the full text. Do not invent the missing part. -->

# T2 — Extend the engine: startedAt, startFocus(now), setAllowPausingFocus(on) and the focus-pause policy

## Place in the sequence

- **Blocked by:** T1 — Add pure On-time, Skip-guard and stored-toggle rules in src/logic/controls.js · **Blocks:** T5 — Add the Auto-start breaks and Allow pausing focus toggles with a third storage gatekeeper; T6 — Replace Start/Pause/Reset with the phase-labelled slots and route every action to the engine; T7 — Auto-start the break after an On-time Focus completion (backdated start in render) · **Wave:** 2.
- **Lane:** shares `src/logic/index.js`, `test/logic/timer-engine.test.js` with T1, T6 — serialized (ordered by the dependency chain).

## Why (user story)

> **As a** User
> **I want** to end the current break — short or long, running, paused or waiting — and start the next Focus with one press
> **So that** I can get back to work the moment I'm ready
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

Puts the Skip guard and the focus-pause policy inside the engine, so no input path can bypass them.

## Inlined context

> The engine gains two methods: `startFocus(now)` ends a break (running, paused or waiting) and starts the next Focus, and `setAllowPausingFocus(on)` sets whether `pause(now)` may pause a running Focus. The snapshot gains `startedAt` (the moment of the current phase's fresh start, kept across pause/resume) and `allowPausingFocus`. `startFocus` does nothing inside the Skip guard … `pause` does nothing for a running Focus while pausing isn't allowed … A Skipped break adds nothing to and removes nothing from the in-cycle focus count (AC-04b). This grows the engine surface from six methods to eight …
>
> — `sad.md §4, decision 4, abridged` · full text: [sad.md](../sad.md)

> `startFocus(now)` (break-only: ends a running, paused or waiting break and starts the next Focus; no-op inside the Skip guard and in any Focus state; Start focus on a waiting Focus goes through the existing `start(now)`), `setAllowPausingFocus(on)`; `pause(now)` is a no-op for a running Focus while pausing isn't allowed; `start(now)` records `startedAt` on a fresh start (now may be the backdated true Focus end, ADR-0001). `settle()` and `reset()` both clear `startedAt`, so a waiting phase never carries a Skip guard (AC-05). Otherwise `settle()` keeps its rule: one boundary, next phase idle. Snapshot + `startedAt`, + `allowPausingFocus`.
>
> — `sad.md §5, src/logic/index.js, abridged` · full text: [sad.md](../sad.md)

> A paused break keeps its `startedAt`, so a pause can't extend the guard. Resume isn't a fresh start, so it starts no new guard. Reset clears it, and so does a completion (`settle()`), so a waiting break never carries a guard. `startFocus` is break-only; Start focus on a waiting Focus goes through `start`. … After a Skipped Long break, the count is already 0 because it reset when the Long break began.
>
> — `adr/0002, Decision outcome + Consequences, abridged` · full text: [adr/0002-enforce-skip-guard-and-focus-pause-policy-in-the-engine.md](../adr/0002-enforce-skip-guard-and-focus-pause-policy-in-the-engine.md)

> The engine is unchanged at completion (the break loads idle) … Accuracy follows directly from passing the true end: the deadline becomes `at + full length`, so the remaining time is exact.
>
> — `adr/0001, Considered options + Decision outcome, abridged` · full text: [adr/0001-auto-start-breaks-with-a-backdated-start-from-the-ui.md](../adr/0001-auto-start-breaks-with-a-backdated-start-from-the-ui.md)

> `test/logic/timer-engine.test.js` pins the engine surface at six methods ("no new control method", sensory-feedback). This feature **deliberately changes that pin** (§4).
>
> — `sad.md §2, Conventions, verbatim` · full text: [sad.md](../sad.md)

> Every rule is a pure function of wall-clock timestamps passed in as `now`: the deadline, the On-time check (`now − at ≤ 5000 ms`), the Skip guard (`now − startedAt < 3000 ms`, real time, pause doesn't stop it). No tick counting. Tests inject the clock
>
> — `sad.md §8, Time, verbatim` · full text: [sad.md](../sad.md)

> The engine changes only through methods called by `src/ui/` from this page's own controls, toggles and duration/cycle commits, plus the auto-start branch. There is no `message`/`storage` listener and no `BroadcastChannel`.
>
> — `sad.md §8, Input guard, abridged` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-01 (US-01) — happy path

> **Given** Auto-start breaks is on and a Focus phase is running on an awake device with the page open (visible in any supported browser, or in a background tab of desktop Chrome or Edge — the browsers sensory-feedback §3 holds its background timing promise for)
> **When** that Focus phase reaches zero — an On-time completion
> **Then** the Focus-end chime plays once, the completion is credited exactly as before (in-cycle focus count, Session counter), and the correct next break — Short or Long per the cycle — begins counting down by itself from its full length, measured from the Focus phase's true end; its length comes from the current Configured duration, checked and corrected exactly as for any fresh start (adjustable-durations AC-06); the phase name, ring and tab title show that break running. In a background tab of any other browser (e.g. Firefox) no auto-start is promised: the 5 s On-time tolerance (§6) decides, and a completion noticed later is a late completion (AC-03)
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-02 (US-01, US-04) — domain invariant

> **Given** any break is running, whether it auto-started or the User started it
> **When** the break reaches zero
> **Then** the break-end chime plays once and the next Focus phase is shown at its full length, waiting for the User to press Start focus — a Focus phase never starts on its own, with Auto-start breaks on or off, so at most one phase per completion ever starts without the User
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-03 (US-05) — cross-context

> **Given** Auto-start breaks is on and a Focus phase is running when the device sleeps, the screen locks, or the browser freezes or backgrounds the tab so that the Focus end is only noticed later — a late completion
> **When** the User returns to the page, however much time has passed
> **Then** the Focus-end chime plays exactly once, the completion is credited as session-tracking decides, and the correct next break — including a Long break — is shown at its full length, waiting, with Start break and Start focus offered; the break is never counted down or used up while the User was away, and no break-end chime plays
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-04 (US-02) — happy path

> **Given** a Short break or Long break is running, paused, or waiting at full length, and the Skip guard (AC-05) is not active
> **When** the User presses Start focus
> **Then** the break ends at once with no chime, and the next Focus phase starts counting down from the current Configured focus duration — checked and corrected exactly as for any fresh start (adjustable-durations AC-06) — with the phase name, ring and tab title showing Focus running
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-04b (US-02) — domain invariant

> **Given** the User has ended a break early with Start focus — a Skipped break
> **When** the cycle continues
> **Then** the Skipped break itself adds nothing to and removes nothing from the in-cycle focus count or the Session counter (session-tracking's midnight rollover still applies as usual), and it doesn't move the next Long break earlier or later; after a Skipped Long break the cycle continues from its first Focus, as it would after a completed one
>
> — `spec.md §5, AC-04b, verbatim` · full text: [spec.md](../spec.md)

### AC-05 (US-02) — error

> **Given** a break has just started — auto-started after an On-time completion (AC-01), or started by the User with Start break
> **When** the User presses Start focus within 3 seconds of that break's start — the Focus phase's true end for an auto-started break, the Start break press for a User-started one — the Skip guard
> **Then** the press does nothing and the break keeps going; for that time Start focus is shown greyed out in the main position, so the User can see it isn't available yet, and it becomes available on its own when the 3 seconds have passed in real time; pausing the break doesn't extend the guard — a break paused inside it keeps Start focus greyed out until the 3 seconds have passed — and Resume break starts no new guard; Reset break leaves the break waiting, where no guard applies; a break waiting at full length has no Skip guard
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

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

- [ ] Add `startedAt` (null at construction; set by `start()` only on a fresh start; kept by pause/resume; cleared by `reset()` and `settle()`) and `allowPausingFocus` (default `false`) to the engine state and the frozen snapshot — `src/logic/index.js`.
- [ ] Make `pause(now)` a no-op for a running Focus while the policy is off; breaks always pause.
- [ ] Add `setAllowPausingFocus(on)` (coerce to boolean) and `startFocus(now)` (break phases only; no-op when `isSkipGuardActive`; ends the break, loads Focus at the Configured focus duration, running, `startedAt = now`, `focusCount` untouched).
- [ ] Freeze the engine with eight methods; do NOT remove `controlStates` yet (T6 removes it with its last caller).
- [ ] Amend `test/logic/timer-engine.test.js`: surface pin 6 → 8, snapshot-shape pin (+`startedAt`, +`allowPausingFocus`); add tests for backdated `start(at)` accuracy, late completion leaving the break idle, `startFocus` (guard edges 2999/3000 ms, paused-in-guard, waiting break, Skipped Long break), pause policy off/on, one completion record per completion.

## Edge cases

| Case | Behaviour |
|---|---|
| `startFocus` during a Focus phase | No-op (Start focus on a waiting Focus uses `start`) |
| `startFocus` 2999 ms after `startedAt`, break paused meanwhile | No-op; guarded until 3000 ms of real time have passed |
| Resume break (`start` on a paused break) | `startedAt` unchanged — no new guard |
| `startFocus` on a waiting break | Allowed at once — `startedAt` is null, no guard |
| `pause` of a Focus paused before the policy was turned off | Stays paused; resume and reset still work |
| Skipped Long break | `focusCount` already 0; cycle continues from the first Focus |
| `setAllowPausingFocus` with a non-boolean | Coerced to boolean; never throws |

## Definition of Done

- [ ] Engine unit tests (injected clock) pass: startFocus ends a break with no justCompleted and no focusCount change, is a no-op inside the 3 s guard, pause() of a running Focus is a no-op while the policy is off, a backdated start(at) leaves remaining = full − (now − at) within 1 s, and the engine-surface and snapshot-shape pins match the amended eight methods.
- [ ] every Hard Rule inlined above still holds
- [ ] `npm test` and `npm run lint` clean
