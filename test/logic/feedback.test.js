import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTimerEngine,
  formatDuration,
  PHASES,
  TONES,
  toneFor,
  ringFraction,
  tabTitle,
} from '../../src/logic/index.js';

const MIN = 60 * 1000;

const endOf = (tone) => Math.max(...tone.map((n) => n.start + n.duration));
const peak = (tone) => Math.max(...tone.map((n) => n.peakGain));
const freqs = (tone) => tone.map((n) => n.frequency);
const isRising = (f) => f.every((x, i) => i === 0 || x > f[i - 1]);
const isFalling = (f) => f.every((x, i) => i === 0 || x < f[i - 1]);

describe('TONES / toneFor (AC-05, §6 chime length + loudness)', () => {
  for (const name of ['focusEnd', 'breakEnd']) {
    test(`${name}: every note is well-formed, the tone lasts <= 2 s and peaks <= 0.3`, () => {
      const tone = TONES[name];
      assert.ok(tone.length >= 1);
      for (const n of tone) {
        assert.ok(n.frequency > 0 && n.duration > 0 && n.start >= 0 && n.peakGain > 0);
      }
      assert.ok(endOf(tone) <= 2, `${name} lasts ${endOf(tone)} s`);
      assert.ok(peak(tone) <= 0.3, `${name} peak gain ${peak(tone)}`);
    });
  }

  test('AC-05: the two tones are distinguishable by construction (opposite direction or different note count)', () => {
    const f = freqs(TONES.focusEnd);
    const b = freqs(TONES.breakEnd);
    const oppositeDirection = (isRising(f) && isFalling(b)) || (isFalling(f) && isRising(b));
    assert.ok(oppositeDirection || f.length !== b.length);
  });

  test('toneFor: Focus -> focusEnd, Short and Long break -> breakEnd', () => {
    assert.equal(toneFor(PHASES.FOCUS), TONES.focusEnd);
    assert.equal(toneFor(PHASES.SHORT_BREAK), TONES.breakEnd);
    assert.equal(toneFor(PHASES.LONG_BREAK), TONES.breakEnd);
  });

  test('the tone data is frozen', () => {
    assert.ok(Object.isFrozen(TONES) && Object.isFrozen(TONES.focusEnd));
  });
});

describe('ringFraction (AC-01, AC-08, §6 ring vs countdown agreement)', () => {
  const snap = (over) => ({ phase: PHASES.FOCUS, running: true, idle: false, remainingMs: 25 * MIN, phaseFullMs: 25 * MIN, ...over });

  test('full at the start, empty at zero', () => {
    assert.equal(ringFraction(snap({ remainingMs: 25 * MIN })), 1);
    assert.equal(ringFraction(snap({ remainingMs: 0 })), 0);
  });

  test('steps with the displayed second: two readings inside one displayed second give the same ring', () => {
    const a = ringFraction(snap({ remainingMs: 24 * MIN + 59 * 1000 + 400 }));
    const b = ringFraction(snap({ remainingMs: 24 * MIN + 59 * 1000 + 1 }));
    assert.equal(a, b); // both readings display 25:00
    assert.equal(formatDuration(24 * MIN + 59 * 1000 + 400), formatDuration(24 * MIN + 59 * 1000 + 1));
  });

  test('agrees with the countdown within 1 s over sampled snapshots', () => {
    const engine = createTimerEngine();
    engine.start(0);
    for (const t of [0, 1, 999, 1000, 1001, 59_999, 60_000, 12 * MIN + 345, 24 * MIN + 59_500, 25 * MIN - 1]) {
      const s = engine.getSnapshot(t);
      const shownSeconds = Math.ceil(s.remainingMs / 1000);
      const fractionSeconds = ringFraction(s) * (s.phaseFullMs / 1000);
      assert.ok(Math.abs(fractionSeconds - shownSeconds) < 1e-9, `t=${t}`);
    }
  });

  test('AC-08: measured against the pinned phase length after a mid-phase duration commit', () => {
    const engine = createTimerEngine();
    engine.start(0);
    engine.setConfiguredDurations({ focus: 10, shortBreak: 5, longBreak: 15 });
    const s = engine.getSnapshot(5 * MIN);
    assert.equal(ringFraction(s), 20 / 25); // 20 of 25 minutes left, not 20 of 10
  });

  test('AC-09: an idle phase after a committed duration reads full', () => {
    const engine = createTimerEngine();
    engine.setConfiguredDurations({ focus: 40, shortBreak: 5, longBreak: 15 });
    assert.equal(ringFraction(engine.getSnapshot(0)), 1);
  });

  test('clamps out-of-range and bad input, never throws', () => {
    assert.equal(ringFraction(snap({ remainingMs: 99 * MIN })), 1);
    assert.equal(ringFraction(snap({ remainingMs: -5 })), 0);
    assert.equal(ringFraction(snap({ remainingMs: NaN })), 1);
    assert.equal(ringFraction(snap({ phaseFullMs: 0 })), 1);
    assert.equal(ringFraction(null), 1);
  });
});

describe('tabTitle (AC-04, AC-09)', () => {
  const snap = (over) => ({ phase: PHASES.FOCUS, running: true, idle: false, remainingMs: 25 * MIN, phaseFullMs: 25 * MIN, ...over });

  test('running: whole minutes rounded up plus the phase name', () => {
    assert.equal(tabTitle(snap({ remainingMs: 24 * MIN + 1 })), '25 min · Focus');
    assert.equal(tabTitle(snap({ remainingMs: 24 * MIN })), '24 min · Focus');
    assert.equal(tabTitle(snap({ phase: PHASES.SHORT_BREAK, remainingMs: 3 * MIN })), '3 min · Short break');
    assert.equal(tabTitle(snap({ phase: PHASES.LONG_BREAK, remainingMs: 10 * MIN })), '10 min · Long break');
  });

  test('never shows zero minutes while time is left', () => {
    assert.equal(tabTitle(snap({ remainingMs: 1 })), '1 min · Focus');
    assert.equal(tabTitle(snap({ remainingMs: 59_999 })), '1 min · Focus');
  });

  test('paused is marked paused with the frozen minutes', () => {
    assert.equal(tabTitle(snap({ running: false, remainingMs: 7 * MIN + 5000 })), 'Paused · 8 min · Focus');
  });

  test('waiting for Start is marked ready with the minutes the phase will run for', () => {
    assert.equal(tabTitle(snap({ running: false, idle: true, remainingMs: 5 * MIN, phase: PHASES.SHORT_BREAK })), 'Ready · 5 min · Short break');
  });

  test('AC-09: an idle phase shows the newly committed duration at once', () => {
    const engine = createTimerEngine();
    engine.setConfiguredDurations({ focus: 40, shortBreak: 5, longBreak: 15 });
    assert.equal(tabTitle(engine.getSnapshot(0)), 'Ready · 40 min · Focus');
  });

  test('the three states are pairwise distinct for the same minutes and phase', () => {
    const titles = new Set([
      tabTitle(snap({})),
      tabTitle(snap({ running: false })),
      tabTitle(snap({ running: false, idle: true })),
    ]);
    assert.equal(titles.size, 3);
  });

  test('an unknown phase or null snapshot does not throw', () => {
    assert.equal(typeof tabTitle(snap({ phase: 'nope' })), 'string');
    assert.equal(typeof tabTitle(null), 'string');
  });
});
