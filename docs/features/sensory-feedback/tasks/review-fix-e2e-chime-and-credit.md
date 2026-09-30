---
id: T17
title: "Review fix F7: e2e for the chime and the Session counter credit on the same completion"
layer: "tests"
deps: ["T12"]
blocks: []
acs: ["AC-10"]
files_hint: ["test-e2e/sensory-feedback-chime.e2e.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
status: "todo"
origin: "review-2026-09-30 F7"
---

# T17 — e2e: chime and Session counter credit on the same completion

## Why

Review finding F7 ([review-2026-09-30.md](../_review/review-2026-09-30.md)). No UI-level test
asserts AC-10's combined outcome: the chime AND the session-tracking credit, on the same completion.

## Acceptance criteria

> **AC-10** — … the Focus-end chime plays, and that same completion is credited to the Session counter exactly as session-tracking decides (`docs/features/session-tracking/spec.md` AC-04 and AC-06) — normally today's count goes up by exactly one; a completion whose true moment fell before a midnight that has since passed still chimes but is not carried into the new day's count; a break completion chimes and never changes the Session counter
>
> — `spec.md §5, AC-10, abridged`

## Checklist

- [ ] A Focus completion gives exactly one Focus-end chime, and the counter reads `…: 1`.
- [ ] A Focus that starts before midnight, with the clock jumped past the next midnight before the page looks, gives one chime and no credit to the new day.
- [ ] A break completion gives one break-end chime, and the counter is unchanged.

## Definition of Done

- [ ] `npm run test:e2e` passes.
