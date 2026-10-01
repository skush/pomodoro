---
status: Accepted
owner: "sergii.kushnir@gmail.com"
reviewers: []
updated_at: "2026-10-01"
feature_size: "S"
ticket: "docs/features/break-flow/spec.md"
---

# 0001 — Auto-start breaks with a backdated start from the UI, keeping the engine's idle-after-completion rule

- **Status:** Accepted
- **Date:** 2026-10-01
- **Deciders:** Architect (sergii.kushnir@gmail.com), during `design`'s Socratic pass

## Context

`spec.md` AC-01 needs a break to start counting down by itself after an On-time Focus completion
(noticed ≤ 5 s after the true end), measured from that true end, with its length "checked and
corrected exactly as for any fresh start". AC-03 needs a late completion to leave the break
waiting. Today the engine's `settle(now)` advances at most one phase boundary and always leaves
the next phase idle (core-timer AC-05). The UI's `prepareStart()` re-reads and corrects the saved
durations before every fresh start, as adjustable-durations requires. This decision fixes which
layer turns "the Focus phase just ended" into "the break is running".

## Decision drivers

- `spec.md` §6: auto-started break accuracy ≤ 1 s against (full length − real time since the Focus
  end), and the On-time tolerance tested at 5 s and 5.001 s with an injected clock.
- `spec.md` AC-12 / AC-14: saved Configured durations are re-read "before each fresh start, which
  now includes a break that auto-starts", and a change committed before the Focus end applies to
  the auto-started break.
- `spec.md` AC-02: at most one phase per completion starts without the User, and never Focus.
- `CLAUDE.md` layering: `src/logic/` has no browser APIs, so it can't read local storage itself.

## Considered options

1. **UI backdated start** — the engine is unchanged at completion (the break loads idle). A pure
   `isOnTimeCompletion(at, now)` in `src/logic/` decides On-time. `render()` in `src/ui/`, seeing an
   On-time Focus completion with Auto-start breaks on, runs `prepareStart()` on the idle break and
   calls `engine.start(at)` with the Focus phase's true end.
2. **Engine auto-start in `settle()`** — the engine holds an auto-start flag and the tolerance, and
   `settle()` starts the break running from the Focus deadline.

## Decision outcome

**Chosen:** Option 1, the UI backdated start. The break's length is pinned only after the
ordinary pre-start correction has re-read the saved durations, which satisfies AC-12 and AC-14
without a new storage path. The engine keeps one simple completion rule that core-timer,
session-tracking and sensory-feedback all rely on. Accuracy follows directly from passing the
true end: the deadline becomes `at + full length`, so the remaining time is exact. Option 2 would
pin the break from the in-memory durations before any storage read could run, and it would make
the engine own a UI preference.

## Consequences

**Positive**
- `settle()` and the one-shot completion record (sensory-feedback ADR-0002) are unchanged, so the
  Focus-end chime and the session credit still happen exactly once, from the snapshot that
  carried the completion.
- The On-time rule is a pure function with a direct 5 s / 5.001 s unit test, and accuracy is a
  unit test on `start(at)` with an injected clock.
- AC-02's "at most one phase per completion" holds by construction: the only automatic start is
  this branch, and it runs only for a Focus completion.
- The Skip guard for an auto-started break starts at the true Focus end for free, because the
  engine records the fresh-start time it is given (ADR-0002).

**Negative**
- `render()` becomes an orchestrator. It takes one snapshot, which consumes the completion, may
  start the break, and then takes a second snapshot for display. The chime and the credit must come
  from the first snapshot and the ring and title from the second, an ordering rule `tasks` must
  pin with a test (§8 One-shot consumption).
- `engine.start(now)` now receives a timestamp in the past on this path. That's legitimate, since
  only `src/ui/` calls it, but it's a new kind of call a reader may not expect.
- The auto-start branch must also re-arm the wake-up worker, because a render from the interval
  tick doesn't re-arm it today. Without that, the break-end chime of a break that auto-started in
  a visible tab could be late once the tab is hidden.

**Neutral**
- If a future feature wants Focus to auto-start too, it adds a second branch here. The engine
  doesn't change.

## Links

- Spec: [[../spec.md]] AC-01, AC-02, AC-03, AC-12, AC-13, AC-14, §6
- SAD: [[../sad.md]] §4 decision 3, §6 Flow 1, §8 One-shot consumption
- Related ADR: [[0002-enforce-skip-guard-and-focus-pause-policy-in-the-engine]] (startedAt and the guard)
