# Changelog — adjustable-durations

## adjustable-durations — set Focus / Short break / Long break lengths and the cycle length

**What:** The User can now set the length of each phase type (whole minutes, 1–180) and the number of Focus sessions before a Long break (2–8, default 4). Values commit on blur/Enter, persist in this browser's `localStorage`, and are pre-filled on the next visit. Defaults stay 25 / 5 / 15 and 4.

**Why:** The hardcoded classic cadence didn't fit everyone; this is roadmap step 4 and resolves open decision D1 — a duration change never disturbs the phase in progress, it applies the next time that phase type starts fresh ([spec](spec.md) §1). Key decisions: [ADR-0001](adr/0001-extend-engine-surface-with-configurable-durations.md) (engine surface, incl. Amendment 2 on idle-vs-paused detection) and [ADR-0002](adr/0002-centralize-duration-config-writes.md) (single write gatekeeper for the config keys).

**How to use:** Type a value into a duration or cycle-length field, then press Enter or leave the field. An invalid value (out of range or not a whole number) reverts to the last valid value with an inline range message. A cycle-length change takes effect immediately, including mid-cycle; a duration change while a phase is running or paused waits for the next fresh start (Reset then shows the new value).

**Operational notes:**
- Migration: none. New `localStorage` keys hold the three durations and the cycle length; invalid/missing stored values fall back to the classic defaults and are written back.
- Feature flag / config: none.
- Build: `index.html` is regenerated (`npm run build`) and committed with the source.
- Dev tooling: adds `playwright-core` (dev-only) and `npm run test:e2e`; the shipped page has no new runtime dependency.
- Rollback: revert the merge commit; stored keys are then simply ignored.

**Acceptance criteria delivered:** AC-01–AC-14 (incl. AC-04b) — valid commits saved and used on next fresh start; invalid commits rejected; idle display updates immediately; running/paused phases untouched; corrupted storage never yields an instant completion; commits never alter cycle position or the daily count; the write guard ignores foreign writes; values pre-fill after reload.
