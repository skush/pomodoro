import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { localDateString, shouldRollover } from '../../src/logic/index.js';

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
