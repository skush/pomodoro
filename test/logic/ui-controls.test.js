// break-flow T4: the three-slot controls and the keyboard-focus rule (spec.md AC-10, AC-11,
// sad.md §6 Flow 6, ADR-0003). Plain Node — the decision is a pure function and the DOM
// pieces run against a minimal fake document, like test/logic/ring.test.js.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createControls, focusTargetAfterUpdate, slotsOf } from '../../src/ui/controls.js';
import { controlLayout, PHASES } from '../../src/logic/index.js';

// Slots are [main, side-1, side-2]; each entry is the action there or null when empty.
const NONE = -1;

describe('focusTargetAfterUpdate (AC-11, Flow 6)', () => {
  test('keyboard focus outside the slots is never moved', () => {
    assert.equal(focusTargetAfterUpdate(['startFocus', null, null], ['startBreak', 'startFocus', null], NONE), 'leave');
    assert.equal(focusTargetAfterUpdate(['startFocus', null, null], [null, 'resetFocus', null], NONE), 'leave');
  });

  test('the same action in the focused slot keeps focus', () => {
    assert.equal(focusTargetAfterUpdate(['startFocus', 'pauseBreak', 'resetBreak'], ['startFocus', 'pauseBreak', 'resetBreak'], 0), 'keep');
    assert.equal(focusTargetAfterUpdate(['startFocus', 'pauseBreak', 'resetBreak'], ['startFocus', 'pauseBreak', 'resetBreak'], 2), 'keep');
  });

  test('a greyed Start focus becoming available is the same control — focus stays', () => {
    // Greyed-ness is not part of the slot's action, so the guard ending changes nothing here.
    const slots = ['startFocus', 'pauseBreak', 'resetBreak'];
    assert.equal(focusTargetAfterUpdate(slots, slots, 0), 'keep');
  });

  test('the pause toggle keeps focus across Pause <-> Resume of the same phase', () => {
    assert.equal(focusTargetAfterUpdate(['startFocus', 'pauseBreak', 'resetBreak'], ['startFocus', 'resumeBreak', 'resetBreak'], 1), 'keep');
    assert.equal(focusTargetAfterUpdate(['startFocus', 'resumeBreak', 'resetBreak'], ['startFocus', 'pauseBreak', 'resetBreak'], 1), 'keep');
    assert.equal(focusTargetAfterUpdate(['pauseFocus', 'resetFocus', null], ['resumeFocus', 'resetFocus', null], 0), 'keep');
    assert.equal(focusTargetAfterUpdate(['resumeFocus', 'resetFocus', null], ['pauseFocus', 'resetFocus', null], 0), 'keep');
  });

  test('a pause control swapping to another phase is not a toggle — focus moves', () => {
    assert.equal(focusTargetAfterUpdate(['pauseFocus', 'resetFocus', null], ['startBreak', 'startFocus', null], 0), 'main');
    assert.equal(focusTargetAfterUpdate(['startFocus', 'pauseBreak', 'resetBreak'], ['resumeFocus', 'resetFocus', null], 1), 'main');
  });

  test('a vanished control moves focus to the main position', () => {
    // Reset break pressed: the break goes waiting — focus goes to Start break, not Start focus.
    assert.equal(focusTargetAfterUpdate(['startFocus', 'pauseBreak', 'resetBreak'], ['startBreak', 'startFocus', null], 2), 'main');
    // Start focus pressed on a break: the slot now holds a different control.
    assert.equal(focusTargetAfterUpdate(['startFocus', 'pauseBreak', 'resetBreak'], [null, 'resetFocus', null], 0), 'phase');
    // The slot changed to a different control.
    assert.equal(focusTargetAfterUpdate(['startBreak', 'startFocus', null], ['startFocus', 'pauseBreak', 'resetBreak'], 0), 'main');
    assert.equal(focusTargetAfterUpdate(['startBreak', 'startFocus', null], ['startFocus', 'pauseBreak', 'resetBreak'], 1), 'main');
  });

  test('main holding a greyed Start focus still counts as holding a control', () => {
    // Focus completed into a break, auto-started: main is Start focus (greyed in the guard).
    assert.equal(focusTargetAfterUpdate([null, 'resetFocus', null], ['startFocus', 'pauseBreak', 'resetBreak'], 1), 'main');
  });

  test('an empty main moves focus to the phase name and countdown, never onto Reset focus', () => {
    // Focus running with pausing off: main is empty, Reset focus beside it.
    assert.equal(focusTargetAfterUpdate(['startFocus', null, null], [null, 'resetFocus', null], 0), 'phase');
    // Policy turned off while on Pause focus.
    assert.equal(focusTargetAfterUpdate(['pauseFocus', 'resetFocus', null], [null, 'resetFocus', null], 0), 'phase');
    // Even when focus was on Reset focus's own slot and that control vanished.
    assert.equal(focusTargetAfterUpdate([null, 'resetFocus', null], [null, null, null], 1), 'phase');
  });

  test('focus on a slot that held nothing is not moved', () => {
    assert.equal(focusTargetAfterUpdate([null, 'resetFocus', null], [null, 'resetFocus', null], 0), 'leave');
  });

  test('bad input never throws and leaves focus alone', () => {
    assert.equal(focusTargetAfterUpdate(undefined, undefined, 0), 'leave');
    assert.equal(focusTargetAfterUpdate(['startFocus'], ['startFocus'], 7), 'leave');
  });
});

describe('slotsOf', () => {
  test('flattens a layout into [main, side-1, side-2], padding empties with null', () => {
    assert.deepEqual(slotsOf({ main: 'startFocus', side: [], mainGreyed: false }), ['startFocus', null, null]);
    assert.deepEqual(slotsOf({ main: null, side: ['resetFocus'], mainGreyed: false }), [null, 'resetFocus', null]);
    assert.deepEqual(slotsOf({ main: 'startFocus', side: ['pauseBreak', 'resetBreak'], mainGreyed: true }), [
      'startFocus', 'pauseBreak', 'resetBreak',
    ]);
  });
});

// ---- createControls against a minimal fake DOM ----

function fakeDocument() {
  const doc = {
    activeElement: null,
    createElement(tag) {
      const el = {
        tag,
        attrs: {},
        listeners: {},
        children: [],
        hidden: false,
        textContent: '',
        type: undefined,
        className: '',
        setAttribute(k, v) {
          this.attrs[k] = String(v);
        },
        removeAttribute(k) {
          delete this.attrs[k];
        },
        getAttribute(k) {
          return k in this.attrs ? this.attrs[k] : null;
        },
        append(...kids) {
          this.children.push(...kids);
        },
        addEventListener(type, fn) {
          this.listeners[type] = fn;
        },
        click() {
          this.listeners.click?.({ currentTarget: this });
        },
        focus() {
          doc.activeElement = this;
        },
      };
      return el;
    },
  };
  return doc;
}

const FOCUS_START = 5_000_000;
function snapshot({ phase, state, allow = false, startedAt = FOCUS_START }) {
  return {
    phase,
    running: state === 'running',
    idle: state === 'waiting',
    startedAt: state === 'waiting' ? null : startedAt,
    allowPausingFocus: allow,
  };
}

function build() {
  const doc = fakeDocument();
  const actions = [];
  const phaseEl = doc.createElement('p');
  const controls = createControls((a) => actions.push(a), doc);
  const [main, side1, side2] = controls.element.children;
  return { doc, actions, phaseEl, controls, main, side1, side2 };
}

describe('createControls (AC-10)', () => {
  test('builds exactly three fixed <button type=button> slots in a .timer-controls element', () => {
    const { controls } = build();
    assert.equal(controls.element.className, 'timer-controls');
    assert.equal(controls.element.children.length, 3);
    for (const [i, btn] of controls.element.children.entries()) {
      assert.equal(btn.tag, 'button');
      assert.equal(btn.type, 'button');
      assert.equal(btn.attrs['data-slot'], ['main', 'side-1', 'side-2'][i]);
    }
  });

  test('update(layout) sets label, data-action and hidden from the layout', () => {
    const { controls, phaseEl, main, side1, side2 } = build();
    const brk = controlLayout(snapshot({ phase: PHASES.SHORT_BREAK, state: 'running' }), FOCUS_START + 10_000);
    controls.update(brk, phaseEl);
    assert.deepEqual([main.textContent, side1.textContent, side2.textContent], ['Start focus', 'Pause break', 'Reset break']);
    assert.deepEqual([main.attrs['data-action'], side1.attrs['data-action'], side2.attrs['data-action']], [
      'startFocus', 'pauseBreak', 'resetBreak',
    ]);
    assert.deepEqual([main.hidden, side1.hidden, side2.hidden], [false, false, false]);
  });

  test('an empty slot is hidden and carries no action; no button is ever labelled with a bare verb', () => {
    const { controls, phaseEl, main, side1, side2 } = build();
    controls.update(controlLayout(snapshot({ phase: PHASES.FOCUS, state: 'running' }), FOCUS_START + 10_000), phaseEl);
    assert.equal(main.hidden, true);
    assert.equal(main.getAttribute('data-action'), null);
    assert.equal(side1.textContent, 'Reset focus');
    assert.equal(side2.hidden, true);
    for (const btn of [main, side1, side2]) assert.doesNotMatch(btn.textContent, /^(Start|Pause|Resume|Reset)$/);
  });

  test('a greyed Start focus uses aria-disabled, never the disabled attribute, and clears it afterwards', () => {
    const { controls, phaseEl, main } = build();
    const brk = snapshot({ phase: PHASES.SHORT_BREAK, state: 'running' });
    controls.update(controlLayout(brk, FOCUS_START + 1000), phaseEl);
    assert.equal(main.attrs['aria-disabled'], 'true');
    assert.equal('disabled' in main.attrs, false);
    assert.equal(main.disabled, undefined);
    controls.update(controlLayout(brk, FOCUS_START + 3000), phaseEl);
    assert.equal(main.getAttribute('aria-disabled'), null);
  });

  test('a click on a slot reports its action; the controls module never touches the engine', () => {
    const { controls, phaseEl, actions, main, side1, side2 } = build();
    controls.update(controlLayout(snapshot({ phase: PHASES.SHORT_BREAK, state: 'running' }), FOCUS_START + 5000), phaseEl);
    main.click();
    side1.click();
    side2.click();
    assert.deepEqual(actions, ['startFocus', 'pauseBreak', 'resetBreak']);
  });

  // AC-05 is enforced by the engine (ADR-0002, unit-tested there): the control only forwards, so
  // a press right after the guard ends is never dropped while the greyed look trails a tick.
  test('a click on the greyed Start focus is still forwarded — the engine, not the control, enforces the guard (AC-05)', () => {
    const { controls, phaseEl, actions, main } = build();
    controls.update(controlLayout(snapshot({ phase: PHASES.SHORT_BREAK, state: 'running' }), FOCUS_START + 1000), phaseEl);
    assert.equal(main.attrs['aria-disabled'], 'true');
    main.click();
    assert.deepEqual(actions, ['startFocus']);
  });

  test('a click on a hidden, empty slot reports nothing', () => {
    const { controls, phaseEl, actions, main } = build();
    controls.update(controlLayout(snapshot({ phase: PHASES.FOCUS, state: 'running' }), FOCUS_START + 1000), phaseEl);
    assert.equal(main.hidden, true);
    main.click();
    assert.deepEqual(actions, []);
  });

  test('the phase element is made a programmatic focus target (tabindex=-1)', () => {
    const { controls, phaseEl } = build();
    controls.update(controlLayout(snapshot({ phase: PHASES.FOCUS, state: 'waiting' }), FOCUS_START), phaseEl);
    assert.equal(phaseEl.attrs.tabindex, '-1');
  });
});

describe('createControls — keyboard focus (AC-11)', () => {
  test('pause toggle: focus stays on the slot across Pause break -> Resume break', () => {
    const { doc, controls, phaseEl, side1 } = build();
    const t = FOCUS_START + 10_000;
    controls.update(controlLayout(snapshot({ phase: PHASES.SHORT_BREAK, state: 'running' }), t), phaseEl);
    side1.focus();
    controls.update(controlLayout(snapshot({ phase: PHASES.SHORT_BREAK, state: 'paused' }), t), phaseEl);
    assert.equal(side1.textContent, 'Resume break');
    assert.equal(doc.activeElement, side1);
  });

  test('Reset break pressed: focus moves to the main Start break, not to Start focus', () => {
    const { doc, controls, phaseEl, main, side1, side2 } = build();
    const t = FOCUS_START + 10_000;
    controls.update(controlLayout(snapshot({ phase: PHASES.SHORT_BREAK, state: 'running' }), t), phaseEl);
    side2.focus();
    controls.update(controlLayout(snapshot({ phase: PHASES.SHORT_BREAK, state: 'waiting' }), t), phaseEl);
    assert.equal(main.textContent, 'Start break');
    assert.equal(side1.textContent, 'Start focus');
    assert.equal(doc.activeElement, main);
  });

  test('Focus running with pausing off: focus goes to the phase name, never onto Reset focus', () => {
    const { doc, controls, phaseEl, main, side1 } = build();
    controls.update(controlLayout(snapshot({ phase: PHASES.FOCUS, state: 'waiting' }), FOCUS_START), phaseEl);
    main.focus(); // Start focus pressed
    controls.update(controlLayout(snapshot({ phase: PHASES.FOCUS, state: 'running' }), FOCUS_START + 1000), phaseEl);
    assert.equal(doc.activeElement, phaseEl);
    assert.notEqual(doc.activeElement, side1);
  });

  test('the Skip guard ending keeps focus on the same main slot', () => {
    const { doc, controls, phaseEl, main } = build();
    const brk = snapshot({ phase: PHASES.SHORT_BREAK, state: 'running' });
    controls.update(controlLayout(brk, FOCUS_START + 1000), phaseEl);
    main.focus();
    controls.update(controlLayout(brk, FOCUS_START + 3000), phaseEl);
    assert.equal(doc.activeElement, main);
  });

  test('focus outside the slots (Task label, a duration field, a toggle) is never moved', () => {
    const { doc, controls, phaseEl } = build();
    const outside = doc.createElement('input');
    controls.update(controlLayout(snapshot({ phase: PHASES.FOCUS, state: 'waiting' }), FOCUS_START), phaseEl);
    outside.focus();
    controls.update(controlLayout(snapshot({ phase: PHASES.FOCUS, state: 'running' }), FOCUS_START + 1000), phaseEl);
    assert.equal(doc.activeElement, outside);
  });

  test('a break auto-starting while focus sits on the vanished Focus control lands on the main Start focus', () => {
    const { doc, controls, phaseEl, main } = build();
    controls.update(controlLayout(snapshot({ phase: PHASES.FOCUS, state: 'running', allow: true }), FOCUS_START + 1000), phaseEl);
    // main = Pause focus; focus sits there. The Focus completes and the break auto-starts.
    main.focus();
    controls.update(
      controlLayout(snapshot({ phase: PHASES.SHORT_BREAK, state: 'running', startedAt: FOCUS_START + 2000 }), FOCUS_START + 2000),
      phaseEl,
    );
    assert.equal(main.textContent, 'Start focus');
    assert.equal(main.attrs['aria-disabled'], 'true');
    assert.equal(doc.activeElement, main);
  });
});
