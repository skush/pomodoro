// break-flow T1: the pure On-time, Skip-guard and stored-toggle rules (spec.md AC-01,
// AC-05, AC-09). Plain Node, injected timestamps — no DOM, no real clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ON_TIME_TOLERANCE_MS,
  SKIP_GUARD_MS,
  DEFAULT_BREAK_FLOW_SETTINGS,
  isOnTimeCompletion,
  isSkipGuardActive,
  validateStoredToggle,
  PHASES,
} from '../../src/logic/index.js';

test('the tolerance and guard constants match the spec NFRs', () => {
  assert.equal(ON_TIME_TOLERANCE_MS, 5000);
  assert.equal(SKIP_GUARD_MS, 3000);
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
