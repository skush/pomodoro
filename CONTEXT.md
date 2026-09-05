---
status: Living
updated_at: "2026-09-05"
---

# Domain Context — pomodoro

## Glossary

- **User** — the single person running the timer in their own browser tab; there are no other roles (no accounts, no admin, no server-side actor). NOT a generic placeholder — every user story and acceptance criterion in this domain uses this exact role name.
- **Phase** — the current segment of the Pomodoro cycle: Focus, Short break, or Long break, each with its own duration. NOT the same as *session* — a phase is what's currently running; a session is a specific completed Focus phase.
- **Focus session** — a Focus phase whose countdown reached zero naturally (not ended early by Reset). NOT a Focus phase still in progress, and NOT a break phase.
- **Cycle** — the repeating sequence of 4 (Focus → Short break) pairs followed by one Long break, after which it repeats from Focus #1. NOT a single phase or a single session.
- **Session counter** — the count of completed Focus sessions for the current day, used to trigger the Long break on every 4th one. NOT decremented or reset by pausing or resetting the current phase.

## Invariants

- The session counter always increments only when a Focus phase completes naturally (reaches zero); it never changes on Reset or on switching phases early.
- Exactly every 4th completed Focus session is followed by a Long break; the 3 in between are each followed by a Short break.
