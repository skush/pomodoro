# Tracker — core-timer

> Status of every task in the epic. `implement` updates `done` as it commits each task.
> States: `todo` · `in_progress` · `blocked` · `review` · `done`.

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| T1 | Engine control state machine (start/pause/reset + no-ops) | domain | sergii.kushnir@gmail.com | S | — | todo |
| T2 | Phase cadence + backgrounding reconciliation | domain | sergii.kushnir@gmail.com | S | T1 | todo |
| T3 | Unit tests for the engine state machine | tests | sergii.kushnir@gmail.com | S | T1, T2 | todo |
| T4 | UI rendering + control wiring | ui | sergii.kushnir@gmail.com | S | T1, T2 | todo |
| T5 | Wire main.js + regenerate index.html | wiring | sergii.kushnir@gmail.com | S | T4 | todo |
| T6 | Automated backgrounding/drift hardening test | tests | sergii.kushnir@gmail.com | S | T3 | todo |
| T7 | README + GitHub Pages hygiene | docs | sergii.kushnir@gmail.com | S | T5 | todo |

**Total:** 7 tasks, ~1 person-day (XS effort budget, `.size`).

> Note: this breakdown was produced against the already-committed core-timer implementation
> (commits `42c7339`, `9380a64`, `7e9d6e4`) — running `/sdd:implement core-timer` will find each
> task's Definition of Done already satisfied by the existing code/tests and should fast-forward
> each task to `done` rather than re-deriving it from scratch.
