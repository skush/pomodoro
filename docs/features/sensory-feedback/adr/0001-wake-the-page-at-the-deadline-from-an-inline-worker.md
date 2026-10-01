---
status: Accepted
owner: "sergii.kushnir@gmail.com"
reviewers: []
updated_at: "2026-09-30"
feature_size: "S"
ticket: "docs/roadmap.md step 5"
---

# 0001 — Wake the page at the phase deadline from an inline dedicated worker

- **Status:** Accepted
- **Date:** 2026-09-30
- **Deciders:** Architect (sergii.kushnir@gmail.com), during `design`'s Socratic pass

## Context

The page learns that a phase ended only when its own code runs. Today the only thing that runs it is
`src/ui/index.js`'s 250 ms `setInterval` render loop plus a `visibilitychange` re-render
(`sad.md` §3 brownfield note). A hidden tab changes that. Desktop Chrome throttles the page's own
timers to about once per second at first. After about 5 minutes hidden it applies *intensive
throttling* and wakes chained page timers at most once per minute. So a Completion chime at the end
of a 25-minute Focus in a background tab could arrive up to about 60 s late. The spec asks for
≤ 1 s, never before the true Phase completion moment, including after ≥ 30 min hidden (`spec.md`
AC-06, §6 "Chime timing, hidden tab, awake device"). It also requires the tab title to already show
the next phase waiting for Start when the chime begins (AC-06, §6 "Tab title freshness"). This
decision fixes what wakes the page at the deadline. The chime, the title and the completion itself
still come from the existing render path.

## Decision drivers

- `spec.md` §6: chime ≤ 1 s after the true Phase completion moment, never before it, in a hidden
  desktop Chrome tab (Firefox deferred to a later feature), including after ≥ 30 min hidden.
- `spec.md` AC-06: the tab title already shows the next phase waiting for Start when the chime starts.
- `spec.md` AC-07 / AC-06b: exactly one chime per completion. No chime after a Pause or Reset
  pressed before zero, and none held back after sleep.
- [`core-timer/adr/0001`](../../core-timer/adr/0001-wall-clock-deadline-timing.md): completion is
  decided against an absolute wall-clock deadline. A second clock would be a second source of truth.
- [`core-timer/adr/0002`](../../core-timer/adr/0002-structural-encapsulation-control-guard.md): the
  engine changes only through its control methods, called only by `src/ui/` in response to the
  User. A wake-up must not become a new input source.
- `spec.md` §6 "Self-contained": 0 network requests, 0 audio files. The app is one `index.html`
  ([`adr/0001`](../../../adr/0001-generate-single-file-from-modular-source.md)).

## Considered options

1. **Inline dedicated worker as a wake-up clock.** A tiny Web Worker, created once per page from an
   in-bundle source string through a Blob URL, is told "wake me in N ms" on Start/Resume and
   "cancel" on Pause/Reset. When its timer fires it posts a message, and the main thread runs the
   ordinary `render()`.
2. **Web Audio clock pre-scheduling.** On Start/Resume, schedule the tone on the
   `AudioContext.currentTime` clock at the deadline, and add a silent scheduled source whose
   `ended` event wakes the main thread to update the title. Pause/Reset cancel both.

A third option, keeping only main-thread page timers, was not considered: the §6 NFR above excludes
it under Chrome's intensive throttling.

## Decision outcome

**Chosen:** Option 1, the inline dedicated worker. It keeps **one clock**. The worker's timer and
the engine both read the same system time, and a wake-up only *triggers* `render()`. Whether a
phase completed is still decided by the engine's `settle(now)`, which completes a phase only when
it is running and `now ≥ deadlineAt`. "Never before" therefore holds structurally: an early
wake-up changes nothing and simply re-arms for the remainder. The title-before-chime order of
AC-06 also comes for free, because `render()` updates `document.title` before it plays the tone
(`sad.md` §6). Option 2 introduces a second clock (the audio hardware clock) that drifts against
the wall clock and stops while the device sleeps. That makes an early chime and a mistimed
after-sleep chime possible, and it makes the scheduled sound itself something that Pause/Reset must
remember to cancel, which is a new path to an AC-07 violation.

Shape (for `tasks`; `src/ui/wakeup.js`):
- `createWakeup(onWake) → { arm(delayMs), cancel() }`. There is one worker per page. The Blob URL
  is revoked right after `new Worker(...)`, so nothing leaks.
- `arm` is called after Start/Resume with `delayMs = snapshot.remainingMs`. It is also called after
  a wake-up that arrived before the deadline, for the remainder. `cancel` is called on Pause and
  Reset. `onWake` is `render`, and nothing else.
- The worker never calls an engine method and never touches the DOM or storage. Its message is a
  pure "look at the clock now" nudge. The core-timer AC-03 input guard is unchanged: no engine
  control method is reachable from it.
- Fallback: if constructing the worker throws (for example, workers are blocked), `createWakeup`
  falls back to a main-thread `setTimeout`. This is fail-soft per `CLAUDE.md`. The chime still
  plays, possibly late in a hidden tab, and the case is listed in `sad.md` §11.

### Amendments (2026-09-30, after review)

- **Fallback on a late worker error.** Besides the constructor throwing, `createWakeup` also falls
  back when the worker reports an `error` after construction (a policy block, or the blob URL revoked
  before the script loaded). The handler detaches the dead worker (`onmessage = null`, `terminate()`),
  marks it failed, and re-arms any pending deadline on the main-thread `setTimeout` for the remaining
  time. It still only ever calls `onWake`, so the carve-out below is unchanged
  (`src/ui/wakeup.js`, review finding F5, task T15).
- **"Started", not "audible".** The owner reworded AC-06 and the `spec.md` §6 row: the promise is that
  the chime is *started* (handed to the browser's audio output) within 1 s. Audible latency of the
  output device is recorded, not graded (`_review/manual-timing-check.md`). Read the "≤ 1 s" in the
  context and drivers above in that sense.

### Amends core-timer ADR-0002

[core-timer ADR-0002](../../core-timer/adr/0002-structural-encapsulation-control-guard.md) guarantees
AC-03 structurally: there is no input channel through which anything but the User's own controls
could reach the engine. `test/logic/timer-engine.test.js` enforces this by failing on any
`addEventListener('message'`, `onmessage`, `postMessage(`, `BroadcastChannel` or `storage`
listener anywhere under `src/`. Its Neutral consequence says a feature that adds a channel
"reopens this decision — it does not retrofit silently". This ADR reopens it explicitly, with a
narrow carve-out:

- **Allowed:** exactly one channel, between the page and the `Worker` object it creates itself.
  It lives in `src/ui/wakeup.js` only. The page-side handler is attached to that `Worker`
  instance, never to `window` or any global, and it may do one thing: call the `onWake` callback
  it was given (`render()`, a read).
- **Still forbidden everywhere:** `window`/global `message` listeners, `storage` listeners, and
  `BroadcastChannel`. No other page, tab or frame can reach this channel, because a dedicated
  worker's port belongs to the page that created it.
- **Enforcement:** the AC-03 scan is reworked, not deleted. `postMessage(` / `onmessage` are
  permitted in `src/ui/wakeup.js` only. Every other pattern and every other file keeps its current
  rule. `review` checks that the handler calls nothing but `onWake`.
- The premise of core-timer ADR-0002 holds in substance: no engine control method is reachable from
  any channel. A pointer amendment is added to that ADR.

## Consequences

**Positive**
- Meets the ≤ 1 s hidden-tab target without a second clock. Completion, the chime and the title
  stay derived from the one wall-clock deadline (core-timer ADR-0001).
- Correctness never depends on `cancel()` arriving. A stale or duplicate wake-up only runs a
  `render()`, which is idempotent. When the page is paused or reset, nothing completes and no chime
  plays (AC-07).
- Lifecycle is owned by the browser. A dedicated worker belongs to its page, so closing, reloading
  or navigating the tab terminates it automatically, and a discarded or frozen tab stops it with the
  page. That matches `spec.md` §3 (no surviving a reload or discard; a frozen tab behaves as after a
  sleep, AC-06b).
- No file, no fetch, no permission. The worker source ships inside the bundle.

**Negative**
- One more moving part in `src/ui/`, and the first worker in the repo.
- It reopens core-timer ADR-0002's "no input channel" premise. The AC-03 source-scan test must be
  reworked, not just amended, to allow the one page↔worker channel (see "Amends core-timer
  ADR-0002" above).
- Playwright's fake page clock (used by `test-e2e/`) does not drive a worker's timers. The e2e
  suite verifies completion, chime selection and exactly-once through the normal render loop under
  the fake clock. True hidden-tab timing is verified by a real-time check plus the manual stopwatch
  run in desktop Chrome that
  `spec.md` §6 already names.
- Needs a spike: a Blob-URL worker must be confirmed to start when `index.html` is opened from
  `file://` in both target browsers, and the existing zero-network-requests e2e check
  (`test-e2e/durations.e2e.js:226`) must not count the `blob:` URL as a request (`sad.md` §11).

**Neutral**
- Phones are unaffected either way. A phone browser suspends the whole page in the background,
  worker included, so the after-sleep path (AC-06b) applies, as `spec.md` §3 scopes it. Option 2
  would have had the same limit. A future native wrapper would be a different target surface
  (`mobile-app`) needing native local notifications, which is a separate decision.
- Relies on current browser throttling policy, under which dedicated-worker timers are not subject
  to page-level intensive throttling. A future policy change is a `sad.md` §11 risk, caught by the
  manual timing check.

## Links

- Spec: [[../spec.md]] AC-06, AC-06b, AC-07, §3, §6
- SAD: [[../sad.md]] §4 (decision 3), §5, §6 Flows 1–2, §11
- Related ADR: [[0002-extend-engine-snapshot-with-phase-length-and-completion-record]] (the render
  path this wake-up triggers); [core-timer ADR-0001](../../core-timer/adr/0001-wall-clock-deadline-timing.md);
  [core-timer ADR-0002](../../core-timer/adr/0002-structural-encapsulation-control-guard.md) (amended
  by this ADR, see "Amends core-timer ADR-0002")

## Spike result (T1, 2026-09-30)

- **Chromium (Microsoft Edge, headless, Playwright):** an inline Blob-URL worker starts from a
  `file://` `index.html`, receives a message and posts one back after 50 ms, with its URL revoked
  right after construction. Asserted by the e2e test "sensory-feedback spike" in
  `test-e2e/durations.e2e.js`.
- **The zero-network check** now ignores `blob:` URLs only. A positive control (a real `http:`
  request from the page) is still counted.
- **Firefox: out of scope for now.** Firefox support for the background timing promise is a separate,
  later feature (`docs/roadmap.md` step 6). It has not been tested: no Firefox was available. If the
  worker cannot start there, the main-thread fallback applies and a chime in a long-hidden tab may be
  late. The follow-up feature must run the `file://` Blob-worker check and the hidden-tab timing run.

> **Amendment (2026-10-01, owner):** sensory-feedback `spec.md` AC-06b changed. A stale completion, one the page notices more than 2 minutes after its true moment, plays no chime and shows no sound-unavailable notice, so "exactly one chime per completion" holds for every non-stale completion. The decision recorded here is unchanged; the text above is left as written.
