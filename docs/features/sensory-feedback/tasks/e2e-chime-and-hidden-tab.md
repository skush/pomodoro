---
id: T12
title: "e2e: exactly-once chime, no chime on controls, hidden-tab timing, sound-unavailable notice, no permission or network"
layer: "tests"
deps: ["T10", "T11"]
blocks: ["T13"]
acs: ["AC-06", "AC-06b", "AC-07", "AC-11", "AC-12"]
files_hint: ["test-e2e/sensory-feedback.e2e.js", "test-e2e/helpers.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "M"
context_budget: "M"   # measured: 55 inlined lines
status: "todo"
---

<!-- Inline of upstream text is a snapshot taken at breakdown time; the source named in each signature always wins. Work from what is inlined. If a slice is insufficient, ambiguous, or contradicts the code in front of you, open the named file for the full text and follow that. Do not invent the missing part. -->

# T12 — e2e: exactly-once chime, no chime on controls, hidden-tab timing, sound-unavailable notice, no permission or network

## Place in the sequence

- **Blocked by:** T10 — Arm the wake-up on Start/Resume and after an early wake; cancel on Pause/Reset; build; T11 — e2e: ring vs countdown, tab title states, 320px layout and reduced motion · **Blocks:** T13 — Run the manual stopwatch check in desktop Chrome and Firefox and record the review checklist · **Wave:** 7, after its dependencies.
- **Lane:** shares files with T1 via `test-e2e/helpers.js`, T11 via `test-e2e/sensory-feedback.e2e.js` — serialized by `files_hint` overlap (already ordered by `deps` where needed).

## Why (user story)

> **As a** User
> **I want** the chime to play on time even while the timer's tab is in the background
> **So that** I can work in another tab and still stop and start on time
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

Proves the background promise as far as automation can: one on-time chime, never before, never on a control, and no prompt or request.

## Inlined context

> Split verification: exactly-once and tone choice under the fake clock; a real-time hidden-page e2e; the manual stopwatch run in desktop Chrome + Firefox that `spec.md` §6 already requires, recorded at `review`. … The fake page clock does not drive the worker (ADR-0001), so the hidden row's timing relies on the real-time e2e + the manual stopwatch run.
>
> — `sad.md §11 row 3 and §10 QG-1, abridged` · full text: [sad.md](../sad.md)

> | Chime timing, hidden tab, awake device | ≤ 1 s after the true Phase completion moment …, never before it, including after ≥ 30 min hidden | e2e with the page hidden + manual stopwatch check … |
> | Chime timing, visible tab | ≤ 250 ms after the true Phase completion moment, never before it | e2e |
>
> — `spec.md §6, rows «Chime timing», abridged` · full text: [spec.md](../spec.md)

> e2e under the fake page clock for "no chime on controls" and "one chime per completion", with the audio adapter observed, not heard.
>
> — `sad.md §10, QG-2 «How verify», abridged` · full text: [sad.md](../sad.md)

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

### AC-07 — domain invariant

> **Given** the User is using the timer
> **When** they press Start, Pause, Resume or Reset, or commit a duration or cycle-length change
> **Then** no chime plays — the Completion chime plays only at a Phase completion, and exactly once per completion (never again when the User returns to the tab); a Pause or Reset pressed an instant before zero means that phase does not complete, so its chime never plays
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

### AC-11 — error

> **Given** sound cannot be played in the User's browser (sound unavailable, blocked, or silently suspended by the browser)
> **When** the User presses Start or Resume, or a phase reaches its Phase completion
> **Then** the phase runs and completes exactly as usual — Session counter, ring and tab title are unaffected and nothing breaks — and the page tells the User in plain language that the completion sound is unavailable, so they know to rely on the ring and the tab title instead; the notice appears as soon as the problem is found at Start or Resume (before the phase runs unattended) or at the completion, and stays until a later Start or Resume finds sound working. A muted operating system or unplugged speakers cannot be seen by the page and are outside this criterion
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

### AC-12 — authorization

> **Given** the User has granted the page no browser permissions
> **When** they use the timer, including in a background tab
> **Then** no permission prompt ever appears (no notifications, no microphone, nothing else); sound is enabled by the User's own press of Start, and nothing is fetched from anywhere
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Under the fake clock: observe the audio adapter (spy on the fake `AudioContext`) — exactly one tone per completion, Focus-end vs break-end, none on Start/Pause/Resume/Reset or a duration commit, none on return to the tab.
- [ ] Sound unavailable (suspended context): notice shown at Start and at completion, no late chime.
- [ ] Real-time run with the page hidden: chime ≤ 1 s after the true completion moment and never before it.
- [ ] Extend the zero-network/no-permission check (blob: excluded per T1).

## Edge cases

| Case | Behaviour |
|---|---|
| Pause or Reset an instant before zero | No chime. |
| Return to the tab after a completion | No second chime. |
| Suspended context | Notice, no chime, no delayed chime. |
| Hidden page, real time | ≤ 1 s late, never early. |

## Definition of Done

- [ ] `npm run test:e2e` passes.
- [ ] Fake-clock cases and the real-time hidden case are separate tests.
