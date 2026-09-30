---
id: T11
title: "e2e: ring vs countdown, tab title states, 320px layout and reduced motion"
layer: "tests"
deps: ["T8"]
blocks: ["T12"]
acs: ["AC-13", "AC-04", "AC-08"]
files_hint: ["test-e2e/sensory-feedback.e2e.js", "package.json"]
owner: "sergii.kushnir@gmail.com"
estimate: "M"
context_budget: "M"   # measured: 44 inlined lines
status: "todo"
---

<!-- Inline of upstream text is a snapshot taken at breakdown time; the source named in each signature always wins. Work from what is inlined. If a slice is insufficient, ambiguous, or contradicts the code in front of you, open the named file for the full text and follow that. Do not invent the missing part. -->

# T11 — e2e: ring vs countdown, tab title states, 320px layout and reduced motion

## Place in the sequence

- **Blocked by:** T8 — Render the ring, Tab title mirror and sound-unavailable notice from the snapshot in mount() · **Blocks:** T12 — e2e: exactly-once chime, no chime on controls, hidden-tab timing, sound-unavailable notice, no permission or network · **Wave:** 5, after its dependencies.
- **Lane:** shares files with T12 via `test-e2e/sensory-feedback.e2e.js` — serialized by `files_hint` overlap (already ordered by `deps` where needed).

## Why (user story)

> **As a** User
> **I want** the whole page to share one readable dark palette and fit a phone-width screen
> **So that** the timer is comfortable to read in any lighting and on any device
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

Proves the visual cues agree with the countdown and that the page fits 320 px and honours reduced motion.

## Inlined context

> e2e viewport check at 320 CSS px. e2e with reduced motion emulated. e2e sample of the rendered ring against the on-page countdown ("unit + e2e sample").
>
> — `sad.md §10, QG-3 «How verify», abridged` · full text: [sad.md](../sad.md)

> test-e2e/: playwright-core harness with a fake page clock, and an existing zero-network-request check (durations.e2e.js:226).
>
> — `sad.md §3, brownfield note, verbatim` · full text: [sad.md](../sad.md)

> | Phone width | 0 px horizontal overflow at 320 CSS px, with a three-digit countdown and every notice or validation message shown | e2e viewport check |
> | Reduced motion | … 0 animated ring transitions … the ring changes at most once per second, in discrete steps | e2e with the reduced-motion preference emulated |
> | Tab title freshness | visible tab: shows the on-page countdown's whole minute (rounded up) within 1 s … | e2e |
>
> — `spec.md §6, rows «Phone width», «Reduced motion», «Tab title freshness», abridged` · full text: [spec.md](../spec.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

— `data-model.md, «No schema change», verbatim` · full text: [data-model.md](../data-model.md)

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-13 — happy path

> **Given** the page is shown on a phone-width screen, down to 320 CSS pixels wide
> **When** the User views any timer state, including a three-digit countdown
> **Then** every visible element of the page — the ring, countdown, phase name, controls, settings fields, Session counter, Task label, any validation message and the sound-unavailable notice (AC-11) — is visible and usable without horizontal scrolling or overlapping
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

### AC-04 — happy path

> **Given** the timer is in any state
> **When** the User looks at the browser's tab strip
> **Then** the tab title shows the remaining time as whole minutes, rounded up (so it never shows zero minutes while time is left), together with the phase name, and distinguishes the three states: running shows the minutes and phase; paused is marked as paused with the frozen minutes; waiting for Start is marked as ready with the minutes the phase will run for — the one tolerance: while the tab is hidden, a running phase's minutes may trail the countdown by up to a minute between completions, but are always correct at a Phase completion (§6 Tab title freshness)
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-08 — domain invariant

> **Given** a phase is running or paused, and the User commits a new Configured duration for that same phase type
> **When** the phase keeps running, or is resumed
> **Then** the ring keeps measuring against the length that phase started with — it neither jumps nor sticks, and stays in step with the unchanged countdown; after Reset, the full ring corresponds to the new Configured duration
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `test-e2e/sensory-feedback.e2e.js`: with the fake page clock, sample the ring fraction against the on-page countdown at several ticks; check the three title states (running, paused, ready); check a mid-phase duration commit keeps the ring in step.
- [ ] Viewport 320 CSS px with a three-digit countdown and the validation message and sound-unavailable notice shown: assert `scrollWidth <= clientWidth` and no overlap.
- [ ] Emulate `prefers-reduced-motion: reduce` and assert no ring transition and at most one change per second.
- [ ] `package.json`: add the new file to the `test:e2e` script.

## Edge cases

| Case | Behaviour |
|---|---|
| Invalid duration message and notice visible at 320 px | No horizontal overflow, no overlap. |
| Reduced motion | Computed ring transition is none; steps at most once per second. |
| Mid-phase duration commit | Ring stays in step with the unchanged countdown. |

## Definition of Done

- [ ] `npm run test:e2e` passes with the new file.
- [ ] Every assertion above is present and would fail if the feature were removed.
