// sensory-feedback: pure cue rules — which tone plays, how full the Progress ring is,
// and what the Tab title mirror says. Everything here is a pure function of a timer
// snapshot (or frozen data); no DOM, no Web Audio, no timers. src/ui/ only plays or
// draws what these return (docs/features/sensory-feedback/sad.md §4 decision 6).

// Phase keys are the engine's PHASES values, written as literals here because index.js
// re-exports this module (importing PHASES back would be a load-order cycle).
const FOCUS = 'focus';
const SHORT_BREAK = 'short_break';
const LONG_BREAK = 'long_break';

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;

const PHASE_LABELS = Object.freeze({
  [FOCUS]: 'Focus',
  [SHORT_BREAK]: 'Short break',
  [LONG_BREAK]: 'Long break',
});

function note(frequency, start, duration, peakGain) {
  return Object.freeze({ frequency, start, duration, peakGain });
}

// Tones as note lists: frequency in Hz, start offset and duration in seconds, peak gain
// as a fraction of full scale. Each tone lasts <= 2 s and peaks <= 0.3 (spec.md §6);
// Focus-end rises (C5 E5 G5), break-end falls (G5 C5) — so they differ in melodic
// direction AND note count (AC-05). Changing the tone character is a data-only edit.
export const TONES = Object.freeze({
  focusEnd: Object.freeze([note(523.25, 0, 0.25, 0.2), note(659.25, 0.25, 0.25, 0.2), note(783.99, 0.5, 0.6, 0.2)]),
  breakEnd: Object.freeze([note(783.99, 0, 0.3, 0.2), note(523.25, 0.3, 0.7, 0.2)]),
});

// AC-05: a Focus completion plays the Focus-end tone, either break the break-end tone.
export function toneFor(phase) {
  return phase === FOCUS ? TONES.focusEnd : TONES.breakEnd;
}

function validSnapshot(snapshot) {
  return (
    snapshot !== null &&
    typeof snapshot === 'object' &&
    Number.isFinite(snapshot.remainingMs) &&
    Number.isFinite(snapshot.phaseFullMs) &&
    snapshot.phaseFullMs > 0
  );
}

// The remaining fraction of the phase, for the Progress ring: the remaining WHOLE
// second (what the countdown shows, see formatDuration) over the phase's pinned full
// length, clamped to [0, 1]. Bad input reads as a full ring (fail-soft).
export function ringFraction(snapshot) {
  if (!validSnapshot(snapshot)) return 1;
  const shownMs = Math.ceil(Math.max(0, snapshot.remainingMs) / MS_PER_SECOND) * MS_PER_SECOND;
  return Math.min(1, shownMs / snapshot.phaseFullMs);
}

// The Tab title mirror (AC-04): whole minutes rounded up (never 0 while time is left),
// the phase name, and the state — running shows no marker, paused and waiting-for-Start
// are marked. `screens.md` does not exist, so this wording is owned here.
export function tabTitle(snapshot) {
  const label = snapshot && PHASE_LABELS[snapshot.phase] ? PHASE_LABELS[snapshot.phase] : 'Pomodoro';
  const remainingMs = snapshot && Number.isFinite(snapshot.remainingMs) ? Math.max(0, snapshot.remainingMs) : 0;
  const text = `${Math.ceil(remainingMs / MS_PER_MINUTE)} min · ${label}`;
  if (!snapshot) return text;
  if (snapshot.running) return text;
  return snapshot.idle ? `Ready · ${text}` : `Paused · ${text}`;
}
