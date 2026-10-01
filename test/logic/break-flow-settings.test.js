// break-flow T5: the third storage gatekeeper for the two break-flow toggles (spec.md AC-07,
// AC-09, AC-12, AC-17; sad.md §8 Persistence; ADR session-tracking-0002 pattern). Plain Node
// with an injected storage, like the other two gatekeepers' tests in write-guard.test.js.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { persistBreakFlowSettings, readPersistedBreakFlowSettings } from '../../src/ui/index.js';
import { DEFAULT_BREAK_FLOW_SETTINGS } from '../../src/logic/index.js';

const AUTO_KEY = 'break-flow:auto-start-breaks';
const PAUSE_KEY = 'break-flow:allow-pausing-focus';

function recordingStorage(initial = {}) {
  const data = { ...initial };
  const writes = [];
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      writes.push(key);
      data[key] = String(value);
    },
    dump: () => ({ ...data }),
    writes,
  };
}

const throwingStorage = {
  getItem() {
    throw new Error('storage disabled');
  },
  setItem() {
    throw new Error('quota exceeded');
  },
};

describe('persistBreakFlowSettings (AC-07, AC-09, AC-12)', () => {
  test('always writes both keys, as the strings true/false, and only those two', () => {
    const storage = recordingStorage();
    persistBreakFlowSettings(storage, { autoStartBreaks: false, allowPausingFocus: true });
    assert.deepEqual([...storage.writes].sort(), [PAUSE_KEY, AUTO_KEY].sort());
    assert.deepEqual(storage.dump(), { [AUTO_KEY]: 'false', [PAUSE_KEY]: 'true' });
  });

  test('a write overwrites a foreign edit to either key — never adopts it (the full pair every time)', () => {
    const storage = recordingStorage({ [AUTO_KEY]: 'garbage', [PAUSE_KEY]: 'true' });
    persistBreakFlowSettings(storage, { autoStartBreaks: true, allowPausingFocus: false });
    assert.deepEqual(storage.dump(), { [AUTO_KEY]: 'true', [PAUSE_KEY]: 'false' });
  });

  test('reports whether the write succeeded; a refusing or absent storage never throws', () => {
    const settings = { autoStartBreaks: true, allowPausingFocus: false };
    assert.equal(persistBreakFlowSettings(recordingStorage(), settings), true);
    assert.equal(persistBreakFlowSettings(throwingStorage, settings), false);
    assert.doesNotThrow(() => persistBreakFlowSettings(null, settings));
    assert.equal(persistBreakFlowSettings(null, settings), false);
  });

  test('a non-boolean value is coerced, so only the strings true/false are ever stored', () => {
    const storage = recordingStorage();
    persistBreakFlowSettings(storage, { autoStartBreaks: 'yes', allowPausingFocus: 0 });
    assert.deepEqual(storage.dump(), { [AUTO_KEY]: 'true', [PAUSE_KEY]: 'false' });
  });
});

describe('readPersistedBreakFlowSettings (AC-07, AC-09)', () => {
  test('first use (nothing stored): auto-start on, allow pausing focus off', () => {
    assert.deepEqual(readPersistedBreakFlowSettings(recordingStorage()), { autoStartBreaks: true, allowPausingFocus: false });
    assert.deepEqual(readPersistedBreakFlowSettings(recordingStorage()), { ...DEFAULT_BREAK_FLOW_SETTINGS });
  });

  test('round-trips what persistBreakFlowSettings wrote (the choice survives a reload)', () => {
    for (const autoStartBreaks of [true, false]) {
      for (const allowPausingFocus of [true, false]) {
        const storage = recordingStorage();
        persistBreakFlowSettings(storage, { autoStartBreaks, allowPausingFocus });
        assert.deepEqual(readPersistedBreakFlowSettings(storage), { autoStartBreaks, allowPausingFocus });
      }
    }
  });

  test('each key falls back on its own — a bad value never affects the other key', () => {
    assert.deepEqual(readPersistedBreakFlowSettings(recordingStorage({ [AUTO_KEY]: 'maybe', [PAUSE_KEY]: 'true' })), {
      autoStartBreaks: true,
      allowPausingFocus: true,
    });
    assert.deepEqual(readPersistedBreakFlowSettings(recordingStorage({ [AUTO_KEY]: 'false', [PAUSE_KEY]: '' })), {
      autoStartBreaks: false,
      allowPausingFocus: false,
    });
  });

  test('never writes back — not even to correct an invalid value (the next toggle writes the full pair)', () => {
    const storage = recordingStorage({ [AUTO_KEY]: 'nope', [PAUSE_KEY]: '1' });
    readPersistedBreakFlowSettings(storage);
    assert.deepEqual(storage.writes, []);
    assert.deepEqual(storage.dump(), { [AUTO_KEY]: 'nope', [PAUSE_KEY]: '1' });
  });

  test('a storage whose getItem throws (or no storage at all) reads as the defaults, nothing thrown', () => {
    assert.deepEqual(readPersistedBreakFlowSettings(throwingStorage), { autoStartBreaks: true, allowPausingFocus: false });
    assert.deepEqual(readPersistedBreakFlowSettings(null), { autoStartBreaks: true, allowPausingFocus: false });
  });
});
