---
status: Accepted
owner: "sergii.kushnir@gmail.com"
reviewers: []
updated_at: "2026-10-01"
feature_size: "S"
ticket: "docs/features/break-flow/spec.md"
---

# 0003 — Derive the phase-labelled controls from a pure layout rule rendered into three fixed slots

- **Status:** Accepted
- **Date:** 2026-10-01
- **Deciders:** Architect (sergii.kushnir@gmail.com), during `design`'s Socratic pass

## Context

`spec.md` AC-10 lists, for each of eight phase × run-state × Skip-guard combinations, which
phase-labelled control sits in the main position and which sit beside it. It also says a control
the settings never allow is hidden, and that the only greyed-out control is Start focus inside the
Skip guard. AC-11 says keyboard focus must never be left on a control that disappeared or became
unavailable, including after automatic changes. Today `src/ui/index.js` has three fixed buttons
labelled Start/Pause/Reset, enabled by a pure `controlStates(snapshot)`, and a
`refocusIfStranded()` helper. This decision fixes the control model the next features will reuse
(`CLAUDE.md`: the first UI sets the precedent).

## Decision drivers

- `spec.md` AC-10 is a complete table, so it should be one tested function, not spread across DOM
  code.
- `spec.md` AC-11: the greyed-out Start focus must still hold keyboard focus, so a reflex key press
  does nothing.
- `CLAUDE.md` layering: rules in `src/logic/` are unit-tested under plain Node, DOM in `src/ui/`.
- `spec.md` §7 KPI: breaks lost to an accidental Start focus press → 0.

## Considered options

1. **Pure layout + fixed slots** — `controlLayout(snapshot, now)` in `src/logic/` returns
   `{main, side: [a, b], mainGreyed}` as action names, replacing `controlStates`. `src/ui/controls.js`
   renders three fixed slot buttons that take label and action from it: `hidden` when the slot is
   empty, `aria-disabled="true"` when greyed out.
2. **One DOM button per action** — eight buttons (Start/Pause/Resume/Reset × focus/break) in
   `src/ui/`, shown or hidden per state by DOM code.

## Decision outcome

**Chosen:** Option 1, a pure layout with fixed slots. The AC-10 table becomes one Node unit test
over every state. The UI only paints what the layout returns. Fixed slots also make keyboard focus
predictable (AC-11). Focus stays put when its slot keeps the same control. The greyed Start focus
becoming available is the same control, and Pause *X* ↔ Resume *X* of the same phase in the same
slot counts as one pause toggle. Focus moves only when its slot becomes hidden or holds a
different control. It then goes to the main position, or to the phase name and countdown
(`tabindex="-1"`) when the main position is empty, never to Reset focus. Focus that is anywhere
else (Task label, a duration field, a toggle) is never touched. Option 2 can't be tested without a
DOM, and it hides and shows buttons on every change, so most state changes would strand keyboard
focus.

## Consequences

**Positive**
- One exhaustive unit test pins AC-10. The slot positions themselves, which control sits where
  after Reset break, stay a `screens` decision (AC-10's last sentence) and are a data change in
  the layout rule.
- `aria-disabled` keeps the greyed Start focus focusable and announced as unavailable. The click
  is still forwarded to the engine, which enforces the guard (ADR-0002).
- The pattern (pure layout → fixed slots) is the precedent for any later control set.

**Negative**
- The pause toggle reading of AC-11 is an interpretation. After Pause break, keyboard focus stays
  on the slot that now reads Resume break, rather than moving to the main position (Start focus).
  A double press therefore pauses and resumes the break instead of skipping it. That serves the
  §7 KPI, but it differs from core-timer's old `refocusIfStranded` (Pause → Start). The owner chose
  this reading during `design` (`sad.md` §1 ¶4). `screens` confirms that the visual arrangement
  keeps Pause and Resume in one slot.
- `controlStates` and `refocusIfStranded` are removed, along with their tests.

**Neutral**
- A button whose label and action change in place needs its accessible name updated on every
  change. That's the normal `textContent` update the render loop already does for the phase name.

## Links

- Spec: [[../spec.md]] AC-05, AC-06, AC-08, AC-10, AC-11, AC-15, AC-17, §7
- SAD: [[../sad.md]] §4 decision 5, §8 Accessibility
- Related ADR: [[0002-enforce-skip-guard-and-focus-pause-policy-in-the-engine]]
