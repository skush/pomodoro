---
id: T8
title: "Move the existing e2e helpers and scripts to the phase-labelled controls"
layer: "tests"
deps: ["T6"]
blocks: ["T9"]
acs: ["AC-10"]
files_hint: ["test-e2e/helpers.js", "test-e2e/durations.e2e.js", "test-e2e/sensory-feedback.e2e.js", "test-e2e/sensory-feedback-chime.e2e.js", "test-e2e/smoke.e2e.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "S"
context_budget: "M"
status: "todo"
---

<!-- Inline slices are snapshots taken at breakdown time; the source file named in each signature always wins. To the executing agent: work from what is inlined; if a slice is insufficient, ambiguous or contradicts the code, open the named file for the full text. Do not invent the missing part. -->

# T8 — Move the existing e2e helpers and scripts to the phase-labelled controls

## Place in the sequence

- **Blocked by:** T6 — Replace Start/Pause/Reset with the phase-labelled slots and route every action to the engine · **Blocks:** T9 — Add test-e2e/break-flow.e2e.js: auto-start, return-after-sleep, Start focus, keyboard focus · **Wave:** 5.
- **Lane:** own lane.

## Why (user story)

> **As a** User
> **I want** every control to name the phase it acts on, and keyboard focus never left on a control that disappeared
> **So that** I always know whether a press touches Focus or the break, including after an unattended phase change
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

Keeps the shipped e2e suite green after the control labels change, so the new e2e work builds on a working harness.

## Inlined context

> Amending pinned contracts … the e2e helpers and scripts (`test-e2e/helpers.js`, `durations.e2e.js`, `sensory-feedback-chime.e2e.js`) select buttons labelled Start/Pause/Reset … `tasks` includes … moving the existing e2e selectors to the phase-labelled controls.
>
> — `sad.md §11, Risks row "Amending pinned contracts", abridged` · full text: [sad.md](../sad.md)

> Allow pausing focus is off by default; with it off, a running Focus offers no pause control. Auto-start breaks is on by default, so a break after a Focus completion now starts on its own; scenarios that expect a waiting break must seed Auto-start breaks off.
>
> — `spec.md §1 committed approach + AC-07/AC-15/AC-01, abridged` · full text: [spec.md](../spec.md)

> Dev-only e2e-through-UI harness … Drives the BUILT root index.html in a real headless browser — run `npm run build` first so it is current. Never imported by src/ and never inlined into index.html.
>
> — `test-e2e/helpers.js header comment, abridged`

> Architecture convention: layered, `src/logic/` (pure, no DOM, no browser API) → `src/ui/` (DOM + browser APIs) → `src/main.js` (the one wiring point), unchanged (`CLAUDE.md`).
>
> — `sad.md §2, Conventions/Technical, verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-10 (US-06) — domain invariant

> **Given** any phase in any state
> **When** the User looks at the controls
> **Then** every control names the phase it acts on — no control is labelled only "Start", "Pause", "Resume" or "Reset" — the phase name stays visible as text, and the main position holds:
> - Focus waiting: **Start focus**.
> - Focus running: **Pause focus** when Allow pausing focus is on; empty when it is off. Reset focus is beside it in both cases, never in the main position.
> - Focus paused (only reachable with Allow pausing focus on): **Resume focus**, with Reset focus beside it.
> - Break running, within the Skip guard: **Start focus**, greyed out, with Pause break and Reset break beside it.
> - Break paused, within the Skip guard: **Start focus**, greyed out, with Resume break and Reset break beside it.
> - Break running: **Start focus**, with Pause break and Reset break beside it.
> - Break paused: **Start focus**, with Resume break and Reset break beside it.
> - Break waiting: **Start break**, with Start focus beside it.
>
> These lists are complete: a waiting phase shows no pause or reset control. A control the User's settings never allow (Pause focus with Allow pausing focus off) is hidden, not greyed out; the only control ever greyed out is Start focus within the Skip guard. When Reset break returns a break to waiting, Start focus does not take the place where Reset break was, so a repeated press there cannot skip the break — the exact arrangement is settled at the screens stage
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] In `test-e2e/helpers.js` replace the `start/pause/reset` locators (lines ~150–152) with phase-labelled ones (`startFocus`, `pauseFocus`, `resetFocus`, `startBreak`, `pauseBreak`, `resumeBreak`, `resetBreak`) and let `openApp` seed the break-flow keys through the existing `storage` option.
- [ ] Update `durations.e2e.js`, `sensory-feedback.e2e.js`, `sensory-feedback-chime.e2e.js`, `smoke.e2e.js` to the new locators; seed `break-flow:auto-start-breaks=false` where a test expects a waiting break and `break-flow:allow-pausing-focus=true` where it pauses Focus.
- [ ] Run `npm run build && npm run test:e2e` and fix only selector/seed fallout.

## Edge cases

| Case | Behaviour |
|---|---|
| A scenario pauses Focus | Seed Allow pausing focus on |
| A scenario expects the break to wait after Focus | Seed Auto-start breaks off |
| Two "Start …" buttons visible in a waiting break | Match by exact accessible name |

## Definition of Done

- [ ] npm run build then npm run test:e2e passes with the existing scenarios unchanged in intent, now driving Start focus / Pause focus / Reset focus (Allow pausing focus seeded on where a test pauses Focus) and Start break where a break waits.
- [ ] every Hard Rule inlined above still holds
- [ ] `npm test` and `npm run lint` clean
