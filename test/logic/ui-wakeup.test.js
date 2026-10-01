import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { syncWakeup } from '../../src/ui/index.js';
import { createTimerEngine } from '../../src/logic/index.js';

// sensory-feedback T10: arming and cancelling the wake-up from the last rendered snapshot.
const MIN = 60 * 1000;
const fakeWakeup = () => {
  const calls = [];
  return { calls, arm: (ms) => calls.push(['arm', ms]), cancel: () => calls.push(['cancel']) };
};

describe('syncWakeup (AC-06, AC-06b, AC-07)', () => {
  test('Start or Resume: a running snapshot arms the wake-up for the remaining time', () => {
    const engine = createTimerEngine();
    const wake = fakeWakeup();
    engine.setAllowPausingFocus(true); // break-flow AC-16: Focus may be paused
    engine.start(0);
    syncWakeup(engine.getSnapshot(0), wake);
    assert.deepEqual(wake.calls, [['arm', 25 * MIN]]);
    engine.pause(10 * MIN);
    engine.start(11 * MIN); // Resume
    syncWakeup(engine.getSnapshot(11 * MIN), wake);
    assert.deepEqual(wake.calls.at(-1), ['arm', 15 * MIN]);
  });

  test('Pause and Reset cancel the wake-up', () => {
    const engine = createTimerEngine();
    const wake = fakeWakeup();
    engine.setAllowPausingFocus(true); // break-flow AC-16: Focus may be paused
    engine.start(0);
    engine.pause(MIN);
    syncWakeup(engine.getSnapshot(MIN), wake);
    engine.reset(2 * MIN);
    syncWakeup(engine.getSnapshot(2 * MIN), wake);
    assert.deepEqual(wake.calls, [['cancel'], ['cancel']]);
  });

  test('an early wake-up (still before the deadline) re-arms for the remainder', () => {
    const engine = createTimerEngine();
    const wake = fakeWakeup();
    engine.start(0);
    syncWakeup(engine.getSnapshot(25 * MIN - 40), wake);
    assert.deepEqual(wake.calls, [['arm', 40]]);
  });

  test('a wake-up after the deadline finds the next phase idle, so nothing is re-armed', () => {
    const engine = createTimerEngine();
    const wake = fakeWakeup();
    engine.start(0);
    syncWakeup(engine.getSnapshot(25 * MIN + 5), wake);
    assert.deepEqual(wake.calls, [['cancel']]);
  });

  test('fail-soft: a throwing wake-up never propagates', () => {
    const engine = createTimerEngine();
    engine.start(0);
    const boom = { arm() { throw new Error('x'); }, cancel() { throw new Error('y'); } };
    assert.doesNotThrow(() => syncWakeup(engine.getSnapshot(0), boom));
    assert.doesNotThrow(() => syncWakeup(engine.getSnapshot(30 * MIN), boom));
  });
});
