import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { applyVisualCues } from '../../src/ui/index.js';
import { createTimerEngine, PHASES } from '../../src/logic/index.js';

// sensory-feedback T8: the render-time cue helpers exported from src/ui/index.js,
// against fakes (the repo has no DOM test environment). The full page wiring is covered
// by test-e2e/sensory-feedback.e2e.js.
const MIN = 60 * 1000;

function fakeRing() {
  const calls = [];
  return { calls, update: (fraction, phase) => calls.push([fraction, phase]) };
}

describe('applyVisualCues (AC-01, AC-02, AC-04, AC-08, AC-09)', () => {
  test('sets the tab title and the ring from the snapshot, title first', () => {
    const order = [];
    const ring = { update: () => order.push('ring') };
    const engine = createTimerEngine();
    applyVisualCues(engine.getSnapshot(0), { ring, setTitle: () => order.push('title') });
    assert.deepEqual(order, ['title', 'ring']);
  });

  test('waiting for Start: ring full, title marked ready with the minutes the phase will run for', () => {
    const engine = createTimerEngine();
    const ring = fakeRing();
    let title = '';
    applyVisualCues(engine.getSnapshot(0), { ring, setTitle: (t) => (title = t) });
    assert.deepEqual(ring.calls, [[1, PHASES.FOCUS]]);
    assert.equal(title, 'Ready · 25 min · Focus');
  });

  test('running then paused: the ring steps down, then freezes at the portion left', () => {
    const engine = createTimerEngine();
    const ring = fakeRing();
    let title = '';
    const setTitle = (t) => (title = t);
    engine.start(0);
    applyVisualCues(engine.getSnapshot(5 * MIN), { ring, setTitle });
    assert.equal(ring.calls.at(-1)[0], 20 / 25);
    assert.equal(title, '20 min · Focus');
    engine.pause(5 * MIN);
    applyVisualCues(engine.getSnapshot(9 * MIN), { ring, setTitle });
    assert.equal(ring.calls.at(-1)[0], 20 / 25); // frozen
    assert.equal(title, 'Paused · 20 min · Focus');
  });

  test('AC-02: after Phase completion the next phase loads full, ready, in its own phase', () => {
    const engine = createTimerEngine();
    const ring = fakeRing();
    let title = '';
    engine.start(0);
    applyVisualCues(engine.getSnapshot(25 * MIN), { ring, setTitle: (t) => (title = t) });
    assert.deepEqual(ring.calls.at(-1), [1, PHASES.SHORT_BREAK]);
    assert.equal(title, 'Ready · 5 min · Short break');
  });

  test('fail-soft: a throwing ring or title setter never propagates', () => {
    const engine = createTimerEngine();
    assert.doesNotThrow(() =>
      applyVisualCues(engine.getSnapshot(0), {
        ring: { update: () => { throw new Error('x'); } },
        setTitle: () => { throw new Error('y'); },
      }),
    );
  });
});
