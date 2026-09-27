---
id: T6
title: "Automated backgrounding/drift hardening test for QG-1"
layer: "tests"
deps: ["T3"]
blocks: []
acs: ["AC-05"]
files_hint: ["test/logic/timer-engine.test.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
context_budget: "S"
status: "todo"
---

# T6 — Automated backgrounding/drift hardening test for QG-1

## Place in the sequence

- **Blocked by:** T3 — Unit tests for the engine state machine (extends the same describe-block-per-concern file). **Blocks:** none — this is a hardening addition, nothing downstream depends on it. **Wave:** 3 (can run any time after T3; independent of T4/T5).
- **Lane:** shares `test/logic/timer-engine.test.js` with T3 — serialized.

## Why (user story)

> **As a** User
> **I want** the countdown to stay accurate even if I switch tabs or minimize the browser
> **So that** the phase ends at the correct real-world time, not late because the tab was backgrounded
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

This task closes the risk flagged in sad §11 by adding a scripted, deterministic drift assertion instead of relying only on the manual stopwatch check.

## Inlined context

> The ≤1s drift NFR (QG-1) is verified only manually (stopwatch), no automated backgrounding/sleep test | Medium | Documented manual-check procedure in spec §6; a scripted fake-timer test could be added in a later hardening pass, not required for this step | Tech Lead
>
> — `sad.md §11, Risks and technical debt table, verbatim` · full text: [sad.md](../sad.md)

> **QG-1. Countdown accuracy under backgrounding/throttling** — **When:** a focus or break phase is running and the User backgrounds the tab, minimizes, or the machine itself sleeps for any length of real time, then the User returns. **Then:** countdown drift after backgrounding or sleep is ≤ 1s versus true wall-clock elapsed time.
>
> — `sad.md §10, QG-1, abridged` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-05 — cross-context

> **Given** a focus or break phase is running and the User backgrounds, minimizes, or the machine itself sleeps for any length of real time
> **When** the User returns to the tab
> **Then** the system reflects at most one completed phase boundary: if the true elapsed wall-clock time was enough to finish the running phase, the system now shows the correct next phase per the classic cadence at that next phase's full duration, waiting for the User to press Start — any additional elapsed time beyond that single completed phase is discarded and never triggers a second, unattended transition, even if far more real time actually passed
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add a deterministic test that starts a phase at `now = t0`, then calls `getSnapshot(now)` at `t0 + fullDuration - 1ms` and asserts remaining time reflects true elapsed time to the millisecond (no accumulator drift) — `test/logic/timer-engine.test.js`
- [ ] Add a test that jumps `now` far beyond one phase duration (simulating a long sleep) and asserts exactly one phase boundary advanced (reuses/extends the AC-05 case from T3 if not already exhaustive) — `test/logic/timer-engine.test.js`
- [ ] Note in the test file (comment) that this closes the sad §11 "manual-only" risk row — `test/logic/timer-engine.test.js`

## Edge cases

| Case | Behaviour |
|---|---|
| `now` queried exactly at `deadlineAt` | Boundary crossed (inclusive `>=` per the engine's `settle`) |
| Multiple full phase durations elapsed at once | Still exactly one boundary advances (AC-05) |

## Definition of Done

- [ ] `npm test` passes including the new deterministic drift assertions
- [ ] sad §11 risk row for QG-1's manual-only verification is updated to note the automated test exists
- [ ] every Hard Rule inlined above still holds
- [ ] lint + vet clean
