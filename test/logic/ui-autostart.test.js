// break-flow T7: the auto-start step and the fixed-order render cycle around it (spec.md
// AC-01/02/03/13/14, ADR-0001, sad.md §6 Flow 1 and §8 One-shot consumption). Plain Node with
// an injected clock, engine, player and wake-up — the same exported code the page runs.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { autoStartBreak, renderCycle, syncWakeup } from '../../src/ui/index.js';
import { createTimerEngine, PHASES, TONES } from '../../src/logic/index.js';

const MIN = 60 * 1000;
const FOCUS = 25 * MIN;
const SHORT = 5 * MIN;
const LONG = 15 * MIN;

// An engine whose Focus phase started at t=0 and ends at FOCUS.
function runningFocus(setup) {
  const engine = createTimerEngine();
  setup?.(engine);
  engine.start(0);
  return engine;
}

describe('autoStartBreak (AC-01, AC-03, AC-14, ADR-0001)', () => {
  function step(engine, { now, enabled = true, prepare = () => {} }) {
    const snapshot = engine.getSnapshot(now);
    const display = autoStartBreak({ snapshot, now, enabled, engine, prepare });
    return { snapshot, display };
  }

  test('an On-time completion (exactly 5000 ms) starts the break from the Focus end', () => {
    const engine = runningFocus();
    const now = FOCUS + 5000;
    const { snapshot, display } = step(engine, { now });
    assert.equal(snapshot.phase, PHASES.SHORT_BREAK);
    assert.equal(snapshot.running, false); // snapshot A: the break loaded idle
    assert.equal(display.phase, PHASES.SHORT_BREAK);
    assert.equal(display.running, true);
    assert.equal(display.startedAt, FOCUS); // measured from the true end, not from `now`
    assert.ok(Math.abs(display.remainingMs - (SHORT - 5000)) <= 1000);
    assert.equal(display.justCompleted, null); // the completion is consumed once, by A
  });

  test('a late completion (5001 ms) starts nothing — the break waits at full length (AC-03)', () => {
    const engine = runningFocus();
    const { snapshot, display } = step(engine, { now: FOCUS + 5001 });
    assert.equal(display, snapshot);
    const after = engine.getSnapshot(FOCUS + 5001);
    assert.equal(after.running, false);
    assert.equal(after.idle, true);
    assert.equal(after.remainingMs, SHORT);
  });

  test('a late completion after a long sleep leaves a Long break waiting, never used up (AC-03)', () => {
    const engine = runningFocus((e) => e.setCycleLength(2));
    // first cycle: Focus, auto-start the short break, skip it, second Focus
    engine.getSnapshot(FOCUS);
    engine.startFocus(FOCUS);
    const second = FOCUS * 2;
    const now = second + 3 * 60 * MIN; // the device slept for three hours
    const { snapshot, display } = step(engine, { now });
    assert.equal(snapshot.phase, PHASES.LONG_BREAK);
    assert.equal(display, snapshot);
    assert.equal(engine.getSnapshot(now).remainingMs, LONG);
    assert.equal(engine.getSnapshot(now).running, false);
  });

  test('an On-time completion into a Long break auto-starts the Long break (AC-01)', () => {
    const engine = runningFocus((e) => e.setCycleLength(2));
    engine.getSnapshot(FOCUS);
    engine.startFocus(FOCUS);
    const { display } = step(engine, { now: FOCUS * 2 + 100 });
    assert.equal(display.phase, PHASES.LONG_BREAK);
    assert.equal(display.running, true);
    assert.ok(Math.abs(display.remainingMs - (LONG - 100)) <= 1000);
  });

  test('with the setting off nothing starts', () => {
    const engine = runningFocus();
    const { snapshot, display } = step(engine, { now: FOCUS + 10, enabled: false });
    assert.equal(display, snapshot);
    assert.equal(engine.getSnapshot(FOCUS + 10).running, false);
  });

  test('a break completion never starts anything (AC-02)', () => {
    const engine = runningFocus();
    engine.getSnapshot(FOCUS);
    engine.start(FOCUS); // the User's Start break
    const { snapshot, display } = step(engine, { now: FOCUS + SHORT + 10 });
    assert.equal(snapshot.justCompleted.phase, PHASES.SHORT_BREAK);
    assert.equal(snapshot.phase, PHASES.FOCUS);
    assert.equal(display, snapshot);
    assert.equal(engine.getSnapshot(FOCUS + SHORT + 10).running, false);
  });

  test('a snapshot with no completion is returned untouched and the correction is not run', () => {
    const engine = runningFocus();
    let prepared = 0;
    const { snapshot, display } = step(engine, { now: 1000, prepare: () => (prepared += 1) });
    assert.equal(display, snapshot);
    assert.equal(prepared, 0);
  });

  test('the pre-start correction runs exactly once, before the break starts', () => {
    const engine = runningFocus();
    const order = [];
    const realStart = engine.start;
    const spied = { ...engine, start: (at) => (order.push('start'), realStart(at)) };
    const snapshot = engine.getSnapshot(FOCUS + 10);
    autoStartBreak({ snapshot, now: FOCUS + 10, enabled: true, engine: spied, prepare: () => order.push('prepare') });
    assert.deepEqual(order, ['prepare', 'start']);
  });

  test('a Configured duration committed before the Focus end applies to the auto-started break (AC-14)', () => {
    const engine = runningFocus();
    engine.setConfiguredDurations({ focus: 25, shortBreak: 8, longBreak: 15 }); // mid-Focus commit
    const { display } = step(engine, { now: FOCUS + 50 });
    assert.equal(display.phaseFullMs, 8 * MIN);
    assert.ok(Math.abs(display.remainingMs - (8 * MIN - 50)) <= 1000);
  });

  test('a duration committed after the auto-start leaves the running break at its length (AC-14)', () => {
    const engine = runningFocus();
    const { display } = step(engine, { now: FOCUS + 50 });
    engine.setConfiguredDurations({ focus: 25, shortBreak: 9, longBreak: 15 });
    const later = engine.getSnapshot(FOCUS + 1000);
    assert.equal(later.phaseFullMs, SHORT);
    assert.ok(later.remainingMs <= display.remainingMs);
  });

  test('a failing correction is fail-soft: the break is left waiting, nothing thrown', () => {
    const engine = runningFocus();
    const { snapshot, display } = step(engine, {
      now: FOCUS + 10,
      prepare: () => {
        throw new Error('storage exploded');
      },
    });
    assert.equal(display, snapshot);
    assert.equal(engine.getSnapshot(FOCUS + 10).running, false);
  });
});

// ---- renderCycle: the fixed order getSnapshot A -> auto-start -> title -> ring -> chime/notice
// -> credit, plus re-arming the wake-up after an auto-start ----

function fakes({ soundWorks = true } = {}) {
  const log = [];
  const ring = { update: (fraction, phase) => log.push(['ring', fraction, phase]) };
  const player = {
    play: (tone) => {
      log.push(['play', tone === TONES.focusEnd ? 'focusEnd' : tone === TONES.breakEnd ? 'breakEnd' : 'other']);
      return soundWorks;
    },
  };
  const wakeup = {
    arm: (ms) => log.push(['arm', ms]),
    cancel: () => log.push(['cancel']),
  };
  return {
    log,
    deps: {
      visual: { ring, setTitle: (text) => log.push(['title', text]) },
      cue: { player, setNotice: (visible) => log.push(['notice', visible]) },
      credit: (now, at) => log.push(['credit', at]),
      wakeup,
    },
    wakeup,
  };
}

describe('renderCycle (AC-01, AC-13, sad.md §8 One-shot consumption)', () => {
  function cycle(engine, now, { enabled = true, soundWorks = true } = {}) {
    const f = fakes({ soundWorks });
    const result = renderCycle({
      engine,
      now,
      autoStartBreaks: enabled,
      prepare: () => f.log.push(['prepare']),
      ...f.deps,
    });
    return { ...result, ...f };
  }

  test('an On-time Focus end: one chime and one credit from snapshot A, display = the running break', () => {
    const engine = runningFocus();
    const now = FOCUS + 2000;
    const { snapshot, display, log } = cycle(engine, now);
    assert.equal(snapshot.justCompleted.phase, PHASES.FOCUS);
    assert.equal(display.running, true);
    assert.equal(display.phase, PHASES.SHORT_BREAK);
    assert.equal(log.filter(([k]) => k === 'play').length, 1);
    assert.deepEqual(log.find(([k]) => k === 'play'), ['play', 'focusEnd']);
    assert.deepEqual(log.filter(([k]) => k === 'credit'), [['credit', FOCUS]]);
  });

  test('the fixed order: correction, then title, ring, chime/notice, credit', () => {
    const engine = runningFocus();
    const { log } = cycle(engine, FOCUS + 1000);
    const kinds = log.map(([k]) => k).filter((k) => k !== 'arm');
    assert.deepEqual(kinds, ['prepare', 'title', 'ring', 'play', 'credit']);
  });

  test('title and ring show the break running (not waiting), the ring starts near full (AC-13)', () => {
    const engine = runningFocus();
    const { log } = cycle(engine, FOCUS + 1000);
    const title = log.find(([k]) => k === 'title')[1];
    assert.match(title, /Short break/);
    assert.doesNotMatch(title, /Ready|Paused/);
    const ring = log.find(([k]) => k === 'ring');
    assert.equal(ring[2], PHASES.SHORT_BREAK);
    assert.ok(ring[1] > 0.99 && ring[1] <= 1);
  });

  test('the wake-up is armed for the auto-started break (render-tick path)', () => {
    const engine = runningFocus();
    const { log, display } = cycle(engine, FOCUS + 1000);
    assert.deepEqual(log.filter(([k]) => k === 'arm' || k === 'cancel'), [['arm', display.remainingMs]]);
    assert.ok(Math.abs(display.remainingMs - (SHORT - 1000)) <= 1000);
  });

  test('the worker-wake path keeps the alarm: syncWakeup on the display snapshot arms the break, never cancels', () => {
    const engine = runningFocus();
    const { display, wakeup, log } = cycle(engine, FOCUS + 1000);
    log.length = 0;
    syncWakeup(display, wakeup); // what the wake-up callback runs after render(), with lastSnapshot = display
    assert.deepEqual(log, [['arm', display.remainingMs]]);
  });

  test('a late completion: one Focus-end chime, one credit, nothing started, no wake-up armed (AC-03)', () => {
    const engine = runningFocus();
    const { display, log } = cycle(engine, FOCUS + 60 * MIN);
    assert.equal(display.running, false);
    assert.equal(display.remainingMs, SHORT);
    assert.deepEqual(log.filter(([k]) => k === 'play'), [['play', 'focusEnd']]);
    assert.equal(log.filter(([k]) => k === 'credit').length, 1);
    assert.equal(log.some(([k]) => k === 'arm' || k === 'prepare'), false);
  });

  test('with the setting off the break waits, with one chime and one credit', () => {
    const engine = runningFocus();
    const { display, log } = cycle(engine, FOCUS + 100, { enabled: false });
    assert.equal(display.running, false);
    assert.equal(log.filter(([k]) => k === 'play').length, 1);
    assert.equal(log.some(([k]) => k === 'prepare'), false);
  });

  test('the next tick plays nothing again and starts nothing again', () => {
    const engine = runningFocus();
    cycle(engine, FOCUS + 100);
    const { snapshot, display, log } = cycle(engine, FOCUS + 350);
    assert.equal(snapshot.justCompleted, null);
    assert.equal(display, snapshot);
    assert.equal(log.some(([k]) => k === 'play' || k === 'prepare'), false);
    assert.equal(log.filter(([k]) => k === 'credit').length, 1); // credit() is still called, with a null completion
    assert.deepEqual(log.find(([k]) => k === 'credit'), ['credit', null]);
  });

  test('a break reaching zero chimes once, shows Focus waiting and starts nothing (AC-02)', () => {
    const engine = runningFocus();
    cycle(engine, FOCUS + 100); // auto-start
    const end = FOCUS + SHORT + 50;
    const { snapshot, display, log } = cycle(engine, end);
    assert.equal(snapshot.justCompleted.phase, PHASES.SHORT_BREAK);
    assert.deepEqual(log.filter(([k]) => k === 'play'), [['play', 'breakEnd']]);
    assert.equal(display.phase, PHASES.FOCUS);
    assert.equal(display.running, false);
    assert.equal(log.some(([k]) => k === 'prepare'), false);
  });

  test('sound unavailable: the notice appears at the auto-start moment (AC-13)', () => {
    const engine = runningFocus();
    const { log, display } = cycle(engine, FOCUS + 100, { soundWorks: false });
    assert.equal(display.running, true);
    assert.deepEqual(log.filter(([k]) => k === 'notice'), [['notice', true]]);
  });
});
