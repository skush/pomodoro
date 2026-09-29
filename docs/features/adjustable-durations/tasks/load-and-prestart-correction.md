---
id: T7
title: "Wire load-time and pre-start correction of stored durations and cycle length"
layer: "ui"
deps: ["T5","T6"]
blocks: ["T9"]
acs: ["AC-06","AC-12"]
files_hint: ["src/ui/index.js","test/logic/write-guard.test.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
context_budget: "M"
status: "todo"
---

<!-- Self-contained task. To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or contradicts the code in front of you, open the named file for the full text and follow that. Do not invent the missing part. The source always wins over an inline. -->

# T7 — Wire load-time and pre-start correction of stored durations and cycle length

## Place in the sequence

- **Blocked by:** T5 — Add the three duration fields (Numeric setting field) with commit on blur/Enter and inline validation, T6 — Add the cycle-length field with commit on blur/Enter and inline validation · **Blocks:** T9 — Rebuild index.html and run the manual NFR checks · **Wave:** 5.
- **Lane:** shares `src/ui/index.js` with T4, T5, T6 and `test/logic/write-guard.test.js` with T4 — serialized last in the ui lane.

## Why (user story)

> **As a** User
> **I want** a corrupted or invalid stored duration to never let a phase complete instantly
> **So that** my daily count stays trustworthy no matter what ends up in storage
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

Re-runs the T4 read/correct path right before any phase type starts fresh, so a value corrupted mid-session can never produce an instant completion.

## Inlined context

> **Critical flow 3: Corrupted or invalid stored value falls back to the classic default (AC-06/AC-12)**
>
> ```mermaid
> sequenceDiagram
>     actor User
>     participant UI as UI layer
>     participant Storage as Local storage
>     participant Engine as Timer engine
>
>     Note over UI: page loads, or a phase type is about to start fresh
>     UI->>Storage: read stored adjustable-durations:* keys
>     Storage-->>UI: raw values (possibly missing, malformed, or out of range)
>     UI->>UI: validateStoredDuration(raw) / validateStoredCycleLength(raw), per key
>     alt stored value is valid (1-180 for a duration, 2-8 for cycle length)
>         UI->>Engine: setConfiguredDurations(...) / setCycleLength(...) with the stored value
>     else invalid
>         UI->>Engine: setConfiguredDurations(...) / setCycleLength(...) with the classic default (25/5/15 minutes, 4 sessions)
>         UI->>Storage: persistDurationConfig(storage, {corrected full state}) (written back immediately)
>     end
>     UI-->>User: field pre-filled with the value now in effect — never able to produce an instant or sub-minimum completion
> ```
>
> — `sad.md §6, «Critical flow 3: Corrupted or invalid stored value falls back to the classic default (AC-06/AC-12)», verbatim` · full text: [sad.md](../sad.md)

> │   └── index.js   <mount(root, engine) extended: three duration input fields + one
> │                   cycle-length input field, each committing on blur/Enter only (mirroring
> │                   commitLabel()'s commit-trigger discipline, not validateLabelInput()'s
> │                   per-keystroke validation — see §4 decision 7) — a commit calls the
> │                   engine's new setConfiguredDurations/setCycleLength method, then
> │                   persistDurationConfig(storage, {...}), the second write gatekeeper
> │                   (ADR-0002). readPersistedDurationConfig(storage) added alongside
> │                   readPersistedState — run at mount, AND re-run as a pre-start correction
> │                   check right before any phase type starts fresh (AC-06/AC-12), each field
> │                   validated independently; an invalid value found at either read point is
> │                   corrected and written back via persistDurationConfig immediately.>
>
> — `sad.md §5, src/ui/index.js building block, verbatim` · full text: [sad.md](../sad.md)

> | Corrupted/missing persisted duration | Each phase type's Configured duration falls back to its own classic default on any stored value that isn't a valid whole number in 1–180 (missing key, malformed value, non-numeric, decimal, or out of range — AC-06), immediately written back to storage — 0 thrown exceptions, 0 instant completions | unit test with invalid stored data |
>
> — `spec.md §6, NFR «Corrupted/missing persisted duration», verbatim` · full text: [spec.md](../spec.md)

> **Screen contract (`screens.md`, SCR-01):** builds SCR-01 state **default** (pre-filled with the corrected value; corrections are silent, no error state). Reuses Timer card, Phase label, Countdown display, Control buttons, Session count display, Inline validation message; the only new component is `Numeric setting field`.
>
> — `screens.md §Screens, SCR-01, abridged` · full text: [screens.md](../screens.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/) · [screens.md](../screens.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-06 (US-06) — domain invariant

> **Given** a stored duration value for a phase type — encountered on page load or before that phase type would start fresh — is not a valid whole number in the 1–180 range (missing, malformed, non-numeric, decimal, or out of range)
> **When** the system encounters it
> **Then** the system treats it as no valid Configured duration, falls back to that phase type's classic default (Focus 25 minutes, Short break 5 minutes, Long break 15 minutes), and writes that default back to storage immediately — under no circumstance does an invalid stored value let a phase complete faster than its own valid minimum, or complete instantly
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-12 (US-09) — domain invariant

> **Given** a stored cycle-length value — encountered on page load — is not a valid whole number in the 2–8 range (missing, malformed, non-numeric, decimal, or out of range)
> **When** the system encounters it
> **Then** the system treats it as no valid Configured cycle length, falls back to the classic default of 4, and writes that default back to storage immediately
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Before every fresh start of a phase type (Start from idle, and the automatic next-phase start), call `readPersistedDurationConfig`, push any corrected values to the engine via `setConfiguredDurations`/`setCycleLength`, and refresh the fields — `src/ui/index.js`
- [ ] Confirm the mount-time read (T5/T6) uses the same path so load and pre-start behave identically — `src/ui/index.js`
- [ ] Add a test or scripted check with invalid stored data set between load and start: no instant completion, value corrected and written back — `test/logic/write-guard.test.js`

## Edge cases

| Case | Behaviour |
|---|---|
| Stored value tampered to `0` or `-3` between load and start | Start uses the classic default; corrected value written back; no instant completion |
| Stored value exactly 1 or 180 (or 2 / 8) | Valid, honored as-is |
| Storage unreadable | Classic defaults in memory; no exception, nothing shown |

## Definition of Done

- [ ] Tampered storage never yields an instant or sub-minimum completion, verified
- [ ] Correction is written back immediately
- [ ] Every Hard Rule inlined above still holds
- [ ] `npm test` and `npm run lint` clean
