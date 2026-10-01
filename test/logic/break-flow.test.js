// break-flow T1: the pure On-time, Skip-guard and stored-toggle rules (spec.md AC-01,
// AC-05, AC-09). Plain Node, injected timestamps — no DOM, no real clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ON_TIME_TOLERANCE_MS,
  SKIP_GUARD_MS,
  DEFAULT_BREAK_FLOW_SETTINGS,
  isOnTimeCompletion,
  isStaleCompletion,
  STALE_COMPLETION_MS,
  isSkipGuardActive,
  validateStoredToggle,
  controlLayout,
  CONTROL_LABELS,
  PHASES,
} from '../../src/logic/index.js';

test('the tolerance and guard constants match the spec NFRs', () => {
  assert.equal(ON_TIME_TOLERANCE_MS, 5000);
  assert.equal(SKIP_GUARD_MS, 3000);
});

test('isStaleCompletion: false up to 120 s late, true after; a nonsensical clock is never stale (sensory-feedback AC-06b)', () => {
  const at = 1_000_000;
  assert.equal(STALE_COMPLETION_MS, 120_000);
  assert.equal(isStaleCompletion(at, at), false);
  assert.equal(isStaleCompletion(at, at + 120_000), false);
  assert.equal(isStaleCompletion(at, at + 120_001), true);
  assert.equal(isStaleCompletion(at, at - 5000), false); // clock went backwards: keep the old behaviour, chime
  assert.equal(isStaleCompletion(undefined, at), false);
  assert.equal(isStaleCompletion(at, undefined), false);
});

test('isOnTimeCompletion: true at 5000 ms, false at 5001 ms (AC-01)', () => {
  const at = 1_000_000;
  assert.equal(isOnTimeCompletion(at, at), true);
  assert.equal(isOnTimeCompletion(at, at + 5000), true);
  assert.equal(isOnTimeCompletion(at, at + 5001), false);
});

test('isOnTimeCompletion: a backward clock (now < at) is never on time', () => {
  assert.equal(isOnTimeCompletion(1_000_000, 999_999), false);
});

test('isOnTimeCompletion: non-finite input is never on time', () => {
  assert.equal(isOnTimeCompletion(NaN, 1), false);
  assert.equal(isOnTimeCompletion(1, undefined), false);
});

const breakSnap = (startedAt, phase = PHASES.SHORT_BREAK) => ({ phase, startedAt });

test('isSkipGuardActive: true below 3000 ms after startedAt, false from 3000 ms (AC-05)', () => {
  const t = 5_000_000;
  assert.equal(isSkipGuardActive(breakSnap(t), t), true);
  assert.equal(isSkipGuardActive(breakSnap(t), t + 2999), true);
  assert.equal(isSkipGuardActive(breakSnap(t), t + 3000), false);
});

test('isSkipGuardActive: applies to the long break too', () => {
  const t = 5_000_000;
  assert.equal(isSkipGuardActive(breakSnap(t, PHASES.LONG_BREAK), t + 10), true);
});

test('isSkipGuardActive: no guard for Focus or a waiting (startedAt null) break', () => {
  const t = 5_000_000;
  assert.equal(isSkipGuardActive(breakSnap(t, PHASES.FOCUS), t + 10), false);
  assert.equal(isSkipGuardActive(breakSnap(null), t), false);
  assert.equal(isSkipGuardActive(null, t), false);
});

test('isSkipGuardActive: a backward clock does not hold the guard open', () => {
  assert.equal(isSkipGuardActive(breakSnap(5_000_000), 4_999_000), false);
});

test('DEFAULT_BREAK_FLOW_SETTINGS: auto-start on, allow pausing focus off, frozen', () => {
  assert.deepEqual(DEFAULT_BREAK_FLOW_SETTINGS, { autoStartBreaks: true, allowPausingFocus: false });
  assert.equal(Object.isFrozen(DEFAULT_BREAK_FLOW_SETTINGS), true);
});

test('validateStoredToggle: accepts only "true" / "false" (AC-09)', () => {
  assert.equal(validateStoredToggle('true', false), true);
  assert.equal(validateStoredToggle('false', true), false);
});

test('validateStoredToggle: anything else falls back, nothing thrown (AC-09)', () => {
  for (const raw of [null, undefined, '', 'yes', '1', 'TRUE', true, false, 1, {}]) {
    assert.equal(validateStoredToggle(raw, true), true, `fallback true for ${String(raw)}`);
    assert.equal(validateStoredToggle(raw, false), false, `fallback false for ${String(raw)}`);
  }
});

// ---- T3: controlLayout + CONTROL_LABELS (spec.md AC-06, AC-08, AC-10) ----

const T0 = 7_000_000;
// A snapshot-shaped plain object: phase, run-state, startedAt and the focus-pause policy.
function snap({ phase, state, allow = false, startedAt = null }) {
  return {
    phase,
    running: state === 'running',
    idle: state === 'waiting',
    startedAt: state === 'waiting' ? null : startedAt,
    allowPausingFocus: allow,
  };
}

const L = (main, side, mainGreyed = false) => ({ main, side, mainGreyed });

test('CONTROL_LABELS: every action is phase-named — no bare Start/Pause/Resume/Reset (AC-10)', () => {
  assert.deepEqual(CONTROL_LABELS, {
    startFocus: 'Start focus',
    pauseFocus: 'Pause focus',
    resumeFocus: 'Resume focus',
    resetFocus: 'Reset focus',
    startBreak: 'Start break',
    pauseBreak: 'Pause break',
    resumeBreak: 'Resume break',
    resetBreak: 'Reset break',
  });
  assert.equal(Object.isFrozen(CONTROL_LABELS), true);
  for (const label of Object.values(CONTROL_LABELS)) {
    assert.doesNotMatch(label, /^(Start|Pause|Resume|Reset)$/);
  }
});

test('controlLayout: the AC-10 table, every phase × run-state × guard × policy combination', () => {
  const inGuard = T0 + 1000;
  const outOfGuard = T0 + 3000;
  const cases = [];
  // Focus: the guard never applies; waiting ignores the policy.
  for (const allow of [false, true]) {
    cases.push([{ phase: PHASES.FOCUS, state: 'waiting', allow }, outOfGuard, L('startFocus', [])]);
    cases.push([
      { phase: PHASES.FOCUS, state: 'running', startedAt: T0, allow },
      inGuard,
      L(allow ? 'pauseFocus' : null, [null, 'resetFocus']),
    ]);
    // A paused Focus stays paused (resume + reset) even if the policy has since gone off.
    cases.push([{ phase: PHASES.FOCUS, state: 'paused', startedAt: T0, allow }, outOfGuard, L('resumeFocus', [null, 'resetFocus'])]);
  }
  for (const phase of [PHASES.SHORT_BREAK, PHASES.LONG_BREAK]) {
    for (const allow of [false, true]) {
      cases.push([{ phase, state: 'waiting', allow }, outOfGuard, L('startBreak', ['startFocus'])]);
      cases.push([{ phase, state: 'running', startedAt: T0, allow }, inGuard, L('startFocus', ['pauseBreak', 'resetBreak'], true)]);
      cases.push([{ phase, state: 'running', startedAt: T0, allow }, outOfGuard, L('startFocus', ['pauseBreak', 'resetBreak'])]);
      cases.push([{ phase, state: 'paused', startedAt: T0, allow }, inGuard, L('startFocus', ['resumeBreak', 'resetBreak'], true)]);
      cases.push([{ phase, state: 'paused', startedAt: T0, allow }, outOfGuard, L('startFocus', ['resumeBreak', 'resetBreak'])]);
    }
  }
  for (const [input, now, expected] of cases) {
    // 'paused' = started but not running (not idle)
    const s = { ...snap(input), running: input.state === 'running', idle: input.state === 'waiting' };
    assert.deepEqual(controlLayout(s, now), expected, JSON.stringify({ ...input, now: now - T0 }));
  }
  assert.equal(cases.length, 2 * 3 + 2 * 2 * 5);
});

test('controlLayout: the result is frozen, side included', () => {
  const layout = controlLayout(snap({ phase: PHASES.SHORT_BREAK, state: 'running', startedAt: T0 }), T0);
  assert.equal(Object.isFrozen(layout), true);
  assert.equal(Object.isFrozen(layout.side), true);
});

test('controlLayout: Start focus is greyed only inside the guard (AC-05, AC-10)', () => {
  const states = ['waiting', 'running', 'paused'];
  for (const phase of Object.values(PHASES)) {
    for (const state of states) {
      for (const dt of [0, 2999, 3000, 60_000]) {
        for (const allow of [false, true]) {
          const s = snap({ phase, state, startedAt: T0, allow });
          const layout = controlLayout(s, T0 + dt);
          const expectGrey = phase !== PHASES.FOCUS && state !== 'waiting' && dt < 3000;
          assert.equal(layout.mainGreyed, expectGrey, `${phase}/${state}/${dt}`);
          if (layout.mainGreyed) assert.equal(layout.main, 'startFocus');
        }
      }
    }
  }
});

test('controlLayout: Pause and Resume of one phase sit at the same index (AC-11 toggle)', () => {
  const idx = (layout, action) => layout.side.indexOf(action);
  const brk = (state) => controlLayout(snap({ phase: PHASES.SHORT_BREAK, state, startedAt: T0 }), T0 + 5000);
  assert.equal(idx(brk('running'), 'pauseBreak'), idx(brk('paused'), 'resumeBreak'));
  assert.notEqual(idx(brk('running'), 'pauseBreak'), -1);
  const foc = (state) => controlLayout(snap({ phase: PHASES.FOCUS, state, startedAt: T0, allow: true }), T0 + 5000);
  assert.equal(foc('running').main, 'pauseFocus');
  assert.equal(foc('paused').main, 'resumeFocus'); // main slot in both states
});

test('controlLayout: after Reset break, Start focus never lands where Reset break was (AC-10)', () => {
  const running = controlLayout(snap({ phase: PHASES.LONG_BREAK, state: 'running', startedAt: T0 }), T0 + 5000);
  const waiting = controlLayout(snap({ phase: PHASES.LONG_BREAK, state: 'waiting' }), T0 + 5000);
  const resetSlot = running.side.indexOf('resetBreak');
  assert.notEqual(resetSlot, -1);
  assert.notEqual(waiting.side.indexOf('startFocus'), resetSlot);
  assert.equal(waiting.side[resetSlot], undefined);
});

test('controlLayout: only Start focus is ever greyed out, and a waiting phase has no pause/reset', () => {
  for (const phase of Object.values(PHASES)) {
    const layout = controlLayout(snap({ phase, state: 'waiting' }), T0);
    for (const action of [layout.main, ...layout.side]) {
      assert.doesNotMatch(String(action), /^(pause|resume|reset)/);
    }
  }
});

test('controlLayout: fail-soft on a bad snapshot', () => {
  assert.doesNotThrow(() => controlLayout(null, T0));
  assert.doesNotThrow(() => controlLayout({}, T0));
});
