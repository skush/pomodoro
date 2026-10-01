import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  persistState,
  readPersistedState,
  persistDurationConfig,
  readPersistedDurationConfig,
  syncConfigFromStorage,
  prepareStart,
} from '../../src/ui/index.js';
import { createTimerEngine, CONTROL_LABELS } from '../../src/logic/index.js';

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
  test('every storage-write call anywhere in src/ lives inside persistState, persistDurationConfig or persistBreakFlowSettings, and persistState is called only by its legitimate triggers', () => {
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

    // break-flow T5 (sad.md §8 Persistence): the THIRD gatekeeper joins the allowed writers.
    const gatekeepers = ['persistState', 'persistDurationConfig', 'persistBreakFlowSettings'];
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
      assert.equal(writeCallCount(text), 0, 'a storage-write call exists outside the three gatekeepers — the only legitimate write paths AC-07/AC-08 and break-flow AC-09 allow');
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

// adjustable-durations T5/T7 (spec.md AC-06/AC-09/AC-12): the one path both mount()
// and the pre-start correction use — read + validate + write back, then push the
// values in effect into the engine.
describe('syncConfigFromStorage (adjustable-durations T5/T7)', () => {
  const MIN = 60 * 1000;

  test('AC-09: pushes the stored config into the engine and returns it', () => {
    const storage = recordingStorage();
    persistDurationConfig(storage, { focus: 50, shortBreak: 10, longBreak: 20, cycleLength: 2 });
    const engine = createTimerEngine();
    assert.deepEqual(syncConfigFromStorage(storage, engine), { focus: 50, shortBreak: 10, longBreak: 20, cycleLength: 2 });
    assert.equal(engine.getSnapshot(0).remainingMs, 50 * MIN);
    engine.start(0);
    assert.equal(engine.getSnapshot(50 * MIN).phase, 'short_break');
    assert.equal(engine.getSnapshot(50 * MIN).remainingMs, 10 * MIN);
  });

  test('AC-06: invalid values set between load and start run the classic default, corrected and written back, no instant completion', () => {
    const storage = recordingStorage();
    const engine = createTimerEngine();
    syncConfigFromStorage(storage, engine); // load
    for (const bad of ['0', '-3', '', 'abc', '12.5', '181']) {
      storage.setItem('adjustable-durations:focus-duration', bad); // tampered before Start
      storage.setItem('adjustable-durations:cycle-length', bad);
      const fresh = createTimerEngine();
      syncConfigFromStorage(storage, fresh); // pre-start correction
      assert.equal(storage.getItem('adjustable-durations:focus-duration'), '25', bad);
      assert.equal(storage.getItem('adjustable-durations:cycle-length'), '4', bad);
      fresh.start(0);
      const snap = fresh.getSnapshot(1000);
      assert.equal(snap.phase, 'focus');
      assert.equal(snap.running, true);
      assert.equal(snap.remainingMs, 25 * MIN - 1000);
    }
  });

  test('a valid foreign value found at a read point is honored (1 and 180 / 2 and 8 are valid)', () => {
    const storage = recordingStorage();
    persistDurationConfig(storage, { focus: 25, shortBreak: 5, longBreak: 15, cycleLength: 4 });
    storage.setItem('adjustable-durations:focus-duration', '180');
    storage.setItem('adjustable-durations:short-break-duration', '1');
    storage.setItem('adjustable-durations:cycle-length', '8');
    const engine = createTimerEngine();
    assert.deepEqual(syncConfigFromStorage(storage, engine), { focus: 180, shortBreak: 1, longBreak: 15, cycleLength: 8 });
  });

  test('unreadable storage yields the classic defaults with no exception', () => {
    const engine = createTimerEngine();
    assert.doesNotThrow(() => syncConfigFromStorage(null, engine));
    assert.equal(engine.getSnapshot(0).remainingMs, 25 * MIN);
  });
});

// adjustable-durations T7 (ADR-0002, spec.md AC-06/AC-08/AC-12): persistDurationConfig
// may be called only from its three legitimate trigger paths — the two commits and the
// load-time/pre-start correction (readPersistedDurationConfig's write-back, and
// prepareStart's retry of a failed save, re-review fix #1) — and the pre-start
// correction must run before every Start.
describe('duration write-guard call sites (adjustable-durations T7)', () => {
  const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src');
  // Line comments blanked so a comment naming a helper is not counted as a call.
  const uiContents = readFileSync(path.join(srcDir, 'ui/index.js'), 'utf8').replace(/\/\/.*$/gm, '');

  test('persistDurationConfig is called only from commitDuration, commitCycleLength, readPersistedDurationConfig and prepareStart', () => {
    const callSites = (uiContents.match(/\bpersistDurationConfig\(/g) || []).length - 1; // minus the declaration
    assert.equal(callSites, 4);
    for (const trigger of ['commitDuration', 'commitCycleLength', 'readPersistedDurationConfig', 'prepareStart']) {
      const from = uiContents.indexOf('function ' + trigger);
      assert.notEqual(from, -1, trigger + ' not found');
      const next = uiContents.indexOf('persistDurationConfig(', from);
      // the call must come before the next function declaration (any indentation) after this one starts
      const after = uiContents.slice(from + 1).search(/\n\s*(export )?function /);
      const limit = after === -1 ? uiContents.length : from + 1 + after;
      assert.equal(next !== -1 && next < limit, true, trigger + ' does not call persistDurationConfig');
    }
  });
});

// review fix #1/#3 (adjustable-durations AC-01/AC-03/AC-06/AC-08): the decision the
// Start handler makes before starting — correct from storage only for a FRESH start,
// and never let storage override an in-session commit that could not be saved.
describe('prepareStart (adjustable-durations review fix)', () => {
  const MIN = 60 * 1000;
  const throwingStorage = {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error('quota exceeded');
    },
  };

  test('persistDurationConfig reports whether the write succeeded', () => {
    assert.equal(persistDurationConfig(recordingStorage(), CLASSIC), true);
    assert.equal(persistDurationConfig(throwingStorage, CLASSIC), false);
    assert.equal(persistDurationConfig(null, CLASSIC), false);
  });

  test('AC-01/AC-03: a commit that could not be saved survives Start — the phase runs the committed value', () => {
    const engine = createTimerEngine();
    let config = syncConfigFromStorage(throwingStorage, engine);
    config = { ...config, focus: 50 };
    engine.setConfiguredDurations(config);
    const saved = persistDurationConfig(throwingStorage, config);
    const result = prepareStart(throwingStorage, engine, config, engine.getSnapshot(0), saved);
    assert.equal(result.config.focus, 50);
    assert.equal(result.lastWriteOk, false);
    engine.start(0);
    assert.equal(engine.getSnapshot(1000).remainingMs, 50 * MIN - 1000);
  });

  test('AC-01: with storage unavailable (null), Start keeps the in-memory config', () => {
    const engine = createTimerEngine();
    const config = { focus: 40, shortBreak: 5, longBreak: 15, cycleLength: 4 };
    engine.setConfiguredDurations(config);
    assert.deepEqual(prepareStart(null, engine, config, engine.getSnapshot(0), true), { config, lastWriteOk: true });
    engine.start(0);
    assert.equal(engine.getSnapshot(0).remainingMs, 40 * MIN);
  });

  test('AC-06/AC-08: Resume is not a fresh start — no storage write, stored values not adopted', () => {
    const storage = recordingStorage();
    const engine = createTimerEngine();
    const config = syncConfigFromStorage(storage, engine);
    engine.start(0);
    engine.pause(7 * MIN);
    storage.setItem('adjustable-durations:focus-duration', '90'); // foreign, valid
    storage.setItem('adjustable-durations:cycle-length', 'junk'); // foreign, invalid
    storage.writes.length = 0;
    const next = prepareStart(storage, engine, config, engine.getSnapshot(7 * MIN), true);
    assert.deepEqual(next, { config, lastWriteOk: true });
    assert.deepEqual(storage.writes, []);
  });

  test('AC-06: a fresh start with healthy storage runs the correction (invalid value fixed and written back)', () => {
    const storage = recordingStorage();
    const engine = createTimerEngine();
    const config = syncConfigFromStorage(storage, engine);
    storage.setItem('adjustable-durations:focus-duration', '0');
    const next = prepareStart(storage, engine, config, engine.getSnapshot(0), true);
    assert.equal(next.config.focus, 25);
    assert.equal(next.lastWriteOk, true);
    assert.equal(storage.getItem('adjustable-durations:focus-duration'), '25');
  });

  // re-review fix #1: a failed save is retried once per fresh Start — never on Resume,
  // never in the background — so a transient failure neither loses the commit on
  // reload nor switches the pre-start correction off for the rest of the session.
  // Storage whose writes fail while `failing` is true (a transient quota error).
  function flakyStorage() {
    const inner = recordingStorage();
    return {
      ...inner,
      failing: true,
      setItem(key, value) {
        if (this.failing) throw new Error('quota exceeded');
        inner.setItem(key, value);
      },
    };
  }

  test('storage recovered: the fresh Start retries once, saves the in-memory config, and clears the failed state', () => {
    const storage = flakyStorage();
    const engine = createTimerEngine();
    const config = { focus: 50, shortBreak: 5, longBreak: 15, cycleLength: 4 };
    engine.setConfiguredDurations(config);
    const saved = persistDurationConfig(storage, config); // fails
    assert.equal(saved, false);
    storage.failing = false; // storage recovers
    const next = prepareStart(storage, engine, config, engine.getSnapshot(0), saved);
    assert.deepEqual(next, { config, lastWriteOk: true });
    assert.equal(storage.getItem('adjustable-durations:focus-duration'), '50');
    assert.deepEqual([...storage.writes].sort(), DURATION_KEYS); // one full four-key write
    engine.start(0);
    assert.equal(engine.getSnapshot(0).remainingMs, 50 * MIN);
  });

  test('storage still failing: one attempt per fresh Start, in-memory config kept, no exception', () => {
    const storage = flakyStorage();
    const engine = createTimerEngine();
    const config = { focus: 50, shortBreak: 5, longBreak: 15, cycleLength: 4 };
    engine.setConfiguredDurations(config);
    let attempts = 0;
    const counting = {
      ...storage,
      setItem(key, value) {
        if (key === 'adjustable-durations:focus-duration') attempts += 1;
        return storage.setItem(key, value);
      },
    };
    let result;
    assert.doesNotThrow(() => {
      result = prepareStart(counting, engine, config, engine.getSnapshot(0), false);
    });
    assert.deepEqual(result, { config, lastWriteOk: false });
    assert.equal(attempts, 1);
  });

  test('no retry on Resume, and none when storage is unavailable', () => {
    const storage = flakyStorage();
    storage.failing = false;
    const engine = createTimerEngine();
    const config = { focus: 25, shortBreak: 5, longBreak: 15, cycleLength: 4 };
    engine.start(0);
    engine.pause(MIN);
    assert.deepEqual(prepareStart(storage, engine, config, engine.getSnapshot(MIN), false), { config, lastWriteOk: false });
    assert.deepEqual(storage.writes, []);
    const idle = createTimerEngine();
    assert.deepEqual(prepareStart(null, idle, config, idle.getSnapshot(0), false), { config, lastWriteOk: false });
  });
});

// review fix #7 (adjustable-durations AC-08): the helpers that can write are reachable
// only from the legitimate read points — a new caller would be a new write trigger.
describe('duration write-guard reader call sites (adjustable-durations review fix)', () => {
  const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src');
  // Line comments are blanked out so a comment that merely names a helper is not
  // mistaken for a call site.
  const stripComments = (text) => text.replace(/\/\/.*$/gm, '');
  const uiContents = stripComments(readFileSync(path.join(srcDir, 'ui/index.js'), 'utf8'));
  // Every src/ module other than ui/index.js, found recursively — a new module that
  // imported and called a helper would otherwise go unscanned (re-review fix #3).
  const otherSrc = [];
  (function collect(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) collect(full);
      else if (entry.name.endsWith('.js') && full !== path.join(srcDir, 'ui', 'index.js')) {
        otherSrc.push(stripComments(readFileSync(full, 'utf8')));
      }
    }
  })(srcDir);

  // Names of the functions whose bodies contain a call to name + '('.
  function callersOf(name) {
    const callers = [];
    const declaration = /function (\w+)\s*\(/g;
    const starts = [...uiContents.matchAll(declaration)].map((m) => ({ fn: m[1], at: m.index }));
    let index = uiContents.indexOf(name + '(');
    while (index !== -1) {
      const enclosing = starts.filter((s) => s.at < index).pop();
      const isDeclaration = uiContents.slice(index - 'function '.length, index) === 'function ';
      if (!isDeclaration) callers.push(enclosing ? enclosing.fn : '<top level>');
      index = uiContents.indexOf(name + '(', index + 1);
    }
    return callers.sort();
  }

  test('readPersistedDurationConfig is called only by syncConfigFromStorage', () => {
    assert.deepEqual(callersOf('readPersistedDurationConfig'), ['syncConfigFromStorage']);
  });

  test('syncConfigFromStorage is called only by mount (load) and prepareStart (pre-start)', () => {
    assert.deepEqual(callersOf('syncConfigFromStorage'), ['mount', 'prepareStart']);
  });

  test('prepareStart is called only by refreshConfigFromStorage (the Start handler path)', () => {
    assert.deepEqual(callersOf('prepareStart'), ['refreshConfigFromStorage']);
  });

  // break-flow T6 (sad.md §5, ADR-0003): the pre-start correction is re-pinned from the
  // single Start click handler to the legitimate fresh-start triggers — the Start break and
  // Start focus handlers, plus (T7) the auto-start step's prepareAutoStart.
  test('refreshConfigFromStorage (the pre-start correction) is called only by the Start break and Start focus handlers and the auto-start step', () => {
    assert.deepEqual(callersOf('refreshConfigFromStorage'), ['handleStartBreak', 'handleStartFocus', 'prepareAutoStart']);
  });

  test('each of those handlers unlocks sound first, then corrects, then starts — in that order', () => {
    for (const [handler, engineCall] of [
      ['handleStartBreak', 'engine.start('],
      ['handleStartFocus', 'engine.startFocus('],
    ]) {
      const match = uiContents.match(new RegExp('function ' + handler + '\\(\\) \\{([\\s\\S]*?)\\n {2}\\}'));
      assert.notEqual(match, null, handler + ' not found');
      const body = match[1];
      const unlock = body.indexOf('unlockSound(');
      const correct = body.indexOf('refreshConfigFromStorage(');
      const start = body.indexOf(engineCall);
      assert.equal(unlock !== -1 && unlock < correct && correct < start, true, handler + ': unlockSound -> correction -> ' + engineCall);
      assert.equal(body.includes('await'), false, handler + ' must stay synchronous so the audio unlock happens inside the press');
    }
  });

  test('no other src/ module calls the duration read/write helpers', () => {
    assert.equal(otherSrc.length >= 2, true, 'expected to scan at least logic/index.js and main.js');
    for (const text of otherSrc) {
      assert.equal(
        /\b(readPersistedDurationConfig|syncConfigFromStorage|persistDurationConfig|prepareStart|refreshConfigFromStorage)\(/.test(text),
        false,
      );
    }
  });
});

// break-flow T5 (sad.md §8 Persistence, AC-09/AC-12): persistBreakFlowSettings is the only
// writer of the two break-flow keys, and the settings are read only at mount.
describe('break-flow write-guard (T5)', () => {
  const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src');
  const stripComments = (text) => text.replace(/\/\/.*$/gm, '');
  const uiContents = stripComments(readFileSync(path.join(srcDir, 'ui/index.js'), 'utf8'));

  function bodyOf(name) {
    const from = uiContents.indexOf('export function ' + name);
    assert.notEqual(from, -1, name + ' not found');
    const open = uiContents.indexOf('{', from);
    let depth = 0;
    for (let i = open; i < uiContents.length; i += 1) {
      if (uiContents[i] === '{') depth += 1;
      if (uiContents[i] === '}') {
        depth -= 1;
        if (depth === 0) return uiContents.slice(from, i + 1);
      }
    }
    throw new Error('unterminated ' + name);
  }

  test('both break-flow keys are written inside persistBreakFlowSettings and nowhere else', () => {
    const body = bodyOf('persistBreakFlowSettings');
    assert.equal((body.match(/\.setItem\(/g) || []).length, 2);
    for (const key of ['AUTO_START_BREAKS_KEY', 'ALLOW_PAUSING_FOCUS_KEY']) {
      assert.equal(body.includes(key), true, key + ' is not written by persistBreakFlowSettings');
      const writes = uiContents.match(new RegExp('setItem\\(\\s*' + key + '\\b', 'g')) || [];
      assert.equal(writes.length, 1, key + ' must be the argument of exactly one setItem call');
    }
  });

  test('the other gatekeepers never write the break-flow keys', () => {
    for (const name of ['persistState', 'persistDurationConfig']) {
      const body = bodyOf(name);
      assert.equal(/AUTO_START_BREAKS_KEY|ALLOW_PAUSING_FOCUS_KEY|break-flow:/.test(body), false, name);
    }
  });

  test('readPersistedBreakFlowSettings is called only once, by mount (load) — no other read point (AC-12)', () => {
    const calls = (uiContents.match(/\breadPersistedBreakFlowSettings\(/g) || []).length - 1; // minus the declaration
    assert.equal(calls, 1);
    const mountAt = uiContents.indexOf('export function mount');
    assert.equal(uiContents.indexOf('readPersistedBreakFlowSettings(', mountAt) > mountAt, true);
  });

  test('persistBreakFlowSettings is called only from the toggle change handler', () => {
    const calls = (uiContents.match(/\bpersistBreakFlowSettings\(/g) || []).length - 1; // minus the declaration
    assert.equal(calls, 1);
    const handler = uiContents.match(/function commitBreakFlowSettings\b[\s\S]*?\n {2}\}/);
    assert.notEqual(handler, null, 'commitBreakFlowSettings not found');
    assert.equal(handler[0].includes('persistBreakFlowSettings('), true);
  });

  test('the engine learns Allow pausing focus at mount and on every toggle — and nowhere else', () => {
    const calls = (uiContents.match(/\bengine\.setAllowPausingFocus\(/g) || []).length;
    assert.equal(calls, 2, 'once at mount, once in the toggle handler');
    const handler = uiContents.match(/function commitBreakFlowSettings\b[\s\S]*?\n {2}\}/);
    assert.equal(handler[0].includes('engine.setAllowPausingFocus('), true);
  });
});

describe('prepareStart — a fresh Focus started from a break (break-flow T6)', () => {
  const MIN = 60 * 1000;

  function runningBreak() {
    const engine = createTimerEngine();
    engine.start(0);
    engine.getSnapshot(25 * MIN); // Focus completes; the short break waits
    engine.start(25 * MIN); // Start break
    return engine;
  }

  test('with freshStart the correction runs even though the displayed break is running, and the break is untouched', () => {
    const storage = recordingStorage();
    const engine = runningBreak();
    const config = syncConfigFromStorage(storage, engine);
    storage.setItem('adjustable-durations:focus-duration', '0'); // invalid between load and the press
    const snapshot = engine.getSnapshot(25 * MIN + 10_000);
    assert.equal(snapshot.idle, false);
    const next = prepareStart(storage, engine, config, snapshot, true, true);
    assert.equal(next.config.focus, 25);
    assert.equal(storage.getItem('adjustable-durations:focus-duration'), '25');
    // the running break keeps its pinned length and remaining time
    const after = engine.getSnapshot(25 * MIN + 10_000);
    assert.equal(after.phase, 'short_break');
    assert.equal(after.running, true);
    assert.equal(after.remainingMs, 5 * MIN - 10_000);
  });

  test('without freshStart a running break is still not a fresh start (Resume path unchanged)', () => {
    const storage = recordingStorage();
    const engine = runningBreak();
    const config = syncConfigFromStorage(storage, engine);
    storage.setItem('adjustable-durations:focus-duration', '0');
    storage.writes.length = 0;
    const snapshot = engine.getSnapshot(25 * MIN + 10_000);
    assert.deepEqual(prepareStart(storage, engine, config, snapshot, true), { config, lastWriteOk: true });
    assert.deepEqual(storage.writes, []);
  });

  test('a fresh Focus started via the corrected config runs the Configured focus duration', () => {
    const storage = recordingStorage({ 'adjustable-durations:focus-duration': '40' });
    const engine = runningBreak();
    const config = syncConfigFromStorage(storage, engine);
    prepareStart(storage, engine, config, engine.getSnapshot(25 * MIN + 10_000), true, true);
    engine.startFocus(25 * MIN + 10_000);
    assert.equal(engine.getSnapshot(25 * MIN + 10_000).remainingMs, 40 * MIN);
  });
});

// break-flow T6 (sad.md §5/§6 Flows 2-4, ADR-0003): how the page routes the slot actions.
describe('phase-labelled controls wiring (break-flow T6)', () => {
  const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src');
  const uiContents = readFileSync(path.join(srcDir, 'ui/index.js'), 'utf8').replace(/\/\/.*$/gm, '');

  function bodyOfInner(name) {
    const match = uiContents.match(new RegExp('function ' + name + '\\(\\) \\{([\\s\\S]*?)\\n {2}\\}'));
    assert.notEqual(match, null, name + ' not found');
    return match[1];
  }

  test('the old Start/Pause/Reset buttons, controlStates and refocusIfStranded are gone from the page', () => {
    for (const gone of ['controlStates', 'refocusIfStranded', 'startBtn', 'pauseBtn', 'resetBtn']) {
      assert.equal(uiContents.includes(gone), false, gone + ' is still referenced in src/ui/index.js');
    }
  });

  test('mount builds createControls and render() paints controlLayout(display, now) — the display snapshot', () => {
    assert.equal(/createControls\(/.test(uiContents), true);
    assert.equal(/controls\.update\(\s*controlLayout\(display, now\)/.test(uiContents), true);
  });

  test('every layout action has a handler', () => {
    const table = uiContents.match(/const ACTION_HANDLERS = \{([\s\S]*?)\n {2}\};/);
    assert.notEqual(table, null, 'ACTION_HANDLERS not found');
    for (const action of Object.keys(CONTROL_LABELS)) {
      assert.equal(new RegExp('\\b' + action + ':').test(table[1]), true, 'no handler for ' + action);
    }
  });

  test('Start focus, Start break and Resume (focus and break) unlock sound synchronously inside the press', () => {
    for (const handler of ['handleStartFocus', 'handleStartBreak', 'handleResume']) {
      const body = bodyOfInner(handler);
      assert.equal(body.includes('unlockSound('), true, handler);
      assert.equal(body.includes('await'), false, handler);
    }
  });

  test('Pause and Reset never unlock sound or touch storage; each ends with render + wake-up sync', () => {
    for (const handler of ['handlePause', 'handleReset']) {
      const body = bodyOfInner(handler);
      assert.equal(body.includes('unlockSound('), false, handler);
      assert.equal(/refreshConfigFromStorage|persist/.test(body), false, handler);
    }
    const finish = uiContents.match(/function afterAction\(\) \{([\s\S]*?)\n {2}\}/);
    assert.notEqual(finish, null, 'afterAction not found');
    assert.equal(finish[1].includes('render()') && finish[1].includes('syncWakeup('), true);
  });

  test('a waiting Focus is started through engine.start, a break is ended through engine.startFocus', () => {
    const body = bodyOfInner('handleStartFocus');
    assert.equal(/engine\.start\(/.test(body) && /engine\.startFocus\(/.test(body), true);
  });
});
