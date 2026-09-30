// sensory-feedback: the Progress ring — an inline SVG track + arc. The arc length is set
// through stroke-dashoffset from a 0..1 fraction (src/logic/feedback.js ringFraction),
// and the phase colour through a data-phase attribute that src/styles.css maps to a
// token. No JS animation: the short smoothing transition, and its removal under
// prefers-reduced-motion, live in CSS (docs/features/sensory-feedback/sad.md §8 Motion).

const SVG_NS = 'http://www.w3.org/2000/svg';
const RADIUS = 45;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const KNOWN_PHASES = new Set(['focus', 'short_break', 'long_break']);

function clampFraction(fraction) {
  if (!Number.isFinite(fraction)) return 1; // fail-soft: unreadable input reads as a full ring
  return Math.min(1, Math.max(0, fraction));
}

export function createRing(doc = document) {
  const element = doc.createElement('div');
  element.setAttribute('class', 'progress-ring');
  element.setAttribute('data-phase', 'focus');
  // Decorative: the phase name and the countdown stay visible text (AC-03).
  element.setAttribute('aria-hidden', 'true');

  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('focusable', 'false');

  const circle = (cls) => {
    const c = doc.createElementNS(SVG_NS, 'circle');
    c.setAttribute('class', cls);
    c.setAttribute('cx', '50');
    c.setAttribute('cy', '50');
    c.setAttribute('r', String(RADIUS));
    c.setAttribute('stroke-width', '6');
    return c;
  };
  const track = circle('ring-track');
  const arc = circle('ring-arc');
  arc.setAttribute('stroke-dasharray', String(CIRCUMFERENCE));
  arc.setAttribute('stroke-dashoffset', '0');

  svg.append(track, arc);
  element.append(svg);

  function update(fraction, phase) {
    arc.setAttribute('stroke-dashoffset', String(CIRCUMFERENCE * (1 - clampFraction(fraction))));
    if (KNOWN_PHASES.has(phase)) element.setAttribute('data-phase', phase);
  }

  return { element, update };
}
