---
id: T14
title: "Review fix F1: isolate the wake-up worker in the AC-06 hidden-tab e2e and correct the timing-check doc"
layer: "tests"
deps: ["T12"]
blocks: ["T13"]
acs: ["AC-06"]
files_hint: ["test-e2e/sensory-feedback-chime.e2e.js", "test-e2e/helpers.js", "docs/features/sensory-feedback/_review/manual-timing-check.md"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
status: "done"
origin: "review-2026-09-30 F1"
---

# T14 — Isolate the wake-up worker in the AC-06 hidden-tab e2e

## Why

Review finding F1 ([review-2026-09-30.md](../_review/review-2026-09-30.md)). The test
"AC-06: hidden tab, real time" (`test-e2e/sensory-feedback-chime.e2e.js:159`) sets
`window.setInterval = () => 0` inside `page.evaluate`, which runs after `mount()` has already
registered `setInterval(render, RENDER_INTERVAL_MS)` (`src/ui/index.js:589`). The 250 ms render loop
keeps running and completes the phase by itself. The reviewer confirmed that the countdown still
advances with `Worker` deleted. So the test does not check the ADR-0001 wake-up path it's named for.

## Acceptance criteria

> **AC-06** — Given a phase is running in a desktop browser (§3), the timer's tab is in the background, and the device stays awake — for any length of time. When the phase reaches its Phase completion. Then the Completion chime is started within 1 second of that moment and never before it — "started" meaning the page has handed the tone to the browser's audio output; how soon the sound is then audible depends on the output device and the browser's audio start-up, which the page does not control — and by the time it starts the tab title already shows the next phase waiting for Start.
>
> — `spec.md §5, AC-06, verbatim`

## Checklist

- [ ] Stop the render loop before the app script runs. Use `context.addInitScript` (or an `openApp` option in `helpers.js`) to make `setInterval` a no-op, or to record the interval ids so the test can clear them.
- [ ] Keep the hidden `visibilityState` override. Keep the "never early" and "≤ 1 s late" bounds.
- [x] Add a negative control: with the same setup and a dead worker (accepts messages, never answers), the phase must NOT complete within the 1 s window. This proves the worker is what completes it. (A deleted `Worker` is not a valid control: the main-thread fallback would then finish the phase.)
- [ ] Correct the "What was verified automatically" section of `_review/manual-timing-check.md` to match.

## Definition of Done

- [ ] The negative control fails without the worker, and the real test passes with it.
- [ ] `npm run test:e2e` passes. `npm test` and `npm run lint` are clean.
