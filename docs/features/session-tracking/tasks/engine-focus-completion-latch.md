---
id: T1
title: "Latch the true Focus-completion timestamp inside the engine's settle()"
layer: "domain"
deps: []
blocks: ["T6", "T7"]
acs: ["AC-04", "AC-06"]
files_hint: ["src/logic/index.js", "test/logic/timer-engine.test.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
context_budget: "M"
status: "todo"
---

# T1 — Latch the true Focus-completion timestamp inside the engine's settle()

## Place in the sequence

- **Blocked by:** none — the first task in the graph. · **Blocks:** T6 — Today's count display: load-time rollover-check + Focus-completion crediting; T7 — Edge-case test hardening. · **Wave:** 1 (parallel with T2, T3 — all three are independent pure/engine changes).
- **Lane:** own lane (only task touching `test/logic/timer-engine.test.js`).

## Why (user story)

> **As a** User
> **I want** to see how many Focus sessions I've completed today
> **So that** I can gauge my progress without counting manually
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

This task builds the engine-level primitive US-02 (and US-04's midnight correctness) depends on: a way to know *exactly when* a Focus phase truly finished, not just that the app noticed it later.

## Inlined context

> **Chosen:** Option 1, latching the completion in `settle()` and exposing it through `getSnapshot()`'s return shape. ... Latching inside `settle()` itself (not inside `getSnapshot()` specifically) is what makes it correct regardless of which of the four public methods actually triggers the transition — a User clicking Pause the instant a phase completes still gets that completion reported on the *next* `getSnapshot()` call, because the latch was set when `settle()` ran, not lost because it ran from inside `pause()`.
>
> — `adr/0001-expose-true-focus-completion-timestamp.md §Decision outcome, verbatim` · full text: [adr/0001-expose-true-focus-completion-timestamp.md](../adr/0001-expose-true-focus-completion-timestamp.md)

> `start(now)`, `pause(now)`, and `reset(now)` each call the same internal `settle(now)` that `getSnapshot(now)` does ... so the transition that completes a Focus phase can fire inside **any** of the four public methods — not only `getSnapshot`. A design that only reports the completion from inside `getSnapshot` itself would silently drop it whenever the User happens to click Start, Pause, or Reset in the moment the deadline passes.
>
> — `adr/0001-expose-true-focus-completion-timestamp.md §Context, abridged` · full text: [adr/0001-expose-true-focus-completion-timestamp.md](../adr/0001-expose-true-focus-completion-timestamp.md)

> `src/logic/` still never imports `src/ui/`; `src/ui/` remains the only module that touches the DOM or the Web Storage API.
>
> — `sad.md §5, Building block view, verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-04 — happy path

> **Given** a User completes a Focus session naturally (its countdown reaches zero while running)
> **When** that completion is detected
> **Then** the system credits the completed-session count for the calendar day the session actually finished on (its true completion moment, not the moment the completion is detected) — if that day is still the day currently being tracked, the displayed count increases by exactly one; if a new calendar day has since begun, the increment does not carry into the new day (see AC-06), which starts at zero regardless
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-06 — cross-context

> **Given** the tab is left open, backgrounded, or the machine sleeps across local midnight, whether mid-session or between sessions
> **When** the count is next read (on page load, on the tab becoming visible, on any display refresh, or right before crediting a completed session — see AC-04) and local midnight has passed since the count was last reset
> **Then** the system resets the count to zero for the new calendar day before doing anything else with it — the previous day's count, and any session whose true completion fell before that midnight, is not carried into the new day's count
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

This task provides the `justCompletedFocusAt` signal both ACs are built on; T6 wires it into the actual credit/display logic.

## Checklist

- [ ] Add an internal latch to `settle(now)` in `createTimerEngine()` — the instant it detects a Focus phase's deadline has passed, record the true deadline timestamp — `src/logic/index.js`
- [ ] Extend `getSnapshot(now)`'s return shape with `justCompletedFocusAt: <ms timestamp> | null` — consume-and-clear the latch exactly once per completion — `src/logic/index.js`
- [ ] Confirm the latch is set regardless of whether `settle()` ran from inside `start`, `pause`, `reset`, or `getSnapshot` — `src/logic/index.js`
- [ ] Unit tests: completion during a `getSnapshot` poll; completion latched via `start`/`pause`/`reset` and consumed by the *next* `getSnapshot()` call; `null` on every call after consumption — `test/logic/timer-engine.test.js`

## Edge cases

| Case | Behaviour |
|---|---|
| Focus phase completes exactly while `pause(now)` is called | `justCompletedFocusAt` is latched inside `pause`'s internal `settle()` call and reported on the *next* `getSnapshot()`, not lost |
| Two `getSnapshot()` calls in a row with no new completion between them | Second call returns `justCompletedFocusAt: null` — the latch is one-shot |
| `reset(now)` is called before any `getSnapshot()` consumes a pending latch | The latch is still consumed and reported on the next `getSnapshot()` after the reset (existing latch semantics are not cleared by `reset`'s own `settle()` unless `reset` itself causes a *different* Focus completion) |

## Definition of Done

- [ ] Unit tests for `justCompletedFocusAt` (poll-triggered and start/pause/reset-triggered) pass, alongside the full existing `timer-engine.test.js` suite (27 existing tests untouched)
- [ ] `getSnapshot()`'s return shape is purely additive — no existing test asserting exact keys needs unrelated changes beyond adding the new field
- [ ] Hard rule holds: `src/logic/` has zero DOM/browser-API access; `src/ui/` is untouched by this task
- [ ] lint + vet clean
