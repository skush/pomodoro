## Summary

- The next break auto-starts after an On-time Focus completion (Auto-start breaks, on by default); a late completion leaves it waiting at full length.
- **Start focus** during any break ends it and starts Focus; a 3 s Skip guard absorbs reflex presses.
- **Allow pausing focus** (off by default) makes Focus indivisible; all controls are phase-labelled and laid out in three fixed slots with a keyboard-focus rule.

## Acceptance criteria

AC-01 … AC-17 and AC-04b of [spec.md](docs/features/break-flow/spec.md); each is traced to a task, code and a test in the review record.

## Links

[spec](docs/features/break-flow/spec.md) · [sad](docs/features/break-flow/sad.md) · [ADRs](docs/features/break-flow/adr/) · [changelog](docs/features/break-flow/CHANGELOG.md) · [review (round 6, PASS)](docs/features/break-flow/_review/review-2026-10-01.md) · [manual timing check](docs/features/break-flow/_review/manual-timing-check.md)

## Verification

- `npm test` 335/335, `npm run lint` clean, `npm run test:e2e` 84/84, `npm run build` reproduces `index.html` exactly.
- Run on the built page: AC-15 (Focus running shows only Reset focus), AC-01 (4:58 break running 2 s after Focus end), AC-05 (press inside the guard does nothing), AC-04 (press after the guard starts Focus 25:00, count unchanged), AC-03 (10 min late: break waiting at 5:00 with Start break + Start focus).
- Manual: auto-start accuracy and Start focus response measured in Edge; return-after-sleep run by the owner (see the manual timing check).

## Migration / rollback

No migration. Two new `localStorage` keys (defaults apply when missing). Rollback = revert + `npm run build`.

## Commits

`SDD-Task` history: `git log --oneline master..feature/break-flow`.
