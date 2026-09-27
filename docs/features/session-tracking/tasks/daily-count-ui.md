---
id: T6
title: "Wire today's count display: load-time rollover check + Focus-completion crediting"
layer: "ui"
deps: ["T1", "T2", "T4"]
blocks: ["T7"]
acs: ["AC-04", "AC-04b", "AC-05", "AC-06", "AC-06b"]
files_hint: ["src/ui/index.js", "src/styles.css", "index.html"]
owner: "sergii.kushnir@gmail.com"
estimate: "M"
context_budget: "L"   # justified: this task wires 3 upstream tasks' outputs (engine latch + rollover fn + centralized writer) into the single credit/display flow, and the AC/edge-case tables cover the feature's most architecturally distinctive logic (the two-step rollover-then-credit check)
status: "todo"
---

# T6 — Wire today's count display: load-time rollover check + Focus-completion crediting

## Place in the sequence

- **Blocked by:** T1 — Engine focus-completion latch; T2 — Rollover-decision function; T4 — Centralized write gatekeeper. · **Blocks:** T7 — Edge-case test hardening. · **Wave:** 3 (parallel with T5 in principle; serialized behind it in practice since both touch `src/ui/index.js`).
- **Lane:** shares `src/ui/index.js` with T5 — serialized by `implement`.

## Why (user story)

> **As a** User
> **I want** to see how many Focus sessions I've completed today
> **So that** I can gauge my progress without counting manually
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

> **As a** User
> **I want** the completed-session count to correctly start over at the beginning of a new day
> **So that** yesterday's sessions never inflate today's count
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

This task is where every prior task's output actually meets the User: the displayed count, correct across a midnight boundary and correct about which completions count.

## Inlined context

> Note over UI: Step 1 - rollover uses NOW, never the completion's own day
> alt calendar day of now is later than stored date
>     UI->>Storage: write { count: 0, date: today } (rollover first, via the centralized writer)
> else today is not later than stored date (including a clock moved backward - AC-06b)
>     Note over UI: tracked day stays whatever was stored
> end
> Note over UI: Step 2 - credit only if this completion's true day matches the tracked day
> alt justCompletedFocusAt is non-null AND its calendar day equals the tracked day
>     UI->>Storage: write { count: count + 1 } (via the centralized writer)
>     UI-->>User: today's count increases by one
> else justCompletedFocusAt is non-null but its day is earlier than the tracked day
>     UI-->>User: count is not incremented - the just-finished session (from before the rollover) is not credited
> end
>
> — `sad.md §6, «Focus completion → true-day credit», verbatim` · full text: [sad.md](../sad.md)

> Flow 5 is the negative case Flow 1 doesn't otherwise show: whenever `justCompletedFocusAt` comes back `null`, the count-writing branch of the centralized writer is never entered at all — Reset and the two break phases simply don't reach it (AC-05).
>
> — `sad.md §6, «Reset or break completion leaves the count unchanged», verbatim` · full text: [sad.md](../sad.md)

> Flow 4 is the load-time counterpart to Flow 1: the same rollover decision (real now vs. stored date) runs on every read, not only right before a completion, so AC-04b's "0 if none yet today" and AC-06's "resets on the first read after midnight" are the same single check exercised from two different triggers.
>
> — `sad.md §6, «Page load — restore label and display today's count», verbatim` · full text: [sad.md](../sad.md)

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

### AC-04b — happy path (load state)

> **Given** a User opens or reloads the page
> **When** the page finishes loading
> **Then** the system displays today's completed-session count as currently saved, showing 0 if no Focus session has completed yet today
>
> — `spec.md §5, AC-04b, verbatim` · full text: [spec.md](../spec.md)

### AC-05 — domain invariant

> **Given** a User resets the current phase, or a Short break or Long break phase completes
> **When** that happens
> **Then** the system does not change today's completed-session count — only a Focus phase reaching zero naturally increments it
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

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

- [ ] Add a count display element to `mount()`'s DOM tree — `src/ui/index.js`
- [ ] On every read trigger (load, `visibilitychange`, the existing render interval, and right before a credit decision), call T2's rollover function against the stored date and write the rollover via T4's writer when it fires — `src/ui/index.js`
- [ ] After the rollover check, read `justCompletedFocusAt` from `engine.getSnapshot(now)` (T1); if non-null and its calendar day equals the (possibly just-rolled) tracked day, increment the count and write it via T4's writer — `src/ui/index.js`
- [ ] If `justCompletedFocusAt` is non-null but its day is earlier than the tracked day, do not increment (the sleep-across-midnight case) — `src/ui/index.js`
- [ ] Confirm Reset and Short/Long break completions never reach the increment branch at all (`justCompletedFocusAt` is `null` for those transitions) — `src/ui/index.js`
- [ ] Style the count display — `src/styles.css`
- [ ] Run `npm run build` and commit the regenerated `index.html` alongside — `index.html`

## Edge cases

| Case | Behaviour |
|---|---|
| Focus session's true completion is before midnight, but detected after | Rollover fires first (count → 0, date → today); the completion's own day is earlier than the now-tracked day, so it is NOT credited (AC-06) |
| Device clock moves backward | Rollover check leaves the tracked day untouched (AC-06b); credit check still runs normally against the unchanged tracked day |
| User presses Reset mid-Focus-phase | `justCompletedFocusAt` is `null` — count is left exactly as it was (AC-05) |
| Short or Long break completes | Same as Reset — `null` latch, no increment (AC-05) |
| Page loaded for the first time today, no prior completions | Count displays `0` (AC-04b) |

## Definition of Done

- [ ] Unit test using a fixed/mocked date boundary passes across all ≥5 required midnight-boundary cases, exercised end-to-end through this wiring (not just T2's isolated function) (`spec.md` §6 NFR "Daily reset correctness")
- [ ] Manual check: count increments only on a genuine Focus completion, never on Reset or a break completing, and correctly resets across a simulated midnight
- [ ] Every Hard Rule inlined above still holds — rollover always runs before crediting, never the reverse
- [ ] lint + vet clean
