# Tracker — sensory-feedback

> Status of every task in the epic. `implement` updates `done` as it commits each task.
> States: `todo` · `in_progress` · `blocked` · `review` · `done`.

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| T1 | Spike: confirm an inline Blob worker starts from file:// in Chrome, and that the zero-network check ignores blob: URLs | tests | sergii.kushnir@gmail.com | S | — | done |
| T2 | Extend the engine snapshot with phaseFullMs and a one-shot justCompleted for every phase type | domain | sergii.kushnir@gmail.com | M | — | done |
| T3 | Add the pure cue rules: tone data, ringFraction and tabTitle | domain | sergii.kushnir@gmail.com | M | T2 | done |
| T4 | Add the ring, notice and focus palette tokens, reduced-motion and 320px layout rules, and a contrast unit test | ui | sergii.kushnir@gmail.com | M | — | done |
| T5 | Build the Progress ring component (inline SVG track + arc) | ui | sergii.kushnir@gmail.com | S | T3, T4 | done |
| T6 | Build the audio adapter: lazy AudioContext, unlock inside Start/Resume, play a tone once | ui | sergii.kushnir@gmail.com | M | T3 | done |
| T7 | Build the inline wake-up worker and rework the message-channel source scan | ui | sergii.kushnir@gmail.com | M | T1, T2 | done |
| T8 | Render the ring, Tab title mirror and sound-unavailable notice from the snapshot in mount() | ui | sergii.kushnir@gmail.com | M | T2, T3, T4, T5, T6 | done |
| T9 | Play the chime or show the notice at completion; unlock sound in Start/Resume | ui | sergii.kushnir@gmail.com | M | T6, T8 | done |
| T10 | Arm the wake-up on Start/Resume and after an early wake; cancel on Pause/Reset; build | wiring | sergii.kushnir@gmail.com | S | T7, T9 | done |
| T11 | e2e: ring vs countdown, tab title states, 320px layout and reduced motion | tests | sergii.kushnir@gmail.com | M | T8 | done |
| T12 | e2e: exactly-once chime, no chime on controls, hidden-tab timing, sound-unavailable notice, no permission or network | tests | sergii.kushnir@gmail.com | M | T10, T11 | done |
| T13 | Run the manual stopwatch check in desktop Chrome and record the review checklist | docs | sergii.kushnir@gmail.com | S | T12, T14, T15 | blocked (needs a human: manual Chrome run, after T14 and T15) |
| T14 | Review fix F1: isolate the wake-up worker in the AC-06 hidden-tab e2e and correct the timing-check doc | tests | sergii.kushnir@gmail.com | S | T12 | done |
| T15 | Review fix F5: fall back to the main-thread timer when the wake-up worker errors after construction | ui | sergii.kushnir@gmail.com | S | T7 | done |
| T16 | Review fixes F3, F4, F6: e2e for ring at completion, visible-tab chime within 250 ms, rendered ring colour per phase | tests | sergii.kushnir@gmail.com | S | T12 | done |
| T17 | Review fix F7: e2e for the chime and the Session counter credit on the same completion | tests | sergii.kushnir@gmail.com | S | T12 | done |
| T18 | Review fix F8: source scan forbidding permission-requesting APIs under src/ | tests | sergii.kushnir@gmail.com | XS | — | done |

**Total:** 18 tasks (T14–T18 added by review 2026-09-30), ~13 person-days.
