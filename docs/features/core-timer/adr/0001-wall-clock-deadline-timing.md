---
status: Accepted
owner: "sergii.kushnir@gmail.com"
reviewers: []
updated_at: "2026-09-05"
feature_size: "XS"
ticket: "docs/roadmap.md step 2"
---

# 0001 — Use an absolute wall-clock deadline for countdown timing, not a per-tick counter

- **Status:** Accepted
- **Date:** 2026-09-05
- **Deciders:** Architect (sergii.kushnir@gmail.com), during `design`'s Socratic pass

## Context

core-timer's central technical challenge is a countdown that stays accurate even when the browser
tab is backgrounded, throttled, or the machine sleeps mid-phase (US-06). `spec.md` §1 already
committed to computing remaining time "from real elapsed wall-clock time rather than a naive tick
counter" — this ADR records that decision formally, at the point in the architecture where the
timing mechanism becomes a §5 building-block contract (the shape of the state `src/logic/`
exposes to `src/ui/`).

## Decision drivers

- Spec §6 NFR: "Countdown drift after backgrounding or sleep ≤ 1s versus true wall-clock elapsed
  time", measured by backgrounding the tab (and separately suspending the machine) for 5 min
  mid-phase and comparing displayed remaining time to a stopwatch.
- AC-05: on return from backgrounding, the system must reflect **at most one** completed phase
  boundary, however long the absence — never an unattended chain of transitions.
- `CLAUDE.md` / `architecture-map.md`: `src/logic/` must stay pure (no DOM, no browser APIs), so
  the mechanism must be expressible as ordinary timestamp arithmetic, not a `requestAnimationFrame`
  or DOM-dependent loop.

## Considered options

1. **Naive per-tick counter** — a `setInterval(..., 1000)` callback decrements a `remainingSeconds`
   field by 1 on every fire. Explicitly named and rejected in spec §1: browsers throttle or fully
   suspend timers in backgrounded/inactive tabs and during machine sleep, so ticks are missed —
   the countdown silently falls behind real elapsed time with no way to tell how far.
2. **Absolute wall-clock deadline** — on Start/resume, compute `deadlineAt = now + remainingMs` once;
   remaining time for display is always `deadlineAt - now`, recomputed fresh from `Date.now()` on
   every render tick and on tab-visibility-return, never accumulated from missed ticks.

## Decision outcome

**Chosen:** Option 2, absolute wall-clock deadline. It makes drift structurally impossible between
renders (each read is independent, no accumulated error) and gives AC-05's reconciliation a simple
rule: on return, if `now >= deadlineAt`, exactly one phase boundary is crossed and the next phase
starts at its full duration, waiting for Start — any further overshoot is discarded by construction,
because the new phase is idle (not running), and no `deadlineAt` for it exists until the User
presses Start again.

## Consequences

**Positive**
- Meets the ≤1s drift NFR by construction — display accuracy no longer depends on timer-firing
  reliability, only on `Date.now()` being correct.
- AC-05's "at most one boundary" rule falls out naturally: the next phase is armed but not running,
  so no second deadline exists to overshoot into.
- `src/logic/` stays pure and unit-testable: `getSnapshot(now)` is a deterministic function of its
  state and an injected timestamp — no real timers needed in tests.

**Negative**
- Every state-machine query needs a `now` argument threaded through from `src/ui/`, which is a
  slightly larger function-signature surface than "just decrement a counter".
- Pause/Reset must convert the live deadline back into a stored remaining-duration (`deadlineAt -
  now` at the moment of pausing) rather than just stopping a counter — one extra arithmetic step at
  each transition.

**Neutral**
- The per-tick counter approach is not salvageable later without a rewrite of the state shape; this
  was accepted as a one-way door because the NFR makes drift-free timing non-negotiable from day one.

## Links

- Spec: [[../spec.md]] §1, §6
- SAD: [[../sad.md]] §4
- Related ADR: [[0002-structural-encapsulation-control-guard]]
