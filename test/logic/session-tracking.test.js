import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  localDateString,
  shouldRollover,
  validateLabelInput,
  validateStoredCount,
  validateStoredDate,
  validateStoredLabel,
} from '../../src/logic/index.js';

// All timestamps use the local Date(y, m, d, h, min, s) constructor, never
// Date.UTC — shouldRollover/localDateString reason about the *local* calendar
// day (spec.md's "local midnight"), so tests must move in local wall-clock
// time to stay meaningful regardless of the runner's own timezone.

// session-tracking T2 (spec.md AC-06, AC-06b): the rollover decision compares the
// real current date against the stored date — never the completing session's own
// day (that is a separate, second comparison T6 performs). >=5 mocked
// midnight-boundary cases per spec.md §6 NFR "Daily reset correctness".
describe('shouldRollover (session-tracking T2, AC-06/AC-06b)', () => {
  test('no prior stored date forces a fresh rollover', () => {
    const now = new Date(2026, 8, 28, 12, 0, 0).getTime();
    assert.equal(shouldRollover(null, now), true);
  });

  test('exactly-at-midnight: stored date is yesterday, now is the first instant of today', () => {
    const stored = localDateString(new Date(2026, 8, 27, 23, 59, 59).getTime());
    const now = new Date(2026, 8, 28, 0, 0, 0).getTime();
    assert.equal(shouldRollover(stored, now), true);
  });

  test('mid-sleep crossing: stored yesterday evening, now well into today', () => {
    const stored = localDateString(new Date(2026, 8, 27, 22, 0, 0).getTime());
    const now = new Date(2026, 8, 28, 9, 0, 0).getTime();
    assert.equal(shouldRollover(stored, now), true);
  });

  test('long-absence crossing: stored several days ago, now much later', () => {
    const stored = localDateString(new Date(2026, 8, 20, 10, 0, 0).getTime());
    const now = new Date(2026, 8, 28, 10, 0, 0).getTime();
    assert.equal(shouldRollover(stored, now), true);
  });

  test('true-completion-before-midnight crossing: stored is still today relative to the read, no rollover yet needed for the read itself', () => {
    const stored = localDateString(new Date(2026, 8, 28, 23, 0, 0).getTime());
    const now = new Date(2026, 8, 28, 23, 30, 0).getTime();
    assert.equal(shouldRollover(stored, now), false);
  });

  test('backward clock change: stored date is later than what now reports (AC-06b) — never rolls backward', () => {
    const stored = localDateString(new Date(2026, 8, 28, 10, 0, 0).getTime());
    const now = new Date(2026, 8, 27, 10, 0, 0).getTime(); // clock/date moved back a day
    assert.equal(shouldRollover(stored, now), false);
  });

  test('same calendar day, no rollover', () => {
    const stored = localDateString(new Date(2026, 8, 28, 1, 0, 0).getTime());
    const now = new Date(2026, 8, 28, 23, 0, 0).getTime();
    assert.equal(shouldRollover(stored, now), false);
  });
});

describe('localDateString (session-tracking T2)', () => {
  test('formats as a lexicographically-sortable YYYY-MM-DD', () => {
    assert.equal(localDateString(new Date(2026, 0, 5, 12).getTime()).length, 10);
  });

  test('a later timestamp on the next day sorts after an earlier one', () => {
    const a = localDateString(new Date(2026, 8, 27, 23, 59).getTime());
    const b = localDateString(new Date(2026, 8, 28, 0, 0).getTime());
    assert.equal(a < b, true);
  });
});

// session-tracking T3 (spec.md AC-02, §6 NFR "Task label length limit"): a hard
// stop at 100 raw characters, never a post-hoc truncation — a paste that would
// push the field over the limit is rejected in full, not truncated to fit.
describe('validateLabelInput (session-tracking T3, AC-02)', () => {
  test('accepts input under the limit', () => {
    const result = validateLabelInput('hello', 'hello world');
    assert.deepEqual(result, { value: 'hello world', rejected: false });
  });

  test('accepts input landing exactly at 100 characters', () => {
    const previous = 'a'.repeat(99);
    const next = 'a'.repeat(100);
    const result = validateLabelInput(previous, next);
    assert.deepEqual(result, { value: next, rejected: false });
  });

  test('rejects a single keystroke past 100 characters — reverts to the previous value', () => {
    const previous = 'a'.repeat(100);
    const next = 'a'.repeat(101);
    const result = validateLabelInput(previous, next);
    assert.deepEqual(result, { value: previous, rejected: true });
  });

  test('rejects a paste that would push the field over 100 characters — in full, not truncated', () => {
    const previous = 'a'.repeat(95);
    const next = previous + '1234567890'; // 95 + 10 = 105
    const result = validateLabelInput(previous, next);
    assert.deepEqual(result, { value: previous, rejected: true }); // stays at 95, not truncated to 100
  });

  test('raw string length, not visual-character count', () => {
    // surrogate pair emoji: 2 UTF-16 code units, 1 visual character
    const previous = 'a'.repeat(99);
    const next = previous + '😀'; // raw length 101
    const result = validateLabelInput(previous, next);
    assert.deepEqual(result, { value: previous, rejected: true });
  });
});

describe('validateStoredCount (session-tracking T3, §6 NFR "Corrupted or missing persisted state")', () => {
  test('a valid non-negative integer passes through', () => {
    assert.equal(validateStoredCount('3'), 3);
    assert.equal(validateStoredCount(3), 3);
  });

  test('missing, malformed, negative, or wrong-type values fall back to 0', () => {
    assert.equal(validateStoredCount(null), 0);
    assert.equal(validateStoredCount(undefined), 0);
    assert.equal(validateStoredCount('abc'), 0);
    assert.equal(validateStoredCount('-1'), 0);
    assert.equal(validateStoredCount({}), 0);
    assert.equal(validateStoredCount('3.5'), 0);
  });
});

describe('validateStoredDate (session-tracking T3, §6 NFR "Corrupted or missing persisted state")', () => {
  test('a valid YYYY-MM-DD string passes through', () => {
    assert.equal(validateStoredDate('2026-09-28'), '2026-09-28');
  });

  test('missing or malformed values fall back to null (no prior date, forces rollover)', () => {
    assert.equal(validateStoredDate(null), null);
    assert.equal(validateStoredDate(undefined), null);
    assert.equal(validateStoredDate('not-a-date'), null);
    assert.equal(validateStoredDate(12345), null);
    assert.equal(validateStoredDate(''), null);
  });
});

describe('validateStoredLabel (session-tracking T3, §6 NFR "Corrupted or missing persisted state")', () => {
  test('a valid string passes through', () => {
    assert.equal(validateStoredLabel('write the report'), 'write the report');
  });

  test('missing or wrong-type values fall back to empty string', () => {
    assert.equal(validateStoredLabel(null), '');
    assert.equal(validateStoredLabel(undefined), '');
    assert.equal(validateStoredLabel(42), '');
    assert.equal(validateStoredLabel({}), '');
  });
});
