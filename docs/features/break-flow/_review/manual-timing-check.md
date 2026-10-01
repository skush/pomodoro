# Manual timing check and review checklist — break-flow (T10)

**Status: COMPLETE (the return-after-sleep item accepted by the owner under the 2026-10-01 requirement change) — the auto-start accuracy and the Start focus response are measured (headless Edge, real clock, automated stopwatch). The real return-after-sleep run was done by the owner on 2026-10-01: the screen was right for a Short and a Long break. No Focus-end chime was heard on return, which led the owner to change the requirement the same day — a completion noticed more than 2 minutes late plays no chime and shows no notice (sensory-feedback AC-06b). Under that requirement the observed behaviour is the expected one, so the item is closed (T10 done). The final build has not been put through another real sleep; the new rule is covered by unit and fake-clock e2e tests.**
`spec.md` §6 asks for a "manual stopwatch check on desktop Chrome" (auto-started break accuracy) and a "manual check during a running break" (Start focus response); §7 KPI 4 asks for "one manual return-after-sleep run at merge".

## Measured on 2026-10-01

Built page (`npm run build`), opened from `file://` in headless **Microsoft Edge 154.0.4258.48** (Chromium; Playwright), **real clock, no fake timers**, visible tab, Focus duration 1 minute, defaults otherwise (Auto-start breaks on). Page-side `Date.now()` timestamps; the Focus true end is bracketed by a capture-phase and a bubble-phase `click` listener around the Start press (the same technique as the sensory-feedback check).

### Auto-started break accuracy (spec §6: ≤ 1 s) — pass

40 samples, one every ~0.5 s, from 45 ms to 20.1 s after the Focus true end. The break was already running at the first sample; the title read `5 min · Short break` (no "Ready" or "Paused" marker); one Focus-end chime (3 notes) was scheduled 12–21 ms after the Focus end.

| Quantity | Result |
|---|---|
| Displayed seconds minus ceil(5:00 − real time since the Focus end), over all 40 samples | always 0 or 1 — never more, and no growth from 0.05 s to 20 s |
| Same comparison against the raw (un-rounded) expectation | at most 1.17 s |

Reading: the display deliberately rounds the remaining time **up** to a whole second and repaints every 250 ms (`formatDuration`, §6 NFR "Time display"), which accounts for the whole difference (up to 1 s of rounding plus up to 0.25 s of repaint lag). The series is a clean one-second staircase with no drift, which shows the break was started from the Focus end (`start(at)`), not from when the page noticed. The raw 1.17 s figure is the rounding-up convention, not engine error; the engine's own accuracy is pinned by the unit test (`remaining = full − (now − at)`, within 1 s, `test/logic/timer-engine.test.js` and `test/logic/ui-autostart.test.js`).

### Start focus response (spec §6: Focus shown running ≤ 250 ms) — pass

During the running break, after the Skip guard: the Start focus button was pressed inside the page and the time to the Focus phase being shown was read from the same synchronous call (the click handler renders before it returns).

| Run | Press → "Focus" shown and title `1 min · Focus` |
|---|---|
| 1 | 1.2 ms |
| 2 | 1.3 ms |

### Layout (screenshots, headless Edge)

The three fixed slots read side-1 | main | side-2 at 900 px and at 320 px (labels wrap to two lines, every state keeps one row height). Found and fixed on the way: the control row used to shrink to its labels and shift with every state change (caught by the existing display-width e2e); the phase-name focus outline now uses `:focus-visible`, so it shows for keyboard users and not after a mouse press.

## Not done — to do by hand

**Return-after-sleep (spec §7 KPI 4, AC-03, §6 "Chimes per completion"): PASS under the changed requirement (owner run, 2026-10-01). See the results table below.** It could not be run from the implementation session, so the owner ran it by hand. The *logic* is covered automatically — a clock jump past the Focus end leaves the break waiting at full length with no break-end chime, and with one Focus-end chime when it is within 2 minutes or none (and no notice) when later, for a Short and a Long break (`test-e2e/break-flow.e2e.js`, AC-03 tests, and `test/logic/ui-autostart.test.js`) — but a jump of a fake clock is not a real sleep.

Do once at merge, in desktop Chrome or Edge, with the root `index.html` from `file://`:

1. Set the Focus duration to 1 minute, leave Auto-start breaks on, press Start focus (this unlocks sound).
2. Put the device to sleep (or lock it and let it sleep) so that the Focus end passes while it is asleep; wake it more than 5 s after the Focus end.
3. Expect, on return (more than 2 minutes after the Focus end): the break shown **waiting at its full length** (not counting down, not used up), **Start break** and **Start focus** offered, **no chime and no sound-unavailable notice**, and the Session counter credited once. (Originally "one Focus-end chime"; changed by the owner on 2026-10-01.)
4. Repeat once for a Long break if practical (Focus sessions before a long break = 2).

| Browser (version) | Date | Slept across the Focus end | Break waiting at full length | No chime and no notice (changed requirement) | Notes |
|---|---|---|---|---|---|
| Chrome / Edge (version not recorded) | 2026-10-01 | yes: Short break and Long break | **pass**: the screen looked right for both | **pass** (as now required): nothing was heard on return, and no notice appeared | Owner run, made against the build that still chimed on a late return. Diagnostics showed the page scheduled the chime on a working audio context after the wake, but nothing was audible: the laptop's audio was not ready right after wake. The owner then decided a User who comes back needs no late sound, so the chime is now suppressed past 2 minutes. This run was not repeated on the final build |

Also still manual, by feel: pressing Start focus on a real break (the ≤ 250 ms figure above is page-side and synchronous, so it holds in any browser that runs the page).

## Review checklist (for `/sdd:review`)

- The engine changes only through the page's own controls, its two toggles, its duration/cycle commits and the auto-start branch (`autoStartBreak`, called only by `renderCycle`, called only by `render()`); there is still no `message`/`storage` listener (`test/logic/timer-engine.test.js` source scan).
- `getSnapshot()` callers in `src/ui/`: `renderCycle` (snapshot A) and `autoStartBreak` (snapshot B, only after an On-time Focus completion). This deliberately loosens the sensory-feedback review item "`render()` is the only `getSnapshot()` caller" (`sad.md` §8 "One-shot consumption": one render may take two snapshots).
- `persistBreakFlowSettings` is the only writer of the two `break-flow:` keys (`write-guard.test.js`); `readPersistedBreakFlowSettings` runs once, at mount, and never writes back.
- The pre-start correction (`refreshConfigFromStorage`) has exactly three triggers: `handleStartBreak`, `handleStartFocus`, `prepareAutoStart` (`write-guard.test.js`).
- Start focus presses are forwarded to the engine even while the control looks greyed, so the Skip guard is enforced by the engine to the millisecond (ADR-0002/0003); the greyed look can trail by one 250 ms render tick, which is inside the §6 ± 0.25 s tolerance.
- A Focus completion noticed after the 5 s tolerance (or with Auto-start breaks off) leaves the break waiting; Firefox background-tab timing is not promised (`spec.md` AC-01).
