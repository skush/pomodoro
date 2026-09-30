import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRing } from '../../src/ui/ring.js';

// sensory-feedback T5: createRing() against a minimal fake DOM (no browser needed).
function fakeDocument() {
  const make = (tag) => ({
    tag,
    attrs: {},
    children: [],
    setAttribute(k, v) {
      this.attrs[k] = String(v);
    },
    getAttribute(k) {
      return this.attrs[k];
    },
    append(...kids) {
      this.children.push(...kids);
    },
    style: {},
  });
  return { createElement: (t) => make(t), createElementNS: (_ns, t) => make(t) };
}

const find = (el, cls) => {
  if (el.attrs.class === cls) return el;
  for (const c of el.children) {
    const hit = find(c, cls);
    if (hit) return hit;
  }
  return null;
};

describe('createRing (AC-01, AC-02, AC-03)', () => {
  test('builds an SVG track + arc inside a .progress-ring element, full and focus-coloured at first', () => {
    const ring = createRing(fakeDocument());
    assert.equal(ring.element.attrs.class, 'progress-ring');
    assert.equal(ring.element.attrs['data-phase'], 'focus');
    assert.ok(find(ring.element, 'ring-track'));
    const arc = find(ring.element, 'ring-arc');
    assert.ok(arc);
    assert.equal(Number(arc.attrs['stroke-dashoffset']), 0);
  });

  test('the ring is decorative for assistive tech (phase name stays visible text)', () => {
    const ring = createRing(fakeDocument());
    assert.equal(ring.element.attrs['aria-hidden'], 'true');
  });

  test('update sets the arc length through stroke-dashoffset and the phase through data-phase', () => {
    const ring = createRing(fakeDocument());
    const arc = find(ring.element, 'ring-arc');
    const circumference = Number(arc.attrs['stroke-dasharray']);
    assert.ok(circumference > 0);
    ring.update(0.25, 'short_break');
    assert.ok(Math.abs(Number(arc.attrs['stroke-dashoffset']) - circumference * 0.75) < 1e-6);
    assert.equal(ring.element.attrs['data-phase'], 'short_break');
    ring.update(0, 'long_break');
    assert.ok(Math.abs(Number(arc.attrs['stroke-dashoffset']) - circumference) < 1e-6);
    assert.equal(ring.element.attrs['data-phase'], 'long_break');
    ring.update(1, 'focus');
    assert.equal(Number(arc.attrs['stroke-dashoffset']), 0);
  });

  test('fail-soft: clamps to [0, 1], treats NaN as full, ignores an unknown phase', () => {
    const ring = createRing(fakeDocument());
    const arc = find(ring.element, 'ring-arc');
    const c = Number(arc.attrs['stroke-dasharray']);
    ring.update(7, 'focus');
    assert.equal(Number(arc.attrs['stroke-dashoffset']), 0);
    ring.update(-3, 'focus');
    assert.ok(Math.abs(Number(arc.attrs['stroke-dashoffset']) - c) < 1e-6);
    ring.update(NaN, 'focus');
    assert.equal(Number(arc.attrs['stroke-dashoffset']), 0);
    ring.update(0.5, 'short_break');
    ring.update(0.5, 'not-a-phase');
    assert.equal(ring.element.attrs['data-phase'], 'short_break'); // kept, never thrown
    assert.doesNotThrow(() => ring.update(undefined, undefined));
  });
});
