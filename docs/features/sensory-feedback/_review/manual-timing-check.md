# Manual timing check and review checklist — sensory-feedback (T13)

**Status: PARTIAL — the 1 min run in desktop Chrome is done (app side passes; the audible delay is open, see below). The ≥ 30 min run is still to do. Firefox is out of scope (deferred to a later feature).**
`spec.md` §6 requires "e2e with the page hidden + manual stopwatch check in desktop Chrome
(current stable; Edge shares the engine)". Automation cannot replace a real hidden tab in a real browser.

## What was verified automatically (2026-09-30)

- **Microsoft Edge (Chromium, headless, Playwright), real time, `file://`:** the e2e test
  "AC-06: hidden tab, real time" in `test-e2e/sensory-feedback-chime.e2e.js` starts the page with
  `setInterval` already a no-op (`noRenderLoop`, an init script that runs before the app), so the
  page's own 250 ms render loop never starts, and reports the page as hidden. Only the wake-up worker
  can bring the page back. The chime started ≥ the phase start plus 60 s (never early) and ≤ 1 s after
  the deadline, and the tab title already showed the next phase waiting for Start. Passed (chime at
  about 60.3 s).
- **Negative control** (review F1): "AC-06 control" runs the same setup with a `Worker` that accepts
  messages and never answers (`deadWorker`). The phase does not complete and no chime plays 2 s past
  the deadline. So the test above passes because of the worker, not because of the render loop.
- Headless Edge does not throttle like a real hidden tab, so this proves the wake-up path works, not
  the browsers' throttling behaviour.

## To do by hand

Build first (`npm run build`), then open the root `index.html` from `file://` (double-click or
drag into the browser). In **desktop Chrome (current stable)**:

1. Set the Focus duration to 1 minute and press Start (this also unlocks sound).
2. Switch to another tab, and watch the clock. Note the wall-clock second at which the phase ends
   (Start time + 60 s) and the second at which the chime starts.
3. Record the delay. Pass = the page starts the chime at or after the end and within 1 s of it (page-side timestamp, see the diagnostic below). Also note the audible delay by ear and the output device — for information, not pass/fail (AC-06 wording, decided 2026-09-30).
4. Note whether the tab strip title read "Ready · <Short-break minutes> min · Short break" (with the default 5-minute Short break: "Ready · 5 min · Short break") by the time the chime played.
5. Repeat once with a 30 min or longer hidden run (Focus 30) if practical (the spec says "including
   after ≥ 30 min hidden").

| Browser (version) | Date | Hidden duration | Chime delay after the true end | Title already next phase | Notes |
|---|---|---|---|---|---|
| Chrome (version: fill in) | 2026-09-30 | 1 min | Audible: about 1 s in the instrumented run (1–2 s in earlier runs), by ear. Page-side: tone scheduled +37 ms after the deadline | Yes (logged 1 ms after the tone, but that is the `MutationObserver` firing after the synchronous `render()`, which sets the title first; the e2e checks the title at the moment the tone starts) | See "Diagnostic" below |
| Chrome (version: fill in) | 2026-09-30 | 30 min | pending | pending | |
| Firefox | — | — | — | — | Out of scope, deferred to a later feature (`docs/roadmap.md` step 6) |

If any delay is above 1 s or the chime is early, record it here and raise it before `ship`.

## Diagnostic — 1 min run, real Chrome, tab hidden (2026-09-30)

Timestamps logged in the page with `Date.now()` (a hook on `createOscillator`, a `MutationObserver` on
`<title>`, and a capture-phase `click` listener; the click is +0 ms):

| Event | Time after the Start click |
|---|---|
| click | +0 ms |
| title `1 min · Focus` | +14 ms |
| tone scheduled (3 notes, Focus-end) | +60037 ms |
| title `Ready · 1 min · Short break` | +60038 ms |

Reading: the wake-up worker brought the hidden page back 37 ms after the deadline (limit 1 s), the
chime was scheduled in that same wake, and the title already showed the next phase. The 1–2 s heard
is therefore added **after** the page plays the tone (heard about 1 s after the deadline in this same run): audio output wake-up latency (output device,
e.g. Bluetooth or a device that sleeps when idle) plus reaction time. Output device used: fill in.

Decision (owner, 2026-09-30): AC-06 and the `spec.md` §6 row now promise that the chime is *started* within
1 s (the page hands the tone to the browser); audible latency of the output device is recorded here but
is not a pass/fail figure. Still to do: repeat once on built-in speakers to confirm the device explanation.

## Review checklist (for `/sdd:review`)

- `render()` is the only `getSnapshot()` caller in `src/ui/` (`sad.md` §8, §11).
- The `src/ui/wakeup.js` worker handler calls only `onWake`, never an engine control method.
- The source-scan carve-out for `postMessage(` / `onmessage` is limited to `src/ui/wakeup.js`
  (`test/logic/timer-engine.test.js`).
- `unlock()` in `src/ui/audio.js` is async (returns a promise of availability) unlike the sync
  `unlock() → available?` sketched in `sad.md` §5, because `AudioContext.resume()` is a promise.
  The `resume()` call itself is still made synchronously inside the Start/Resume click.
- No `screens.md` exists: the tab-title wording (`src/logic/feedback.js` `tabTitle`) and the notice
  text were decided in implementation. The screen-reader announcement question (`spec.md` §8) is still open.
