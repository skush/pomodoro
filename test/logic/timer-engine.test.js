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
      ['getSnapshot', 'pause', 'reset', 'setConfiguredDurations', 'setCycleLength', 'start'],
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

// session-tracking T1 (ADR-0001, AC-04/AC-06): getSnapshot() must report the exact
// wall-clock moment a Focus phase's deadline passed, latched inside settle() itself
// so the signal survives regardless of which public method triggers the transition.
describe('justCompletedFocusAt (session-tracking T1, ADR-0001)', () => {
  test('is null when no completion has occurred', () => {
    const engine = createTimerEngine();
    const snap = engine.getSnapshot(0);
    assert.equal(snap.justCompletedFocusAt, null);
  });

  test('reports the true deadline when a Focus phase completes during a getSnapshot poll', () => {
    const engine = createTimerEngine();
    engine.start(0);
    const snap = engine.getSnapshot(FOCUS + 5000); // polled 5s after the true deadline
    assert.equal(snap.justCompletedFocusAt, FOCUS); // the true deadline, not the poll time
  });

  test('is consumed exactly once — null on the next call', () => {
    const engine = createTimerEngine();
    engine.start(0);
    engine.getSnapshot(FOCUS + 1);
    const second = engine.getSnapshot(FOCUS + 2);
    assert.equal(second.justCompletedFocusAt, null);
  });

  test('is latched when the completing settle() runs inside start(), not only getSnapshot()', () => {
    const engine = createTimerEngine();
    engine.start(0);
    // Focus phase's deadline passes; the User clicks Start again before any getSnapshot poll.
    engine.start(FOCUS + 3000);
    const snap = engine.getSnapshot(FOCUS + 4000);
    assert.equal(snap.justCompletedFocusAt, FOCUS);
  });

  test('is latched when the completing settle() runs inside pause()', () => {
    const engine = createTimerEngine();
    engine.start(0);
    engine.pause(FOCUS + 3000);
    const snap = engine.getSnapshot(FOCUS + 4000);
    assert.equal(snap.justCompletedFocusAt, FOCUS);
  });

  test('is latched when the completing settle() runs inside reset()', () => {
    const engine = createTimerEngine();
    engine.start(0);
    engine.reset(FOCUS + 3000);
    const snap = engine.getSnapshot(FOCUS + 4000);
    assert.equal(snap.justCompletedFocusAt, FOCUS);
  });

  // review fix (CHANGES REQUESTED, AC-05): resetting BEFORE the deadline passes
  // must give no credit — distinct from the existing 'is latched ... inside
  // reset()' case above, which resets AFTER the deadline already passed.
  test('resetting before the deadline passes leaves the latch null — no credit (AC-05)', () => {
    const engine = createTimerEngine();
    engine.start(0);
    engine.reset(FOCUS - 1000); // reset while still mid-Focus, deadline not yet passed
    const snap = engine.getSnapshot(FOCUS + 1);
    assert.equal(snap.justCompletedFocusAt, null);
  });

  test('stays null across a Short/Long break completion (only Focus completions latch)', () => {
    const engine = createTimerEngine();
    engine.start(0);
    engine.getSnapshot(FOCUS + 1); // Focus completes -> Short break; latch set then consumed
    engine.start(FOCUS + 1);
    const afterBreak = engine.getSnapshot(FOCUS + 1 + SHORT + 1); // Short break completes
    assert.equal(afterBreak.justCompletedFocusAt, null);
  });
});

// adjustable-durations T1 (spec.md AC-03/AC-04/AC-04b/AC-05/AC-07): durations are
// configurable in whole minutes; a started (running or paused) phase keeps the full
// duration pinned at its own start, and only an idle phase follows the live config.
describe('setConfiguredDurations (adjustable-durations T1)', () => {
  test('AC-03: an idle phase shows the new duration immediately', () => {
    const engine = createTimerEngine();
    engine.setConfiguredDurations({ focus: 50, shortBreak: 5, longBreak: 15 });
    const snap = engine.getSnapshot(0);
    assert.equal(snap.running, false);
    assert.equal(snap.remainingMs, 50 * MIN);
  });

  test('AC-04: a running phase keeps its remaining time and deadline byte-for-byte', () => {
    const engine = createTimerEngine();
    engine.start(0);
    const before = engine.getSnapshot(60 * 1000).remainingMs;
    engine.setConfiguredDurations({ focus: 50, shortBreak: 5, longBreak: 15 });
    assert.equal(engine.getSnapshot(60 * 1000).remainingMs, before);
    assert.equal(engine.getSnapshot(120 * 1000).remainingMs, FOCUS - 120 * 1000);
  });

  test('AC-04: lowering the duration below the elapsed time does not complete the running phase', () => {
    const engine = createTimerEngine();
    engine.start(0);
    engine.setConfiguredDurations({ focus: 1, shortBreak: 5, longBreak: 15 });
    const snap = engine.getSnapshot(10 * MIN);
    assert.equal(snap.phase, PHASES.FOCUS);
    assert.equal(snap.running, true);
    assert.equal(snap.remainingMs, FOCUS - 10 * MIN);
  });

  test('AC-04: a running phase never displays more than the duration it started with', () => {
    const engine = createTimerEngine();
    engine.start(1000);
    engine.setConfiguredDurations({ focus: 50, shortBreak: 5, longBreak: 15 });
    // backward clock jump: still clamped to the pinned 25 min, not the new 50
    assert.equal(engine.getSnapshot(0).remainingMs, FOCUS);
  });

  test('AC-05: a paused phase with partially elapsed time keeps its frozen remainingMs', () => {
    const engine = createTimerEngine();
    engine.start(0);
    engine.pause(7 * MIN);
    const frozen = engine.getSnapshot(7 * MIN).remainingMs;
    assert.equal(frozen, FOCUS - 7 * MIN);
    engine.setConfiguredDurations({ focus: 90, shortBreak: 5, longBreak: 15 });
    assert.equal(engine.getSnapshot(8 * MIN).remainingMs, frozen);
    engine.start(9 * MIN);
    assert.equal(engine.getSnapshot(9 * MIN + 1000).remainingMs, frozen - 1000);
  });

  test('AC-05: a phase paused at the same instant it started is still paused, not idle', () => {
    const engine = createTimerEngine();
    engine.start(0);
    engine.pause(0);
    engine.setConfiguredDurations({ focus: 90, shortBreak: 5, longBreak: 15 });
    assert.equal(engine.getSnapshot(0).remainingMs, FOCUS);
  });

  test('AC-04b: Reset after a running/paused change shows the current configured duration', () => {
    const engine = createTimerEngine();
    engine.start(0);
    engine.setConfiguredDurations({ focus: 50, shortBreak: 5, longBreak: 15 });
    engine.reset(MIN);
    const snap = engine.getSnapshot(MIN);
    assert.equal(snap.running, false);
    assert.equal(snap.remainingMs, 50 * MIN);
  });

  test('a commit for a phase type that is not current applies at its next fresh start', () => {
    const engine = createTimerEngine();
    engine.setConfiguredDurations({ focus: 25, shortBreak: 10, longBreak: 15 });
    assert.equal(engine.getSnapshot(0).remainingMs, FOCUS);
    engine.start(0);
    assert.equal(engine.getSnapshot(FOCUS).phase, PHASES.SHORT_BREAK);
    assert.equal(engine.getSnapshot(FOCUS).remainingMs, 10 * MIN);
  });

  test('a new phase after completion starts at its configured duration and runs for exactly that long', () => {
    const engine = createTimerEngine();
    engine.setConfiguredDurations({ focus: 1, shortBreak: 2, longBreak: 3 });
    engine.start(0);
    assert.equal(engine.getSnapshot(MIN).phase, PHASES.SHORT_BREAK);
    engine.start(MIN);
    assert.equal(engine.getSnapshot(MIN + 2 * MIN - 1).phase, PHASES.SHORT_BREAK);
    assert.equal(engine.getSnapshot(MIN + 2 * MIN).phase, PHASES.FOCUS);
  });

  test('AC-07: a commit leaves the in-cycle focus count untouched', () => {
    const engine = createTimerEngine();
    engine.start(0);
    engine.getSnapshot(FOCUS); // completes one Focus
    const before = engine.getSnapshot(FOCUS).focusCount;
    engine.setConfiguredDurations({ focus: 50, shortBreak: 1, longBreak: 2 });
    assert.equal(before, 1);
    assert.equal(engine.getSnapshot(FOCUS).focusCount, 1);
  });

  test('invalid values are ignored fail-soft, keeping the current configuration', () => {
    const engine = createTimerEngine();
    assert.doesNotThrow(() =>
      engine.setConfiguredDurations({ focus: 0, shortBreak: 'abc', longBreak: -3 }),
    );
    assert.doesNotThrow(() => engine.setConfiguredDurations(undefined));
    assert.equal(engine.getSnapshot(0).remainingMs, FOCUS);
  });
});

// adjustable-durations T2 (spec.md AC-07/AC-10/AC-13): the cycle length is read at
// Focus-completion time, against the in-cycle focus count including that completion.
describe('setCycleLength (adjustable-durations T2)', () => {
  // Runs one full Focus phase to completion starting at `t`; returns the snapshot
  // taken right after it (the phase that follows) and the completion instant.
  function completeFocus(engine, t) {
    engine.start(t);
    const end = t + FOCUS;
    return { snap: engine.getSnapshot(end), end };
  }
  test('AC-10: with no call, a Long break follows the 4th Focus (classic behaviour)', () => {
    const engine = createTimerEngine();
    let t = 0;
    let snap;
    for (let i = 0; i < 4; i += 1) {
      ({ snap } = completeFocus(engine, t));
      t += FOCUS;
      if (i < 3) {
        assert.equal(snap.phase, PHASES.SHORT_BREAK);
        engine.start(t); // run the Short break through to reach the next Focus
        t += SHORT;
        engine.getSnapshot(t);
      }
    }
    assert.equal(snap.phase, PHASES.LONG_BREAK);
  });

  test('AC-13: committing alone changes nothing — phase, running state, counts', () => {
    const engine = createTimerEngine();
    engine.start(0);
    engine.getSnapshot(FOCUS); // 1 Focus done, now an idle Short break
    const before = engine.getSnapshot(FOCUS);
    engine.setCycleLength(2);
    const after = engine.getSnapshot(FOCUS);
    assert.equal(after.phase, before.phase);
    assert.equal(after.running, before.running);
    assert.equal(after.remainingMs, before.remainingMs);
    assert.equal(after.focusCount, before.focusCount);
    assert.equal(after.phase, PHASES.SHORT_BREAK);
  });

  test('AC-10: a shorter cycle length yields a Long break at the new length', () => {
    const engine = createTimerEngine();
    engine.setCycleLength(2);
    let { snap } = completeFocus(engine, 0);
    assert.equal(snap.phase, PHASES.SHORT_BREAK);
    engine.start(FOCUS);
    engine.getSnapshot(FOCUS + SHORT); // back to Focus
    ({ snap } = completeFocus(engine, FOCUS + SHORT));
    assert.equal(snap.phase, PHASES.LONG_BREAK);
    assert.equal(snap.focusCount, 0);
  });

  test('AC-13: lowering to below the in-cycle count — next completion is a Long break (passed)', () => {
    const engine = createTimerEngine();
    let t = 0;
    for (let i = 0; i < 3; i += 1) {
      completeFocus(engine, t);
      t += FOCUS;
      engine.start(t);
      t += SHORT;
      engine.getSnapshot(t);
    }
    assert.equal(engine.getSnapshot(t).focusCount, 3);
    engine.setCycleLength(2); // in-cycle count 3 already passed 2
    assert.equal(engine.getSnapshot(t).focusCount, 3); // untouched (AC-07)
    assert.equal(engine.getSnapshot(t).phase, PHASES.FOCUS); // no retroactive Long break
    const { snap } = completeFocus(engine, t);
    assert.equal(snap.phase, PHASES.LONG_BREAK);
    assert.equal(snap.focusCount, 0);
  });

  test('AC-13: lowering to exactly the count after one more completion — reached', () => {
    const engine = createTimerEngine();
    let t = 0;
    completeFocus(engine, t);
    t += FOCUS;
    engine.start(t);
    t += SHORT;
    engine.getSnapshot(t); // focusCount 1, Focus idle
    engine.setCycleLength(2);
    const { snap } = completeFocus(engine, t);
    assert.equal(snap.phase, PHASES.LONG_BREAK);
  });

  test('AC-13: raising mid-cycle — Short break until the new length is reached', () => {
    const engine = createTimerEngine();
    let t = 0;
    for (let i = 0; i < 3; i += 1) {
      completeFocus(engine, t);
      t += FOCUS;
      engine.start(t);
      t += SHORT;
      engine.getSnapshot(t);
    }
    engine.setCycleLength(6);
    const { snap } = completeFocus(engine, t); // 4th Focus — classic would be Long
    assert.equal(snap.phase, PHASES.SHORT_BREAK);
    assert.equal(snap.focusCount, 4);
  });

  test('AC-07: setCycleLength never changes focusCount', () => {
    const engine = createTimerEngine();
    engine.start(0);
    engine.getSnapshot(FOCUS);
    engine.setCycleLength(8);
    assert.equal(engine.getSnapshot(FOCUS).focusCount, 1);
    engine.setCycleLength(2);
    assert.equal(engine.getSnapshot(FOCUS).focusCount, 1);
  });

  test('invalid cycle length is ignored fail-soft', () => {
    const engine = createTimerEngine();
    assert.doesNotThrow(() => engine.setCycleLength(0));
    assert.doesNotThrow(() => engine.setCycleLength('abc'));
    assert.doesNotThrow(() => engine.setCycleLength(undefined));
    let t = 0;
    let snap;
    for (let i = 0; i < 4; i += 1) {
      ({ snap } = completeFocus(engine, t));
      t += FOCUS;
      if (i < 3) {
        engine.start(t);
        t += SHORT;
        engine.getSnapshot(t);
      }
    }
    assert.equal(snap.phase, PHASES.LONG_BREAK);
  });
});
