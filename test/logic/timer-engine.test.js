import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as logic from '../../src/logic/index.js';
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
    engine.setAllowPausingFocus(true); // break-flow AC-16: Focus may be paused
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
  // break-flow ADR-0002 deliberately amends this pin from six methods to eight: startFocus
  // and setAllowPausingFocus join the engine so the Skip guard and the focus-pause policy
  // live where no input path can bypass them.
  test('exposes exactly the eight engine methods and is frozen', () => {
    const engine = createTimerEngine();
    assert.deepEqual(
      Object.keys(engine).sort(),
      ['getSnapshot', 'pause', 'reset', 'setAllowPausingFocus', 'setConfiguredDurations', 'setCycleLength', 'start', 'startFocus'],
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
  // sensory-feedback (ADR-0001 "Amends core-timer ADR-0002"): the scan is reworked, not
  // deleted. postMessage( / onmessage are permitted in src/ui/wakeup.js ONLY (the private
  // page<->worker channel); window/global message listeners, storage listeners and
  // BroadcastChannel stay forbidden in every file, wakeup.js included.
  const WAKEUP_FILE = 'src/ui/wakeup.js';
  const forbiddenEverywhere = [
    /addEventListener\(\s*['"]message['"]/,
    /BroadcastChannel/,
    // review fix #2 (adjustable-durations AC-08): a same-origin tab's localStorage write
    // reaches other tabs only as a 'storage' event — forbidding that listener is what
    // makes "a foreign write never triggers app logic" a structural guarantee.
    /addEventListener\(\s*['"]storage['"]/,
    /\bonstorage\b/,
  ];
  const forbiddenOutsideWakeup = [/\bonmessage\b/, /\bpostMessage\(/];

  // Returns the forbidden patterns a source file matches. `relPath` is repo-relative,
  // forward-slashed (e.g. 'src/ui/index.js').
  function violations(relPath, contents) {
    const patterns = relPath === WAKEUP_FILE ? forbiddenEverywhere : [...forbiddenEverywhere, ...forbiddenOutsideWakeup];
    return patterns.filter((pattern) => pattern.test(contents)).map(String);
  }

  test('no src/ file registers a window/global message listener or exposes any other input channel', () => {
    const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

    function scan(dir) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(full);
        } else if (entry.name.endsWith('.js')) {
          const rel = path.relative(repoRoot, full).split(path.sep).join('/');
          assert.deepEqual(
            violations(rel, readFileSync(full, 'utf8')),
            [],
            `${rel} matches a forbidden pattern — this would be an input channel AC-03/ADR-0002 forbid`,
          );
        }
      }
    }

    scan(path.join(repoRoot, 'src'));
  });

  test('the reworked scan: postMessage/onmessage only in src/ui/wakeup.js, everything else forbidden everywhere', () => {
    assert.deepEqual(violations('src/ui/wakeup.js', 'worker.onmessage = f; self.postMessage(1);'), []);
    assert.equal(violations('src/ui/index.js', 'worker.postMessage(1)').length, 1);
    assert.equal(violations('src/ui/other.js', 'x.onmessage = f').length, 1);
    assert.equal(violations('src/ui/wakeup.js', "window.addEventListener('message', f)").length, 1);
    assert.equal(violations('src/ui/wakeup.js', 'new BroadcastChannel("x")').length, 1);
    assert.equal(violations('src/ui/wakeup.js', "addEventListener('storage', f)").length, 1);
    assert.equal(violations('src/logic/index.js', "addEventListener('message', f)").length, 1);
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

// break-flow T6 (ADR-0003): controlStates(snapshot) -> {startDisabled, pauseDisabled} is replaced
// by controlLayout and its Start/Pause enablement tests by the AC-10 table test in
// break-flow.test.js; the old export must be gone so nothing can still depend on it.
describe('controlStates (retired by break-flow)', () => {
  test('is no longer exported by the logic module', () => {
    assert.equal(logic.controlStates, undefined);
    assert.equal(typeof logic.controlLayout, 'function');
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
    engine.setAllowPausingFocus(true); // break-flow AC-16: Focus may be paused
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

// review fix #3 (adjustable-durations AC-06/AC-08): the snapshot exposes whether the
// current phase is idle (fresh — never started since it began or was reset), so the
// UI can tell a fresh Start from a Resume without a second engine query.
describe('snapshot.idle (adjustable-durations review fix)', () => {
  test('idle at creation, not idle while running or paused, idle again after Reset and after completion', () => {
    const engine = createTimerEngine();
    assert.equal(engine.getSnapshot(0).idle, true);
    engine.start(0);
    assert.equal(engine.getSnapshot(1000).idle, false);
    engine.pause(0);
    assert.equal(engine.getSnapshot(0).idle, false); // paused at the instant it started
    engine.reset(0);
    assert.equal(engine.getSnapshot(0).idle, true);
    engine.start(0);
    assert.equal(engine.getSnapshot(FOCUS).idle, true); // completed → next phase idle
  });
});

// review fix #4 (adjustable-durations AC-06, NFR bounds): the engine itself enforces
// whole minutes 1–180 and a cycle length 2–8, ignoring anything else fail-soft.
describe('engine setter bounds (adjustable-durations review fix)', () => {
  test('durations outside whole 1–180 are ignored; the boundaries are accepted', () => {
    const engine = createTimerEngine();
    for (const bad of [0.001, 0.5, 12.5, 181, 1000, -1, NaN, Infinity]) {
      engine.setConfiguredDurations({ focus: bad, shortBreak: 5, longBreak: 15 });
      assert.equal(engine.getSnapshot(0).remainingMs, FOCUS, String(bad));
    }
    engine.setConfiguredDurations({ focus: 180, shortBreak: 5, longBreak: 15 });
    assert.equal(engine.getSnapshot(0).remainingMs, 180 * MIN);
    engine.setConfiguredDurations({ focus: 1, shortBreak: 5, longBreak: 15 });
    assert.equal(engine.getSnapshot(0).remainingMs, MIN);
  });

  test('a cycle length outside whole 2–8 is ignored; 2 and 8 are accepted', () => {
    // Completes n Focus sessions (running each Short break through) and returns
    // the phase that follows the last one.
    function phaseAfterFocusSessions(engine, n) {
      let t = 0;
      let snap;
      for (let i = 0; i < n; i += 1) {
        engine.start(t);
        t += FOCUS;
        snap = engine.getSnapshot(t);
        if (i < n - 1) {
          engine.start(t);
          t += SHORT;
          engine.getSnapshot(t);
        }
      }
      return snap.phase;
    }
    for (const bad of [1, 9, 2.5, 1000]) {
      const engine = createTimerEngine();
      engine.setCycleLength(bad);
      assert.equal(phaseAfterFocusSessions(engine, 4), PHASES.LONG_BREAK, String(bad));
    }
    const two = createTimerEngine();
    two.setCycleLength(2);
    assert.equal(phaseAfterFocusSessions(two, 2), PHASES.LONG_BREAK);
    const eight = createTimerEngine();
    eight.setCycleLength(8);
    assert.equal(phaseAfterFocusSessions(eight, 7), PHASES.SHORT_BREAK);
    const eightB = createTimerEngine();
    eightB.setCycleLength(8);
    assert.equal(phaseAfterFocusSessions(eightB, 8), PHASES.LONG_BREAK);
  });
});

// sensory-feedback T2 (ADR-0002): getSnapshot() carries the phase's pinned full length
// (`phaseFullMs`) and a one-shot `justCompleted {phase, at}` for EVERY phase type.
describe('phaseFullMs and justCompleted (sensory-feedback ADR-0002)', () => {
  test('a fresh snapshot carries phaseFullMs and a null justCompleted', () => {
    const engine = createTimerEngine();
    const snap = engine.getSnapshot(0);
    assert.equal(snap.phaseFullMs, FOCUS);
    assert.equal(snap.justCompleted, null);
  });

  test('AC-05/AC-10: a Focus completion latches {focus, true deadline}, once', () => {
    const engine = createTimerEngine();
    engine.start(0);
    const snap = engine.getSnapshot(FOCUS + 3000); // read 3 s late
    assert.deepEqual(snap.justCompleted, { phase: PHASES.FOCUS, at: FOCUS });
    assert.equal(engine.getSnapshot(FOCUS + 4000).justCompleted, null);
    assert.equal(snap.justCompletedFocusAt, FOCUS); // session-tracking's field is unchanged
  });

  test('AC-05: a break completion latches the break phase type and leaves justCompletedFocusAt unset', () => {
    const engine = createTimerEngine();
    engine.start(0);
    engine.getSnapshot(FOCUS); // Focus completes, Short break loads idle
    engine.start(FOCUS + 1000);
    const snap = engine.getSnapshot(FOCUS + 1000 + SHORT + 500);
    assert.deepEqual(snap.justCompleted, { phase: PHASES.SHORT_BREAK, at: FOCUS + 1000 + SHORT });
    assert.equal(snap.justCompletedFocusAt, null);
    assert.equal(snap.phase, PHASES.FOCUS);
  });

  test('a Long break completion is latched with the long_break type', () => {
    const engine = createTimerEngine();
    let t = 0;
    for (let i = 0; i < 4; i += 1) {
      engine.start(t);
      t += FOCUS;
      engine.getSnapshot(t);
      if (i < 3) {
        engine.start(t);
        t += SHORT;
        engine.getSnapshot(t);
      }
    }
    assert.equal(engine.getSnapshot(t).phase, PHASES.LONG_BREAK);
    engine.start(t);
    const snap = engine.getSnapshot(t + LONG);
    assert.deepEqual(snap.justCompleted, { phase: PHASES.LONG_BREAK, at: t + LONG });
  });

  test('AC-06b: a completion detected inside a control call survives to the next getSnapshot', () => {
    const engine = createTimerEngine();
    engine.start(0);
    engine.pause(FOCUS + 100); // settle() inside pause detects the completion
    const snap = engine.getSnapshot(FOCUS + 200);
    assert.deepEqual(snap.justCompleted, { phase: PHASES.FOCUS, at: FOCUS });
    assert.equal(engine.getSnapshot(FOCUS + 300).justCompleted, null);
  });

  test('AC-06b: a late read after a long sleep still yields one completion at the true deadline', () => {
    const engine = createTimerEngine();
    engine.start(0);
    const snap = engine.getSnapshot(FOCUS + 3 * 60 * MIN);
    assert.deepEqual(snap.justCompleted, { phase: PHASES.FOCUS, at: FOCUS });
    assert.equal(snap.idle, true);
    assert.equal(snap.running, false);
  });

  test('never before the deadline: an early read leaves justCompleted null and the phase running', () => {
    const engine = createTimerEngine();
    engine.start(0);
    const snap = engine.getSnapshot(FOCUS - 1);
    assert.equal(snap.justCompleted, null);
    assert.equal(snap.running, true);
  });

  test('AC-07: Pause or Reset just before zero means the phase never completes', () => {
    const paused = createTimerEngine();
    paused.setAllowPausingFocus(true); // break-flow AC-16: Focus may be paused
    paused.start(0);
    paused.pause(FOCUS - 1);
    assert.equal(paused.getSnapshot(FOCUS + MIN).justCompleted, null);
    const reset = createTimerEngine();
    reset.start(0);
    reset.reset(FOCUS - 1);
    assert.equal(reset.getSnapshot(FOCUS + MIN).justCompleted, null);
  });

  test('AC-08: phaseFullMs stays pinned across a mid-phase commit and changes after Reset', () => {
    const engine = createTimerEngine();
    engine.start(0);
    engine.setConfiguredDurations({ focus: 10, shortBreak: 5, longBreak: 15 });
    assert.equal(engine.getSnapshot(1000).phaseFullMs, FOCUS);
    engine.pause(2000);
    assert.equal(engine.getSnapshot(3000).phaseFullMs, FOCUS);
    engine.reset(4000);
    assert.equal(engine.getSnapshot(5000).phaseFullMs, 10 * MIN);
  });

  test('AC-09: an idle phase follows a committed duration in phaseFullMs and remainingMs', () => {
    const engine = createTimerEngine();
    engine.setConfiguredDurations({ focus: 30, shortBreak: 5, longBreak: 15 });
    const snap = engine.getSnapshot(0);
    assert.equal(snap.phaseFullMs, 30 * MIN);
    assert.equal(snap.remainingMs, 30 * MIN);
  });

  test('the engine surface is the eight methods amended by break-flow ADR-0002', () => {
    assert.deepEqual(Object.keys(createTimerEngine()).sort(), [
      'getSnapshot', 'pause', 'reset', 'setAllowPausingFocus', 'setConfiguredDurations', 'setCycleLength', 'start', 'startFocus',
    ]);
  });
});

// break-flow T2 (ADR-0001, ADR-0002): startedAt, the backdated start, startFocus with the
// Skip guard, and the focus-pause policy. Injected clock throughout.
describe('break-flow engine (T2)', () => {
  // A started Focus phase; callers advance the clock past its deadline to land on the break.
  function engineAtBreak() {
    const engine = createTimerEngine();
    engine.start(0);
    return engine;
  }

  test('snapshot shape pin: startedAt and allowPausingFocus join the frozen snapshot', () => {
    const snap = createTimerEngine().getSnapshot(0);
    assert.deepEqual(Object.keys(snap).sort(), [
      'allowPausingFocus', 'focusCount', 'idle', 'justCompleted', 'justCompletedFocusAt',
      'phase', 'phaseFullMs', 'remainingMs', 'running', 'startedAt',
    ]);
    assert.equal(Object.isFrozen(snap), true);
    assert.equal(snap.startedAt, null);
    assert.equal(snap.allowPausingFocus, false);
  });

  test('start records startedAt on a fresh start only; pause and resume keep it', () => {
    const engine = createTimerEngine();
    engine.setAllowPausingFocus(true);
    engine.start(1000);
    assert.equal(engine.getSnapshot(1500).startedAt, 1000);
    engine.pause(2000);
    assert.equal(engine.getSnapshot(2500).startedAt, 1000);
    engine.start(9000); // resume — not a fresh start
    assert.equal(engine.getSnapshot(9500).startedAt, 1000);
  });

  test('reset and a completion clear startedAt (a waiting phase has no Skip guard)', () => {
    const engine = createTimerEngine();
    engine.setAllowPausingFocus(true);
    engine.start(0);
    engine.pause(1000);
    engine.reset(2000);
    assert.equal(engine.getSnapshot(2000).startedAt, null);
    engine.start(3000);
    const after = engine.getSnapshot(3000 + FOCUS);
    assert.equal(after.phase, PHASES.SHORT_BREAK);
    assert.equal(after.startedAt, null);
  });

  test('backdated start(at): remaining = full - (now - at) within 1 s, startedAt = at (ADR-0001)', () => {
    const engine = engineAtBreak();
    const at = FOCUS; // the Focus phase's true end
    const now = at + 4000; // noticed 4 s late
    const snap = engine.getSnapshot(now); // consumes the completion; the break waits
    assert.equal(snap.phase, PHASES.SHORT_BREAK);
    assert.equal(snap.idle, true);
    assert.equal(snap.running, false);
    assert.equal(snap.justCompleted.phase, PHASES.FOCUS);
    assert.equal(snap.justCompleted.at, at);
    engine.start(at);
    const running = engine.getSnapshot(now);
    assert.equal(running.running, true);
    assert.equal(running.startedAt, at);
    assert.ok(Math.abs(running.remainingMs - (SHORT - 4000)) <= 1000);
    assert.equal(running.justCompleted, null); // one completion record per completion
  });

  test('a late completion leaves the break waiting at full length (AC-03)', () => {
    const engine = engineAtBreak();
    const snap = engine.getSnapshot(FOCUS + 60 * MIN);
    assert.equal(snap.phase, PHASES.SHORT_BREAK);
    assert.equal(snap.running, false);
    assert.equal(snap.remainingMs, SHORT);
    assert.equal(snap.startedAt, null);
  });

  test('setAllowPausingFocus: default off, coerces to boolean, shows in the snapshot', () => {
    const engine = createTimerEngine();
    assert.equal(engine.getSnapshot(0).allowPausingFocus, false);
    engine.setAllowPausingFocus(true);
    assert.equal(engine.getSnapshot(0).allowPausingFocus, true);
    engine.setAllowPausingFocus(0);
    assert.equal(engine.getSnapshot(0).allowPausingFocus, false);
    assert.doesNotThrow(() => engine.setAllowPausingFocus(undefined));
  });

  test('pause of a running Focus is a no-op while the policy is off (AC-15)', () => {
    const engine = createTimerEngine();
    engine.start(0);
    engine.pause(10_000);
    const snap = engine.getSnapshot(20_000);
    assert.equal(snap.running, true);
    assert.equal(snap.remainingMs, FOCUS - 20_000);
  });

  test('pause and resume of Focus work when the policy is on (AC-16)', () => {
    const engine = createTimerEngine();
    engine.setAllowPausingFocus(true);
    engine.start(0);
    engine.pause(10_000);
    assert.equal(engine.getSnapshot(50_000).running, false);
    assert.equal(engine.getSnapshot(50_000).remainingMs, FOCUS - 10_000);
    engine.start(60_000);
    assert.equal(engine.getSnapshot(70_000).remainingMs, FOCUS - 20_000);
  });

  test('a Focus paused before the policy went off stays paused; resume and reset still work', () => {
    const engine = createTimerEngine();
    engine.setAllowPausingFocus(true);
    engine.start(0);
    engine.pause(10_000);
    engine.setAllowPausingFocus(false);
    assert.equal(engine.getSnapshot(11_000).running, false);
    engine.start(12_000);
    assert.equal(engine.getSnapshot(12_000).running, true);
    engine.reset(13_000);
    assert.equal(engine.getSnapshot(13_000).idle, true);
  });

  test('breaks always pause, whatever the policy', () => {
    const engine = engineAtBreak();
    engine.getSnapshot(FOCUS);
    engine.start(FOCUS);
    engine.pause(FOCUS + 10_000);
    assert.equal(engine.getSnapshot(FOCUS + 20_000).running, false);
  });

  test('startFocus ends a running break: Focus running, no chime record, focusCount unchanged (AC-04, AC-04b)', () => {
    const engine = engineAtBreak();
    engine.getSnapshot(FOCUS);
    engine.start(FOCUS);
    const t = FOCUS + 10_000;
    engine.startFocus(t);
    const snap = engine.getSnapshot(t);
    assert.equal(snap.phase, PHASES.FOCUS);
    assert.equal(snap.running, true);
    assert.equal(snap.remainingMs, FOCUS);
    assert.equal(snap.startedAt, t);
    assert.equal(snap.focusCount, 1);
    assert.equal(snap.justCompleted, null);
    assert.equal(snap.justCompletedFocusAt, null);
  });

  test('startFocus uses the current Configured focus duration (AC-04)', () => {
    const engine = engineAtBreak();
    engine.getSnapshot(FOCUS);
    engine.start(FOCUS);
    engine.setConfiguredDurations({ focus: 40, shortBreak: 5, longBreak: 15 });
    engine.startFocus(FOCUS + 5000);
    const snap = engine.getSnapshot(FOCUS + 5000);
    assert.equal(snap.phaseFullMs, 40 * MIN);
    assert.equal(snap.remainingMs, 40 * MIN);
  });

  test('startFocus: Skip guard edges — no-op at 2999 ms, allowed at 3000 ms (AC-05)', () => {
    const engine = engineAtBreak();
    engine.getSnapshot(FOCUS);
    engine.start(FOCUS);
    engine.startFocus(FOCUS + 2999);
    assert.equal(engine.getSnapshot(FOCUS + 2999).phase, PHASES.SHORT_BREAK);
    assert.equal(engine.getSnapshot(FOCUS + 2999).running, true);
    engine.startFocus(FOCUS + 3000);
    assert.equal(engine.getSnapshot(FOCUS + 3000).phase, PHASES.FOCUS);
  });

  test('startFocus: a break paused inside the guard stays guarded until 3 s of real time pass (AC-05)', () => {
    const engine = engineAtBreak();
    engine.getSnapshot(FOCUS);
    engine.start(FOCUS);
    engine.pause(FOCUS + 1000);
    engine.startFocus(FOCUS + 2000);
    assert.equal(engine.getSnapshot(FOCUS + 2000).phase, PHASES.SHORT_BREAK);
    engine.startFocus(FOCUS + 3000);
    assert.equal(engine.getSnapshot(FOCUS + 3000).phase, PHASES.FOCUS);
  });

  test('startFocus: Resume break starts no new guard (AC-05)', () => {
    const engine = engineAtBreak();
    engine.getSnapshot(FOCUS);
    engine.start(FOCUS);
    engine.pause(FOCUS + 1000);
    engine.start(FOCUS + 60_000); // resume well after the guard
    engine.startFocus(FOCUS + 60_001);
    assert.equal(engine.getSnapshot(FOCUS + 60_001).phase, PHASES.FOCUS);
  });

  test('startFocus on a waiting break is allowed at once — no guard (AC-04, AC-05)', () => {
    const engine = engineAtBreak();
    engine.getSnapshot(FOCUS + 1); // break waits, startedAt null
    engine.startFocus(FOCUS + 1);
    const snap = engine.getSnapshot(FOCUS + 1);
    assert.equal(snap.phase, PHASES.FOCUS);
    assert.equal(snap.running, true);
    assert.equal(snap.focusCount, 1);
  });

  test('startFocus pressed just after the break really ended starts that Focus (AC-04)', () => {
    const engine = engineAtBreak();
    engine.getSnapshot(FOCUS);
    engine.start(FOCUS);
    const press = FOCUS + 5 * MIN + 1; // 1 ms past the break deadline, before any render tick settled it
    engine.startFocus(press);
    const snap = engine.getSnapshot(press);
    assert.equal(snap.phase, PHASES.FOCUS);
    assert.equal(snap.running, true);
    assert.equal(snap.remainingMs, FOCUS);
    assert.equal(snap.startedAt, press);
  });

  test('startFocus is a no-op in any Focus state', () => {
    const engine = createTimerEngine();
    engine.startFocus(0); // waiting Focus
    assert.equal(engine.getSnapshot(0).running, false);
    engine.start(1000);
    engine.startFocus(50_000); // running Focus — must not restart it
    const snap = engine.getSnapshot(60_000);
    assert.equal(snap.startedAt, 1000);
    assert.equal(snap.remainingMs, FOCUS - 59_000);
  });

  test('a Skipped Long break continues from the first Focus with focusCount 0 (AC-04b)', () => {
    const engine = createTimerEngine();
    let t = 0;
    for (let i = 0; i < 3; i += 1) {
      engine.start(t);
      t += FOCUS;
      engine.getSnapshot(t); // short break waiting
      engine.startFocus(t); // skip it (waiting — no guard)
    }
    t += FOCUS; // Focus #4 completes
    const longBreak = engine.getSnapshot(t);
    assert.equal(longBreak.phase, PHASES.LONG_BREAK);
    assert.equal(longBreak.focusCount, 0);
    engine.startFocus(t);
    const snap = engine.getSnapshot(t);
    assert.equal(snap.phase, PHASES.FOCUS);
    assert.equal(snap.focusCount, 0);
  });

  test('a break completion still latches one break-end record and the next Focus waits (AC-02)', () => {
    const engine = engineAtBreak();
    engine.getSnapshot(FOCUS);
    engine.start(FOCUS);
    const snap = engine.getSnapshot(FOCUS + SHORT);
    assert.equal(snap.phase, PHASES.FOCUS);
    assert.equal(snap.running, false);
    assert.equal(snap.justCompleted.phase, PHASES.SHORT_BREAK);
    assert.equal(snap.startedAt, null);
  });
});
