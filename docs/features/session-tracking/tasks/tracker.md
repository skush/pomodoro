# Tracker — session-tracking

> Status of every task in the epic. `implement` updates `done` as it commits each task.
> States: `todo` · `in_progress` · `blocked` · `review` · `done`.

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| T1 | Latch the true Focus-completion timestamp inside the engine's `settle()` | domain | sergii.kushnir@gmail.com | S | — | done |
| T2 | Add a pure daily-rollover decision function | domain | sergii.kushnir@gmail.com | S | — | done |
| T3 | Add pure task-label length validation and per-field storage fallback functions | domain | sergii.kushnir@gmail.com | S | — | done |
| T4 | Build the centralized local-storage read + write gatekeeper | infra | sergii.kushnir@gmail.com | M | T2, T3 | done |
| T5 | Wire the task-label input: typing, placeholder, limit, commit-on-blur/Enter | ui | sergii.kushnir@gmail.com | M | T3, T4 | done |
| T6 | Wire today's count display: load-time rollover check + Focus-completion crediting | ui | sergii.kushnir@gmail.com | M | T1, T2, T4 | done |
| T7 | Dedicated edge-case coverage: transition-source latch, write-integrity KPI | tests | sergii.kushnir@gmail.com | S | T1, T2, T3, T4, T5, T6 | done |

**Total:** 7 tasks, ~1 person-day (XS, `.size`/`.route`: XS/quick).
