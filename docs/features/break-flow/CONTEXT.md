---
status: Living
updated_at: "2026-10-01"
---

# Domain Context — break-flow

## Glossary

- **Auto-start breaks** — the User's on/off setting (on for first use, persisted across reloads) that makes a Short break or Long break begin counting down by itself right after an On-time completion of a Focus phase. NOT auto-start of Focus — a Focus phase never starts on its own, with this setting on or off.
- **Allow pausing focus** — the User's on/off setting (off for first use, persisted across reloads) that decides whether a running Focus phase can be paused. Off: a Focus phase is indivisible — the only way to interrupt it is Reset focus, which discards it. NOT about breaks — a break can always be paused, whatever this setting says.
- **On-time completion** — a Phase completion (`docs/features/sensory-feedback/CONTEXT.md`) that the page notices within the 5 s On-time tolerance (spec §6) of its true end, because the page was awake and running at that moment. NOT a *late completion* — one only noticed afterwards, when the device was asleep, the screen locked, or the browser had frozen or backgrounded the tab on a phone; a late completion never auto-starts a break.
- **Skipped break** — a Short break or Long break the User ends before it reaches zero by pressing Start focus. NOT a Phase completion — no chime plays, and neither the in-cycle focus count nor the Session counter changes.
- **Discarded focus** — a Focus phase the User ends before it reaches zero by pressing Reset focus. NOT a Focus session — it is never counted, and the Focus phase returns to its full length, waiting for Start focus.
- **Skip guard** — the 3 seconds after any break starts, during which that break's Start focus is unavailable, so a reflex or repeated press cannot skip the break. Measured in real time: from the Focus phase's true end for a break that auto-started (not from when the page noticed it), from the Start break press for a break the User started; pausing doesn't extend it, and Resume break starts no new one. NOT applied to a break waiting for Start.
