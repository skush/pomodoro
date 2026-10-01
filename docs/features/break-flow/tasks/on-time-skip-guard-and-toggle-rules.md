---
id: T1
title: "Add pure On-time, Skip-guard and stored-toggle rules in src/logic/controls.js"
layer: "domain"
deps: []
blocks: ["T2", "T3", "T5"]
acs: ["AC-01", "AC-05", "AC-09"]
files_hint: ["src/logic/controls.js", "src/logic/index.js", "test/logic/break-flow.test.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
context_budget: "M"
status: "todo"
---

<!-- Inline slices are snapshots taken at breakdown time; the source file named in each signature always wins. To the executing agent: work from what is inlined; if a slice is insufficient, ambiguous or contradicts the code, open the named file for the full text. Do not invent the missing part. -->

# T1 — Add pure On-time, Skip-guard and stored-toggle rules in src/logic/controls.js

## Place in the sequence

- **Blocked by:** — · **Blocks:** T2 — Extend the engine: startedAt, startFocus(now), setAllowPausingFocus(on) and the focus-pause policy; T3 — Add the pure controlLayout(snapshot, now) rule and phase-named CONTROL_LABELS; T5 — Add the Auto-start breaks and Allow pausing focus toggles with a third storage gatekeeper · **Wave:** 1.
- **Lane:** shares `src/logic/controls.js`, `src/logic/index.js`, `test/logic/break-flow.test.js` with T2, T3, T6 — serialized (ordered by the dependency chain).

## Why (user story)

> **As a** User
> **I want** my break to start counting down by itself when a Focus phase ends while I'm working
> **So that** I actually take the break instead of losing it to a missed chime or a forgotten press
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

Creates the three pure rules (On-time tolerance, Skip guard, fail-soft toggle reading) that the engine, the layout and the UI all call.

## Inlined context

> `src/logic/controls.js` — NEW, pure, re-exported from `index.js`: `ON_TIME_TOLERANCE_MS = 5000`, `SKIP_GUARD_MS = 3000`, `isOnTimeCompletion(at, now)`, `isSkipGuardActive(snapshot, now)`, `controlLayout(...)`, `CONTROL_LABELS`, `DEFAULT_BREAK_FLOW_SETTINGS {autoStartBreaks: true, allowPausingFocus: false}`, `validateStoredToggle(raw, fallback)`.
>
> — `sad.md §5, Internal decomposition, src/logic/controls.js, abridged` · full text: [sad.md](../sad.md)

> | On-time completion tolerance | a Focus completion noticed ≤ 5 s after its true end counts as On-time and auto-starts the break; > 5 s counts as late and leaves the break waiting | unit test on the timer engine with an injected clock, at 5 s and 5.001 s |
> | Skip guard length | 3 s (± 0.25 s) of real time from the break's start — the Focus phase's true end for an auto-started break, the Start break press otherwise | unit test on the guard rule with an injected clock |
>
> — `spec.md §6, NFR rows On-time tolerance + Skip guard length, verbatim` · full text: [spec.md](../spec.md)

> `readPersistedBreakFlowSettings(storage)` validates each key on its own through `validateStoredToggle(raw, fallback)` and does no write-back; … always writes both, as `'true'`/`'false'`.
>
> — `sad.md §8, Persistence, abridged` · full text: [sad.md](../sad.md)

> `startedAt` — Snapshot field: the timestamp of the current phase's fresh start (null while waiting), kept through pause and resume. The Skip guard is measured from it (ADR-0002). (Added by T2; here the rule takes it from a plain snapshot object.)
>
> — `sad.md §12, `startedAt`, abridged` · full text: [sad.md](../sad.md)

> Architecture convention: layered, `src/logic/` (pure, no DOM, no browser API) → `src/ui/` (DOM + browser APIs) → `src/main.js` (the one wiring point), unchanged (`CLAUDE.md`).
>
> — `sad.md §2, Conventions/Technical, verbatim` · full text: [sad.md](../sad.md)

> Every rule is a pure function of wall-clock timestamps passed in as `now`: the deadline, the On-time check (`now − at ≤ 5000 ms`), the Skip guard (`now − startedAt < 3000 ms`, real time, pause doesn't stop it). No tick counting. Tests inject the clock
>
> — `sad.md §8, Time, verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-01 (US-01) — happy path

> **Given** Auto-start breaks is on and a Focus phase is running on an awake device with the page open (visible in any supported browser, or in a background tab of desktop Chrome or Edge — the browsers sensory-feedback §3 holds its background timing promise for)
> **When** that Focus phase reaches zero — an On-time completion
> **Then** the Focus-end chime plays once, the completion is credited exactly as before (in-cycle focus count, Session counter), and the correct next break — Short or Long per the cycle — begins counting down by itself from its full length, measured from the Focus phase's true end; its length comes from the current Configured duration, checked and corrected exactly as for any fresh start (adjustable-durations AC-06); the phase name, ring and tab title show that break running. In a background tab of any other browser (e.g. Firefox) no auto-start is promised: the 5 s On-time tolerance (§6) decides, and a completion noticed later is a late completion (AC-03)
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-05 (US-02) — error

> **Given** a break has just started — auto-started after an On-time completion (AC-01), or started by the User with Start break
> **When** the User presses Start focus within 3 seconds of that break's start — the Focus phase's true end for an auto-started break, the Start break press for a User-started one — the Skip guard
> **Then** the press does nothing and the break keeps going; for that time Start focus is shown greyed out in the main position, so the User can see it isn't available yet, and it becomes available on its own when the 3 seconds have passed in real time; pausing the break doesn't extend the guard — a break paused inside it keeps Start focus greyed out until the 3 seconds have passed — and Resume break starts no new guard; Reset break leaves the break waiting, where no guard applies; a break waiting at full length has no Skip guard
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-09 (US-04, US-07) — error

> **Given** the saved value of Auto-start breaks or Allow pausing focus is missing, unreadable or not a valid on/off value, or the browser refuses to save it
> **When** the page loads, or the User changes the setting
> **Then** the page treats that setting as its default — Auto-start breaks on, Allow pausing focus off — when nothing valid can be read, and a change the browser couldn't save still applies for the rest of this page load; the page never shows an error or stops working because of it
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Create `src/logic/controls.js` with the two named constants and `isOnTimeCompletion(at, now)` (`0 ≤ now − at ≤ 5000`).
- [ ] Add `isSkipGuardActive(snapshot, now)`: true only for a break phase with non-null `startedAt` and `now − startedAt < SKIP_GUARD_MS`.
- [ ] Add frozen `DEFAULT_BREAK_FLOW_SETTINGS` and `validateStoredToggle(raw, fallback)`: accepts only `'true'`/`'false'`, anything else returns `fallback`.
- [ ] Add `export * from './controls.js'` to `src/logic/index.js` (star export, so later tasks add names without touching index.js).
- [ ] Write `test/logic/break-flow.test.js` with the 5000/5001 ms, 2999/3000 ms and toggle-fallback tests (injected clock, plain Node).

## Edge cases

| Case | Behaviour |
|---|---|
| Completion noticed exactly 5000 ms after its true end | On-time (auto-start allowed) |
| Completion noticed 5001 ms after its true end | Late (break waits) |
| `now < at` (backward clock change) | Not On-time — never auto-start on a nonsensical clock |
| Snapshot of a Focus phase or with `startedAt: null` | No Skip guard |
| Stored value `null`, `'yes'`, `''`, `'1'` | Default for that setting; nothing thrown |

## Definition of Done

- [ ] Unit tests pass: isOnTimeCompletion is true at 5000 ms and false at 5001 ms; isSkipGuardActive is true below 3000 ms and false from 3000 ms after the snapshot's startedAt; validateStoredToggle falls back to the default for missing, malformed or non-boolean values.
- [ ] every Hard Rule inlined above still holds
- [ ] `npm test` and `npm run lint` clean
