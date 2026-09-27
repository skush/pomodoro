---
id: T3
title: "Add pure task-label length validation and per-field storage fallback functions"
layer: "domain"
deps: []
blocks: ["T4", "T5", "T7"]
acs: ["AC-02"]
files_hint: ["src/logic/index.js", "test/logic/session-tracking.test.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
context_budget: "M"
status: "todo"
---

# T3 — Add pure task-label length validation and per-field storage fallback functions

## Place in the sequence

- **Blocked by:** none — independent pure functions. · **Blocks:** T4 — Centralized write gatekeeper (calls the fallback functions when reading stored state); T5 — Task-label UI (calls the length-validation function on every keystroke/paste); T7 — Edge-case test hardening. · **Wave:** 1 (parallel with T1, T2).
- **Lane:** shares `src/logic/index.js` and `test/logic/session-tracking.test.js` with T2 — serialized by `implement`.

## Why (user story)

> **As a** User
> **I want** to type a short label describing my current task
> **So that** I can remind myself what I'm focusing on during this session
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

This task provides the pure decision logic US-01's 100-character hard stop needs, plus the fallback-default logic every persisted field needs when storage is corrupted or missing.

## Inlined context

> Error handling: fail-soft in `src/ui/` for storage reads (corrupted/missing → per-field defaults) and writes (failure → silent, in-memory continues) — **except** the task-label length limit, which deliberately rejects-with-message rather than clamps, a documented divergence from `CLAUDE.md`'s default already stated in `spec.md` §1.
>
> — `sad.md §2, Conventions, verbatim` · full text: [sad.md](../sad.md)

> New to this feature: the pure *decision* functions (rollover, fallback validation) live in `src/logic/` even though nothing calls them from the timer engine itself — they're pure data-in/data-out functions with no engine-state access, kept there specifically so they're testable under plain Node without a DOM.
>
> — `sad.md §5, Building block view, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** Task label length limit ≤ 100 characters, counted as raw string length (not a visual-character count), enforced by refusing further input once the limit is reached (a hard stop while typing/pasting, never a post-hoc truncation).
>
> — `spec.md §6, NFR "Task label length limit", verbatim` · full text: [spec.md](../spec.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-02 — error

> **Given** a User is typing into the task label field and it already holds 100 characters (measured as raw string length, not a visual-character count)
> **When** the User attempts to enter more text, whether by typing or pasting
> **Then** the system does not accept anything beyond the 100th character — the field never exceeds 100 characters, whether the attempt was one keystroke or a paste that would have pushed it over — and shows the User an inline message that the task label is limited to 100 characters
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add a length-check function (e.g. `clampLabelInput(currentValue, incomingText)` returning the accepted text and whether it was rejected) enforcing the 100-character raw-length hard stop, covering both single-keystroke and paste-sized inputs — `src/logic/index.js`
- [ ] Add per-field fallback functions for the three persisted values: an invalid/negative/non-numeric count → `0`; an unparseable stored date → treated as no prior date; an invalid stored label → empty string — `src/logic/index.js`
- [ ] Unit tests: at-limit single keystroke rejected; a paste that would push past 100 rejected in full; count/date/label fallback on missing key, malformed JSON, and wrong type, with 0 thrown exceptions — `test/logic/session-tracking.test.js`

## Edge cases

| Case | Behaviour |
|---|---|
| Field at exactly 100 characters, one more keystroke | Rejected — field stays at 100 |
| Field at 95 characters, a 10-character paste | Rejected in full — the paste is not partially accepted to fill the remaining 5 |
| Stored count is `"abc"` or negative | Falls back to `0` |
| Stored date is malformed / missing | Treated as no prior date (forces a fresh rollover — feeds T2) |
| Stored label is the wrong type (e.g. a number) | Falls back to empty string |

## Definition of Done

- [ ] Unit test on the validation function passes (`spec.md` §6 NFR "Task label length limit")
- [ ] Unit test with invalid stored data passes with 0 thrown exceptions across all fuzzed/invalid cases (`spec.md` §6 NFR "Corrupted or missing persisted state")
- [ ] Every Hard Rule inlined above still holds — the label limit rejects-with-message, it never clamps/truncates after the fact
- [ ] lint + vet clean
