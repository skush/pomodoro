---
id: T7
title: "Auto-start the break after an On-time Focus completion (backdated start in render)"
layer: "app"
deps: ["T2", "T5", "T6"]
blocks: ["T9"]
acs: ["AC-01", "AC-02", "AC-03", "AC-13", "AC-14"]
files_hint: ["src/ui/index.js", "test/logic/ui-autostart.test.js", "test/logic/write-guard.test.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "M"
context_budget: "M"
status: "todo"
---

<!-- Inline slices are snapshots taken at breakdown time; the source file named in each signature always wins. To the executing agent: work from what is inlined; if a slice is insufficient, ambiguous or contradicts the code, open the named file for the full text. Do not invent the missing part. -->

# T7 — Auto-start the break after an On-time Focus completion (backdated start in render)

## Place in the sequence

- **Blocked by:** T2 — Extend the engine: startedAt, startFocus(now), setAllowPausingFocus(on) and the focus-pause policy; T5 — Add the Auto-start breaks and Allow pausing focus toggles with a third storage gatekeeper; T6 — Replace Start/Pause/Reset with the phase-labelled slots and route every action to the engine · **Blocks:** T9 — Add test-e2e/break-flow.e2e.js: auto-start, return-after-sleep, Start focus, keyboard focus · **Wave:** 5.
- **Lane:** shares `src/ui/index.js`, `test/logic/write-guard.test.js` with T5, T6 — serialized (ordered by the dependency chain).

## Why (user story)

> **As a** User
> **I want** my break to start counting down by itself when a Focus phase ends while I'm working
> **So that** I actually take the break instead of losing it to a missed chime or a forgotten press
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

Starts the break by itself after an On-time Focus end — the core of the feature — without changing the engine's settle rule.

## Inlined context

> Option 1, the UI backdated start. … `render()` in `src/ui/`, seeing an On-time Focus completion with Auto-start breaks on, runs `prepareStart()` on the idle break and calls `engine.start(at)` with the Focus phase's true end. … AC-02's "at most one phase per completion" holds by construction: the only automatic start is this branch, and it runs only for a Focus completion.
>
> — `adr/0001, Considered options + Consequences, abridged` · full text: [adr/0001-auto-start-breaks-with-a-backdated-start-from-the-ui.md](../adr/0001-auto-start-breaks-with-a-backdated-start-from-the-ui.md)

> One render may take two snapshots when it auto-starts a break. Snapshot A (with the completion) feeds the chime/notice and the Session counter credit. The display snapshot (B after an auto-start, else A) feeds the title, ring, controls and wake-up, and it is what `lastSnapshot` holds when `render()` returns, so the wake-up callback's `syncWakeup(lastSnapshot)` never cancels the alarm the auto-start armed. Fixed order: getSnapshot A → auto-start (correction, `start(at)`, getSnapshot B, re-arm wake-up) → title → ring → chime/notice → credit → controls → keyboard focus.
>
> — `sad.md §8, One-shot consumption, verbatim` · full text: [sad.md](../sad.md)

> Flow 1: getSnapshot → settle (next break loads idle, completion latched once) → snapshot A. alt Auto-start on and `isOnTimeCompletion(at, now)`: pre-start correction → `setConfiguredDurations` → `start(at)` → getSnapshot B (break running, `startedAt = at`) → arm wake-up. Else snapshot A is the display snapshot, break waiting at full length. Then the Focus-end tone once from A, or the sound-unavailable notice now (AC-13); credit the Session counter from A.
>
> — `sad.md §6, Flow 1, abridged` · full text: [sad.md](../sad.md)

> Extract the auto-start step into an exported, injectable function in `src/ui/` (like `applyCompletionCue`) with a unit test asserting one chime + one credit + break running … Tests cover both the render-tick path and the worker-wake path, asserting the alarm stays armed for the break.
>
> — `sad.md §11, Risks rows 1–2, abridged` · full text: [sad.md](../sad.md)

> When an auto-started break later reaches zero, the existing completion path runs again and leaves Focus waiting, because only a Focus completion enters the auto-start branch (AC-02).
>
> — `sad.md §6, Flow 1 closing paragraph, verbatim` · full text: [sad.md](../sad.md)

> Every rule is a pure function of wall-clock timestamps passed in as `now`: the deadline, the On-time check (`now − at ≤ 5000 ms`), the Skip guard (`now − startedAt < 3000 ms`, real time, pause doesn't stop it). No tick counting. Tests inject the clock
>
> — `sad.md §8, Time, verbatim` · full text: [sad.md](../sad.md)

> The engine changes only through methods called by `src/ui/` from this page's own controls, toggles and duration/cycle commits, plus the auto-start branch. There is no `message`/`storage` listener and no `BroadcastChannel`.
>
> — `sad.md §8, Input guard, abridged` · full text: [sad.md](../sad.md)

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

### AC-02 (US-01, US-04) — domain invariant

> **Given** any break is running, whether it auto-started or the User started it
> **When** the break reaches zero
> **Then** the break-end chime plays once and the next Focus phase is shown at its full length, waiting for the User to press Start focus — a Focus phase never starts on its own, with Auto-start breaks on or off, so at most one phase per completion ever starts without the User
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-03 (US-05) — cross-context

> **Given** Auto-start breaks is on and a Focus phase is running when the device sleeps, the screen locks, or the browser freezes or backgrounds the tab so that the Focus end is only noticed later — a late completion
> **When** the User returns to the page, however much time has passed
> **Then** the Focus-end chime plays exactly once, the completion is credited as session-tracking decides, and the correct next break — including a Long break — is shown at its full length, waiting, with Start break and Start focus offered; the break is never counted down or used up while the User was away, and no break-end chime plays
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-13 (US-01) — cross-context

> **Given** a break has auto-started (AC-01)
> **When** the User looks at, or listens for, the sensory cues
> **Then** the ring starts full and shrinks with the break, the tab title shows the break running (not waiting), the break-end chime plays at its completion as usual, and if sound cannot be played when the break auto-starts, the sound-unavailable notice (sensory-feedback AC-11) appears at that moment rather than only at the next press
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

### AC-14 (US-01, US-04) — cross-context

> **Given** the User changes a break's Configured duration
> **When** the change is committed before the Focus phase ends, or after the break has auto-started
> **Then** a change committed before the Focus end applies to the break that auto-starts; a change committed after the break has auto-started leaves that running break at its length and applies from the next fresh start of a break of that type, or from a Reset break — the adjustable-durations rule that a started phase keeps its length (AC-04, AC-04b)
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] In `src/ui/index.js` add an exported `autoStartBreak({snapshot, now, enabled, engine, prepare})` step returning the display snapshot: runs only when `snapshot.justCompleted?.phase === 'focus'`, `enabled`, and `isOnTimeCompletion(snapshot.justCompleted.at, now)`; then `prepare()`, `engine.start(at)`, `engine.getSnapshot(now)`.
- [ ] Restructure `render()` into the fixed order: A → auto-start → title/ring from the display snapshot → chime/notice and credit from A → controls → `lastSnapshot = display`; `syncWakeup(display, wakeup)` after an auto-start.
- [ ] Make the sound-unavailable notice appear at the auto-start moment (AC-13) via the existing `applyCompletionCue` path.
- [ ] Add `test/logic/ui-autostart.test.js`: On-time (5000 ms) / late (5001 ms), setting off, break completion, one chime + one credit, wake-up stays armed via both the render-tick and worker-wake paths, backdated accuracy ≤ 1 s, Long break after a late completion waits.
- [ ] Extend `test/logic/write-guard.test.js`: the auto-start step is the third legitimate pre-start-correction trigger.

## Edge cases

| Case | Behaviour |
|---|---|
| Focus completion noticed 5001 ms late (sleep, frozen tab) | Break waits at full length, Long break included; one Focus-end chime; no break-end chime |
| Auto-start off | Break waiting; Start break in main, Start focus beside |
| Break reaches zero (auto-started or not) | Focus waiting; one chime; nothing auto-starts |
| Break duration committed before the Focus end / after the auto-start | Before: applies to the auto-started break. After: the running break keeps its length |
| Worker wake callback runs right after auto-start | Alarm stays armed (lastSnapshot is the display snapshot) |

## Definition of Done

- [ ] Unit tests of an exported, injectable auto-start step pass: an On-time Focus completion with the setting on yields a running break with remaining ≈ full − (now − at), exactly one chime and one session credit from snapshot A, wake-up armed for the break and lastSnapshot holding the display snapshot; a late completion, the setting off, or a break completion never starts anything; the sound-unavailable notice appears at auto-start when sound is unavailable.
- [ ] every Hard Rule inlined above still holds
- [ ] `npm test` and `npm run lint` clean; `npm run build` regenerated
