## Summary

Adds user-adjustable Focus / Short break / Long break durations (1–180 min) and a configurable cycle length (2–8), persisted in `localStorage`, with running/paused phases left untouched by a change. See [spec](docs/features/adjustable-durations/spec.md).

## Acceptance criteria

- AC-01/02 — valid duration commit saved and used at next fresh start; invalid commit reverts with a range message ✓
- AC-03/04/04b/05 — idle updates immediately; running/paused phases unchanged; Reset shows the current configured value ✓
- AC-06/12 — corrupted or out-of-range stored values fall back to defaults and are written back; no instant completion ✓
- AC-07/13 — commits never alter cycle position or daily count; a new cycle length shapes the next Long-break decision ✓
- AC-08 — foreign writes ignored as triggers, overwritten by the next legitimate write ✓
- AC-09/10/11/14 — values pre-filled after reload; cycle-length commit/reject ✓

## Design

- Spec: `docs/features/adjustable-durations/spec.md`
- Architecture: `docs/features/adjustable-durations/sad.md`
- Decisions: `docs/features/adjustable-durations/adr/` (0001, 0002)
- Changelog: `docs/features/adjustable-durations/CHANGELOG.md`
- Review: `docs/features/adjustable-durations/_review/review-2026-09-29.md` (PASS after 3 rounds)

## Tasks (SDD-Task trailers)

T1–T11 — `git log --grep SDD-Task master..HEAD`

## Verification

- Unit: `npm test` 137/137 pass
- Lint: `npm run lint` clean; `npm run build` reproduces the committed `index.html` exactly
- Ran the feature: `npm run test:e2e` 21/21 pass against the built page in headless Chromium (AC-01…AC-14, persistence across full browser close/reopen, zero extra network requests)

## Operational notes

- Migration: none.
- Feature flag / config: none. Rollback: revert the merge.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01WkG1dRKNThcDQEwiYZXLaw
