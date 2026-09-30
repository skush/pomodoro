import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createWakeup, WORKER_SOURCE } from '../../src/ui/wakeup.js';

// sensory-feedback T7 (ADR-0001): the wake-up clock, against fakes (no browser).
function fakeWorkerEnv() {
  const workers = [];
  const urls = { created: [], revoked: [] };
  class FakeWorker {
    constructor(url) {
      this.url = url;
      this.posted = [];
      this.onmessage = null;
      workers.push(this);
    }
    postMessage(m) {
      this.posted.push(m);
    }
    // test helper: the worker "fires" a wake carrying the id it was armed with
    wake(id) {
      this.onmessage?.({ data: { type: 'wake', id } });
    }
  }
  return {
    workers,
    urls,
    options: {
      WorkerClass: FakeWorker,
      createObjectURL: () => {
        urls.created.push('blob:fake');
        return 'blob:fake';
      },
      revokeObjectURL: (u) => urls.revoked.push(u),
    },
  };
}

describe('createWakeup with a worker (AC-06)', () => {
  test('builds one worker per page and revokes its URL right after construction', () => {
    const env = fakeWorkerEnv();
    const wake = createWakeup(() => {}, env.options);
    wake.arm(1000);
    wake.arm(2000);
    wake.cancel();
    assert.equal(env.workers.length, 1);
    assert.deepEqual(env.urls.revoked, ['blob:fake']);
    assert.equal(env.workers[0].url, 'blob:fake');
  });

  test('arm posts the delay, and the matching wake message calls onWake exactly once', () => {
    const env = fakeWorkerEnv();
    let wakes = 0;
    const wake = createWakeup(() => (wakes += 1), env.options);
    wake.arm(5000);
    const [msg] = env.workers[0].posted;
    assert.equal(msg.type, 'arm');
    assert.equal(msg.delayMs, 5000);
    env.workers[0].wake(msg.id);
    assert.equal(wakes, 1);
  });

  test('a cancelled arm never calls onWake, even if its wake message is already in flight', () => {
    const env = fakeWorkerEnv();
    let wakes = 0;
    const wake = createWakeup(() => (wakes += 1), env.options);
    wake.arm(5000);
    const { id } = env.workers[0].posted[0];
    wake.cancel();
    assert.equal(env.workers[0].posted.at(-1).type, 'cancel');
    env.workers[0].wake(id);
    assert.equal(wakes, 0);
  });

  test('re-arming replaces the pending wake-up: only the latest id is honoured', () => {
    const env = fakeWorkerEnv();
    let wakes = 0;
    const wake = createWakeup(() => (wakes += 1), env.options);
    wake.arm(5000);
    wake.arm(3000);
    const [first, second] = env.workers[0].posted;
    env.workers[0].wake(first.id);
    assert.equal(wakes, 0);
    env.workers[0].wake(second.id);
    assert.equal(wakes, 1);
  });

  test('a bad delay is clamped to 0 (fail-soft)', () => {
    const env = fakeWorkerEnv();
    const wake = createWakeup(() => {}, env.options);
    wake.arm(-50);
    wake.arm(NaN);
    assert.equal(env.workers[0].posted[0].delayMs, 0);
    assert.equal(env.workers[0].posted[1].delayMs, 0);
  });
});

describe('createWakeup fallback (worker unavailable)', () => {
  function fakeTimers() {
    const pending = new Map();
    let next = 1;
    return {
      pending,
      setTimeoutFn: (fn, ms) => {
        pending.set(next, { fn, ms });
        return next++;
      },
      clearTimeoutFn: (id) => pending.delete(id),
    };
  }
  const throwingWorker = class {
    constructor() {
      throw new Error('workers blocked');
    }
  };

  test('a worker that cannot be constructed falls back to a main-thread timer with the same arm/cancel', () => {
    const t = fakeTimers();
    let wakes = 0;
    const wake = createWakeup(() => (wakes += 1), { WorkerClass: throwingWorker, createObjectURL: () => 'blob:x', revokeObjectURL() {}, ...t });
    wake.arm(4000);
    assert.equal(t.pending.size, 1);
    assert.equal([...t.pending.values()][0].ms, 4000);
    [...t.pending.values()][0].fn();
    assert.equal(wakes, 1);
  });

  test('fallback: cancel clears the timer, and re-arm replaces the pending one', () => {
    const t = fakeTimers();
    let wakes = 0;
    const wake = createWakeup(() => (wakes += 1), { WorkerClass: null, ...t });
    wake.arm(4000);
    wake.arm(1000);
    assert.equal(t.pending.size, 1);
    assert.equal([...t.pending.values()][0].ms, 1000);
    wake.cancel();
    assert.equal(t.pending.size, 0);
    assert.equal(wakes, 0);
  });
});

describe('createWakeup when the worker errors after construction (review F5, AC-06)', () => {
  function setup() {
    const env = fakeWorkerEnv();
    const pending = new Map();
    let next = 1;
    let clock = 1000;
    let wakes = 0;
    const wake = createWakeup(() => (wakes += 1), {
      ...env.options,
      setTimeoutFn: (fn, ms) => (pending.set(next, { fn, ms }), next++),
      clearTimeoutFn: (id) => pending.delete(id),
      now: () => clock,
    });
    return { env, pending, wake, wakes: () => wakes, advance: (ms) => (clock += ms) };
  }

  test('an armed deadline is re-armed on the main-thread timer with the remaining delay', () => {
    const s = setup();
    s.wake.arm(5000);
    s.advance(1500);
    s.env.workers[0].onerror({});
    assert.equal(s.pending.size, 1);
    assert.equal([...s.pending.values()][0].ms, 3500);
    [...s.pending.values()][0].fn();
    assert.equal(s.wakes(), 1);
  });

  test('later arms use the fallback and never post to the dead worker', () => {
    const s = setup();
    s.wake.arm(5000);
    s.env.workers[0].onerror({});
    const posted = s.env.workers[0].posted.length;
    s.wake.arm(2000);
    assert.equal(s.env.workers[0].posted.length, posted);
    assert.equal(s.env.workers.length, 1);
    assert.equal([...s.pending.values()].at(-1).ms, 2000);
  });

  test('an error while nothing is armed starts no timer, and a cancelled arm never fires', () => {
    const s = setup();
    s.wake.arm(5000);
    s.wake.cancel();
    s.env.workers[0].onerror({});
    assert.equal(s.pending.size, 0);
    assert.equal(s.wakes(), 0);
  });

  test('a wake message that arrives after the error is ignored', () => {
    const s = setup();
    s.wake.arm(5000);
    const { id } = s.env.workers[0].posted[0];
    s.env.workers[0].onerror({});
    s.env.workers[0].wake(id);
    assert.equal(s.wakes(), 0);
  });
});

describe('the worker source (runs inside the Worker)', () => {
  function runWorker() {
    const timers = new Map();
    let next = 1;
    const posted = [];
    const self = { postMessage: (m) => posted.push(m) };
    new Function('self', 'setTimeout', 'clearTimeout', WORKER_SOURCE)(
      self,
      (fn, ms) => (timers.set(next, { fn, ms }), next++),
      (id) => timers.delete(id),
    );
    return { self, timers, posted };
  }

  test('arm schedules one timeout that posts a wake with the same id; a second arm replaces it', () => {
    const w = runWorker();
    w.self.onmessage({ data: { type: 'arm', delayMs: 700, id: 1 } });
    w.self.onmessage({ data: { type: 'arm', delayMs: 300, id: 2 } });
    assert.equal(w.timers.size, 1);
    const [t] = [...w.timers.values()];
    assert.equal(t.ms, 300);
    t.fn();
    assert.deepEqual(w.posted, [{ type: 'wake', id: 2 }]);
  });

  test('cancel clears the pending timeout', () => {
    const w = runWorker();
    w.self.onmessage({ data: { type: 'arm', delayMs: 700, id: 1 } });
    w.self.onmessage({ data: { type: 'cancel' } });
    assert.equal(w.timers.size, 0);
  });
});

describe('input guard (ADR-0001, core-timer ADR-0002)', () => {
  test('wakeup.js never reaches an engine control method or the DOM', () => {
    const src = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/ui/wakeup.js'), 'utf8');
    for (const forbidden of [/\bengine\b/, /\.(start|pause|reset|setConfiguredDurations|setCycleLength)\(/, /\bdocument\b/, /localStorage|sessionStorage/]) {
      assert.doesNotMatch(src, forbidden);
    }
  });
});
