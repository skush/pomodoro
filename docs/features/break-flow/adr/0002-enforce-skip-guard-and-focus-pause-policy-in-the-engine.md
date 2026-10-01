---
status: Accepted
owner: "sergii.kushnir@gmail.com"
reviewers: []
updated_at: "2026-10-01"
feature_size: "S"
ticket: "docs/features/break-flow/spec.md"
---

# 0002 — Enforce the Skip guard and the focus-pause policy inside the engine with two new methods

- **Status:** Accepted
- **Date:** 2026-10-01
- **Deciders:** Architect (sergii.kushnir@gmail.com), during `design`'s Socratic pass

## Context

`spec.md` AC-04/AC-04b add Start focus during a break: it ends the break with no chime and no
change to the cycle, then starts Focus. AC-05 makes that press do nothing for 3 s of real time
after any break start, with no extension from a pause and no new guard on Resume break. AC-15
says that, with Allow pausing focus off, "a pause requested by any other means (for example
bypassing the hidden control) does nothing". Today the engine exposes six methods, and its surface
is pinned by a test in `test/logic/timer-engine.test.js`. core-timer ADR-0002 makes the engine
reachable only from `src/ui/`. This decision fixes where those two rules are enforced.

## Decision drivers

- `spec.md` §6: Skip guard length 3 s (± 0.25 s), measured by "unit test on the guard rule with an
  injected clock".
- `spec.md` AC-15 and §6.1 abuse case: a forced pause of Focus does nothing.
- `spec.md` AC-04b: a Skipped break never touches the in-cycle focus count or the Session counter,
  a rule that lives with the engine's `focusCount`.
- core-timer ADR-0002: the engine's state changes only through its own methods, so a rule kept in
  the engine holds for every caller.

## Considered options

1. **Inside the engine** — add `startFocus(now)` (ends a break, running, paused or waiting, and
   starts the next Focus; no-op inside the Skip guard, measured from the snapshot's new `startedAt`)
   and `setAllowPausingFocus(on)` (`pause(now)` does nothing for a running Focus while it's off).
   Both rules have pure helpers in `src/logic/controls.js`.
2. **In the UI handlers only** — the engine gets a generic `skipToFocus(now)` and knows nothing of
   the guard or the policy. The click handlers check both before calling.

## Decision outcome

**Chosen:** Option 1, inside the engine. Both rules then hold for every input path, which is what
AC-15's "any other means" asks for, and they get unit tests on the engine itself with an injected
clock. Recording `startedAt` at each fresh start (and keeping it through pause and resume) gives
the guard exactly the spec's measuring points: the true Focus end for an auto-started break
(ADR-0001 passes it to `start`), and the Start break press for a User-started one. A paused break
keeps its `startedAt`, so a pause can't extend the guard. Resume isn't a fresh start, so it starts
no new guard, and Reset clears it, leaving the waiting break with no guard. Option 2 leaves the
rules to the order of the UI code. A direct engine call, or a future second caller, would bypass
both.

## Consequences

**Positive**
- The AC-05 timing table and AC-15 become engine unit tests, with no DOM needed.
- The UI forwards every Start focus press to the engine and never decides the guard itself. The
  greyed-out look can trail by up to one 250 ms render tick, but the behaviour is exact (within the
  §6 ± 0.25 s).
- `startFocus` keeps `focusCount` untouched by construction (AC-04b). After a Skipped Long break,
  the count is already 0 because it reset when the Long break began, so the cycle continues from
  its first Focus.

**Negative**
- The engine surface grows from six methods to eight. The pin in `test/logic/timer-engine.test.js`
  ("no new control method", sensory-feedback) and core-timer ADR-0002's "exactly these controls"
  wording are amended by this ADR. The snapshot shape pin also gains `startedAt` and
  `allowPausingFocus`.
- The engine now holds one User preference (Allow pausing focus). It's pushed in by `src/ui/` like
  the Configured durations, so it isn't read from storage by the engine.

**Neutral**
- Making a Long break harder to skip (`spec.md` §8, open until `tasks`) would become a per-phase
  guard length in `isSkipGuardActive`. That's a local change.

## Amends

- core-timer ADR-0002 (structural encapsulation): the guard's premise is unchanged. The engine is
  still reachable only from `src/ui/`, and no `message`/`storage` listener is added. The list of
  control methods grows by `startFocus` and `setAllowPausingFocus`.

## Links

- Spec: [[../spec.md]] AC-04, AC-04b, AC-05, AC-15, AC-16, AC-17, §6, §6.1
- SAD: [[../sad.md]] §4 decision 4, §6 Flow 2
- Related ADR: [[0001-auto-start-breaks-with-a-backdated-start-from-the-ui]],
  [[0003-derive-controls-from-a-pure-layout-rendered-into-fixed-slots]],
  core-timer [[../../core-timer/adr/0002-structural-encapsulation-control-guard]]
