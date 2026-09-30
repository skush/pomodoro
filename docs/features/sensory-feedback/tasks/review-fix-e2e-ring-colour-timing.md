---
id: T16
title: "Review fixes F3, F4, F6: e2e for ring at completion, visible-tab chime within 250 ms, rendered ring colour per phase"
layer: "tests"
deps: ["T12"]
blocks: []
acs: ["AC-01", "AC-03", "AC-05"]
files_hint: ["test-e2e/sensory-feedback.e2e.js", "test-e2e/sensory-feedback-chime.e2e.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
status: "todo"
origin: "review-2026-09-30 F3, F4, F6"
---

# T16 — e2e: ring at completion, visible-tab chime timing, rendered ring colour

## Why

These are review findings F3, F4 and F6 ([review-2026-09-30.md](../_review/review-2026-09-30.md)).

- **F3 (AC-01):** the test at `test-e2e/sensory-feedback.e2e.js:43` is named for "ring empty at completion", but only checks that the next phase starts full. `ringFraction` (`src/logic/feedback.js:54`) rounds up, so the last frame shows 1 s of the ring left. The user chose to assert this against the §6 "within 1 s" tolerance, not to change the rendering.
- **F4 (§6):** "Chime timing, visible tab: ≤ 250 ms" is never asserted. The audio spy records `tones[].at`, but the fake-clock tests only count notes.
- **F6 (AC-03):** ring colour is only checked through tokens and the `data-phase` attribute, and Long break never renders in any e2e test.

## Checklist

- [ ] F3: just before the deadline, assert that the ring fraction is ≤ 1 s of the phase length, then that the next phase starts full. Rename the test to match.
- [ ] F4: in a fake-clock Focus completion on a visible tab, assert `tones[0].at >= deadline` and `tones[0].at - deadline <= 250`.
- [ ] F6: read the computed `stroke` of `.ring-arc` for Focus, Short break and Long break. Reach Long break with cycle length 2 (the minimum). Assert the three values are pairwise different.

## Definition of Done

- [ ] `npm run test:e2e` passes. `npm run lint` is clean.
