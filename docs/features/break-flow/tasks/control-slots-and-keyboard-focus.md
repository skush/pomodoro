---
id: T4
title: "Build createControls(onAction): three fixed slot buttons and the keyboard-focus rule"
layer: "ui"
deps: ["T3"]
blocks: ["T6"]
acs: ["AC-10", "AC-11"]
files_hint: ["src/ui/controls.js", "test/logic/ui-controls.test.js"]
owner: "sergii.kushnir@gmail.com"
estimate: "M"
context_budget: "M"
status: "todo"
---

<!-- Inline slices are snapshots taken at breakdown time; the source file named in each signature always wins. To the executing agent: work from what is inlined; if a slice is insufficient, ambiguous or contradicts the code, open the named file for the full text. Do not invent the missing part. -->

# T4 — Build createControls(onAction): three fixed slot buttons and the keyboard-focus rule

## Place in the sequence

- **Blocked by:** T3 — Add the pure controlLayout(snapshot, now) rule and phase-named CONTROL_LABELS · **Blocks:** T6 — Replace Start/Pause/Reset with the phase-labelled slots and route every action to the engine · **Wave:** 3.
- **Lane:** own lane.

## Why (user story)

> **As a** User
> **I want** every control to name the phase it acts on, and keyboard focus never left on a control that disappeared
> **So that** I always know whether a press touches Focus or the break, including after an unattended phase change
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

Renders the layout into three fixed slots and guarantees keyboard focus is never stranded on a vanished control.

## Inlined context

> `src/ui/controls.js` — NEW: `createControls(onAction) → {element, update(layout)}`: three fixed slot buttons (main, side-1, side-2); label + `data-action` from the layout; hidden when empty; `aria-disabled` when greyed; moves keyboard focus per AC-11 (ADR-0003); the phase name + countdown get `tabindex="-1"` as the fallback focus target.
>
> — `sad.md §5, src/ui/controls.js, abridged` · full text: [sad.md](../sad.md)

> Focus stays put when its slot keeps the same control. The greyed Start focus becoming available is the same control, and Pause *X* ↔ Resume *X* of the same phase in the same slot counts as one pause toggle. Focus moves only when its slot becomes hidden or holds a different control. It then goes to the main position, or to the phase name and countdown (`tabindex="-1"`) when the main position is empty, never to Reset focus. Focus that is anywhere else (Task label, a duration field, a toggle) is never touched.
>
> — `adr/0003, Decision outcome, abridged` · full text: [adr/0003-derive-controls-from-a-pure-layout-rendered-into-fixed-slots.md](../adr/0003-derive-controls-from-a-pure-layout-rendered-into-fixed-slots.md)

> Flow 6 — keyboard focus outside the timer controls → do not move; focused slot still holds the same action → keep; focused slot is the pause toggle and now reads Resume, or the reverse → keep keyboard focus on that slot, so a double press pauses then resumes; focused control disappeared or became unavailable → main slot holds a control (including Start focus greyed inside the Skip guard) → move to main; main slot empty (Focus running with pausing off) → move to the phase name and countdown, never onto Reset focus.
>
> — `sad.md §6, Flow 6, abridged` · full text: [sad.md](../sad.md)

> A greyed-out Start focus uses `aria-disabled`, so it can hold keyboard focus and a reflex key press does nothing. Reset focus and Reset break are never a landing target, so a repeated press cannot discard a phase.
>
> — `sad.md §6, Flow 6 closing paragraph, verbatim` · full text: [sad.md](../sad.md)

> Every control label names its phase (`CONTROL_LABELS`). A control the settings never allow is `hidden`. The greyed-out Start focus is `aria-disabled="true"`, so it stays focusable and is announced as unavailable. … Phase changes are announced by the existing `aria-live` phase name.
>
> — `sad.md §8, Accessibility, abridged` · full text: [sad.md](../sad.md)

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

### AC-11 (US-06) — domain invariant

> **Given** keyboard focus is on one of the timer's controls
> **When** the set of controls changes — after a press, or without one (a break auto-starts, a phase completes, the Skip guard ends, a setting hides a control)
> **Then** keyboard focus is never left on a control that disappeared or became unavailable: it moves to the main position — within the Skip guard that is the greyed-out Start focus, which can still hold keyboard focus, so a reflex key press does nothing — and when the main position is empty (Focus running with Allow pausing focus off) it moves to the phase name and countdown, never onto Reset focus; keyboard focus that is anywhere else (the Task label, a duration field, a setting) is never moved; the phase change is announced the way phase changes already are
>
> > **Design note (2026-10-01, owner):** Pause *X* and Resume *X* of the same phase count as **one pause toggle control** in one position. After Pause break or Pause focus, keyboard focus stays on that control, which now reads Resume, and does not move to the main position. A reflex double press therefore pauses and resumes, and can't skip the break (§7 KPI). Every other control that disappears moves focus as written above. See `sad.md` §1 ¶4 and `adr/0003-derive-controls-from-a-pure-layout-rendered-into-fixed-slots.md`.
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Create `src/ui/controls.js`: `createControls(onAction)` building three `<button type="button">` slots; `update(layout)` sets `textContent` from `CONTROL_LABELS`, `data-action`, `hidden`, and `aria-disabled` (never `disabled`).
- [ ] Export a pure `focusTargetAfterUpdate(prevSlots, nextSlots, focusedSlotIndex)` returning `'leave' | 'keep' | 'main' | 'phase'`, implementing Flow 6; `update()` applies it, calling `.focus()` on the main slot or on the phase element it is given.
- [ ] Slot clicks call `onAction(actionName)` — the controls module never touches the engine.
- [ ] Write `test/logic/ui-controls.test.js` covering each Flow 6 branch.

## Edge cases

| Case | Behaviour |
|---|---|
| Focus on Pause break; break pauses, slot now reads Resume break | Focus stays on that slot |
| Focus on greyed Start focus; guard ends | Same control, now available; focus stays |
| Focus on Reset break; break goes waiting | Focus moves to main (Start break), not to Start focus |
| Focus on Pause focus; policy turned off mid-Focus | Slot empties; focus moves to phase name/countdown, never Reset focus |
| Focus in Task label / a duration field / a toggle | Never moved |

## Definition of Done

- [ ] Unit tests (plain Node, no DOM) of the exported focus-target decision pass for: same action keeps focus, pause toggle keeps focus across Pause↔Resume, a vanished control moves focus to main (including greyed Start focus), an empty main moves it to the phase name/countdown and never to Reset, and focus outside the slots is never moved.
- [ ] every Hard Rule inlined above still holds
- [ ] `npm test` and `npm run lint` clean; `npm run build` regenerated
