## Summary

Adds sensory feedback to the timer: a progress ring with a colour per phase, a tab-title countdown in whole minutes, and a completion chime that also fires from a background tab (via an inline wake-up worker). Closes roadmap step 5. See [spec](docs/features/sensory-feedback/spec.md).

## Acceptance criteria

- AC-01 — ring is full at start, shrinks with the countdown, empty at completion ✓
- AC-02 — ring frozen on pause, full after Reset or a newly loaded phase ✓
- AC-03 — ring colour per phase type, phase name still shown as text ✓
- AC-04 — tab title in whole minutes for running / paused / ready ✓
- AC-05 — distinct Focus-end (rising) and break-end (falling) tones ✓
- AC-06 — hidden tab: chime started within 1 s, never early, title already on the next phase ✓ (real-Chrome runs recorded, see Verification)
- AC-06b — after sleep the chime plays once when the page runs again ✓
- AC-07 — no chime from Start / Pause / Resume / Reset / settings; exactly once per completion ✓
- AC-08 — ring measures against the length the phase started with ✓
- AC-09 — a new duration commit refreshes the ring and the title immediately ✓
- AC-10 — chime and Session counter credited together, midnight and break cases ✓
- AC-11 — plain-language notice when sound is unavailable; nothing else breaks ✓
- AC-12 — no permission prompt, nothing fetched ✓
- AC-13 — usable down to 320 px, reduced motion respected ✓

## Design

- Spec: `docs/features/sensory-feedback/spec.md`
- Architecture: `docs/features/sensory-feedback/sad.md`
- Decisions: `docs/features/sensory-feedback/adr/` (0001 inline wake-up worker, 0002 engine snapshot extension)
- Data model: `docs/features/sensory-feedback/data-model.md` (no new stored values, no migration)
- Review: `docs/features/sensory-feedback/_review/review-2026-09-30.md` (PASS after fixes R1–R4)

## Tasks (SDD-Task trailers)

24 commits on `feature/sensory-feedback` since `master` (`git log --oneline master..HEAD`): engine snapshot, pure cue rules, ring, audio adapter, wake-up worker, wiring, e2e suites, review fixes.

## Verification

- Unit: `npm test` — 226 pass, 0 fail
- e2e: `npm run test:e2e` — 46 pass, 0 fail (real Chromium, including the hidden-tab real-time run and a dead-worker control)
- Lint: `npm run lint` — clean
- Build: `npm run build` leaves `index.html` unchanged (no drift)
- Ran the feature: manual desktop Chrome 154.0.8037.92, tab hidden, recorded in `_review/manual-timing-check.md`:
  - 1 min — tone scheduled +37 ms after the deadline, audible ≈ 1 s by ear.
  - 30 min — audible under 0.25 s by ear, title already on the next phase.
- Not verified: Firefox (out of scope, roadmap step 6), device sleep on real hardware (covered by the e2e jump only).

## Operational notes

- Migration: none.
- Feature flag / config: none.
- Rollback: revert the merge; nothing persisted.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01YCFcxBCHuigbwZuEq5z2nq
