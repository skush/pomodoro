import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { persistState, readPersistedState } from '../../src/ui/index.js';

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
  test('every storage-write call anywhere in src/ lives inside persistState, and persistState is called only by its three legitimate triggers', () => {
    const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src');
    const writeCallPattern = /\.(setItem|removeItem|clear)\(|localStorage\s*[.[]/g;

    const uiPath = path.join(srcDir, 'ui/index.js');
    const uiContents = readFileSync(uiPath, 'utf8');

    const writerStart = uiContents.indexOf('export function persistState');
    assert.notEqual(writerStart, -1, 'persistState function not found in src/ui/index.js');
    const afterWriter = uiContents.slice(writerStart);
    const bodyStart = afterWriter.indexOf('{');
    let depth = 0;
    let bodyEnd = -1;
    for (let i = bodyStart; i < afterWriter.length; i += 1) {
      if (afterWriter[i] === '{') depth += 1;
      if (afterWriter[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          bodyEnd = i + 1;
          break;
        }
      }
    }
    const writerBody = afterWriter.slice(0, bodyEnd);

    function writeCallCount(text) {
      return (text.match(writeCallPattern) || []).length;
    }

    const logicPath = path.join(srcDir, 'logic/index.js');
    const otherFiles = [readFileSync(logicPath, 'utf8'), uiContents.slice(0, writerStart) + uiContents.slice(writerStart + writerBody.length)];

    assert.equal(writeCallCount(writerBody) > 0, true, 'persistState itself has no storage-write call — the test would pass vacuously');
    for (const text of otherFiles) {
      assert.equal(writeCallCount(text), 0, 'a storage-write call exists outside persistState — the single legitimate write path AC-07 requires');
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
