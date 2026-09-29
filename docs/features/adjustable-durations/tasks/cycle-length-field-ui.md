---
id: T6
title: "Add the cycle-length field with commit on blur/Enter and inline validation"
layer: "ui"
deps: ["T2","T3","T4","T5"]
blocks: ["T7"]
acs: ["AC-10","AC-11","AC-14"]
files_hint: ["src/ui/index.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
context_budget: "M"
status: "todo"
---

<!-- Self-contained task. To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or contradicts the code in front of you, open the named file for the full text and follow that. Do not invent the missing part. The source always wins over an inline. -->

# T6 — Add the cycle-length field with commit on blur/Enter and inline validation

## Place in the sequence

- **Blocked by:** T2 — Make the engine's cycle length configurable and read it at completion time, T3 — Add pure duration/cycle-length input and stored-value validation functions, T4 — Add persistDurationConfig / readPersistedDurationConfig as the second storage gatekeeper, T5 — Add the three duration fields (Numeric setting field) with commit on blur/Enter and inline validation · **Blocks:** T7 — Wire load-time and pre-start correction of stored durations and cycle length · **Wave:** 4.
- **Lane:** shares `src/ui/index.js` with T4, T5, T7 — serialized after T5 (reuses its Numeric setting field).

## Why (user story)

> **As a** User
> **I want** to set how many Focus sessions happen before a Long break (2–8)
> **So that** the cadence matches how I actually like to work, not just the classic 4
>
> — `spec.md §4, US-09, verbatim` · full text: [spec.md](../spec.md)

The visible half of the story: the cycle-length field, pre-filled from storage, committing to the engine and to storage.

## Inlined context

> 7. **Input-commit UI pattern: mirror only the task label's commit-trigger discipline (blur/Enter), not
>    its per-keystroke validation.** The label's own `validateLabelInput()` rejects-and-reverts on every
>    `input` event because a length cap is meaningful to enforce live. A duration/cycle-length field is
>    different: the User must be free to type an intermediate, momentarily-invalid state (e.g. clearing
>    "25" to type "50") without it being reverted mid-edit. So these four fields validate **only at
>    commit time** (`blur`/`Enter`) — the field accepts any typed text live, and validation +
>    reject-and-revert-with-message happens once, at the same commit moment `commitLabel()` already
>    fires, per `spec.md` AC-02/AC-11 and `spec.md` §6 NFR "Commit discipline" (corrected 2026-09-29 —
>    the earlier draft of this decision copied the label's *per-keystroke* validation by mistake; only
>    the *commit-trigger* discipline is shared). No legitimate alternative given `spec.md` §1's explicit
>    "same discipline as the task label" requirement (referring to the commit trigger); inline, no ADR.
>
> — `sad.md §4, decision 7, verbatim` · full text: [sad.md](../sad.md)

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

> **Screen contract (`screens.md`, SCR-01):** builds SCR-01 states **default**, **success (cycle length)**, **validation (cycle length)**. Reuses Timer card, Phase label, Countdown display, Control buttons, Session count display, Inline validation message; the only new component is `Numeric setting field`.
>
> — `screens.md §Screens, SCR-01, abridged` · full text: [screens.md](../screens.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/) · [screens.md](../screens.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-10 (US-09) — happy path

> **Given** a User is viewing the app
> **When** the User types a new cycle length — a whole number, 2–8 — and commits it (blurs the field or presses Enter)
> **Then** the system saves that as the Configured cycle length, and it governs every Long-break decision from that point forward
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

### AC-11 (US-09) — error

> **Given** a User commits a cycle-length value that is not a valid whole number in the 2–8 range (out of range, non-numeric, empty, decimal, or otherwise not a strict whole number)
> **When** that commit happens
> **Then** the system rejects it outright — the field reverts to the last validly committed Configured cycle length, unchanged — and shows the User an inline message stating the valid 2–8 range
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

### AC-14 (US-03) — happy path

> **Given** a User previously committed a custom cycle length
> **When** the User reopens or reloads the page
> **Then** the system pre-fills the cycle-length field with exactly the Configured cycle length currently in effect — its last-committed value, or the classic default of 4 if none was ever validly committed or storage needed correcting (AC-12)
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Instantiate T5's Numeric setting field for the cycle length (2–8), pre-filled from `readPersistedDurationConfig` and applied via `engine.setCycleLength` at mount — `src/ui/index.js`
- [ ] On blur/Enter: `validateCycleLengthInput`; invalid → revert + 2–8 message; valid → `engine.setCycleLength(n)` then `persistDurationConfig` with all four values — `src/ui/index.js`

## Edge cases

| Case | Behaviour |
|---|---|
| Invalid commit (`1`, `9`, `4.5`, `abc`, empty) | Field reverts to the last valid value; inline message states the 2–8 range |
| Valid commit mid-cycle | Field shows the new value; no immediate change to the count display or in-cycle count |
| Reload after a commit | Field pre-filled with the last committed cycle length |

## Definition of Done

- [ ] Manual: valid/invalid commits behave as above; reload pre-fills
- [ ] Cycle-length commit leaves the session-count display unchanged
- [ ] Every Hard Rule inlined above still holds
- [ ] `npm test` and `npm run lint` clean
