// break-flow: the timer's controls as three fixed slot buttons (main, side-1, side-2),
// painted from the pure controlLayout() rule, plus the keyboard-focus rule that keeps focus
// from being stranded on a control that vanished (spec.md AC-10/AC-11, sad.md §6 Flow 6,
// ADR-0003). This module never touches the engine: a press only reports its action name.

import { CONTROL_LABELS } from '../logic/index.js';

const SLOT_NAMES = ['main', 'side-1', 'side-2'];

// Pause X and Resume X of one phase are one pause toggle control (AC-11 design note).
const PAUSE_TOGGLE_OF = {
  pauseFocus: 'focus',
  resumeFocus: 'focus',
  pauseBreak: 'break',
  resumeBreak: 'break',
};

// A layout flattened into [main, side-1, side-2]: the action in each slot, null if empty.
export function slotsOf(layout) {
  const side = layout?.side ?? [];
  return [layout?.main ?? null, side[0] ?? null, side[1] ?? null];
}

function isSamePauseToggle(a, b) {
  return a in PAUSE_TOGGLE_OF && PAUSE_TOGGLE_OF[a] === PAUSE_TOGGLE_OF[b];
}

// Flow 6 / AC-11, as a pure decision. `prevSlots` and `nextSlots` are slotsOf() results,
// `focusedSlotIndex` the slot holding keyboard focus (-1 when focus is anywhere else).
//   'leave' — focus is not on a slot control: never touch it
//   'keep'  — the focused slot still holds the same control (or the same pause toggle)
//   'main'  — the control vanished or changed: move to the main position
//   'phase' — it vanished and main is empty: move to the phase name and countdown, which
//             deliberately skips Reset focus so a repeated press cannot discard a phase
// Whether Start focus is greyed is not part of a slot's identity: the greyed control is the
// same control, which is why it can hold focus and a reflex press does nothing.
export function focusTargetAfterUpdate(prevSlots, nextSlots, focusedSlotIndex) {
  if (!Array.isArray(prevSlots) || !Array.isArray(nextSlots)) return 'leave';
  if (!Number.isInteger(focusedSlotIndex) || focusedSlotIndex < 0 || focusedSlotIndex >= prevSlots.length) return 'leave';
  const before = prevSlots[focusedSlotIndex];
  if (before === null || before === undefined) return 'leave';
  const after = nextSlots[focusedSlotIndex] ?? null;
  if (after === before || (after !== null && isSamePauseToggle(before, after))) return 'keep';
  return nextSlots[0] ? 'main' : 'phase';
}

export function createControls(onAction, doc = document) {
  const element = doc.createElement('div');
  element.className = 'timer-controls';

  const slots = SLOT_NAMES.map((name) => {
    const button = doc.createElement('button');
    button.type = 'button';
    button.setAttribute('data-slot', name);
    button.addEventListener('click', () => {
      const action = button.getAttribute('data-action');
      // A greyed Start focus is inside the Skip guard: the press does nothing (AC-05). The
      // engine refuses it too — this just keeps the press from side effects like unlockSound.
      if (!action || button.getAttribute('aria-disabled') === 'true') return;
      onAction(action);
    });
    return button;
  });
  element.append(...slots);

  let prevSlots = [null, null, null];

  // `phaseElement` is the phase name (and countdown) — the focus target of last resort when
  // the main position is empty. It is made programmatically focusable, not a tab stop.
  function update(layout, phaseElement) {
    const nextSlots = slotsOf(layout);
    const focusedIndex = slots.indexOf(doc.activeElement);

    slots.forEach((button, i) => {
      const action = nextSlots[i];
      if (action) {
        button.setAttribute('data-action', action);
        const text = CONTROL_LABELS[action];
        if (button.textContent !== text) button.textContent = text;
        button.hidden = false;
      } else {
        button.removeAttribute('data-action');
        button.textContent = '';
        button.hidden = true;
      }
      // aria-disabled, not disabled: the greyed Start focus stays focusable and is announced.
      if (i === 0 && action && layout.mainGreyed) button.setAttribute('aria-disabled', 'true');
      else button.removeAttribute('aria-disabled');
    });

    if (phaseElement) phaseElement.setAttribute('tabindex', '-1');

    const target = focusTargetAfterUpdate(prevSlots, nextSlots, focusedIndex);
    if (target === 'main') slots[0].focus();
    else if (target === 'phase' && phaseElement) phaseElement.focus();
    prevSlots = nextSlots;
  }

  return { element, update };
}
