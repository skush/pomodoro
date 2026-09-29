---
id: T11
title: "Write the e2e-through-UI tests for duration and cycle-length flows"
layer: "tests"
deps: ["T9", "T10"]
blocks: []
acs: ["AC-01", "AC-02", "AC-03", "AC-04", "AC-05", "AC-08", "AC-09", "AC-10", "AC-11", "AC-14"]
files_hint: ["test-e2e/"]
owner: "sergii.kushnir@gmail.com"
estimate: "M"
context_budget: "L"   # justified: ten ACs verbatim are the assertions; splitting them would duplicate the harness context
status: "todo"
---

<!-- Self-contained task. To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or contradicts the code in front of you, open the named file for the full text and follow that. Do not invent the missing part. The source always wins over an inline. -->

# T11 — Write the e2e-through-UI tests for duration and cycle-length flows

## Place in the sequence

- **Blocked by:** T9 — Rebuild index.html and run the manual NFR checks, T10 — Add a dev-only headless-browser harness · **Blocks:** — · **Wave:** 7 (last; runs against the built `index.html`).
- **Lane:** own lane (`test-e2e/`).

## Why (user story)

> **As a** User
> **I want** to set my own Focus, Short-break, and Long-break durations
> **So that** the timer matches my own work rhythm instead of the fixed classic numbers
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

Proves through the real rendered page what the unit tests prove in logic: commits, rejections, running/paused isolation, reload pre-fill and the write guard.

## Inlined context

> | AC | Level | Expected outcome |
> |---|---|---|
> | AC-01 | unit + e2e-through-UI | Stored value equals the typed value; next fresh phase of that type counts down from exactly that length |
> | AC-02 | unit + e2e-through-UI | Field shows the last valid value, nothing saved, inline message names the 1–180 range |
> | AC-03 | unit + e2e-through-UI | Idle countdown shows the new duration immediately, without pressing Start |
> | AC-04 | unit + e2e-through-UI | Remaining time keeps counting down unchanged; new value applies only at the next fresh start |
> | AC-05 | unit + e2e-through-UI | Resume continues from the same frozen remaining time |
> | AC-08 | unit + e2e-through-UI | A foreign write triggers no engine logic; the next legitimate write saves all four in-memory settings, replacing the foreign value |
> | AC-09 | unit + e2e-through-UI | Fields show last-committed values, or the classic defaults where none is valid |
> | AC-10 | unit + e2e-through-UI | Stored value equals the typed value; the next Long-break decision uses it |
> | AC-11 | unit + e2e-through-UI | Field shows the last valid value, nothing saved, inline message names the 2–8 range |
> | AC-14 | unit + e2e-through-UI | Field shows the last-committed value, or 4 if none is valid |
>
> — `spec.md ## Test plan, AC coverage, abridged` · full text: [spec.md](../spec.md)

> Blur or Enter commits; an intermediate keystroke never applies to display, storage, or engine. 100:00 → 99:59 countdown crossing → the fixed-width countdown area does not shift neighboring controls.
>
> — `spec.md ## Test plan, Edge cases, abridged` · full text: [spec.md](../spec.md)

> **Hard rule:** Cleanup boundary is per-test — a fresh browser context per e2e-through-UI test; the page's storage is seeded before load.
>
> — `spec.md ## Test plan, Test data, verbatim` · full text: [spec.md](../spec.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-01 — happy path

> **Given** a User is viewing the app with a phase type currently idle
> **When** the User types a new duration for that phase type — a whole number of minutes, 1–180, the same range for every phase type — and commits it (blurs the field or presses Enter)
> **Then** the system saves that as the phase type's Configured duration, and the next time that phase type starts fresh, it runs for exactly that long
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-02 — error

> **Given** a User commits a duration value that is not a valid whole number in the 1–180 minute range (out of range, non-numeric, empty, decimal, or otherwise not a strict whole number)
> **When** that commit happens
> **Then** the system rejects it outright — the field reverts to the last validly committed Configured duration for that phase type, unchanged — and shows the User an inline message stating the valid 1–180 range
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-03 — happy path (idle immediate update)

> **Given** a phase type is currently idle, displaying its previous Configured duration
> **When** the User commits a new Configured duration for that same phase type
> **Then** the system updates that phase's idle display to the new duration immediately, without requiring the User to start it first
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-04 — domain invariant

> **Given** a phase is currently running
> **When** the User commits a new Configured duration for that same phase type
> **Then** the system does not alter the running phase's remaining time in any way — it keeps counting down exactly as it was — and the new duration only takes effect the next time that phase type starts fresh
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-05 — domain invariant

> **Given** a phase is currently paused, with a specific amount of time frozen as its remaining time
> **When** the User commits a new Configured duration for that same phase type
> **Then** the system leaves the paused phase's frozen remaining time exactly as it was, so resuming continues counting down from that same frozen value, and the new duration only takes effect the next time that phase type starts fresh
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-08 — authorization

> **Given** the app's saved Configured durations and Configured cycle length
> **When** a write attempt to any of those values arrives from anything other than this app's own duration-commit action, cycle-length-commit action, or its own load-time/pre-start correction (AC-06/AC-12) — for example a message from another tab or origin, a change made in another same-origin tab, or a devtools edit
> **Then** the system's write guard ignores that attempt as a trigger for its own logic, and the next time one of those three legitimate paths writes, it writes the full current in-memory state of all four settings together (all three durations plus the cycle length) — overwriting, never adopting, whatever had been saved in the meantime, even for the settings that particular write wasn't specifically about. […]
>
> — `spec.md §5, AC-08, abridged` · full text: [spec.md](../spec.md)

### AC-09 — happy path

> **Given** a User previously committed custom durations for one or more phase types
> **When** the User reopens or reloads the page
> **Then** the system pre-fills each phase type's duration field with exactly the Configured duration currently in effect — its last-committed value, or the classic default if none was ever validly committed or storage needed correcting (AC-06)
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

### AC-10 — happy path

> **Given** a User is viewing the app
> **When** the User types a new cycle length — a whole number, 2–8 — and commits it (blurs the field or presses Enter)
> **Then** the system saves that as the Configured cycle length, and it governs every Long-break decision from that point forward
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

### AC-11 — error

> **Given** a User commits a cycle-length value that is not a valid whole number in the 2–8 range (out of range, non-numeric, empty, decimal, or otherwise not a strict whole number)
> **When** that commit happens
> **Then** the system rejects it outright — the field reverts to the last validly committed Configured cycle length, unchanged — and shows the User an inline message stating the valid 2–8 range
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

### AC-14 — happy path

> **Given** a User previously committed a custom cycle length
> **When** the User reopens or reloads the page
> **Then** the system pre-fills the cycle-length field with exactly the Configured cycle length currently in effect — its last-committed value, or the classic default of 4 if none was ever validly committed or storage needed correcting (AC-12)
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] AC-01/AC-03: commit a Focus duration while idle; countdown updates at once; Start runs from that length — `test-e2e/durations.test.js`
- [ ] AC-02: commit 0, 181, `12.5`, `25abc`, `1e2`, empty; field reverts, storage unchanged, 1–180 message shown — `test-e2e/durations.test.js`
- [ ] AC-04/AC-05: commit a new value while running, then while paused; remaining time unchanged; resume continues from frozen value — `test-e2e/durations.test.js`
- [ ] AC-09: commit, reload, fields pre-filled; seeded invalid storage shows classic defaults — `test-e2e/persistence.test.js`
- [ ] AC-10/AC-11/AC-14: cycle-length commit, rejection (1, 9, `4.5`, empty) and reload pre-fill — `test-e2e/cycle-length.test.js`
- [ ] AC-08: write a foreign value to storage from the page context, then commit another setting; all four keys hold the in-memory state, foreign value replaced — `test-e2e/write-guard.test.js`
- [ ] Keystroke without blur/Enter changes nothing — `test-e2e/durations.test.js`
- [ ] 100:00 → 99:59 crossing does not move neighboring controls (compare control bounding boxes before/after) — `test-e2e/layout.test.js`

## Edge cases

| Case | Behaviour |
|---|---|
| Boundary values 1, 180 (durations); 2, 8 (cycle length) | Accepted and honored |
| Storage throws or is unavailable | Fail-soft: classic defaults, no uncaught page error |
| Time-dependent assertions | Use the page's own countdown text; do not rely on real 25-minute waits — set short durations (1 min) and assert on the first ticks |

## Definition of Done

- [ ] `npm run test:e2e` passes against the freshly built `index.html`
- [ ] each AC listed above has at least one named test whose title states its intent
- [ ] `npm test` and `npm run lint` clean
- [ ] every Hard Rule inlined above still holds
