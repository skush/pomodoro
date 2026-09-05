---
status: Living
updated_at: "2026-09-05"
---

# Domain Context — pomodoro

## Glossary

- **User** — the single person running the timer in their own browser tab; there are no other roles (no accounts, no admin, no server-side actor). NOT a generic placeholder — every user story and acceptance criterion in this domain uses this exact role name.
- **Phase** — the current segment of the Pomodoro cycle: Focus, Short break, or Long break, each with its own duration. NOT the same as *session* — a phase is what's currently running; a session is a specific completed Focus phase.
- **Focus session** — a Focus phase whose countdown reached zero naturally (not ended early by Reset). NOT a Focus phase still in progress, and NOT a break phase.
- **Cycle** — the repeating sequence of 4 Focus phases separated by 3 Short breaks, followed by one Long break, after which it repeats from Focus #1. NOT a single phase or a single session.
- **In-cycle focus count** — the ephemeral, in-memory count of Focus sessions completed since the last Long break (or since the page was loaded), used only to decide whether the next break is Short or Long. NOT persisted across reloads, and NOT the same as the *Session counter* below — it wraps to zero the instant a Long break begins.
- **Session counter** — the count of completed Focus sessions for the current day, persisted across reloads (introduced by the Session-tracking step). NOT the same as the *in-cycle focus count* — it is cumulative for the whole day and outlives any single cycle; how/when it persists and resets is that later step's concern, not core-timer's.

## Invariants

- The in-cycle focus count always increments only when a Focus phase completes naturally (reaches zero); it never changes on Reset or on switching phases early, and it resets to zero the instant a Long break begins.
- Exactly every 4th completed Focus session (per the in-cycle focus count) is followed by a Long break; the 3 in between are each followed by a Short break.
