---
status: Accepted
owner: "sergii.kushnir@gmail.com"
reviewers: []
updated_at: "2026-09-30"
feature_size: "S"
ticket: "docs/roadmap.md step 5"
---

# 0002 — Extend the engine snapshot with the pinned phase length and a one-shot completion record for every phase

- **Status:** Accepted
- **Date:** 2026-09-30
- **Deciders:** Architect (sergii.kushnir@gmail.com), during `design`'s Socratic pass

## Context

The ring and the chime need two facts that `createTimerEngine().getSnapshot(now)` does not expose
today. Its current shape is `{phase, running, idle, remainingMs, focusCount, justCompletedFocusAt}`
(`src/logic/index.js`, HEAD `61700da`).

1. **The full length the current phase started with.** The Progress ring measures remaining time
   against it, not against the live Configured duration. It must neither jump nor stick when the
   User commits a new duration mid-phase (`spec.md` AC-08, CONTEXT "Progress ring"). The engine
   already pins this privately as `phaseFullMs`, set when a phase enters its idle state and kept
   through Start, Pause and Resume, per adjustable-durations ADR-0001.
2. **That a phase just completed, which phase type it was, and when.** This selects the Focus-end
   vs break-end tone (AC-05) and fires it exactly once (AC-07, AC-06b). session-tracking's
   `justCompletedFocusAt` covers Focus only. A break completion is invisible today.

## Decision drivers

- `spec.md` AC-08 / §6 "Ring vs countdown agreement": the ring stays within 1 s-equivalent of the
  countdown and measures against the length the phase started with.
- `spec.md` AC-05 / AC-07 / AC-06b: the right tone, exactly once per Phase completion, never on a
  User control, never repeated on return to the tab.
- `CLAUDE.md`: `src/logic/` is the unit-tested, DOM-free layer. Rules belong where they can be
  tested under plain Node.
- [`session-tracking/adr/0001`](../../session-tracking/adr/0001-expose-true-focus-completion-timestamp.md):
  the one-shot, latched-in-`settle()`, consumed-by-`getSnapshot()` pattern already exists and is
  tested.
- [`core-timer/adr/0002`](../../core-timer/adr/0002-structural-encapsulation-control-guard.md): the
  frozen control surface must not widen.

## Considered options

1. **Extend the snapshot (read-only).** Add `phaseFullMs` (the current phase's pinned full length)
   and `justCompleted: {phase, at} | null`, a one-shot record latched in `settle()` for **every**
   phase type and consumed by the next `getSnapshot()`.
2. **Infer in the UI.** Leave the engine unchanged. `src/ui/` treats "phase differs from the
   previous render" as a completion, and records the ring's starting length itself from
   `remainingMs` while the phase is idle.

## Decision outcome

**Chosen:** Option 1. Both facts are rules the engine already implements: the pinned length and its
idle/started/Reset lifecycle (AC-08), and the single completion transition in `settle()`. Exposing
them read-only keeps one source of truth, and it keeps the exactly-once guarantee in the pure, unit-tested
layer, using the same consume-once mechanism session-tracking already proved. Option 2 would
re-implement AC-08's idle-vs-started rules in the DOM layer, where they can drift from the engine
and are testable mainly through e2e. It would also make exactly-once depend on UI state carried
between renders, and it cannot know a break's true completion moment.

Shape (for `tasks`):
- `getSnapshot(now)` gains `phaseFullMs` (ms, the value `clampRemaining` already bounds by) and
  `justCompleted` (`{phase: 'focus'|'short_break'|'long_break', at: <true deadline ms>}` or `null`).
- `justCompleted` is latched in `settle()` beside the existing `justCompletedFocusAt` and cleared by
  the `getSnapshot()` that returns it, the same one-shot rule. Because `start`/`pause`/`reset` also
  call `settle()`, a completion detected inside a control call survives until the next render.
- `justCompletedFocusAt` is **unchanged**. session-tracking keeps reading it, so it is additive only.
- **No new control method.** The engine's frozen method set stays at six.
- New pure helpers in `src/logic/` read the snapshot and nothing else. Examples are the ring
  fraction and the tab-title text (`sad.md` §5).

## Consequences

**Positive**
- Exactly-once chime and ring-vs-start-length both become Node unit tests, with no DOM and no timer.
- The break-end tone gets a true completion moment, the same as Focus.
- The User-facing control surface and the AC-03 input guard are untouched.

**Negative**
- Touches a shipped, reviewed module. `test/logic/timer-engine.test.js` pins the snapshot shape and
  needs a mechanical amendment in the same PR.
- There are now two one-shot fields. `render()` must remain the **only** caller of `getSnapshot()`
  in `src/ui/`. A second caller would silently consume a completion, and with it the chime and the
  session credit. The start path already follows this rule (`prepareStart` reads the last rendered
  snapshot, never a fresh one).

**Neutral**
- `justCompletedFocusAt` is now derivable from `justCompleted`. Folding it in later is a small,
  optional clean-up, not done here to keep session-tracking's code untouched.

## Links

- Spec: [[../spec.md]] AC-01, AC-02, AC-05, AC-06b, AC-07, AC-08, AC-10
- SAD: [[../sad.md]] §4 (decision 4), §5, §6
- Related ADR: [[0001-wake-the-page-at-the-deadline-from-an-inline-worker]] (triggers the render
  that consumes this record); [session-tracking ADR-0001](../../session-tracking/adr/0001-expose-true-focus-completion-timestamp.md)
