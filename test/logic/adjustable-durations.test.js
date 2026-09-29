import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateDurationInput,
  validateCycleLengthInput,
  validateStoredDuration,
  validateStoredCycleLength,
  DEFAULT_DURATIONS_MIN,
  DEFAULT_CYCLE_LENGTH,
} from '../../src/logic/index.js';

// adjustable-durations T3 (spec.md AC-02/AC-06/AC-11/AC-12): pure validators, never
// throwing. Input validators take the raw field text and answer {valid, value};
// stored validators take whatever storage returned and always yield a usable value.

const NOT_WHOLE_NUMBERS = ['12.5', '25abc', '1e2', '', ' ', ' 25', '25 ', 'abc', '+5', '0x10', '--5'];
const NON_STRINGS = [null, undefined, 25, {}, [], true];

describe('validateDurationInput (AC-02)', () => {
  test('accepts the 1 and 180 boundaries and values between', () => {
    for (const raw of ['1', '25', '99', '100', '180']) {
      assert.deepEqual(validateDurationInput(raw), { valid: true, value: Number(raw) });
    }
  });

  test('rejects out-of-range whole numbers', () => {
    for (const raw of ['0', '181', '-5', '500', '-0']) {
      assert.equal(validateDurationInput(raw).valid, false, raw);
    }
  });

  test('rejects anything that is not a strict whole number', () => {
    for (const raw of NOT_WHOLE_NUMBERS) {
      assert.equal(validateDurationInput(raw).valid, false, JSON.stringify(raw));
    }
  });

  test('rejects non-strings and never throws', () => {
    for (const raw of NON_STRINGS) {
      assert.doesNotThrow(() => validateDurationInput(raw));
      assert.equal(validateDurationInput(raw).valid, false);
    }
  });
});

describe('validateCycleLengthInput (AC-11)', () => {
  test('accepts the 2 and 8 boundaries and values between', () => {
    for (const raw of ['2', '4', '8']) {
      assert.deepEqual(validateCycleLengthInput(raw), { valid: true, value: Number(raw) });
    }
  });

  test('rejects out-of-range whole numbers', () => {
    for (const raw of ['0', '1', '9', '-4', '100']) {
      assert.equal(validateCycleLengthInput(raw).valid, false, raw);
    }
  });

  test('rejects anything that is not a strict whole number, and never throws', () => {
    for (const raw of [...NOT_WHOLE_NUMBERS, ...NON_STRINGS]) {
      assert.doesNotThrow(() => validateCycleLengthInput(raw));
      assert.equal(validateCycleLengthInput(raw).valid, false, JSON.stringify(raw));
    }
  });
});

describe('validateStoredDuration (AC-06)', () => {
  test('returns a valid stored value as a number', () => {
    assert.equal(validateStoredDuration('50', 'focus'), 50);
    assert.equal(validateStoredDuration('1', 'shortBreak'), 1);
    assert.equal(validateStoredDuration('180', 'longBreak'), 180);
  });

  test('falls back to the classic default per phase type for any invalid value', () => {
    for (const raw of ['0', '181', '-5', '12.5', '25abc', '1e2', '', 'abc', null, undefined, {}]) {
      assert.equal(validateStoredDuration(raw, 'focus'), DEFAULT_DURATIONS_MIN.focus, String(raw));
      assert.equal(validateStoredDuration(raw, 'shortBreak'), DEFAULT_DURATIONS_MIN.shortBreak);
      assert.equal(validateStoredDuration(raw, 'longBreak'), DEFAULT_DURATIONS_MIN.longBreak);
    }
    assert.deepEqual(DEFAULT_DURATIONS_MIN, { focus: 25, shortBreak: 5, longBreak: 15 });
  });

  test('never returns a value outside 1–180 and never throws, even for an unknown phase type', () => {
    for (const raw of ['0', '9999', null, 'x', '50']) {
      const v = validateStoredDuration(raw, 'nonsense');
      assert.ok(Number.isInteger(v) && v >= 1 && v <= 180);
    }
  });
});

describe('validateStoredCycleLength (AC-12)', () => {
  test('returns a valid stored value as a number', () => {
    for (const raw of ['2', '4', '8']) assert.equal(validateStoredCycleLength(raw), Number(raw));
  });

  test('falls back to 4 for any invalid value', () => {
    for (const raw of ['1', '9', '0', '-4', '4.5', '4x', '1e1', '', 'abc', null, undefined]) {
      assert.equal(validateStoredCycleLength(raw), DEFAULT_CYCLE_LENGTH, String(raw));
    }
    assert.equal(DEFAULT_CYCLE_LENGTH, 4);
  });
});
