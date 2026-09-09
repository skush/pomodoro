// Pure timer engine: phase/cycle state machine driven by an absolute wall-clock
// deadline (docs/features/core-timer/adr/0001-wall-clock-deadline-timing.md), not a
// per-tick counter. No DOM, no timers, no browser APIs — every function takes `now`
// (a Date.now()-style timestamp in ms) explicitly.

export const PHASES = Object.freeze({
  FOCUS: 'focus',
  SHORT_BREAK: 'short_break',
  LONG_BREAK: 'long_break',
});

const FOCUS_DURATION_MS = 25 * 60 * 1000;
const SHORT_BREAK_DURATION_MS = 5 * 60 * 1000;
const LONG_BREAK_DURATION_MS = 15 * 60 * 1000;
const FOCUS_SESSIONS_PER_CYCLE = 4;

function durationFor(phase) {
  switch (phase) {
    case PHASES.SHORT_BREAK:
      return SHORT_BREAK_DURATION_MS;
    case PHASES.LONG_BREAK:
      return LONG_BREAK_DURATION_MS;
    case PHASES.FOCUS:
    default:
      return FOCUS_DURATION_MS;
  }
}

// createTimerEngine() -> { start, pause, reset, getSnapshot } — no other exports
// reach mutable state (AC-03: the engine only ever changes in response to these
// four methods, called only by src/ui/, never from a 'message' listener or any
// other input source).
export function createTimerEngine() {
  let phase = PHASES.FOCUS;
  let running = false;
  let deadlineAt = null;
  let remainingMs = durationFor(phase);
  let focusCount = 0;

  // Advances at most one phase boundary if the running phase's deadline has
  // passed. Any further elapsed time beyond that single boundary is discarded
  // (AC-05) — the new phase starts idle, so no chain of unattended transitions.
  function settle(now) {
    if (!running || now < deadlineAt) return;

    if (phase === PHASES.FOCUS) {
      focusCount += 1;
    }
    phase =
      phase === PHASES.FOCUS
        ? focusCount >= FOCUS_SESSIONS_PER_CYCLE
          ? PHASES.LONG_BREAK
          : PHASES.SHORT_BREAK
        : PHASES.FOCUS;
    if (phase === PHASES.LONG_BREAK) {
      focusCount = 0;
    }

    running = false;
    deadlineAt = null;
    remainingMs = durationFor(phase);
  }

  function start(now) {
    settle(now);
    if (running) return; // AC-01b: already running — no-op, no reset
    deadlineAt = now + remainingMs;
    running = true;
  }

  function pause(now) {
    settle(now);
    if (!running) return; // AC-02b: not running — no-op
    remainingMs = Math.max(0, deadlineAt - now);
    running = false;
    deadlineAt = null;
  }

  function reset(now) {
    settle(now);
    running = false;
    deadlineAt = null;
    remainingMs = durationFor(phase);
  }

  function getSnapshot(now) {
    settle(now);
    const remaining = running ? Math.max(0, deadlineAt - now) : remainingMs;
    return Object.freeze({
      phase,
      running,
      remainingMs: remaining,
      focusCount,
    });
  }

  return Object.freeze({ start, pause, reset, getSnapshot });
}

// Pure display formatting (spec §6 NFR): remaining time is always rounded UP to
// the next whole second so the full duration shows immediately and never skips
// to one second less.
export function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
