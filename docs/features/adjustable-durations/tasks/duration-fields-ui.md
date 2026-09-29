---
id: T5
title: "Add the three duration fields (Numeric setting field) with commit on blur/Enter and inline validation"
layer: "ui"
deps: ["T1","T3","T4"]
blocks: ["T6","T7","T8"]
acs: ["AC-01","AC-02","AC-03","AC-09"]
files_hint: ["src/ui/index.js","src/styles.css"]
owner: "sergii.kushnir@gmail.com"
estimate: "M"
context_budget: "M"
status: "todo"
---

<!-- Self-contained task. To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or contradicts the code in front of you, open the named file for the full text and follow that. Do not invent the missing part. The source always wins over an inline. -->

# T5 — Add the three duration fields (Numeric setting field) with commit on blur/Enter and inline validation

## Place in the sequence

- **Blocked by:** T1 — Make the engine's three phase durations configurable at runtime, with idle vs running/paused semantics, T3 — Add pure duration/cycle-length input and stored-value validation functions, T4 — Add persistDurationConfig / readPersistedDurationConfig as the second storage gatekeeper · **Blocks:** T6 — Add the cycle-length field with commit on blur/Enter and inline validation, T7 — Wire load-time and pre-start correction of stored durations and cycle length, T8 — Reserve fixed width for a 3-digit minute countdown so no control shifts · **Wave:** 3.
- **Lane:** shares `src/ui/index.js` with T4, T6, T7 — serialized.

## Why (user story)

> **As a** User
> **I want** to set my own Focus, Short-break, and Long-break durations
> **So that** the timer matches my own work rhythm instead of the fixed classic numbers
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

The visible half of the story: the Focus / Short break / Long break fields, pre-filled from storage, committing to the engine and to storage.

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

> **Critical flow 1: Duration commit across phase states (ADR-0001 in action)**
>
> ```mermaid
> sequenceDiagram
>     actor User
>     participant UI as UI layer
>     participant Engine as Timer engine
>     participant Storage as Local storage
>
>     User->>UI: types a new duration for phase type X, commits (blur or Enter)
>     UI->>UI: validate (whole number, 1-180)
>     alt invalid
>         UI-->>User: reject, revert to last valid value, inline message states the 1-180 range
>     else valid
>         UI->>Engine: setConfiguredDurations({...current, [X]: newMs})
>         alt phase X is currently idle
>             Engine-->>UI: remainingMs for X updated immediately
>             UI-->>User: idle display shows the new duration now (AC-03)
>         else phase X is running or paused
>             Note over Engine: remainingMs/deadlineAt for the active phase untouched (AC-04/AC-05)
>             UI-->>User: countdown/frozen time unchanged, new value applies at the next fresh start
>         end
>         UI->>Storage: persistDurationConfig(storage, {all four current values}) (ADR-0002)
>         Note over UI: in-cycle focus count and today's completed-session count left untouched (AC-07)
>     end
> ```
>
> — `sad.md §6, «Critical flow 1: Duration commit across phase states (ADR-0001 in action)», verbatim` · full text: [sad.md](../sad.md)

> - Error handling: fail-soft in `src/ui/` is `CLAUDE.md`'s default (clamp, never throw) — **but** the
>   duration and cycle-length fields follow the same **documented exception** session-tracking's task
>   label already established: invalid commits are **rejected-with-message and revert to the last
>   valid value on commit** (blur/Enter) — never on an intermediate keystroke, and never silently
>   clamped to the range boundary (`spec.md` AC-02/AC-11, `spec.md` §6 NFR "Commit discipline").
>
> — `sad.md §2 Conventions, error handling, verbatim` · full text: [sad.md](../sad.md)

> **Screen contract (`screens.md`, SCR-01):** builds SCR-01 states **default**, **idle-updated**, **running-or-paused-unchanged**, **validation (duration)**. Reuses Timer card, Phase label, Countdown display, Control buttons, Session count display, Inline validation message; the only new component is `Numeric setting field`.
>
> — `screens.md §Screens, SCR-01, abridged` · full text: [screens.md](../screens.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/) · [screens.md](../screens.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-01 (US-01) — happy path

> **Given** a User is viewing the app with a phase type currently idle
> **When** the User types a new duration for that phase type — a whole number of minutes, 1–180, the same range for every phase type — and commits it (blurs the field or presses Enter)
> **Then** the system saves that as the phase type's Configured duration, and the next time that phase type starts fresh, it runs for exactly that long
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-02 (US-01) — error

> **Given** a User commits a duration value that is not a valid whole number in the 1–180 minute range (out of range, non-numeric, empty, decimal, or otherwise not a strict whole number)
> **When** that commit happens
> **Then** the system rejects it outright — the field reverts to the last validly committed Configured duration for that phase type, unchanged — and shows the User an inline message stating the valid 1–180 range
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-03 (US-04) — happy path (idle immediate update)

> **Given** a phase type is currently idle, displaying its previous Configured duration
> **When** the User commits a new Configured duration for that same phase type
> **Then** the system updates that phase's idle display to the new duration immediately, without requiring the User to start it first
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-09 (US-03) — happy path

> **Given** a User previously committed custom durations for one or more phase types
> **When** the User reopens or reloads the page
> **Then** the system pre-fills each phase type's duration field with exactly the Configured duration currently in effect — its last-committed value, or the classic default if none was ever validly committed or storage needed correcting (AC-06)
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add a reusable `Numeric setting field` builder (label + input + inline validation message element) in `mount()`, reusing the existing Inline validation message styling — `src/ui/index.js`, `src/styles.css`
- [ ] Instantiate it for Focus, Short break, Long break, pre-filled from `readPersistedDurationConfig` at mount and applied via `engine.setConfiguredDurations` — `src/ui/index.js`
- [ ] On `blur`/Enter only (never `input`): `validateDurationInput`; invalid → revert to the last valid value + show the 1–180 message; valid → `engine.setConfiguredDurations`, `persistDurationConfig` with all four values, refresh the idle countdown from the snapshot — `src/ui/index.js`
- [ ] Make Reset and the idle display read the snapshot so they always show the current Configured duration — `src/ui/index.js`

## Edge cases

| Case | Behaviour |
|---|---|
| Intermediate invalid text while typing (e.g. field cleared) | Nothing validated, applied, or stored until blur/Enter |
| Invalid commit (`0`, `181`, `12.5`, `abc`, empty) | Field reverts to the last valid value; inline message states the 1–180 range |
| Valid commit while the phase is running or paused | Countdown / frozen time unchanged; the new value applies at the next fresh start |
| Valid commit while idle | Idle display shows the new duration immediately |
| Reload after a commit | Field pre-filled with the last committed value |

## Definition of Done

- [ ] Manual: type-then-blur/Enter applies; keystrokes alone do not; an invalid commit reverts with the range message
- [ ] Idle display updates on commit; running/paused countdown unchanged
- [ ] Fields pre-filled after reload
- [ ] Every Hard Rule inlined above still holds
- [ ] `npm test` and `npm run lint` clean
