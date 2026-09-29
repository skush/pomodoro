---
status: Accepted
owner: "sergii.kushnir@gmail.com"
reviewers: []
updated_at: "2026-09-29"
feature_size: "S"
ticket: "docs/roadmap.md step 4"
---

# 0002 — Centralize the four duration/cycle-length settings' local-storage writes through a second gatekeeper function

- **Status:** Accepted
- **Date:** 2026-09-29
- **Deciders:** Architect (sergii.kushnir@gmail.com), during `design`'s Socratic pass

## Context

`spec.md` AC-08 already settled the *policy* during `clarify`: the four new settings (Focus/
Short-break/Long-break Configured duration + Configured cycle length) may only ever be written by
three legitimate triggers — a duration-field commit, a cycle-length-field commit, and the load-time/
pre-start correction (AC-06/AC-12) — and each of those writes must persist the **full current
in-memory state of all four settings together**, overwriting whatever was saved, never adopting an
external change. AC-08 also draws a hard boundary: this write guard must be structurally **separate**
from session-tracking's existing one — the daily count, tracked date, and task label "remain writable
only by their own three existing triggers, unaffected by duration or cycle-length commits, exactly
as before." This decision is narrower than the policy itself: **how** that policy is structurally
guaranteed in code, extending session-tracking's own
[`session-tracking/adr/0002-centralize-session-tracking-writes`](../../session-tracking/adr/0002-centralize-session-tracking-writes.md)
(which centralizes count/date/label the same way) to this feature's four new keys, as a second,
independent gatekeeper rather than a widened version of the first.

## Decision drivers

- `spec.md` AC-08: "a built and testable behavior, not merely an assumption about browser
  isolation," and explicitly split from session-tracking's own guard — the two must not
  cross-contaminate.
- `spec.md` §6 NFR "Corrupted/missing persisted duration" and "Cycle-length persistence + fallback":
  0 thrown exceptions, 0 instant completions, verified by unit test.
- `CLAUDE.md` layering rule: only `src/ui/` may touch local storage; `src/logic/` never does.
- Precedent: [`session-tracking/adr/0002-centralize-session-tracking-writes`](../../session-tracking/adr/0002-centralize-session-tracking-writes.md)
  already weighed this exact shape of decision (one centralized writer vs. independent inline call
  sites) for a 3-trigger/N-field write guard and chose the centralized function; this decision
  either reuses that precedent's reasoning for durations/cycle-length or explicitly departs from it.

## Considered options

1. **A second centralized write function**, `persistDurationConfig(storage, {focusDuration,
   shortBreakDuration, longBreakDuration, cycleLength})` — the only place that writes the four
   `adjustable-durations:*` keys, called only from the three legitimate triggers, always writing all
   four fields together. Entirely separate from `persistState()` (session-tracking's count/date/label
   writer) — different function, different keys, different triggers.
2. **Three independent inline write call sites** — each trigger (duration-field commit,
   cycle-length-field commit, load-time/pre-start correction) calls `storage.setItem()` directly for
   each of the four keys, with no shared function between them.

## Decision outcome

**Chosen:** Option 1, a second centralized write function. It gives AC-08's "always write all four
fields together" guarantee a single, exhaustively-testable choke point — one unit-test suite proves
the invariant once, rather than three independent call sites each needing to independently prove
the same thing and stay in sync by hand as the code evolves. It reuses the identical reasoning
[`session-tracking/adr/0002-centralize-session-tracking-writes`](../../session-tracking/adr/0002-centralize-session-tracking-writes.md)
already applied to the same shape of problem (a 3-trigger, always-overwrite-the-full-state write
guard) one feature ago, for the same underlying risk: a future fourth accidental write site, or a
future fifth setting, is easier to introduce correctly against one function's parameter shape than
against three independently-maintained inline blocks.

Option 2 was considered — it costs less indirection (no jump to a separate function to see what's
written) and mirrors core-timer's own original minimal style, which never needed a centralized writer
at all — but AC-08's "always overwrite all four fields together" invariant would then depend on three
humans (present or future) independently keeping three identical four-line blocks in sync, exactly
the failure mode `session-tracking/adr/0002` already rejected this shape for. Given `spec.md`
elevates this guarantee to its own acceptance criterion (AC-08) rather than leaving it implicit, the
stronger, single-point guarantee was judged worth the small extra indirection, consistent with the
precedent this decision extends.

## Consequences

**Positive**
- The "always overwrite all four fields together, never a partial patch" rule is implemented exactly
  once — no risk of the three trigger call sites drifting to different shapes over time.
- Structurally separate from `persistState()` by construction (different function, different key
  set) — directly satisfies AC-08's explicit requirement that the two write guards never
  cross-contaminate, with no possibility of an accidental merge later.
- Unit-testing the AC-08 write-integrity guarantee requires exercising one function, not reconciling
  behavior across three independent call sites.

**Negative**
- One additional layer of indirection for what could be three direct `localStorage.setItem` call
  blocks — a small readability cost, same trade-off session-tracking's own ADR-0002 already accepted
  for count/date/label.
- The three triggers must all agree on the same four-field patch shape when calling the function, a
  light coordination cost three independent call sites wouldn't have.

**Neutral**
- Two structurally similar but functionally independent gatekeeper functions now exist in
  `src/ui/index.js` (`persistState` for count/date/label, `persistDurationConfig` for the four new
  settings) — a future reader needs to know which one owns which keys; this is the direct, intended
  consequence of AC-08's split requirement, not an accident.
- If a future feature adds a fifth runtime-configurable setting related to durations/cycle length, it
  plugs into this same centralized function rather than requiring a new independent call site.

## Links

- Spec: [[../spec.md]] §5 AC-06, AC-08, AC-12, §7 KPI "Duration + cycle-length round-trip persistence"
- SAD: [[../sad.md]] §4, §5, §8
- Related ADR: session-tracking's [[../../session-tracking/adr/0002-centralize-session-tracking-writes]];
  sibling [[0001-extend-engine-surface-with-configurable-durations]]
