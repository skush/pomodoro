import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createTimerEngine, formatDuration, PHASES } from '../../src/logic/index.js';

const MIN = 60 * 1000;
const FOCUS = 25 * MIN;
const SHORT = 5 * MIN;
const LONG = 15 * MIN;

describe('createTimerEngine — initial state (AC-08)', () => {
  test('starts idle at Focus, full duration, zero in-cycle count', () => {
    const engine = createTimerEngine();
    const snap = engine.getSnapshot(0);
    assert.equal(snap.phase, PHASES.FOCUS);
    assert.equal(snap.running, false);
    assert.equal(snap.remainingMs, FOCUS);
    assert.equal(snap.focusCount, 0);
  });
});

describe('start (AC-01, AC-01b)', () => {
  test('begins counting down from full duration', () => {
    const engine = createTimerEngine();
    engine.start(0);
    const snap = engine.getSnapshot(1000);
    assert.equal(snap.running, true);
    assert.equal(snap.remainingMs, FOCUS - 1000);
  });

  test('pressing Start again while running is a no-op — no reset, no double count', () => {
    const engine = createTimerEngine();
    engine.start(0);
    engine.start(5000); // redundant press mid-phase
    const snap = engine.getSnapshot(5000);
    assert.equal(snap.running, true);
    assert.equal(snap.remainingMs, FOCUS - 5000);
  });
});

describe('pause/resume (AC-02b, AC-02c)', () => {
  test('pausing while not running is a no-op', () => {
    const engine = createTimerEngine();
    engine.pause(0);
    const snap = engine.getSnapshot(0);
    assert.equal(snap.running, false);
    assert.equal(snap.remainingMs, FOCUS);
  });

  test('resumes from exactly the frozen remaining time, never full duration', () => {
    const engine = createTimerEngine();
    engine.start(0);
    engine.pause(10_000); // paused 10s in
    const paused = engine.getSnapshot(60_000); // time keeps passing while paused
    assert.equal(paused.running, false);
    assert.equal(paused.remainingMs, FOCUS - 10_000);

    engine.start(60_000); // resume
    const resumed = engine.getSnapshot(61_000);
    assert.equal(resumed.running, true);
    assert.equal(resumed.remainingMs, FOCUS - 10_000 - 1000);
  });
});

describe('engine surface (AC-03)', () => {
  test('exposes exactly start/pause/reset/getSnapshot and is frozen', () => {
    const engine = createTimerEngine();
    assert.deepEqual(
      Object.keys(engine).sort(),
      ['getSnapshot', 'pause', 'reset', 'start'],
    );
    assert.equal(Object.isFrozen(engine), true);
  });
});

describe('classic cadence (AC-04, AC-07)', () => {
  test('short break follows each of the first 3 completed focus sessions', () => {
    const engine = createTimerEngine();
    let now = 0;
    for (let i = 0; i < 3; i += 1) {
      engine.start(now);
      now += FOCUS;
      const snap = engine.getSnapshot(now); // phase fully elapsed
      assert.equal(snap.phase, PHASES.SHORT_BREAK);
      assert.equal(snap.running, false); // never auto-starts (AC-07)
      assert.equal(snap.remainingMs, SHORT);

      engine.start(now); // run the break out so the next loop starts at Focus
      now += SHORT;
      engine.getSnapshot(now);
    }
  });

  test('the 4th completed focus session is followed by a long break, never short', () => {
    const engine = createTimerEngine();
    let now = 0;
    for (let i = 0; i < 3; i += 1) {
      engine.start(now);
      now += FOCUS;
      engine.getSnapshot(now); // settle into short break
      engine.start(now);
      now += SHORT;
      engine.getSnapshot(now); // settle back into focus
    }
    engine.start(now);
    now += FOCUS;
    const snap = engine.getSnapshot(now);
    assert.equal(snap.phase, PHASES.LONG_BREAK);
    assert.equal(snap.remainingMs, LONG);
    assert.equal(snap.focusCount, 0); // resets the instant the long break begins
  });

  test('any break is always followed by Focus', () => {
    const engine = createTimerEngine();
    engine.start(0);
    engine.getSnapshot(FOCUS); // -> short break
    engine.start(FOCUS);
    const snap = engine.getSnapshot(FOCUS + SHORT);
    assert.equal(snap.phase, PHASES.FOCUS);
    assert.equal(snap.remainingMs, FOCUS);
  });
});

describe('backgrounding reconciliation (AC-05)', () => {
  test('crosses at most one phase boundary, discarding any further overshoot', () => {
    const engine = createTimerEngine();
    engine.start(0);
    // Machine "sleeps" for way longer than the phase duration.
    const snap = engine.getSnapshot(FOCUS + 10 * FOCUS);
    assert.equal(snap.phase, PHASES.SHORT_BREAK);
    assert.equal(snap.running, false);
    assert.equal(snap.remainingMs, SHORT); // full duration, not partially consumed
  });

  test('reflects correct remaining time when the phase has not yet elapsed', () => {
    const engine = createTimerEngine();
    engine.start(0);
    const snap = engine.getSnapshot(FOCUS - 5000);
    assert.equal(snap.phase, PHASES.FOCUS);
    assert.equal(snap.running, true);
    assert.equal(snap.remainingMs, 5000);
  });
});

describe('reset (AC-06)', () => {
  test('returns the current phase to full duration and stops it, from any state', () => {
    const running = createTimerEngine();
    running.start(0);
    running.reset(12_345);
    const runningSnap = running.getSnapshot(12_345);
    assert.equal(runningSnap.running, false);
    assert.equal(runningSnap.remainingMs, FOCUS);

    const paused = createTimerEngine();
    paused.start(0);
    paused.pause(9000);
    paused.reset(9000);
    assert.equal(paused.getSnapshot(9000).remainingMs, FOCUS);

    const idle = createTimerEngine();
    idle.reset(0);
    assert.equal(idle.getSnapshot(0).remainingMs, FOCUS);
  });

  test('leaves phase, cycle position and in-cycle focus count unchanged', () => {
    const engine = createTimerEngine();
    engine.start(0);
    engine.getSnapshot(FOCUS); // completes 1st focus session -> short break, focusCount 1
    engine.reset(FOCUS);
    const snap = engine.getSnapshot(FOCUS);
    assert.equal(snap.phase, PHASES.SHORT_BREAK);
    assert.equal(snap.focusCount, 1);
    assert.equal(snap.remainingMs, SHORT);
  });
});

describe('formatDuration — display rounding (NFR)', () => {
  test('shows full duration immediately, never one second less', () => {
    assert.equal(formatDuration(FOCUS), '25:00');
  });

  test('rounds up to the next whole second (ceiling)', () => {
    assert.equal(formatDuration(1), '0:01');
    assert.equal(formatDuration(1000), '0:01');
    assert.equal(formatDuration(1001), '0:02');
  });

  test('never shows negative time', () => {
    assert.equal(formatDuration(-500), '0:00');
  });
});
