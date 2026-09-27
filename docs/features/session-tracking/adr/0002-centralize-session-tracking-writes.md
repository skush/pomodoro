---
status: Accepted
owner: "sergii.kushnir@gmail.com"
reviewers: []
updated_at: "2026-09-28"
feature_size: "XS"
ticket: "docs/roadmap.md step 3"
---

# 0002 — Centralize session-tracking's local-storage writes through one gatekeeper function

- **Status:** Accepted
- **Date:** 2026-09-28
- **Deciders:** Architect (sergii.kushnir@gmail.com), during `design`'s Socratic pass

## Context

`spec.md` AC-07 already settled the *policy* during `clarify`: only a Focus-completion event, the
task-label's own commit, and the daily-rollover check may ever write the persisted count/date/label,
and the app's own next write from one of those three always overwrites whatever it finds saved —
never adopting an external change (another tab, a devtools edit). This decision is narrower: **how**
that already-decided policy is structurally guaranteed in code, extending core-timer's own
[`core-timer/adr/0002-structural-encapsulation-control-guard`](../../core-timer/adr/0002-structural-encapsulation-control-guard.md)
(which guards the in-memory engine the same way) to the new local-storage writes this feature
introduces.

## Decision drivers

- `spec.md` AC-07: "a built and testable behavior, not merely an assumption about browser
  isolation" — the same standard core-timer's own AC-03 held itself to for the in-memory engine.
- `spec.md` §7 KPI "Counter/label write integrity": 100% of external write attempts must be confirmed
  to trigger no app logic, and confirmed overwritten by the app's own next legitimate write —
  verified by unit tests.
- `CLAUDE.md` layering rule: only `src/ui/` may touch local storage; `src/logic/` never does.

## Considered options

1. **One centralized write function** (e.g. `persistState(patch)`) that all three legitimate triggers
   call through — the only place in the codebase that calls the storage-write API.
2. **Three independent inline write call sites** — each trigger (completion handler, label's blur/Enter
   handler, rollover check) calls the storage-write API directly, with no shared function between
   them.

## Decision outcome

**Chosen:** Option 1, one centralized write function. It gives the AC-07 / KPI guarantee a single,
exhaustively-testable choke point: one unit-test suite can assert that the function always overwrites
(never merges with) whatever is currently stored, and a source-level scan (mirroring core-timer's own
AC-03 test) can assert that no other code path in `src/ui/` calls the storage-write API directly. That
combination is what makes the guarantee "built and testable" rather than an inspection-only claim
spread across three separate call sites.

Option 2 was considered — it costs less indirection and mirrors core-timer's minimal style (`AC-01b`/
`AC-02b`'s no-op guards are each proven independently, not through a shared function) — but three
independent call sites means the "only these three paths write" claim has to be re-verified at three
separate locations every time the code changes, and a future fourth accidental write site is easier to
introduce unnoticed. Given `spec.md` explicitly elevates this guarantee to its own acceptance
criterion (AC-07) rather than leaving it implicit, the stronger, single-point guarantee was judged
worth the small extra indirection.

## Consequences

**Positive**
- The "always overwrite, never adopt" rule is implemented exactly once — no risk of two call sites
  drifting to different semantics over time.
- A single function is easy to point reviewers and future maintainers at when asked "where's the
  AC-07 guard enforced?" (avoiding the exact criticism core-timer's own ADR-0002 logged against
  itself: "the guard isn't one dedicated, named function a reviewer can point to").
- Unit-testing the write-integrity KPI (100% of external attempts overwritten) requires exercising one
  function, not reconciling behavior across three.

**Negative**
- One additional layer of indirection for what could be three direct `localStorage.setItem` calls —
  a small readability cost for a small feature.
- The three triggers must all agree on the same patch shape when calling the function, a light
  coordination cost that three independent call sites wouldn't have.

**Neutral**
- `spec.md` §8 resolved during this same design pass that the task label does **not** clear when a
  Long break begins — it persists indefinitely, so there is no fourth write trigger today. If a future
  feature ever reopens that decision (or adds any other legitimate trigger), it plugs into this same
  centralized function rather than requiring a new independent call site.

## Links

- Spec: [[../spec.md]] §5 AC-07, §7 KPI "Counter/label write integrity", §8 (task-label persistence
  resolution)
- SAD: [[../sad.md]] §4, §5, §8
- Related ADR: core-timer's [[../../core-timer/adr/0002-structural-encapsulation-control-guard]];
  sibling [[0001-expose-true-focus-completion-timestamp]]
