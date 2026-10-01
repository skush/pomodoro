# Tracker — break-flow

> Status of every task in the epic. `implement` updates `done` as it commits each task.
> States: `todo` · `in_progress` · `blocked` · `review` · `done`.

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| T1 | Add pure On-time, Skip-guard and stored-toggle rules in src/logic/controls.js | domain | sergii.kushnir@gmail.com | S | — | todo |
| T2 | Extend the engine: startedAt, startFocus(now), setAllowPausingFocus(on) and the focus-pause policy | domain | sergii.kushnir@gmail.com | M | T1 | todo |
| T3 | Add the pure controlLayout(snapshot, now) rule and phase-named CONTROL_LABELS | domain | sergii.kushnir@gmail.com | M | T1 | todo |
| T4 | Build createControls(onAction): three fixed slot buttons and the keyboard-focus rule | ui | sergii.kushnir@gmail.com | M | T3 | todo |
| T5 | Add the Auto-start breaks and Allow pausing focus toggles with a third storage gatekeeper | ui | sergii.kushnir@gmail.com | M | T1, T2 | todo |
| T6 | Replace Start/Pause/Reset with the phase-labelled slots and route every action to the engine | ui | sergii.kushnir@gmail.com | M | T2, T3, T4, T5 | todo |
| T7 | Auto-start the break after an On-time Focus completion (backdated start in render) | app | sergii.kushnir@gmail.com | M | T2, T5, T6 | todo |
| T8 | Move the existing e2e helpers and scripts to the phase-labelled controls | tests | sergii.kushnir@gmail.com | S | T6 | todo |
| T9 | Add test-e2e/break-flow.e2e.js: auto-start, return-after-sleep, Start focus, keyboard focus | tests | sergii.kushnir@gmail.com | M | T7, T8 | todo |
| T10 | Regenerate index.html and run the spec §6 manual timing checks | wiring | sergii.kushnir@gmail.com | S | T9 | todo |

**Total:** 10 tasks, ~6.5 person-days.
