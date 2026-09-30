# Manual timing check and review checklist — sensory-feedback (T13)

**Status: PARTIAL — the manual run in desktop Chrome is still to do. Firefox is out of scope (deferred to a later feature).**
`spec.md` §6 requires "e2e with the page hidden + manual stopwatch check in desktop Chrome
(current stable; Edge shares the engine)". Automation cannot replace a real hidden tab in a real browser.

## What was verified automatically (2026-09-30)

- **Microsoft Edge (Chromium, headless, Playwright), real time, `file://`:** the e2e test
  "AC-06: hidden tab, real time" in `test-e2e/sensory-feedback-chime.e2e.js` disables the page's own
  250 ms render loop and reports the page as hidden, so only the wake-up worker can bring the page
  back. The chime started ≥ the phase start plus 60 s (never early) and ≤ 1 s after the deadline, and
  the tab title already showed the next phase waiting for Start. Passed.
- Headless Edge does not throttle like a real hidden tab, so this proves the wake-up path works, not
  the browsers' throttling behaviour.

## To do by hand

Build first (`npm run build`), then open the root `index.html` from `file://` (double-click or
drag into the browser). In **desktop Chrome (current stable)**:

1. Set the Focus duration to 1 minute and press Start (this also unlocks sound).
2. Switch to another tab, and watch the clock. Note the wall-clock second at which the phase ends
   (Start time + 60 s) and the second at which the chime starts.
3. Record the delay. Pass = chime at or after the end and within 1 s of it.
4. Note whether the tab strip title read "Ready · 5 min · Short break" by the time the chime played.
5. Repeat once with a 30 min or longer hidden run (Focus 30) if practical (the spec says "including
   after ≥ 30 min hidden").

| Browser (version) | Date | Hidden duration | Chime delay after the true end | Title already next phase | Notes |
|---|---|---|---|---|---|
| Chrome (fill in) | | | | | |
| Firefox | — | — | — | — | Out of scope, deferred to a later feature (`docs/roadmap.md` step 6) |

If any delay is above 1 s or the chime is early, record it here and raise it before `ship`.

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
