import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTimerEngine,
  localDateString,
  shouldRollover,
  validateLabelInput,
  validateStoredCount,
  validateStoredDate,
  validateStoredLabel,
  applyCountUpdate,
} from '../../src/logic/index.js';

const FOCUS_MS = 25 * 60 * 1000;

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

  // review fix (CHANGES REQUESTED, stage-2): a calendar-impossible value that
  // still matches the YYYY-MM-DD *format* (e.g. month 13, day 45) must also
  // fall back to null — JS Date silently rolls it over, which would otherwise
  // freeze the counter until the rolled-over date is reached for real.
  test('a format-matching but calendar-impossible value falls back to null', () => {
    assert.equal(validateStoredDate('2026-13-45'), null);
    assert.equal(validateStoredDate('2026-02-30'), null);
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

  // review fix (CHANGES REQUESTED, AC-02): a stored label over the 100-char
  // limit (written externally, e.g. via devtools or another tab) must fall back
  // to empty, not load as-is — AC-02 requires the field to never exceed 100
  // characters, and an over-limit value loaded as-is could never be edited down
  // one character at a time (every edit still exceeds the limit).
  test('a stored value over 100 characters falls back to empty string', () => {
    assert.equal(validateStoredLabel('a'.repeat(101)), '');
  });

  test('a stored value at exactly 100 characters passes through', () => {
    const atLimit = 'a'.repeat(100);
    assert.equal(validateStoredLabel(atLimit), atLimit);
  });
});

// review fix (CHANGES REQUESTED, T6 DoD): applyCountUpdate is the SAME function
// src/ui/index.js's updateSessionCount() calls — these tests exercise the real
// wiring's decision logic directly, not a copy of it. >=5 required
// midnight-boundary cases per spec.md §6 NFR "Daily reset correctness", plus a
// backward-clock-with-completion case and the AC-05 null-latch case.
describe('applyCountUpdate (session-tracking T6, AC-04/AC-04b/AC-05/AC-06/AC-06b)', () => {
  test('exactly-at-midnight: rolls over and does not credit (no completion)', () => {
    const stored = localDateString(new Date(2026, 8, 27, 23, 59, 59).getTime());
    const now = new Date(2026, 8, 28, 0, 0, 0).getTime();
    const result = applyCountUpdate({ trackedDate: stored, count: 3 }, now, null);
    assert.deepEqual(result, { trackedDate: localDateString(now), count: 0 });
  });

  test('mid-sleep crossing, with a genuine new-day completion: rolls over and credits', () => {
    const stored = localDateString(new Date(2026, 8, 27, 22, 0, 0).getTime());
    const now = new Date(2026, 8, 28, 9, 0, 0).getTime();
    const completedAt = new Date(2026, 8, 28, 8, 55, 0).getTime(); // same day as `now`
    const result = applyCountUpdate({ trackedDate: stored, count: 5 }, now, completedAt);
    assert.deepEqual(result, { trackedDate: localDateString(now), count: 1 });
  });

  test('long-absence crossing: rolls over, stale count reset to 0', () => {
    const stored = localDateString(new Date(2026, 8, 20, 10, 0, 0).getTime());
    const now = new Date(2026, 8, 28, 10, 0, 0).getTime();
    const result = applyCountUpdate({ trackedDate: stored, count: 12 }, now, null);
    assert.deepEqual(result, { trackedDate: localDateString(now), count: 0 });
  });

  test('true-completion-before-midnight crossing: a session that truly finished before midnight is not credited into the new day', () => {
    const stored = localDateString(new Date(2026, 8, 28, 23, 10, 0).getTime());
    const now = new Date(2026, 8, 29, 0, 10, 0).getTime(); // detected after midnight
    const completedAt = new Date(2026, 8, 28, 23, 35, 0).getTime(); // truly finished before midnight
    const result = applyCountUpdate({ trackedDate: stored, count: 2 }, now, completedAt);
    assert.deepEqual(result, { trackedDate: localDateString(now), count: 0 }); // rolled, NOT credited
  });

  test('a session that truly finishes after midnight IS credited to the new day', () => {
    const stored = localDateString(new Date(2026, 8, 28, 23, 50, 0).getTime());
    const now = new Date(2026, 8, 29, 0, 16, 0).getTime();
    const completedAt = new Date(2026, 8, 29, 0, 15, 0).getTime(); // after midnight
    const result = applyCountUpdate({ trackedDate: stored, count: 0 }, now, completedAt);
    assert.deepEqual(result, { trackedDate: localDateString(now), count: 1 });
  });

  test('backward clock change: never rolls backward, and a stale completion day does not credit', () => {
    const stored = localDateString(new Date(2026, 8, 28, 10, 0, 0).getTime());
    const now = new Date(2026, 8, 27, 10, 0, 0).getTime(); // clock/date moved back a day
    const result = applyCountUpdate({ trackedDate: stored, count: 4 }, now, null);
    assert.deepEqual(result, { trackedDate: stored, count: 4 }); // unchanged — no rollover, no credit
  });

  test('same tracked day, genuine completion: credits without rolling over', () => {
    const stored = localDateString(new Date(2026, 8, 28, 1, 0, 0).getTime());
    const now = new Date(2026, 8, 28, 23, 0, 0).getTime();
    const completedAt = new Date(2026, 8, 28, 22, 55, 0).getTime();
    const result = applyCountUpdate({ trackedDate: stored, count: 1 }, now, completedAt);
    assert.deepEqual(result, { trackedDate: stored, count: 2 });
  });

  test('AC-05: a null latch (Reset/break completion) never credits, on a same tracked day', () => {
    const stored = localDateString(new Date(2026, 8, 28, 1, 0, 0).getTime());
    const now = new Date(2026, 8, 28, 12, 0, 0).getTime();
    const result = applyCountUpdate({ trackedDate: stored, count: 3 }, now, null);
    assert.deepEqual(result, { trackedDate: stored, count: 3 }); // unchanged
  });
});

// session-tracking T7 (sad.md §11 risk, spec.md AC-06): the sleep-across-midnight
// case end-to-end — composes T1's engine latch with the SAME applyCountUpdate()
// src/ui/index.js's updateSessionCount() calls, without needing a DOM. Calling
// applyCountUpdate directly (rather than re-deriving its steps inline) means
// this test actually breaks if the real wiring's decision logic breaks.
describe('sleep-across-midnight, end-to-end (session-tracking T7, AC-06)', () => {
  test('a session that truly finished before midnight is not credited into the new day', () => {
    const engine = createTimerEngine();
    const start = new Date(2026, 8, 28, 23, 10, 0).getTime(); // starts 23:10, before midnight
    engine.start(start);
    const trueDeadline = start + FOCUS_MS; // 23:35 — still before midnight

    const readAt = new Date(2026, 8, 29, 0, 10, 0).getTime(); // detected 00:10 next day
    const snap = engine.getSnapshot(readAt);
    assert.equal(snap.justCompletedFocusAt, trueDeadline);

    const trackedDate = localDateString(start); // stored date is "yesterday"
    const result = applyCountUpdate({ trackedDate, count: 0 }, readAt, snap.justCompletedFocusAt);

    assert.equal(result.trackedDate, localDateString(readAt)); // rolled to the new day
    assert.equal(result.count, 0); // NOT credited — the true completion was on the old day
  });

  test('a session that truly finishes after midnight IS credited to the new day', () => {
    const engine = createTimerEngine();
    const start = new Date(2026, 8, 28, 23, 50, 0).getTime(); // starts 23:50
    engine.start(start);
    const trueDeadline = start + FOCUS_MS; // 00:15 next day — after midnight

    const readAt = trueDeadline + 60_000; // detected a minute later
    const snap = engine.getSnapshot(readAt);

    const trackedDate = localDateString(start);
    const result = applyCountUpdate({ trackedDate, count: 0 }, readAt, snap.justCompletedFocusAt);

    assert.equal(result.count, 1);
  });
});
