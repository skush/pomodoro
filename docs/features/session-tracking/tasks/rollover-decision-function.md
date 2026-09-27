---
id: T2
title: "Add a pure daily-rollover decision function"
layer: "domain"
deps: []
blocks: ["T4", "T6", "T7"]
acs: ["AC-06", "AC-06b"]
files_hint: ["src/logic/index.js", "test/logic/session-tracking.test.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
context_budget: "M"
status: "todo"
---

# T2 — Add a pure daily-rollover decision function

## Place in the sequence

- **Blocked by:** none — independent pure function. · **Blocks:** T4 — Centralized write gatekeeper (calls this to decide whether to roll before writing); T6 — Today's count display (calls this on every read); T7 — Edge-case test hardening. · **Wave:** 1 (parallel with T1, T3).
- **Lane:** shares `src/logic/index.js` and `test/logic/session-tracking.test.js` with T3 — serialized by `implement`.

## Why (user story)

> **As a** User
> **I want** the completed-session count to correctly start over at the beginning of a new day
> **So that** yesterday's sessions never inflate today's count
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

This task is the single decision US-04 rests on: given the stored date and the real current date, should the tracked day roll forward?

## Inlined context

> Rollover-check timing: resolved on every read and always immediately before crediting an increment, never on a background timer. ... The check itself has two distinct parts, kept separate on purpose: whether to **roll the tracked day forward** compares the real current date against the stored date; whether a **completing session gets credited** separately compares that session's own true completion day against the (possibly just-rolled) tracked day. Conflating the two was an error the critic caught in an earlier draft of this SAD.
>
> — `sad.md §4, Solution strategy point 7, abridged` · full text: [sad.md](../sad.md)

> whether to **roll the tracked day forward** compares the real current date against the stored date (never on the completing session's own day) ... else today is not later than stored date (including a clock moved backward - AC-06b): tracked day stays whatever was stored
>
> — `sad.md §6, «Focus completion → true-day credit» Step 1, abridged` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-06 — cross-context

> **Given** the tab is left open, backgrounded, or the machine sleeps across local midnight, whether mid-session or between sessions
> **When** the count is next read (on page load, on the tab becoming visible, on any display refresh, or right before crediting a completed session — see AC-04) and local midnight has passed since the count was last reset
> **Then** the system resets the count to zero for the new calendar day before doing anything else with it — the previous day's count, and any session whose true completion fell before that midnight, is not carried into the new day's count
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-06b — domain invariant (clock regression)

> **Given** the device's clock or date has moved backward since the count was last reset, so the currently stored date is later than what the device now reports as today
> **When** the count is next read or about to be credited
> **Then** the system leaves the count as it is — it only ever resets forward to a later calendar day, never backward to an earlier one
>
> — `spec.md §5, AC-06b, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add `shouldRollover(storedDateStr, now)` (or equivalent name) as a plain, data-in/data-out function in `src/logic/index.js` — no engine-state access — `src/logic/index.js`
- [ ] Function returns whether the calendar day of `now` is later than the stored date, and leaves the stored date untouched when it isn't (including when `now`'s day is earlier — the backward-clock case) — `src/logic/index.js`
- [ ] Unit tests covering the NFR's ≥5 mocked midnight-boundary cases: exactly-at-midnight, mid-sleep crossing, long-absence crossing, a true-completion-before-midnight crossing, and a backward clock change — `test/logic/session-tracking.test.js`

## Edge cases

| Case | Behaviour |
|---|---|
| `now`'s calendar day equals the stored date | No rollover — tracked day stays as stored |
| `now`'s calendar day is later than the stored date | Rollover — tracked day becomes `now`'s day |
| `now`'s calendar day is earlier than the stored date (clock moved backward) | No rollover — tracked day stays as stored (AC-06b) |
| Stored date is missing/unparseable | Treated as no prior date, forcing a fresh rollover (ties into T3's fallback-validation function) |

## Definition of Done

- [ ] Unit test using a fixed/mocked date boundary passes across all ≥5 required cases (`spec.md` §6 NFR "Daily reset correctness")
- [ ] Function has zero DOM/browser-API access — stays a pure function in `src/logic/`
- [ ] Every Hard Rule inlined above still holds
- [ ] lint + vet clean
