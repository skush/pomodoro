---
id: T4
title: "Add persistDurationConfig / readPersistedDurationConfig as the second storage gatekeeper"
layer: "infra"
deps: ["T3"]
blocks: ["T5","T6"]
acs: ["AC-06","AC-08","AC-12"]
files_hint: ["src/ui/index.js","test/logic/write-guard.test.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "M"
context_budget: "M"
status: "todo"
---

<!-- Self-contained task. To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or contradicts the code in front of you, open the named file for the full text and follow that. Do not invent the missing part. The source always wins over an inline. -->

# T4 — Add persistDurationConfig / readPersistedDurationConfig as the second storage gatekeeper

## Place in the sequence

- **Blocked by:** T3 — Add pure duration/cycle-length input and stored-value validation functions · **Blocks:** T5 — Add the three duration fields (Numeric setting field) with commit on blur/Enter and inline validation, T6 — Add the cycle-length field with commit on blur/Enter and inline validation · **Wave:** 2.
- **Lane:** shares `src/ui/index.js` with T5, T6, T7 — serialized; runs in parallel with T1/T2 (different file).

## Why (user story)

> **As a** User
> **I want** the saved configured durations and cycle length to change only because of my own committed edits
> **So that** I can rely on what the app shows me as accurate
>
> — `spec.md §4, US-08, verbatim` · full text: [spec.md](../spec.md)

The single choke point that writes all four settings together, plus the read/validate/correct path that uses T3's validators.

## Inlined context

> - localStorage key convention confirmed by the scan: `feature-name:key` (e.g.
>   `session-tracking:count`) — new keys follow the same shape: `adjustable-durations:focus-duration`,
>   `:short-break-duration`, `:long-break-duration`, `:cycle-length`.
>
> — `sad.md §2 Conventions, localStorage keys, verbatim` · full text: [sad.md](../sad.md)

> **Chosen:** Option 1, a second centralized write function. It gives AC-08's "always write all four
> fields together" guarantee a single, exhaustively-testable choke point — one unit-test suite proves
> the invariant once, rather than three independent call sites each needing to independently prove
> the same thing and stay in sync by hand as the code evolves. It reuses the identical reasoning
> [`session-tracking/adr/0002-centralize-session-tracking-writes`](../../session-tracking/adr/0002-centralize-session-tracking-writes.md)
> already applied to the same shape of problem (a 3-trigger, always-overwrite-the-full-state write
> guard) one feature ago, for the same underlying risk: a future fourth accidental write site, or a
> future fifth setting, is easier to introduce correctly against one function's parameter shape than
> against three independently-maintained inline blocks.
>
> — `adr/0002 Decision outcome, first paragraph, verbatim` · full text: [adr/](../adr/)

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

> | Authorization | Two independent write guards: session-tracking's own (count/date/label, unchanged) and this feature's new one — only a duration-field commit, a cycle-length-field commit, or the load-time/pre-start correction may **trigger a write** to the four `adjustable-durations:*` keys, and each such write always persists the app's own full current in-memory state of all four together. An external write (another tab, devtools) never triggers any app logic — but that is distinct from whether its *value* is later read: a valid value found at the next read point (mount, or the pre-start correction check) is used like any other stored value, per `spec.md` §6.1's own "honored by design" language — it is not "adopted" via a triggered write, it is simply read, same as any value that happened to be there | [ADR-0002](adr/0002-centralize-duration-config-writes.md), `spec.md` §5 AC-08, §6.1 |
>
> — `sad.md §8, Authorization row, verbatim` · full text: [sad.md](../sad.md)

> **Critical flow 5: Foreign write to a saved setting is ignored, next legitimate write overwrites it (AC-08)**
>
> ```mermaid
> sequenceDiagram
>     actor User
>     participant UI as UI layer
>     participant Engine as Timer engine
>     participant Storage as Local storage
>     participant Other as Other tab / devtools edit
>
>     Note over UI,Engine: in-memory state holds all four current settings (three durations + cycle length)
>     Other->>Storage: writes a different value to a duration or cycle-length key
>     Note over UI: no commit, correction, or load-time read triggered - the write guard ignores it as a trigger for the app's own logic
>     Note over Engine: in-memory settings unchanged, running/paused/idle phases unaffected
>     alt a legitimate write path fires later (duration commit, cycle-length commit, or load-time/pre-start correction)
>         User->>UI: commits a duration or cycle length (or a fresh start triggers pre-start correction)
>         UI->>Storage: persistDurationConfig(storage, {all four current in-memory values}) (ADR-0002)
>         Note over UI,Storage: persists all three durations + cycle length together - overwrites, never adopts, the foreign value, even for settings this write wasn't about
>     else no legitimate write ever fires before the page is reloaded
>         Note over UI: next load reads the foreign value like any stored value - valid in range is honored, invalid falls back per Flow 3 (AC-06/AC-12)
>     end
>     Note over UI,Storage: count, date, and task label keys are not touched by any of this - they stay behind session-tracking's own write guard
> ```
>
> — `sad.md §6, «Critical flow 5: Foreign write to a saved setting is ignored, next legitimate write overwrites it (AC-08)», verbatim` · full text: [sad.md](../sad.md)

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

### AC-08 (US-08) — authorization

> **Given** the app's saved Configured durations and Configured cycle length
> **When** a write attempt to any of those values arrives from anything other than this app's own duration-commit action, cycle-length-commit action, or its own load-time/pre-start correction (AC-06/AC-12) — for example a message from another tab or origin, a change made in another same-origin tab, or a devtools edit
> **Then** the system's write guard ignores that attempt as a trigger for its own logic, and the next time one of those three legitimate paths writes, it writes the full current in-memory state of all four settings together (all three durations plus the cycle length) — overwriting, never adopting, whatever had been saved in the meantime, even for the settings that particular write wasn't specifically about. This extends, but does not widen, session-tracking's existing write guard (`docs/features/session-tracking/spec.md` AC-07): the daily count, tracked date, and task label remain writable only by their own three existing triggers, unaffected by duration or cycle-length commits, exactly as before
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

### AC-12 (US-09) — domain invariant

> **Given** a stored cycle-length value — encountered on page load — is not a valid whole number in the 2–8 range (missing, malformed, non-numeric, decimal, or out of range)
> **When** the system encounters it
> **Then** the system treats it as no valid Configured cycle length, falls back to the classic default of 4, and writes that default back to storage immediately
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add `persistDurationConfig(storage, {focus, shortBreak, longBreak, cycleLength})` — the only new `storage.setItem` caller — writing all four `adjustable-durations:*` keys every time, fail-soft — `src/ui/index.js`
- [ ] Add `readPersistedDurationConfig(storage)` validating each field independently with T3's stored validators; on any invalid/missing value, use the default and write the corrected full state back immediately via `persistDurationConfig` — `src/ui/index.js`
- [ ] Extend the all-of-`src/` write-guard scan to permit `persistDurationConfig` as a `storage.setItem` caller while still forbidding any other — `test/logic/write-guard.test.js`
- [ ] Unit tests: full-state write of all four keys; per-field fallback + write-back; foreign value overwritten by the next write; count/date/label keys never written by it — `test/logic/write-guard.test.js`

## Edge cases

| Case | Behaviour |
|---|---|
| A foreign write to a duration key between legitimate writes | Ignored as a trigger; the next `persistDurationConfig` overwrites it with the full in-memory state (AC-08) |
| One key invalid, others valid | Only that key falls back to its default; the corrected full state is written back |
| `storage` throws on write | Fail-soft: app keeps running on in-memory state, nothing shown, no exception |
| Duration/cycle-length write | session-tracking's count/date/label keys are never touched |

## Definition of Done

- [ ] Write-guard scan permits exactly `persistState` and `persistDurationConfig` and is green
- [ ] Unit tests for the four behaviours above pass
- [ ] Every Hard Rule inlined above still holds (storage access only from `src/ui/`)
- [ ] `npm test` and `npm run lint` clean
