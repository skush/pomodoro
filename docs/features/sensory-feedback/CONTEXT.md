---
status: Living
updated_at: "2026-09-29"
---

# Domain Context — sensory-feedback

## Glossary

- **Phase completion** — the moment any phase (Focus, Short break or Long break) reaches zero on its own countdown. NOT a Reset, and NOT any other early end — a phase ended by the User never "completes". A Focus phase completion is what the root glossary calls a *Focus session*; this term extends the same "reached zero naturally" rule to break phases.
- **Completion chime** — the short synthesized sound played at a Phase completion; its tone tells the User which kind of phase just ended (a Focus-end tone vs a break-end tone). NOT a repeating alarm, and NOT played on Start, Pause, Resume or Reset.
- **Stale completion** — a Phase completion that the page notices more than 2 minutes after its true moment, because the device slept or the tab was frozen (spec AC-06b). NOT a *late completion* in break-flow's sense (more than the 5 s On-time tolerance) — one noticed between 5 s and 2 minutes late is late but still chimes once. A stale completion plays no chime and shows no sound-unavailable notice, but it is still credited as session-tracking decides and the next phase still waits for Start.
- **Progress ring** — the circular indicator showing the fraction of the current phase's time still remaining, measured against the full length that phase started with. NOT measured against the *Configured duration* (`docs/features/adjustable-durations/CONTEXT.md`) when that setting was changed after the phase started — the running or paused phase keeps its own length, so the ring does too.
- **Tab title mirror** — the browser tab's title text showing the remaining time as whole minutes (rounded up, never zero while time is left) and the phase name, kept in step with the on-page countdown in every timer state (the one tolerance: in a hidden tab, a running phase's minutes may trail by up to a minute between completions, never at a Phase completion), and telling the three states apart: running, paused, or waiting for Start (a phase loaded idle, including the next phase right after a Phase completion). NOT a notification — it changes only the tab's title text and asks for no permission.
