---
id: T9
title: "Add test-e2e/break-flow.e2e.js: auto-start, return-after-sleep, Start focus, keyboard focus"
layer: "tests"
deps: ["T7", "T8"]
blocks: ["T10"]
acs: ["AC-01", "AC-03", "AC-04", "AC-05", "AC-11", "AC-13"]
files_hint: ["test-e2e/break-flow.e2e.js", "package.json"]
owner: "sergii.kushnir@gmail.com"
estimate: "M"
context_budget: "M"
status: "todo"
---

<!-- Inline slices are snapshots taken at breakdown time; the source file named in each signature always wins. To the executing agent: work from what is inlined; if a slice is insufficient, ambiguous or contradicts the code, open the named file for the full text. Do not invent the missing part. -->

# T9 — Add test-e2e/break-flow.e2e.js: auto-start, return-after-sleep, Start focus, keyboard focus

## Place in the sequence

- **Blocked by:** T7 — Auto-start the break after an On-time Focus completion (backdated start in render); T8 — Move the existing e2e helpers and scripts to the phase-labelled controls · **Blocks:** T10 — Regenerate index.html and run the spec §6 manual timing checks · **Wave:** 6.
- **Lane:** own lane.

## Why (user story)

> **As a** User
> **I want** my break to start counting down by itself when a Focus phase ends while I'm working
> **So that** I actually take the break instead of losing it to a missed chime or a forgotten press
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

Proves the wired page does what the unit tests promise, including the sleep case and keyboard focus.

## Inlined context

> `test-e2e/break-flow.e2e.js` — NEW: fake-clock auto-start, return-after-sleep, Start focus, focus moves.
>
> — `sad.md §5, Internal decomposition, verbatim` · full text: [sad.md](../sad.md)

> | Chimes per completion | exactly 1, including after a late completion | unit test on the timer engine: one completion → one chime; e2e return-after-sleep check |
>
> — `spec.md §6, NFR Chimes per completion, verbatim` · full text: [spec.md](../spec.md)

> QG-2c … How verify: unit tests on `engine.pause` with the policy off and on `controlLayout` over every AC-10 row; e2e keyboard-focus checks after a press, an auto-start and the guard ending.
>
> — `sad.md §10, QG-2c, abridged` · full text: [sad.md](../sad.md)

> `openApp(browser, { storage, audioSpy, noAudio, … })` opens a fresh context with a controllable fake clock; `storage` is seeded once before the app runs; `audioSpy` records tones; `noAudio` removes Web Audio (sound unavailable).
>
> — `test-e2e/helpers.js, openApp comment, abridged`

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

### AC-03 (US-05) — cross-context

> **Given** Auto-start breaks is on and a Focus phase is running when the device sleeps, the screen locks, or the browser freezes or backgrounds the tab so that the Focus end is only noticed later — a late completion
> **When** the User returns to the page, however much time has passed
> **Then** the Focus-end chime plays exactly once, the completion is credited as session-tracking decides, and the correct next break — including a Long break — is shown at its full length, waiting, with Start break and Start focus offered; the break is never counted down or used up while the User was away, and no break-end chime plays
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-04 (US-02) — happy path

> **Given** a Short break or Long break is running, paused, or waiting at full length, and the Skip guard (AC-05) is not active
> **When** the User presses Start focus
> **Then** the break ends at once with no chime, and the next Focus phase starts counting down from the current Configured focus duration — checked and corrected exactly as for any fresh start (adjustable-durations AC-06) — with the phase name, ring and tab title showing Focus running
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-05 (US-02) — error

> **Given** a break has just started — auto-started after an On-time completion (AC-01), or started by the User with Start break
> **When** the User presses Start focus within 3 seconds of that break's start — the Focus phase's true end for an auto-started break, the Start break press for a User-started one — the Skip guard
> **Then** the press does nothing and the break keeps going; for that time Start focus is shown greyed out in the main position, so the User can see it isn't available yet, and it becomes available on its own when the 3 seconds have passed in real time; pausing the break doesn't extend the guard — a break paused inside it keeps Start focus greyed out until the 3 seconds have passed — and Resume break starts no new guard; Reset break leaves the break waiting, where no guard applies; a break waiting at full length has no Skip guard
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-11 (US-06) — domain invariant

> **Given** keyboard focus is on one of the timer's controls
> **When** the set of controls changes — after a press, or without one (a break auto-starts, a phase completes, the Skip guard ends, a setting hides a control)
> **Then** keyboard focus is never left on a control that disappeared or became unavailable: it moves to the main position — within the Skip guard that is the greyed-out Start focus, which can still hold keyboard focus, so a reflex key press does nothing — and when the main position is empty (Focus running with Allow pausing focus off) it moves to the phase name and countdown, never onto Reset focus; keyboard focus that is anywhere else (the Task label, a duration field, a setting) is never moved; the phase change is announced the way phase changes already are
>
> > **Design note (2026-10-01, owner):** Pause *X* and Resume *X* of the same phase count as **one pause toggle control** in one position. After Pause break or Pause focus, keyboard focus stays on that control, which now reads Resume, and does not move to the main position. A reflex double press therefore pauses and resumes, and can't skip the break (§7 KPI). Every other control that disappears moves focus as written above. See `sad.md` §1 ¶4 and `adr/0003-derive-controls-from-a-pure-layout-rendered-into-fixed-slots.md`.
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

### AC-13 (US-01) — cross-context

> **Given** a break has auto-started (AC-01)
> **When** the User looks at, or listens for, the sensory cues
> **Then** the ring starts full and shrinks with the break, the tab title shows the break running (not waiting), the break-end chime plays at its completion as usual, and if sound cannot be played when the break auto-starts, the sound-unavailable notice (sensory-feedback AC-11) appears at that moment rather than only at the next press
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Create `test-e2e/break-flow.e2e.js` using `launchBrowser`/`openApp` from `helpers.js` (T8 locators).
- [ ] Cases: Focus ends on time → break running, ring/title show the break, one Focus-end tone (AC-01); clock jumps > 5 s past the end → break waiting with Start break + Start focus, one tone, no break-end tone (AC-03); Start focus after the guard → Focus running, no tone (AC-04); Start focus at 2 s → nothing changes, greyed control still holds keyboard focus (AC-05, AC-11); auto-start with `noAudio` → notice visible at once (AC-13); keyboard focus after Reset break and after Pause break (AC-11).
- [ ] Add the file to the `test:e2e` script in `package.json`.

## Edge cases

| Case | Behaviour |
|---|---|
| Clock jump of exactly 5 s vs 5.001 s | On-time vs late |
| Audio unavailable when the break auto-starts | Sound notice shows at that moment |
| Hidden-tab simulation | Only the desktop Chrome/Edge background promise is asserted; no Firefox claim |

## Definition of Done

- [ ] npm run build then node --test test-e2e/break-flow.e2e.js passes on the fake page clock: auto-start within 5 s, a late completion leaves the break waiting with one chime, Start focus works outside the Skip guard and does nothing inside it, keyboard focus follows AC-11, and the sound notice shows at auto-start; the file is listed in the test:e2e script.
- [ ] every Hard Rule inlined above still holds
- [ ] `npm test` and `npm run lint` clean
