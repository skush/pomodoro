---
id: T2
title: "Make the engine's cycle length configurable and read it at completion time"
layer: "domain"
deps: ["T1"]
blocks: ["T6"]
acs: ["AC-07","AC-10","AC-13"]
files_hint: ["src/logic/index.js","test/logic/timer-engine.test.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
context_budget: "M"
status: "todo"
---

<!-- Self-contained task. To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or contradicts the code in front of you, open the named file for the full text and follow that. Do not invent the missing part. The source always wins over an inline. -->

# T2 — Make the engine's cycle length configurable and read it at completion time

## Place in the sequence

- **Blocked by:** T1 — Make the engine's three phase durations configurable at runtime, with idle vs running/paused semantics · **Blocks:** T6 — Add the cycle-length field with commit on blur/Enter and inline validation · **Wave:** 2.
- **Lane:** shares `src/logic/index.js` and `test/logic/timer-engine.test.js` with T1 — serialized after it.

## Why (user story)

> **As a** User
> **I want** a cycle-length change to be reflected in the very next Long-break decision, even if I'm partway through the current cycle
> **So that** the setting I just changed to takes effect right away, without a confusing delay
> ## 5. Acceptance criteria
> *A value is a valid whole number only in its strict form: an optional leading `-` followed only by digits — no decimal point, no letters, no exponent notation, no surrounding non-digit characters. A cleanly-formed but out-of-range number (e.g. `500`, `-5`) is still a valid whole number for AC-02/AC-11's purposes; `12.5`, `25abc`, `1e2`, and empty/non-numeric text are not valid whole numbers at all, for AC-06/AC-12's purposes.*
>
> — `spec.md §4, US-10, verbatim` · full text: [spec.md](../spec.md)

The engine half of the story: `setCycleLength` changes nothing on commit, and `settle()` decides Long vs Short break against the current cycle length at completion time.

## Inlined context

> │   └── index.js   <createTimerEngine() extended: returned object grows two new methods,
> │                   setConfiguredDurations({focus, shortBreak, longBreak}) and
> │                   setCycleLength(n) (ADR-0001) — updates the idle phase's remainingMs
> │                   immediately if the target phase type is currently idle, defers to the
> │                   next fresh start otherwise; settle()'s Long-break decision reads the
> │                   current cycle length at completion time, not a value baked in earlier
> │                   (AC-13). "Idle" here means the phase has never been started since its
> │                   last reset AND remainingMs still equals the full duration it was given
> │                   AT THAT START/RESET moment — not the live current config — so a config
> │                   change while a phase is genuinely running or paused is distinguishable
> │                   from one while it's idle without a new boolean flag (see ADR-0001
> │                   Amendment for the full reasoning and clampRemaining()/durationFor()'s
> │                   corrected contract). New pure functions, no engine-state access:
> │                   per-setting stored-value fallback validation (validateStoredDuration(raw),
> │                   validateStoredCycleLength(raw)) and input-commit validation
> │                   (validateDurationInput / validateCycleLengthInput), mirroring
> │                   validateStoredCount's existing shape.>
>
> — `sad.md §5, src/logic/index.js building block, verbatim` · full text: [sad.md](../sad.md)

> 4. **Engine configuration surface: extend `createTimerEngine()`'s returned object with two new
>    methods, `setConfiguredDurations({focus, shortBreak, longBreak})` and `setCycleLength(n)`, rather
>    than recreating the engine instance on every commit or pushing config-awareness into `src/ui/`.** →
>    [ADR-0001](adr/0001-extend-engine-surface-with-configurable-durations.md). The engine currently
>    closes over four private, immutable constants (`FOCUS_DURATION_MS`, `SHORT_BREAK_DURATION_MS`,
>    `LONG_BREAK_DURATION_MS`, `FOCUS_SESSIONS_PER_CYCLE`) set once at construction. This decision
>    extends [`core-timer/adr/0002-structural-encapsulation-control-guard`](../core-timer/adr/0002-structural-encapsulation-control-guard.md)'s
>    frozen-object public surface with two new legitimate control methods — the "fourth input"
>    `spec.md` §1 itself names — so the engine, which already owns `remainingMs`/`deadlineAt`/
>    `running`/`focusCount` privately, can correctly decide idle-updates-now vs.
>    running/paused-defers-to-next-fresh-start (AC-03/AC-04/AC-05), Reset-always-shows-current-config
>    (AC-04b), and cycle-length-evaluated-at-next-completion-not-retroactively (AC-13) — without
>    exposing that private state to any caller.
>
> — `sad.md §4, decision 4, verbatim` · full text: [sad.md](../sad.md)

> **Critical flow 4: Cycle-length commit mid-cycle (AC-13)**
>
> ```mermaid
> sequenceDiagram
>     actor User
>     participant UI as UI layer
>     participant Engine as Timer engine
>     participant Storage as Local storage
>
>     Note over Engine: a cycle is already in progress, in-cycle focus count partway toward the OLD cycle length
>     User->>UI: commits a new cycle length (blur or Enter)
>     UI->>UI: validate (whole number, 2-8)
>     alt invalid
>         UI-->>User: reject, revert to last valid value, inline message states the 2-8 range
>     else valid
>         UI->>Engine: setCycleLength(n)
>         Note over Engine: nothing changes yet - in-cycle focus count untouched, no retroactive Long break (AC-07/AC-13)
>         UI->>Storage: persistDurationConfig(storage, {all four current values}) (ADR-0002)
>         UI-->>User: cycle-length field shows n
>     end
>     Note over Engine: later - the next Focus session completes naturally
>     UI->>Engine: getSnapshot(now)
>     Engine->>Engine: settle(now) reads the CURRENT cycle length (n, not the value in effect when the cycle started) against the in-cycle focus count
>     alt in-cycle focus count (including this completion) has reached or passed n
>         Engine-->>UI: next phase is a Long break
>     else
>         Engine-->>UI: next phase is a Short break
>     end
> ```
>
> — `sad.md §6, «Critical flow 4: Cycle-length commit mid-cycle (AC-13)», verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/) · [screens.md](../screens.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-07 (US-07) — cross-context

> **Given** a User commits a new Configured duration or Configured cycle length
> **When** that commit happens
> **Then** the system leaves the in-cycle focus count and today's completed-session count (`docs/features/session-tracking/spec.md`) exactly as they were at that moment — a commit never advances, resets, or otherwise alters progress already made (AC-13 separately governs how a new cycle length shapes the *next* Long-break decision, a distinct point in time from the commit itself)
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

### AC-10 (US-09) — happy path

> **Given** a User is viewing the app
> **When** the User types a new cycle length — a whole number, 2–8 — and commits it (blurs the field or presses Enter)
> **Then** the system saves that as the Configured cycle length, and it governs every Long-break decision from that point forward
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

### AC-13 (US-10) — cross-context

> **Given** a cycle is already in progress, with some number of Focus sessions already completed toward the Long break (the in-cycle focus count)
> **When** the User commits a new Configured cycle length before the next Focus session completes
> **Then** committing it alone changes nothing yet — it does not retroactively trigger a Long break and does not alter or reset the in-cycle focus count — but the next Focus session to complete naturally is decided against the newly committed cycle length: if the in-cycle focus count (including that just-completed session) has now reached or passed it, a Long break follows next, exactly as if that had always been the configured length; otherwise a Short break follows as usual
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Replace private `FOCUS_SESSIONS_PER_CYCLE` with a default of 4 (exported for T3) plus a mutable configured cycle length — `src/logic/index.js`
- [ ] Add `setCycleLength(n)` to the frozen returned object; it only stores the value — no retroactive Long break, in-cycle focus count untouched — `src/logic/index.js`
- [ ] Make `settle()` read the current cycle length at Focus-completion time and compare it to the in-cycle focus count including that completion (reached-or-passed → Long break) — `src/logic/index.js`
- [ ] Amend the pinned `Object.keys(engine)` assertion to include `setCycleLength` — `test/logic/timer-engine.test.js`
- [ ] Add unit tests: raise and lower the cycle length mid-cycle (Long at reached-or-passed, Short otherwise); commit alone changes nothing; counts untouched — `test/logic/timer-engine.test.js`

## Edge cases

| Case | Behaviour |
|---|---|
| Cycle length lowered to at or below the in-cycle focus count | No Long break at commit; the next Focus completion yields a Long break (AC-13) |
| Cycle length raised mid-cycle | Next Focus completion yields a Short break until the new count is reached |
| Cycle length committed | In-cycle focus count and today's completed-session count unchanged (AC-07) |
| No `setCycleLength` call | Classic behaviour: Long break after 4 Focus sessions |

## Definition of Done

- [ ] Unit tests for mid-cycle raise/lower pass, including the reached-or-passed boundary
- [ ] `Object.keys(engine)` assertion amended and green
- [ ] Every Hard Rule inlined above still holds
- [ ] `npm test` and `npm run lint` clean
