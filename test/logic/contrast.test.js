import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// sensory-feedback T4 (spec.md §6 "Text contrast" / "Non-text contrast", AC-03, AC-13):
// reads the :root design tokens straight from src/styles.css — the single token
// source — never from a copy, and checks the declared colour pairs against WCAG AA.

const CSS_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/styles.css');
const css = readFileSync(CSS_PATH, 'utf8');

function rootTokens() {
  const block = css.match(/:root\s*\{([^}]*)\}/);
  assert.ok(block, ':root block not found in src/styles.css');
  const tokens = {};
  for (const m of block[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) tokens[m[1]] = m[2].trim();
  return tokens;
}

function hexToRgb(hex) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  assert.ok(m, `token value "${hex}" is not a #hex colour`);
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const tokens = rootTokens();
const token = (name) => {
  assert.ok(tokens[name], `missing :root token --${name}`);
  return tokens[name];
};

// [text token, background token] pairs actually used for text in src/styles.css.
const TEXT_PAIRS = [
  ['fg', 'bg'],
  ['muted', 'bg'], // phase name, labels, validation messages, session count
  ['accent', 'bg'], // countdown (large text, still held to 4.5)
  ['fg', 'control-bg'], // button and field text
  ['muted', 'control-bg'], // placeholder
  ['notice-fg', 'notice-bg'], // sound-unavailable notice
];
const RING_TOKENS = ['ring-focus', 'ring-short-break', 'ring-long-break'];

describe('text contrast (WCAG AA, >= 4.5:1)', () => {
  for (const [fg, bg] of TEXT_PAIRS) {
    test(`--${fg} on --${bg}`, () => {
      const ratio = contrast(token(fg), token(bg));
      assert.ok(ratio >= 4.5, `--${fg} on --${bg} is ${ratio.toFixed(2)}:1`);
    });
  }
});

describe('non-text contrast (WCAG AA, >= 3:1)', () => {
  for (const ring of RING_TOKENS) {
    test(`--${ring} against the page background`, () => {
      const ratio = contrast(token(ring), token('bg'));
      assert.ok(ratio >= 3, `--${ring} on --bg is ${ratio.toFixed(2)}:1`);
    });
    test(`--${ring} (remaining arc) against the elapsed --ring-track`, () => {
      const ratio = contrast(token(ring), token('ring-track'));
      assert.ok(ratio >= 3, `--${ring} on --ring-track is ${ratio.toFixed(2)}:1`);
    });
  }

  test('the focus indicator against the page background and the control background', () => {
    for (const bg of ['bg', 'control-bg']) {
      const ratio = contrast(token('focus'), token(bg));
      assert.ok(ratio >= 3, `--focus on --${bg} is ${ratio.toFixed(2)}:1`);
    }
  });

  test('AC-03: the three phase colours are pairwise different', () => {
    const values = RING_TOKENS.map((t) => token(t).toLowerCase());
    assert.equal(new Set(values).size, 3);
  });
});

describe('motion and layout rules in src/styles.css', () => {
  test('a prefers-reduced-motion block removes ring transitions', () => {
    const block = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?\})\s*\}/);
    assert.ok(block, 'no @media (prefers-reduced-motion: reduce) block');
    assert.match(block[1], /transition:\s*none/);
    assert.match(block[1], /\.ring-arc/);
  });

  test('the ring is fluid so it never exceeds a 320 CSS px screen', () => {
    assert.match(css, /\.progress-ring\s*\{[^}]*width:\s*min\(/);
  });
});
