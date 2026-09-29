# Tracker — adjustable-durations

> Status of every task in the epic. `implement` updates `done` as it commits each task.
> States: `todo` · `in_progress` · `blocked` · `review` · `done`.

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| T1 | Make the engine's three phase durations configurable at runtime, with idle vs running/paused semantics | domain | sergii.kushnir@gmail.com | M | — | done |
| T2 | Make the engine's cycle length configurable and read it at completion time | domain | sergii.kushnir@gmail.com | S | T1 | done |
| T3 | Add pure duration/cycle-length input and stored-value validation functions | domain | sergii.kushnir@gmail.com | S | — | done |
| T4 | Add persistDurationConfig / readPersistedDurationConfig as the second storage gatekeeper | infra | sergii.kushnir@gmail.com | M | T3 | done |
| T5 | Add the three duration fields (Numeric setting field) with commit on blur/Enter and inline validation | ui | sergii.kushnir@gmail.com | M | T1, T3, T4 | todo |
| T6 | Add the cycle-length field with commit on blur/Enter and inline validation | ui | sergii.kushnir@gmail.com | S | T2, T3, T4, T5 | todo |
| T7 | Wire load-time and pre-start correction of stored durations and cycle length | ui | sergii.kushnir@gmail.com | S | T5, T6 | todo |
| T8 | Reserve fixed width for a 3-digit minute countdown so no control shifts | ui | sergii.kushnir@gmail.com | S | T5 | todo |
| T9 | Rebuild index.html and run the manual NFR checks | wiring | sergii.kushnir@gmail.com | S | T7, T8 | todo |
| T10 | Add a dev-only headless-browser harness for e2e-through-UI tests | tests | sergii.kushnir@gmail.com | S | — | todo |
| T11 | Write the e2e-through-UI tests for duration and cycle-length flows | tests | sergii.kushnir@gmail.com | M | T9, T10 | todo |

**Total:** 11 tasks, ~6.5 person-days.
