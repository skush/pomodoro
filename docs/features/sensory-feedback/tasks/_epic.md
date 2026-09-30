# Epic — sensory-feedback

> **Spec:** [spec.md](../spec.md) · **Design:** [sad.md](../sad.md) · **Data model:** [data-model.md](../data-model.md) (no schema change) · **API:** none (no backend) · **ADRs:** [adr/](../adr/)

## Goal

Deliver the eyes-off cue layer: a Completion chime with distinct Focus-end and break-end tones (also in a hidden desktop tab), a Progress ring coloured per phase, and a Tab title mirror, all in one WCAG-AA dark palette that fits 320 CSS px (`spec.md` §2).

## Scope

- **In:** `src/logic/` (snapshot fields, cue rules), `src/ui/` (ring, audio, wake-up worker, render wiring), `src/styles.css`, unit and e2e tests, the regenerated `index.html`.
- **Out:** a mute or volume control, system notifications, surviving a reload or discard, chime timing during sleep, the ≤ 1 s promise on phones and frozen tabs, coordinating two open tabs (`spec.md` §3).

## Task map

```mermaid
flowchart LR
    T1["T1 tests"]
    T2["T2 domain"]
    T3["T3 domain"]
    T4["T4 ui"]
    T5["T5 ui"]
    T6["T6 ui"]
    T7["T7 ui"]
    T8["T8 ui"]
    T9["T9 ui"]
    T10["T10 wiring"]
    T11["T11 tests"]
    T12["T12 tests"]
    T13["T13 docs"]
    T2 --> T3
    T3 --> T5
    T4 --> T5
    T3 --> T6
    T1 --> T7
    T2 --> T7
    T2 --> T8
    T3 --> T8
    T4 --> T8
    T5 --> T8
    T6 --> T8
    T6 --> T9
    T8 --> T9
    T7 --> T10
    T9 --> T10
    T8 --> T11
    T10 --> T12
    T11 --> T12
    T12 --> T13
```

## Tasks

See [tracker.md](./tracker.md) for status. Machine contract: [tasks.json](../tasks.json).

| # | Task | Layer | Blocked by | DoD (short) |
|---|---|---|---|---|
| T1 | Spike: confirm an inline Blob worker starts from file:// in Chrome, and that the zero-network check ignores blob: URLs | tests | — | Spike result for Chrome is written next to ADR-0001. |
| T2 | Extend the engine snapshot with phaseFullMs and a one-shot justCompleted for every phase type | domain | — | Unit tests over `settle()`/`getSnapshot()` pass for every case in the table above. |
| T3 | Add the pure cue rules: tone data, ringFraction and tabTitle | domain | T2 | `test/logic/feedback.test.js` passes for tones, ring fraction and title. |
| T4 | Add the ring, notice and focus palette tokens, reduced-motion and 320px layout rules, and a contrast unit test | ui | — | `test/logic/contrast.test.js` passes for all declared pairs. |
| T5 | Build the Progress ring component (inline SVG track + arc) | ui | T3, T4 | `createRing().update()` sets the arc length and `data-phase` as specified. |
| T6 | Build the audio adapter: lazy AudioContext, unlock inside Start/Resume, play a tone once | ui | T3 | `test/logic/audio.test.js` passes with a fake context. |
| T7 | Build the inline wake-up worker and rework the message-channel source scan | ui | T1, T2 | Fallback and worker paths both covered by tests; cancelled arm never fires. |
| T8 | Render the ring, Tab title mirror and sound-unavailable notice from the snapshot in mount() | ui | T2, T3, T4, T5, T6 | Manual/e2e check: title and ring change in step with the countdown in all three states (full e2e in T11). |
| T9 | Play the chime or show the notice at completion; unlock sound in Start/Resume | ui | T6, T8 | Unit tests over the wiring pieces that can run in Node pass; e2e in T12 asserts one chime per completion and none on controls. |
| T10 | Arm the wake-up on Start/Resume and after an early wake; cancel on Pause/Reset; build | wiring | T7, T9 | `npm run build` succeeds and the committed `index.html` matches `src/`. |
| T11 | e2e: ring vs countdown, tab title states, 320px layout and reduced motion | tests | T8 | `npm run test:e2e` passes with the new file. |
| T12 | e2e: exactly-once chime, no chime on controls, hidden-tab timing, sound-unavailable notice, no permission or network | tests | T10, T11 | `npm run test:e2e` passes. |
| T13 | Run the manual stopwatch check in desktop Chrome and record the review checklist | docs | T12, T14, T15 | `_review/manual-timing-check.md` exists with desktop Chrome results (1 min and ≥ 30 min hidden). |
| T14 | Review fix F1: isolate the wake-up worker in the AC-06 hidden-tab e2e and correct the timing-check doc | tests | T12 | The AC-06 hidden-tab e2e stops the render loop before the app loads (addInitScript) and a companion check proves it fails when `Worker` is deleted; `_review/manual-timing-check.md` describes the test accurately; `npm run test:e2e` passes. |
| T15 | Review fix F5: fall back to the main-thread timer when the wake-up worker errors after construction | ui | T7 | `worker.onerror` sets workerFailed, drops the worker and re-arms the current deadline via `setTimeoutFn`; `test/logic/wakeup.test.js` covers it with a fake worker firing onerror; `npm run build` regenerates `index.html`. |
| T16 | Review fixes F3, F4, F6: e2e for ring at completion, visible-tab chime within 250 ms, rendered ring colour per phase | tests | T12 | e2e asserts: the ring fraction just before the deadline is ≤ 1 s of the phase length (test renamed to match); the first tone starts at or after the deadline and ≤ 250 ms after it on a visible tab; the computed `.ring-arc` stroke differs pairwise for Focus, Short break and Long break (Long break reached with cycle length 1). `npm run test:e2e` passes. |
| T17 | Review fix F7: e2e for the chime and the Session counter credit on the same completion | tests | T12 | e2e asserts: a Focus completion plays one Focus-end chime and the counter goes up by one; a Focus started before midnight and completing after the next midnight chimes once and credits nothing to the new day; a break completion chimes and leaves the counter unchanged. `npm run test:e2e` passes. |
| T18 | Review fix F8: source scan forbidding permission-requesting APIs under src/ | tests | — | A unit test scans every file under `src/` and fails on `requestPermission`, `getUserMedia`, `navigator.permissions` or `Notification(`; `npm test` passes. |

## Risks / Hard rules

- **One `getSnapshot()` caller:** `render()` is the only one in `src/ui/`; a second caller silently consumes a completion (`sad.md` §8, §11).
- **Input guard:** the only message channel is the page↔worker one in `src/ui/wakeup.js`; its handler calls only `onWake` (`sad.md` §8, ADR-0001). T7 reworks the core-timer AC-03 source scan, it does not delete it.
- **Timing source:** every cue derives from the wall-clock deadline; wake sources only decide when to look (core-timer ADR-0001).
- **No storage writer:** `test/logic/write-guard.test.js` stays untouched and guards it.
- **Build-then-commit:** regenerate and commit `index.html` with every change under `src/` (`CLAUDE.md`).
- **Open items carried:** tone character (`spec.md` §8, decided in T3), screen-reader announcement (§8, Tech Lead), `screens.md` was not produced so the tab-title wording is fixed in T3.
