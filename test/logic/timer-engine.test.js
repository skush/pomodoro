import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createTimerEngine, formatDuration, controlStates, PHASES } from '../../src/logic/index.js';

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

  // AC-03 requires "a built, testable behavior, not merely an assumption about
  // browser isolation" that input other than this page's own controls is
  // ignored. ADR-0002 chose structural encapsulation over a runtime token:
  // there is provably no channel (no `message` listener, no global mutator)
  // through which such input could ever reach the engine in the first place.
  // This is a source-level test of that structural guarantee, not a DOM test —
  // the repo has no DOM/jsdom test environment configured, and the guard is a
  // static property of the code, not a runtime race to reproduce.
  test('no src/ file registers a window/global message listener or exposes any other input channel', () => {
    const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src');
    const forbidden = [/addEventListener\(\s*['"]message['"]/, /\bonmessage\b/, /\bpostMessage\(/, /BroadcastChannel/];

    function scan(dir) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(full);
        } else if (entry.name.endsWith('.js')) {
          const contents = readFileSync(full, 'utf8');
          for (const pattern of forbidden) {
            assert.equal(
              pattern.test(contents),
              false,
              `${full} matches forbidden pattern ${pattern} — this would be an input channel AC-03/ADR-0002 forbid`,
            );
          }
        }
      }
    }

    scan(srcDir);
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

describe('drift-free countdown (spec §6 NFR, ADR core-timer/0001)', () => {
  test('remaining time is exact after repeated irregular polling, with no accumulated error', () => {
    const engine = createTimerEngine();
    engine.start(0);
    // Poll at jittery, non-uniform intervals (simulating rAF/setInterval jitter)
    // rather than a fixed tick — an accumulator-based clock would drift here;
    // a wall-clock deadline cannot, by construction.
    for (const t of [37, 241, 242, 990, 991, 4001, 15_000, 15_000, 60_007]) {
      const snap = engine.getSnapshot(t);
      assert.equal(snap.remainingMs, FOCUS - t);
    }
  });

  test('a long backgrounding gap that does not cross the phase boundary still yields exact remaining time', () => {
    const engine = createTimerEngine();
    engine.start(0);
    const backgroundedFor = FOCUS - 1000; // tab frozen for ~24 minutes, still mid-phase
    const snap = engine.getSnapshot(backgroundedFor);
    assert.equal(snap.phase, PHASES.FOCUS);
    assert.equal(snap.remainingMs, 1000); // exact, not approximated from elapsed ticks
  });
});

describe('controlStates (AC-02)', () => {
  test('Pause is disabled and Start enabled while idle', () => {
    const engine = createTimerEngine();
    const { startDisabled, pauseDisabled } = controlStates(engine.getSnapshot(0));
    assert.equal(startDisabled, false);
    assert.equal(pauseDisabled, true);
  });

  test('Pause is enabled and Start disabled while running', () => {
    const engine = createTimerEngine();
    engine.start(0);
    const { startDisabled, pauseDisabled } = controlStates(engine.getSnapshot(1000));
    assert.equal(startDisabled, true);
    assert.equal(pauseDisabled, false);
  });

  test('Pause is disabled again once paused', () => {
    const engine = createTimerEngine();
    engine.start(0);
    engine.pause(1000);
    const { startDisabled, pauseDisabled } = controlStates(engine.getSnapshot(1000));
    assert.equal(startDisabled, false);
    assert.equal(pauseDisabled, true);
  });

  test('Pause is disabled again once a phase completes and the next one is idle', () => {
    const engine = createTimerEngine();
    engine.start(0);
    const { pauseDisabled } = controlStates(engine.getSnapshot(FOCUS));
    assert.equal(pauseDisabled, true);
  });
});

describe('backward clock jump (stage-2 hardening, spec §6 NFR drift)', () => {
  test('remaining time never exceeds the phase full duration if now moves backward', () => {
    const engine = createTimerEngine();
    engine.start(10_000); // started "at" t=10s
    // A backward wall-clock jump makes `now` earlier than the start time.
    const snap = engine.getSnapshot(0);
    assert.equal(snap.remainingMs, FOCUS);
  });

  test('pause() also clamps the frozen remaining time to the full duration', () => {
    const engine = createTimerEngine();
    engine.start(10_000);
    engine.pause(0);
    assert.equal(engine.getSnapshot(0).remainingMs, FOCUS);
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

  test('leaves phase, cycle position and in-cycle focus count unchanged when idle', () => {
    const engine = createTimerEngine();
    engine.start(0);
    engine.getSnapshot(FOCUS); // completes 1st focus session -> short break, focusCount 1
    engine.reset(FOCUS);
    const snap = engine.getSnapshot(FOCUS);
    assert.equal(snap.phase, PHASES.SHORT_BREAK);
    assert.equal(snap.focusCount, 1);
    assert.equal(snap.remainingMs, SHORT);
  });

  test('leaves phase and focus count unchanged when reset while running', () => {
    const engine = createTimerEngine();
    engine.start(0);
    engine.getSnapshot(FOCUS); // completes 1st focus session -> short break, focusCount 1
    engine.start(FOCUS); // start the short break running
    engine.reset(FOCUS + 1000); // reset partway through it
    const snap = engine.getSnapshot(FOCUS + 1000);
    assert.equal(snap.phase, PHASES.SHORT_BREAK);
    assert.equal(snap.focusCount, 1);
    assert.equal(snap.running, false);
    assert.equal(snap.remainingMs, SHORT);
  });

  test('leaves phase and focus count unchanged when reset while paused', () => {
    const engine = createTimerEngine();
    engine.start(0);
    engine.getSnapshot(FOCUS); // completes 1st focus session -> short break, focusCount 1
    engine.start(FOCUS);
    engine.pause(FOCUS + 1000); // paused partway through the short break
    engine.reset(FOCUS + 2000);
    const snap = engine.getSnapshot(FOCUS + 2000);
    assert.equal(snap.phase, PHASES.SHORT_BREAK);
    assert.equal(snap.focusCount, 1);
    assert.equal(snap.running, false);
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
