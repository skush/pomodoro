import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createChimePlayer } from '../../src/ui/audio.js';
import { TONES } from '../../src/logic/index.js';

// sensory-feedback T6: the audio adapter against a fake AudioContext (no browser).
function fakeContextClass({ stateAfterResume = 'running', initialState = 'suspended', resumeRejects = false, throwOn = null } = {}) {
  const instances = [];
  class FakeContext {
    constructor() {
      this.state = initialState;
      this.currentTime = 10;
      this.destination = {};
      this.oscillators = [];
      instances.push(this);
    }
    resume() {
      if (resumeRejects) return Promise.reject(new Error('blocked'));
      this.state = stateAfterResume;
      return Promise.resolve();
    }
    createOscillator() {
      if (throwOn === 'oscillator') throw new Error('boom');
      const osc = { type: '', frequency: { value: 0 }, connect() {}, started: null, stopped: null, start(t) { this.started = t; }, stop(t) { this.stopped = t; } };
      this.oscillators.push(osc);
      return osc;
    }
    createGain() {
      const calls = [];
      return { calls, connect() {}, gain: { setValueAtTime: (v, t) => calls.push(['set', v, t]), linearRampToValueAtTime: (v, t) => calls.push(['ramp', v, t]) } };
    }
  }
  return { FakeContext, instances };
}

describe('createChimePlayer (AC-05, AC-07, AC-11, AC-12)', () => {
  test('unlock creates one context lazily, resumes it, and reports available when running', async () => {
    const { FakeContext, instances } = fakeContextClass();
    const player = createChimePlayer({ AudioContextClass: FakeContext });
    assert.equal(instances.length, 0); // lazy: nothing created at construction
    assert.equal(await player.unlock(), true);
    assert.equal(await player.unlock(), true);
    assert.equal(instances.length, 1); // reused, never a second context
  });

  test('AC-11: unlock reports unavailable when the context stays suspended, is missing, or resume rejects', async () => {
    const suspended = fakeContextClass({ stateAfterResume: 'suspended' });
    assert.equal(await createChimePlayer({ AudioContextClass: suspended.FakeContext }).unlock(), false);
    assert.equal(await createChimePlayer({ AudioContextClass: null }).unlock(), false);
    const rejects = fakeContextClass({ resumeRejects: true });
    assert.equal(await createChimePlayer({ AudioContextClass: rejects.FakeContext }).unlock(), false);
    const throwing = createChimePlayer({ AudioContextClass: class { constructor() { throw new Error('nope'); } } });
    assert.equal(await throwing.unlock(), false);
  });

  test('AC-05: play schedules every note of the tone exactly once, relative to currentTime, and returns true', async () => {
    const { FakeContext, instances } = fakeContextClass();
    const player = createChimePlayer({ AudioContextClass: FakeContext });
    await player.unlock();
    assert.equal(player.play(TONES.focusEnd), true);
    const oscs = instances[0].oscillators;
    assert.equal(oscs.length, TONES.focusEnd.length);
    TONES.focusEnd.forEach((n, i) => {
      assert.equal(oscs[i].frequency.value, n.frequency);
      assert.equal(oscs[i].started, 10 + n.start);
      assert.equal(oscs[i].stopped, 10 + n.start + n.duration);
    });
  });

  test('AC-11: play never queues a chime for later — false, nothing scheduled, when suspended or never unlocked', async () => {
    const never = createChimePlayer({ AudioContextClass: fakeContextClass().FakeContext });
    assert.equal(never.play(TONES.breakEnd), false);
    const { FakeContext, instances } = fakeContextClass({ stateAfterResume: 'suspended' });
    const player = createChimePlayer({ AudioContextClass: FakeContext });
    await player.unlock();
    assert.equal(player.play(TONES.breakEnd), false);
    assert.equal(instances[0].oscillators.length, 0);
    assert.equal(createChimePlayer({ AudioContextClass: null }).play(TONES.breakEnd), false);
  });

  test('play is fail-soft: a throwing oscillator returns false instead of throwing', async () => {
    const { FakeContext } = fakeContextClass({ throwOn: 'oscillator' });
    const player = createChimePlayer({ AudioContextClass: FakeContext });
    await player.unlock();
    assert.doesNotThrow(() => player.play(TONES.focusEnd));
    assert.equal(player.play(TONES.focusEnd), false);
  });

  test('a context that is already running at creation counts as available', async () => {
    const { FakeContext } = fakeContextClass({ initialState: 'running', stateAfterResume: 'running' });
    assert.equal(await createChimePlayer({ AudioContextClass: FakeContext }).unlock(), true);
  });
});
