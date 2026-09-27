---
id: T3
title: "Unit tests for the engine state machine (control no-ops, cadence, guard)"
layer: "tests"
deps: ["T1", "T2"]
blocks: ["T6"]
acs: ["AC-01", "AC-01b", "AC-02b", "AC-02c", "AC-03", "AC-04", "AC-05", "AC-06", "AC-07", "AC-08"]
files_hint: ["test/logic/timer-engine.test.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
context_budget: "S"
status: "todo"
---

# T3 — Unit tests for the engine state machine (control no-ops, cadence, guard)

## Place in the sequence

- **Blocked by:** T1 — Implement engine control state machine, T2 — Implement phase cadence and backgrounding reconciliation. **Blocks:** T6 — Automated drift/backgrounding hardening test (extends this same file). **Wave:** 2 (needs the engine to exist to test against).
- **Lane:** own file (`test/logic/timer-engine.test.js`), no overlap with T1/T2's `src/logic/index.js`.

## Why (user story)

> **As a** User
> **I want** to trust the countdown when I'm away from the tab
>
> — `spec.md §4, US-06, abridged` · full text: [spec.md](../spec.md)

This task is the automated proof (per spec §6 NFR "enforced by unit tests on the state machine") that T1/T2's engine actually satisfies every state-machine acceptance criterion, not just that it compiles.

## Inlined context

> Concurrency / state safety | at most one phase is ever "running" at a time; no double-counted elapsed time | enforced by unit tests on the state machine
>
> — `spec.md §6, NFR table row "Concurrency / state safety", verbatim` · full text: [spec.md](../spec.md)

> **Chosen:** Option 1, structural encapsulation only. ... a test can dispatch a `MessageEvent` at `window` and assert no state change (nothing listens, so nothing happens — directly exercising the "message from another tab/origin" scenario), and the existing AC-01b ... and AC-02b ... unit tests already cover "an unwired/redundant input reaches a control function" from the inside.
>
> — `docs/features/core-timer/adr/0002-structural-encapsulation-control-guard.md, Decision outcome, abridged` · full text: [adr/0002](../adr/0002-structural-encapsulation-control-guard.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

All ten of the engine-level ACs this test suite asserts are quoted in full in [T1](./t1-engine-controls.md) (AC-01, AC-01b, AC-02b, AC-02c, AC-03, AC-06, AC-08) and [T2](./t2-cadence-reconciliation.md) (AC-04, AC-05, AC-07) — this task does not re-derive behavior, it writes the assertions against theirs.

— `spec.md §5, AC-01/AC-01b/AC-02b/AC-02c/AC-03/AC-04/AC-05/AC-06/AC-07/AC-08, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `node:test` suite for `createTimerEngine()` initial state (AC-08) — `test/logic/timer-engine.test.js`
- [ ] Tests for `start`/`pause`/`reset` happy paths and no-op guards (AC-01, AC-01b, AC-02b, AC-02c, AC-06) — `test/logic/timer-engine.test.js`
- [ ] Tests for cadence transitions incl. the 4th-focus-to-long-break rule (AC-04, AC-07) — `test/logic/timer-engine.test.js`
- [ ] Test for the AC-05 "at most one boundary" backgrounding scenario using a synthetic large `now` jump — `test/logic/timer-engine.test.js`
- [ ] Test dispatching a `window` `MessageEvent` and asserting no state change, plus a note that no `message` listener is registered (AC-03) — `test/logic/timer-engine.test.js`
- [ ] Unit test for `formatDuration` ceiling rounding (spec §6 NFR display rounding row) — `test/logic/timer-engine.test.js`

## Edge cases

| Case | Behaviour |
|---|---|
| `formatDuration` given the exact full duration | Shows full duration immediately, no off-by-one |
| `formatDuration` given `0` | Shows `0:00`, never negative |
| Redundant Start/Pause interleaved rapidly | Each no-op leaves state byte-for-byte unchanged (AC-01b/AC-02b) |

## Definition of Done

- [ ] `npm test` passes with all listed cases green
- [ ] every Hard Rule inlined above still holds
- [ ] lint + vet clean
