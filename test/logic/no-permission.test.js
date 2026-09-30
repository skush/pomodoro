import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// sensory-feedback T18 (spec.md AC-12): the feature must never ask the browser for a
// permission. The e2e check can only read Notification.permission (headless browsers
// raise no prompts), so this scan guards the whole API family statically.

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');
const FORBIDDEN = [
  { token: 'requestPermission', re: /requestPermission/ },
  { token: 'getUserMedia', re: /getUserMedia/ },
  { token: 'navigator.permissions', re: /navigator\s*\.\s*permissions/ },
  { token: 'Notification(', re: /\bnew\s+Notification\s*\(|\bNotification\s*\(/ },
];

function jsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return jsFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

function findViolations(name, text) {
  const hits = [];
  text.split('\n').forEach((line, i) => {
    for (const { token, re } of FORBIDDEN) {
      if (re.test(line)) hits.push(`${name}:${i + 1} uses ${token}`);
    }
  });
  return hits;
}

describe('no permission-requesting API under src/ (AC-12)', () => {
  test('the matcher flags every forbidden token (positive control)', () => {
    for (const sample of [
      'Notification.requestPermission()',
      'navigator.mediaDevices.getUserMedia({ audio: true })',
      'navigator.permissions.query({ name: "notifications" })',
      'new Notification("done")',
    ]) {
      assert.ok(findViolations('sample.js', sample).length > 0, sample);
    }
  });

  test('the matcher ignores a plain read of Notification.permission', () => {
    assert.deepEqual(findViolations('sample.js', 'const p = Notification.permission;'), []);
  });

  test('no file under src/ requests a browser permission', () => {
    const files = jsFiles(SRC);
    assert.ok(files.length > 0);
    const violations = files.flatMap((f) => findViolations(path.relative(SRC, f), readFileSync(f, 'utf8')));
    assert.deepEqual(violations, []);
  });
});
