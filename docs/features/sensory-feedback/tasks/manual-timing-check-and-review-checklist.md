---
id: T13
title: "Run the manual stopwatch check in desktop Chrome and Firefox and record the review checklist"
layer: "docs"
deps: ["T12"]
blocks: []
acs: ["AC-06"]
files_hint: ["docs/features/sensory-feedback/_review/manual-timing-check.md"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
context_budget: "S"   # measured: 27 inlined lines
status: "todo"
---

<!-- Inline of upstream text is a snapshot taken at breakdown time; the source named in each signature always wins. Work from what is inlined. If a slice is insufficient, ambiguous, or contradicts the code in front of you, open the named file for the full text and follow that. Do not invent the missing part. -->

# T13 — Run the manual stopwatch check in desktop Chrome and Firefox and record the review checklist

## Place in the sequence

- **Blocked by:** T12 — e2e: exactly-once chime, no chime on controls, hidden-tab timing, sound-unavailable notice, no permission or network · **Blocks:** none · **Wave:** 8, after its dependencies.
- **Lane:** own lane.

## Why (user story)

> **As a** User
> **I want** the chime to play on time even while the timer's tab is in the background
> **So that** I can work in another tab and still stop and start on time
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

Confirms with a real stopwatch, on the two target browsers, that a hidden-tab chime lands within 1 s of the phase end.

## Inlined context

> | Chime timing, hidden tab, awake device | ≤ 1 s after the true Phase completion moment …, never before it, including after ≥ 30 min hidden | e2e with the page hidden + manual stopwatch check in desktop Chrome and desktop Firefox (current stable) |
>
> — `spec.md §6, row «Chime timing, hidden tab», verbatim` · full text: [spec.md](../spec.md)

> The `review` checklist item is "render() is the only getSnapshot caller"; a source-scan unit test like `write-guard.test.js` is optional. `review` checks that the worker handler calls only `onWake`.
>
> — `sad.md §11, rows 6 and 8, abridged` · full text: [sad.md](../sad.md)

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

- [ ] Open the built `index.html` from `file://` in desktop Chrome and Firefox, run a short Focus with the tab hidden (repeat once with ≥ 30 min hidden if practical), record the delay between the true end and the chime.
- [ ] Record results, browser versions and date in `_review/manual-timing-check.md`.
- [ ] List the review checklist items: `render()` is the only `getSnapshot()` caller; the worker handler calls only `onWake`; the scan carve-out is limited to `src/ui/wakeup.js`.

## Edge cases

| Case | Behaviour |
|---|---|
| Delay above 1 s or chime early | Recorded as a failure and raised before `ship`. |
| Browser policy change throttles worker timers | Recorded; mitigation in `sad.md` §11. |

## Definition of Done

- [ ] `_review/manual-timing-check.md` exists with both browsers' results.
- [ ] Review checklist items written down.
