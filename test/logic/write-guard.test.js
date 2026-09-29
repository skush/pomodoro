import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  persistState,
  readPersistedState,
  persistDurationConfig,
  readPersistedDurationConfig,
} from '../../src/ui/index.js';

// session-tracking T4 (ADR-0002, spec.md AC-07): persistState/readPersistedState
// take an injected `storage` parameter (never the bare `localStorage` global
// directly) so they're callable from plain Node — no jsdom needed — while still
// physically living in src/ui/, the only module the architecture lets touch
// Web Storage. mount() is what actually binds them to the real `localStorage`.

function fakeStorage() {
  const data = {};
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
  };
}

describe('persistState (session-tracking T4, ADR-0002/AC-07)', () => {
  test('writes the full {count, date, label} triple every call — a plain overwrite, never a merge', () => {
    const storage = fakeStorage();
    persistState(storage, { count: 5, date: '2026-09-27', label: 'old' });
    persistState(storage, { count: 0, date: '2026-09-28', label: 'old' });
    assert.deepEqual(readPersistedState(storage), { count: 0, date: '2026-09-28', label: 'old' });
  });

  // review fix (CHANGES REQUESTED, AC-07): AC-07's "overwrite, never adopt"
  // guarantee requires EVERY key to be re-written on the next legitimate write —
  // otherwise a key an external edit (devtools/another tab) changed while this
  // tab ran would survive into the next read because that trigger never touched it.
  test('a legitimate write overwrites a key an external edit changed, even though this call did not touch it logically', () => {
    const storage = fakeStorage();
    persistState(storage, { count: 3, date: '2026-09-28', label: 'writing docs' });
    // simulates an external edit (devtools / another tab) to a key this app didn't change
    storage.setItem('session-tracking:date', '2099-01-01');
    // the app's next legitimate write, still carrying its own in-memory state
    persistState(storage, { count: 4, date: '2026-09-28', label: 'writing docs' });
    assert.deepEqual(readPersistedState(storage), { count: 4, date: '2026-09-28', label: 'writing docs' });
  });

  test('a storage write failure is swallowed — no exception escapes, in-memory continues', () => {
    const throwingStorage = {
      setItem() {
        throw new Error('quota exceeded');
      },
      getItem() {
        return null;
      },
    };
    assert.doesNotThrow(() => persistState(throwingStorage, { count: 1, date: '2026-09-28', label: 'x' }));
  });
});

describe('readPersistedState (session-tracking T4)', () => {
  test('reads and validates all three fields through the T3 fallback functions', () => {
    const storage = fakeStorage();
    persistState(storage, { count: 3, date: '2026-09-28', label: 'writing docs' });
    assert.deepEqual(readPersistedState(storage), { count: 3, date: '2026-09-28', label: 'writing docs' });
  });

  test('falls back per-field on missing/corrupted storage — 0 exceptions', () => {
    const storage = fakeStorage(); // nothing written yet — every getItem returns null
    assert.doesNotThrow(() => readPersistedState(storage));
    assert.deepEqual(readPersistedState(storage), { count: 0, date: null, label: '' });
  });

  // review fix (CHANGES REQUESTED, fail-soft): a getItem() that throws (Safari
  // private-mode quota, a blocked-storage browser) must fall back exactly like a
  // missing key — not propagate and take the timer down with it.
  test('falls back per-field when getItem() itself throws — 0 exceptions', () => {
    const throwingStorage = {
      getItem() {
        throw new Error('storage disabled');
      },
    };
    assert.doesNotThrow(() => readPersistedState(throwingStorage));
    assert.deepEqual(readPersistedState(throwingStorage), { count: 0, date: null, label: '' });
  });
});

// AC-07's structural guarantee: no code path other than persistState may ever
// call the storage-write API — mirrors core-timer's own AC-03 source-scan test
// (test/logic/timer-engine.test.js), a static property of the code rather than a
// runtime race to reproduce.
describe('write-guard structural check (session-tracking T4, AC-07)', () => {
  // review fix (CHANGES REQUESTED, stage-2): scans all of src/ (not only
  // src/ui/index.js), catches removeItem/clear and bracket/property assignment
  // too (not only the literal `.setItem(` substring), and bounds persistState's
  // own body strictly (up to its closing brace, not "until the next export" —
  // a non-exported helper placed right after it must not be silently included).
  test('every storage-write call anywhere in src/ lives inside persistState or persistDurationConfig, and persistState is called only by its legitimate triggers', () => {
    const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src');
    const writeCallPattern = /\.(setItem|removeItem|clear)\(|localStorage\s*[.[]/g;

    const uiPath = path.join(srcDir, 'ui/index.js');
    const uiContents = readFileSync(uiPath, 'utf8');

    // The [start, end) range of an exported function's declaration + body, bounded
    // strictly by its own closing brace.
    function functionRange(text, name) {
      const from = text.indexOf('export function ' + name);
      assert.notEqual(from, -1, name + ' function not found in src/ui/index.js');
      const after = text.slice(from);
      const bodyStart = after.indexOf('{');
      let depth = 0;
      for (let i = bodyStart; i < after.length; i += 1) {
        if (after[i] === '{') depth += 1;
        if (after[i] === '}') {
          depth -= 1;
          if (depth === 0) return [from, from + i + 1];
        }
      }
      throw new Error('unterminated ' + name);
    }

    function writeCallCount(text) {
      return (text.match(writeCallPattern) || []).length;
    }

    const gatekeepers = ['persistState', 'persistDurationConfig'];
    const ranges = gatekeepers.map((name) => functionRange(uiContents, name));
    gatekeepers.forEach((name, i) => {
      assert.equal(
        writeCallCount(uiContents.slice(...ranges[i])) > 0,
        true,
        name + ' itself has no storage-write call — the test would pass vacuously',
      );
    });

    let outsideGatekeepers = '';
    let cursor = 0;
    for (const [from, to] of [...ranges].sort((a, b) => a[0] - b[0])) {
      outsideGatekeepers += uiContents.slice(cursor, from);
      cursor = to;
    }
    outsideGatekeepers += uiContents.slice(cursor);

    const otherFiles = [
      readFileSync(path.join(srcDir, 'logic/index.js'), 'utf8'),
      readFileSync(path.join(srcDir, 'main.js'), 'utf8'),
      outsideGatekeepers,
    ];
    for (const text of otherFiles) {
      assert.equal(writeCallCount(text), 0, 'a storage-write call exists outside the two gatekeepers — the only legitimate write paths AC-07/AC-08 allow');
    }

    const persistStateCallSites = (uiContents.match(/\bpersistState\(/g) || []).length;
    const persistStateCallsInTriggers = (uiContents.match(/function (commitLabel|updateSessionCount)\b[\s\S]*?persistState\(/g) || []).length;
    // 3 = commitLabel's own call + updateSessionCount's own call, each matched once by the
    // non-greedy trigger scan above; the export declaration itself is not a call site.
    assert.equal(
      persistStateCallSites - 1, // minus the `export function persistState(` declaration line
      2,
      'persistState must be called only by commitLabel and updateSessionCount — the two legitimate triggers besides its own definition',
    );
    assert.equal(persistStateCallsInTriggers >= 2, true, 'persistState is not called from inside its two legitimate trigger functions');
  });
});

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

const DURATION_KEYS = [
  'adjustable-durations:cycle-length',
  'adjustable-durations:focus-duration',
  'adjustable-durations:long-break-duration',
  'adjustable-durations:short-break-duration',
];
const CLASSIC = { focus: 25, shortBreak: 5, longBreak: 15, cycleLength: 4 };

describe('persistDurationConfig (adjustable-durations T4, ADR-0002/AC-08)', () => {
  test('every call writes all four keys, and only those four', () => {
    const storage = recordingStorage();
    persistDurationConfig(storage, { focus: 50, shortBreak: 10, longBreak: 20, cycleLength: 3 });
    assert.deepEqual([...storage.writes].sort(), DURATION_KEYS);
    assert.deepEqual(storage.dump(), {
      'adjustable-durations:focus-duration': '50',
      'adjustable-durations:short-break-duration': '10',
      'adjustable-durations:long-break-duration': '20',
      'adjustable-durations:cycle-length': '3',
    });
  });

  test('AC-08: a foreign write is overwritten — never adopted — by the next legitimate write, even for keys it did not concern', () => {
    const storage = recordingStorage();
    persistDurationConfig(storage, CLASSIC);
    storage.setItem('adjustable-durations:long-break-duration', '99'); // devtools / other tab
    persistDurationConfig(storage, { ...CLASSIC, focus: 30 });
    assert.equal(storage.getItem('adjustable-durations:long-break-duration'), '15');
  });

  test('never touches the session-tracking count/date/label keys', () => {
    const storage = recordingStorage({
      'session-tracking:count': '7',
      'session-tracking:date': '2026-09-28',
      'session-tracking:label': 'x',
    });
    storage.writes.length = 0;
    persistDurationConfig(storage, CLASSIC);
    assert.equal(storage.writes.some((k) => k.startsWith('session-tracking:')), false);
    assert.equal(storage.getItem('session-tracking:count'), '7');
  });

  test('a storage write failure is swallowed — no exception escapes', () => {
    const throwing = {
      setItem() {
        throw new Error('quota exceeded');
      },
      getItem() {
        return null;
      },
    };
    assert.doesNotThrow(() => persistDurationConfig(throwing, CLASSIC));
    assert.doesNotThrow(() => persistDurationConfig(null, CLASSIC));
  });
});

describe('readPersistedDurationConfig (adjustable-durations T4, AC-06/AC-12)', () => {
  test('round-trips a valid persisted config without writing anything back', () => {
    const storage = recordingStorage();
    persistDurationConfig(storage, { focus: 50, shortBreak: 10, longBreak: 20, cycleLength: 6 });
    storage.writes.length = 0;
    assert.deepEqual(readPersistedDurationConfig(storage), { focus: 50, shortBreak: 10, longBreak: 20, cycleLength: 6 });
    assert.deepEqual(storage.writes, []);
  });

  test('first load with nothing stored yields the classic defaults and writes them back', () => {
    const storage = recordingStorage();
    assert.deepEqual(readPersistedDurationConfig(storage), CLASSIC);
    assert.deepEqual([...storage.writes].sort(), DURATION_KEYS);
    assert.equal(storage.getItem('adjustable-durations:focus-duration'), '25');
  });

  test('one invalid key falls back per key, the others survive, and the corrected full state is written back', () => {
    const storage = recordingStorage({
      'adjustable-durations:focus-duration': '50',
      'adjustable-durations:short-break-duration': '0',
      'adjustable-durations:long-break-duration': '20',
      'adjustable-durations:cycle-length': '6',
    });
    assert.deepEqual(readPersistedDurationConfig(storage), { focus: 50, shortBreak: 5, longBreak: 20, cycleLength: 6 });
    assert.deepEqual(storage.dump(), {
      'adjustable-durations:focus-duration': '50',
      'adjustable-durations:short-break-duration': '5',
      'adjustable-durations:long-break-duration': '20',
      'adjustable-durations:cycle-length': '6',
    });
  });

  test('every invalid class falls back without throwing — nothing outside 1–180 / 2–8 ever comes out', () => {
    for (const bad of ['0', '181', '-5', '12.5', '25abc', '1e2', '', 'abc']) {
      const storage = recordingStorage({
        'adjustable-durations:focus-duration': bad,
        'adjustable-durations:short-break-duration': bad,
        'adjustable-durations:long-break-duration': bad,
        'adjustable-durations:cycle-length': bad,
      });
      assert.doesNotThrow(() => readPersistedDurationConfig(storage));
      assert.deepEqual(readPersistedDurationConfig(storage), CLASSIC);
    }
  });

  test('a throwing or absent storage falls back like a missing key — 0 exceptions', () => {
    const throwing = {
      getItem() {
        throw new Error('storage disabled');
      },
      setItem() {
        throw new Error('storage disabled');
      },
    };
    assert.doesNotThrow(() => readPersistedDurationConfig(throwing));
    assert.deepEqual(readPersistedDurationConfig(throwing), CLASSIC);
    assert.deepEqual(readPersistedDurationConfig(null), CLASSIC);
  });
});
