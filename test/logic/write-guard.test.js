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
  test('writes exactly the patch given — a plain overwrite, never a merge', () => {
    const storage = fakeStorage();
    persistState(storage, { count: 5, date: '2026-09-27', label: 'old' });
    persistState(storage, { count: 0, date: '2026-09-28' }); // label deliberately not in this patch
    assert.deepEqual(readPersistedState(storage), { count: 0, date: '2026-09-28', label: 'old' });
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
});

// AC-07's structural guarantee: no code path other than persistState may ever
// call the storage-write API — mirrors core-timer's own AC-03 source-scan test
// (test/logic/timer-engine.test.js), a static property of the code rather than a
// runtime race to reproduce.
describe('write-guard structural check (session-tracking T4, AC-07)', () => {
  test('every .setItem( call site in src/ui/index.js lives inside persistState', () => {
    const uiPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/ui/index.js');
    const contents = readFileSync(uiPath, 'utf8');

    const writerStart = contents.indexOf('export function persistState');
    assert.notEqual(writerStart, -1, 'persistState function not found in src/ui/index.js');

    const afterWriter = contents.slice(writerStart);
    const nextExportOffset = afterWriter.indexOf('\nexport function', 1);
    const writerBody = nextExportOffset === -1 ? afterWriter : afterWriter.slice(0, nextExportOffset);

    const totalSetItemCalls = (contents.match(/\.setItem\(/g) || []).length;
    const writerSetItemCalls = (writerBody.match(/\.setItem\(/g) || []).length;

    assert.equal(
      totalSetItemCalls,
      writerSetItemCalls,
      'a .setItem( call exists outside persistState — the single legitimate write path AC-07 requires',
    );
  });
});
