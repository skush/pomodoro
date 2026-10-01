---
id: T3
title: "Add the pure controlLayout(snapshot, now) rule and phase-named CONTROL_LABELS"
layer: "domain"
deps: ["T1"]
blocks: ["T4", "T6"]
acs: ["AC-06", "AC-08", "AC-10"]
files_hint: ["src/logic/controls.js", "test/logic/break-flow.test.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "M"
context_budget: "M"
status: "todo"
---

<!-- Inline slices are snapshots taken at breakdown time; the source file named in each signature always wins. To the executing agent: work from what is inlined; if a slice is insufficient, ambiguous or contradicts the code, open the named file for the full text. Do not invent the missing part. -->

# T3 — Add the pure controlLayout(snapshot, now) rule and phase-named CONTROL_LABELS

## Place in the sequence

- **Blocked by:** T1 — Add pure On-time, Skip-guard and stored-toggle rules in src/logic/controls.js · **Blocks:** T4 — Build createControls(onAction): three fixed slot buttons and the keyboard-focus rule; T6 — Replace Start/Pause/Reset with the phase-labelled slots and route every action to the engine · **Wave:** 2.
- **Lane:** shares `src/logic/controls.js`, `test/logic/break-flow.test.js` with T1 — serialized (ordered by the dependency chain).

## Why (user story)

> **As a** User
> **I want** to pause, resume, reset or start the break with controls that say "break"
> **So that** I can manage my rest without ever starting Focus by accident
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

Turns the AC-10 control table into one tested function with phase-named labels, so the UI only paints it.

## Inlined context

> A pure `controlLayout(snapshot, now)` in `src/logic/` returns the action in the main position and in up to two side positions, and whether the main one is greyed out. It encodes the AC-10 table and replaces `controlStates`. … An empty slot is `hidden` (a control the settings never allow). The greyed-out Start focus uses `aria-disabled="true"`, not `disabled` …
>
> — `sad.md §4, decision 5, abridged` · full text: [sad.md](../sad.md)

> `controlLayout(snapshot, now) → {main, side: [a, b], mainGreyed}` with actions `startFocus | pauseFocus | resumeFocus | resetFocus | startBreak | pauseBreak | resumeBreak | resetBreak` (the AC-10 table, ADR-0003), `CONTROL_LABELS` (phase-named labels).
>
> — `sad.md §5, src/logic/controls.js, abridged` · full text: [sad.md](../sad.md)

> The pause toggle reading of AC-11 depends on Pause and Resume sharing one slot in the final arrangement — `screens` keeps Pause and Resume in one slot. `controlLayout` returns them at the same index. … The slot positions themselves, which control sits where after Reset break, stay a `screens` decision (AC-10's last sentence) and are a data change in the layout rule.
>
> — `sad.md §11 row 5 + adr/0003 Consequences, abridged` · full text: [adr/0003-derive-controls-from-a-pure-layout-rendered-into-fixed-slots.md](../adr/0003-derive-controls-from-a-pure-layout-rendered-into-fixed-slots.md)

> **Arrangement fixed at breakdown** (no `screens` stage ran — route `quick`, no `screens.md`): Focus waiting → main `startFocus`, side `[]`. Focus running → main `pauseFocus` (only if allowed, else `null`), side `[resetFocus]`; Focus paused → main `resumeFocus`, side `[resetFocus]`. Break waiting → main `startBreak`, side `[startFocus]`. Break running/paused → main `startFocus` (`mainGreyed` inside the guard), side `[pauseBreak|resumeBreak, resetBreak]` — the pause toggle is always `side[0]`, `resetBreak` always `side[1]`. After Reset break, `startFocus` therefore lands at `side[0]`, never at the `side[1]` Reset break left. Spec §8 open question "harder-to-skip Long break": assumed **no** (same guard for Short and Long).
>
> — `tasks breakdown decision, derived from spec.md §5 AC-10 + adr/0003` · full text: [spec.md](../spec.md)

> Architecture convention: layered, `src/logic/` (pure, no DOM, no browser API) → `src/ui/` (DOM + browser APIs) → `src/main.js` (the one wiring point), unchanged (`CLAUDE.md`).
>
> — `sad.md §2, Conventions/Technical, verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-06 (US-03) — happy path

> **Given** a break is shown
> **When** the User uses the break's own controls
> **Then** each acts only on the break: a running break offers Pause break and Reset break; a paused break offers Resume break and Reset break; a waiting break offers Start break; Pause break freezes the remaining time, Resume break continues from exactly that time, Reset break returns the break to its full length — the current Configured duration (adjustable-durations AC-04b) — stopped and waiting, and Start break starts it counting down; none of them ever starts Focus, and Start focus stays offered alongside them in every break state; breaks can always be paused, whatever Allow pausing focus says
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-08 (US-04) — happy path

> **Given** Auto-start breaks is off
> **When** a Focus phase completes
> **Then** the next break is shown at its full length, waiting, with Start break in the main position and Start focus offered beside it — today's waiting behaviour, plus the option to go straight to Focus
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

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

- [ ] Add `CONTROL_LABELS` to `src/logic/controls.js`: `startFocus: 'Start focus'`, `pauseFocus`, `resumeFocus`, `resetFocus`, `startBreak`, `pauseBreak`, `resumeBreak`, `resetBreak` — no bare "Start"/"Pause"/"Resume"/"Reset".
- [ ] Add `controlLayout(snapshot, now)` returning a frozen `{main, side, mainGreyed}` per the arrangement above; take the policy from `snapshot.allowPausingFocus` and the guard from `isSkipGuardActive`.
- [ ] Extend `test/logic/break-flow.test.js` with the exhaustive AC-10 table test and the index-stability assertions (pause toggle same index; `startFocus` ≠ index of `resetBreak`).

## Edge cases

| Case | Behaviour |
|---|---|
| Focus running, `allowPausingFocus` off | `main: null`, `side: [resetFocus]` — Reset focus never in main |
| Focus paused with the policy now off | Still `resumeFocus` + `resetFocus` (a phase in progress is never altered) |
| Break paused inside the guard | `startFocus` greyed in main; `resumeBreak`, `resetBreak` beside it |
| Break waiting | No pause/reset control; no guard |

## Definition of Done

- [ ] An exhaustive unit test over every phase × run-state × Skip-guard × allowPausingFocus combination matches the AC-10 table, including: Pause/Resume of one phase at the same index, Start focus greyed only inside the guard, and Start focus never at the index Reset break occupies.
- [ ] every Hard Rule inlined above still holds
- [ ] `npm test` and `npm run lint` clean
