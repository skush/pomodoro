---
id: T4
title: "Build the centralized local-storage read + write gatekeeper"
layer: "infra"
deps: ["T2", "T3"]
blocks: ["T5", "T6", "T7"]
acs: ["AC-07"]
files_hint: ["src/ui/index.js", "test/logic/write-guard.test.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "M"
context_budget: "M"
status: "todo"
---

# T4 — Build the centralized local-storage read + write gatekeeper

## Place in the sequence

- **Blocked by:** T2 — Rollover-decision function; T3 — Field validation/fallback functions (this task calls both when reading and rolling stored state). · **Blocks:** T5 — Task-label UI; T6 — Today's count display (both call this task's writer, never `localStorage` directly); T7 — Edge-case test hardening. · **Wave:** 2.
- **Lane:** own lane for `src/ui/index.js` writes at this point — T5/T6 land their own UI code into the same file afterward, serialized behind this task.

## Why (user story)

> **As a** User
> **I want** the saved count and label to change only because of my own completed sessions and my own typing
> **So that** I can rely on what the app shows me as accurate
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

This task is the structural guarantee US-05 needs: one function, and only one, is ever allowed to write the persisted count/date/label.

## Inlined context

> **Chosen:** Option 1, one centralized write function. It gives the AC-07 / KPI guarantee a single, exhaustively-testable choke point: one unit-test suite can assert that the function always overwrites (never merges with) whatever is currently stored, and a source-level scan ... can assert that no other code path in `src/ui/` calls the storage-write API directly.
>
> — `adr/0002-centralize-session-tracking-writes.md §Decision outcome, abridged` · full text: [adr/0002-centralize-session-tracking-writes.md](../adr/0002-centralize-session-tracking-writes.md)

> only a Focus-completion event, the task-label's own commit, and the daily-rollover check may ever write the persisted count/date/label, and the app's own next write from one of those three always overwrites whatever it finds saved — never adopting an external change (another tab, a devtools edit).
>
> — `adr/0002-centralize-session-tracking-writes.md §Context, verbatim` · full text: [adr/0002-centralize-session-tracking-writes.md](../adr/0002-centralize-session-tracking-writes.md)

> **Hard rule:** Persistence: browser local storage only, written exclusively from `src/ui/` (never `src/logic/`) ... three independent local-storage keys (count, date, label), not one combined JSON blob.
>
> — `sad.md §2/§4, Constraints + Solution strategy point 6, abridged` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (Three scalar `localStorage` keys — count, date, label — no ids, no migrations, per `adr/0002-no-backend-for-v1.md`.)

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-07 — authorization

> **Given** the app's saved daily count and task label
> **When** a write attempt arrives from anything other than this page's own Focus-completion event, its own task-label commit, or its own daily-rollover check (for example a message from another tab or origin, a change made in another same-origin tab, or a devtools edit)
> **Then** the system's write guard ignores that attempt as a trigger for its own logic, and the next time one of those three legitimate paths writes, it writes the app's own current in-memory value — overwriting, never adopting, whatever the saved value had become in the meantime; only those three paths, carrying the app's own state, ever determine what ends up saved
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add a read function that loads `{ count, date, label }` from the three `localStorage` keys, running each value through T3's fallback functions — `src/ui/index.js`
- [ ] Add one centralized write function (e.g. `persistState(patch)`) that is the *only* call site for `localStorage.setItem` on these keys, always writing the app's current in-memory state (never a read-then-merge) — `src/ui/index.js`
- [ ] Wrap the write call so a thrown storage error (quota exceeded, private browsing, storage disabled) is caught and swallowed — the app keeps running in-memory, nothing is shown to the User — `src/ui/index.js`
- [ ] Source-level scan test asserting no other function in `src/ui/index.js` calls `localStorage.setItem` directly — mirrors `test/logic/timer-engine.test.js`'s existing AC-03 source-scan style — `test/logic/write-guard.test.js`
- [ ] Unit test simulating a write failure (the storage call throwing) — assert 0 exceptions escape and no error is surfaced — `test/logic/write-guard.test.js`

## Edge cases

| Case | Behaviour |
|---|---|
| An external write lands between two legitimate writes (another tab, devtools edit) | Ignored as a trigger; the next legitimate write overwrites it with the app's own in-memory state |
| `localStorage.setItem` throws (quota/private-mode/disabled) | Swallowed — in-memory state for the current page load is unaffected, 0 exceptions thrown, no User-visible error |
| Two tabs of the app open at once | Each tab's own next write overwrites the other's — no reconciliation attempted (accepted per `spec.md` §6.1) |

## Definition of Done

- [ ] Source-level scan test passes: exactly one function in `src/ui/index.js` calls the storage-write API
- [ ] Unit test simulating a write failure passes with 0 exceptions thrown and no error shown to the User (`spec.md` §6 NFR "Storage write failure")
- [ ] Every Hard Rule inlined above still holds — writes stay in `src/ui/`, never `src/logic/`
- [ ] lint + vet clean
