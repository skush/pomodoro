---
slug: break-flow
date: 2026-10-01
triage: regression
acs: [AC-03]
commit: TBD
recurrence_of: none
---

# Fix: no Focus-end chime, and no notice, after the laptop slept across the Focus end

## Symptom

Doing: the manual return-after-sleep run, Focus 1 min, Auto-start breaks on, laptop slept (lid) across the Focus end, woken more than 5 s later, built-in speakers; expected: one Focus-end chime on return (AC-03, sensory-feedback AC-06b) or, failing that, the sound-unavailable notice (AC-11); got: a correct screen (break waiting at full length) but no sound and no notice, for both a Short and a Long break. Sound worked normally when awake in the same tab. Found by the owner on 2026-10-01; the code path is the same one sensory-feedback shipped, so the gap is older than break-flow.

## Root cause

A throwaway diagnostic build (not committed) logged the audio context on the real sleep: the context's `state` stayed `running`, but its clock stopped across the sleep (wall +157 s, `currentTime` +0.30 s) and was still stalled a second after wake (+0.01 s over 0.87 s). `play()` (`src/ui/audio.js`) only checked `state === 'running'`, so it scheduled the tones on a clock that never advanced and nothing was heard, and the page raised no notice because nothing looked wrong. The fake-clock e2e jumps the page clock and used an audio spy whose clock never moved, so no test could see a context whose clock disagrees with the page's.

## The pinning test

- Unit, `test/logic/audio.test.js` "a context whose clock stalled across the sleep is replaced, and the chime plays on the new one": RED on the old code, `actual: 1, expected: 2` contexts (the chime was scheduled on the stalled context).
- Unit, "AC-11: if the replacement context is not running, play reports unavailable and schedules nothing", and "a Start or Resume press after the sleep also replaces a stalled context": RED on the old code (`actual: true`, and one context instead of two). A healthy context after a 25-minute wait is kept (guards against false positives).
- e2e, `test-e2e/break-flow.e2e.js` "manual sleep run (AC-03): a context whose clock stalled across the sleep is replaced, and the Focus-end chime is heard once": RED on the old `audio.js`, `actual: 1, expected: 2` contexts.
- The e2e audio spy (`test-e2e/helpers.js`) now has a clock that follows page time, a `close()`, and a `frozenAt` switch, like a real context; the old spy froze `currentTime` at 0.

## Spec patch

None — spec was right; AC-03 ("exactly one Focus-end chime, break waiting") and sensory-feedback AC-06b/AC-11 re-verified. The behaviour broke, the wording did not permit it.

## Follow-ups

- The fix is verified against the fake page only; the real wake behaviour needs the owner's manual re-run (`_review/manual-timing-check.md`). If a fresh context outside a button press does not start `running` on a real wake, `play()` returns false and the sound-unavailable notice shows (AC-11) instead of silence, and this needs another round.
- Not covered: a context that stalls and wakes back up by itself before the Focus end (it is then healthy by the time of the check).
