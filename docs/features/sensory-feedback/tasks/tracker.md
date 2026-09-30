# Tracker — sensory-feedback

> Status of every task in the epic. `implement` updates `done` as it commits each task.
> States: `todo` · `in_progress` · `blocked` · `review` · `done`.

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| T1 | Spike: confirm an inline Blob worker starts from file:// in Chrome and Firefox, and that the zero-network check ignores blob: URLs | tests | sergii.kushnir@gmail.com | S | — | todo |
| T2 | Extend the engine snapshot with phaseFullMs and a one-shot justCompleted for every phase type | domain | sergii.kushnir@gmail.com | M | — | todo |
| T3 | Add the pure cue rules: tone data, ringFraction and tabTitle | domain | sergii.kushnir@gmail.com | M | T2 | todo |
| T4 | Add the ring, notice and focus palette tokens, reduced-motion and 320px layout rules, and a contrast unit test | ui | sergii.kushnir@gmail.com | M | — | todo |
| T5 | Build the Progress ring component (inline SVG track + arc) | ui | sergii.kushnir@gmail.com | S | T3, T4 | todo |
| T6 | Build the audio adapter: lazy AudioContext, unlock inside Start/Resume, play a tone once | ui | sergii.kushnir@gmail.com | M | T3 | todo |
| T7 | Build the inline wake-up worker and rework the message-channel source scan | ui | sergii.kushnir@gmail.com | M | T1, T2 | todo |
| T8 | Render the ring, Tab title mirror and sound-unavailable notice from the snapshot in mount() | ui | sergii.kushnir@gmail.com | M | T2, T3, T4, T5, T6 | todo |
| T9 | Play the chime or show the notice at completion; unlock sound in Start/Resume | ui | sergii.kushnir@gmail.com | M | T6, T8 | todo |
| T10 | Arm the wake-up on Start/Resume and after an early wake; cancel on Pause/Reset; build | wiring | sergii.kushnir@gmail.com | S | T7, T9 | todo |
| T11 | e2e: ring vs countdown, tab title states, 320px layout and reduced motion | tests | sergii.kushnir@gmail.com | M | T8 | todo |
| T12 | e2e: exactly-once chime, no chime on controls, hidden-tab timing, sound-unavailable notice, no permission or network | tests | sergii.kushnir@gmail.com | M | T10, T11 | todo |
| T13 | Run the manual stopwatch check in desktop Chrome and Firefox and record the review checklist | docs | sergii.kushnir@gmail.com | S | T12 | todo |

**Total:** 13 tasks, ~11 person-days.
