---
id: T3
title: "Add pure duration/cycle-length input and stored-value validation functions"
layer: "domain"
deps: []
blocks: ["T4","T5","T6"]
acs: ["AC-02","AC-06","AC-11","AC-12"]
files_hint: ["src/logic/index.js","test/logic/adjustable-durations.test.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
context_budget: "M"
status: "todo"
---

<!-- Self-contained task. To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or contradicts the code in front of you, open the named file for the full text and follow that. Do not invent the missing part. The source always wins over an inline. -->

# T3 — Add pure duration/cycle-length input and stored-value validation functions

## Place in the sequence

- **Blocked by:** — · **Blocks:** T4 — Add persistDurationConfig / readPersistedDurationConfig as the second storage gatekeeper, T5 — Add the three duration fields (Numeric setting field) with commit on blur/Enter and inline validation, T6 — Add the cycle-length field with commit on blur/Enter and inline validation · **Wave:** 1.
- **Lane:** shares `src/logic/index.js` with T1 and T2 — serialized; no logical dependency, so run it first.

## Why (user story)

> **As a** User
> **I want** a corrupted or invalid stored duration to never let a phase complete instantly
> **So that** my daily count stays trustworthy no matter what ends up in storage
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

The pure validators that guarantee no invalid value — typed or stored — can become a Configured value or an instant completion.

## Inlined context

> New pure functions, no engine-state access:
> │                   per-setting stored-value fallback validation (validateStoredDuration(raw),
> │                   validateStoredCycleLength(raw)) and input-commit validation
> │                   (validateDurationInput / validateCycleLengthInput), mirroring
> │                   validateStoredCount's existing shape.>
>
> — `sad.md §5, src/logic/index.js building block, validators sentence, abridged` · full text: [sad.md](../sad.md)

> | Duration bounds | Every Configured duration stays within 1–180 minutes at all times, for every phase type, whether freshly typed, freshly loaded, or previously corrupted — 0 exceptions | unit test on the validation function |
>
> — `spec.md §6, NFR «Duration bounds», verbatim` · full text: [spec.md](../spec.md)

> | Cycle-length bounds | The Configured cycle length stays within 2–8 at all times, whether freshly typed, freshly loaded, or previously corrupted — 0 exceptions | unit test on the validation function |
>
> — `spec.md §6, NFR «Cycle-length bounds», verbatim` · full text: [spec.md](../spec.md)

> | Corrupted/missing persisted duration | Each phase type's Configured duration falls back to its own classic default on any stored value that isn't a valid whole number in 1–180 (missing key, malformed value, non-numeric, decimal, or out of range — AC-06), immediately written back to storage — 0 thrown exceptions, 0 instant completions | unit test with invalid stored data |
>
> — `spec.md §6, NFR «Corrupted/missing persisted duration», verbatim` · full text: [spec.md](../spec.md)

> *A value is a valid whole number only in its strict form: an optional leading `-` followed only by digits — no decimal point, no letters, no exponent notation, no surrounding non-digit characters. A cleanly-formed but out-of-range number (e.g. `500`, `-5`) is still a valid whole number for AC-02/AC-11's purposes; `12.5`, `25abc`, `1e2`, and empty/non-numeric text are not valid whole numbers at all, for AC-06/AC-12's purposes.*
>
> — `spec.md §5, preamble on strict whole numbers, verbatim` · full text: [spec.md](../spec.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/) · [screens.md](../screens.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-02 (US-01) — error

> **Given** a User commits a duration value that is not a valid whole number in the 1–180 minute range (out of range, non-numeric, empty, decimal, or otherwise not a strict whole number)
> **When** that commit happens
> **Then** the system rejects it outright — the field reverts to the last validly committed Configured duration for that phase type, unchanged — and shows the User an inline message stating the valid 1–180 range
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-06 (US-06) — domain invariant

> **Given** a stored duration value for a phase type — encountered on page load or before that phase type would start fresh — is not a valid whole number in the 1–180 range (missing, malformed, non-numeric, decimal, or out of range)
> **When** the system encounters it
> **Then** the system treats it as no valid Configured duration, falls back to that phase type's classic default (Focus 25 minutes, Short break 5 minutes, Long break 15 minutes), and writes that default back to storage immediately — under no circumstance does an invalid stored value let a phase complete faster than its own valid minimum, or complete instantly
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-11 (US-09) — error

> **Given** a User commits a cycle-length value that is not a valid whole number in the 2–8 range (out of range, non-numeric, empty, decimal, or otherwise not a strict whole number)
> **When** that commit happens
> **Then** the system rejects it outright — the field reverts to the last validly committed Configured cycle length, unchanged — and shows the User an inline message stating the valid 2–8 range
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

### AC-12 (US-09) — domain invariant

> **Given** a stored cycle-length value — encountered on page load — is not a valid whole number in the 2–8 range (missing, malformed, non-numeric, decimal, or out of range)
> **When** the system encounters it
> **Then** the system treats it as no valid Configured cycle length, falls back to the classic default of 4, and writes that default back to storage immediately
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add `validateDurationInput(raw)` (strict whole number 1–180) and `validateCycleLengthInput(raw)` (2–8), using the strict form: optional leading `-` then digits only — `src/logic/index.js`
- [ ] Add `validateStoredDuration(raw)` and `validateStoredCycleLength(raw)` returning the value or the classic default (25/5/15 by phase type; 4), mirroring `validateStoredCount`'s shape and never throwing — `src/logic/index.js`
- [ ] Unit tests: boundaries 1/180 and 2/8 accepted; rejects 0, 181, -5, 500, `12.5`, `25abc`, `1e2`, empty, whitespace, null/undefined, non-string — `test/logic/adjustable-durations.test.js`

## Edge cases

| Case | Behaviour |
|---|---|
| `500` or `-5` (well-formed but out of range) | Rejected as out of range (input) / falls back to the default (stored) |
| `12.5`, `25abc`, `1e2`, empty, non-numeric | Not a valid whole number: rejected / fall back to the default |
| Boundary values 1, 180, 2, 8 | Accepted |
| Stored value missing (`null`) | Falls back to the classic default, never throws |

## Definition of Done

- [ ] Unit tests for every valid/invalid class above pass, 0 thrown exceptions
- [ ] No stored-value path can return a value outside 1–180 / 2–8
- [ ] `src/logic/` still has no DOM/storage access
- [ ] `npm test` and `npm run lint` clean
