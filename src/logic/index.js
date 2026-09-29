// Pure timer engine: phase/cycle state machine driven by an absolute wall-clock
// deadline (docs/features/core-timer/adr/0001-wall-clock-deadline-timing.md), not a
// per-tick counter. No DOM, no timers, no browser APIs — every function takes `now`
// (a Date.now()-style timestamp in ms) explicitly.

export const PHASES = Object.freeze({
  FOCUS: 'focus',
  SHORT_BREAK: 'short_break',
  LONG_BREAK: 'long_break',
});

const MS_PER_MINUTE = 60 * 1000;

// adjustable-durations: classic defaults, in whole minutes — the fallback for any
// missing/invalid stored value (validateStoredDuration) and the engine's initial config.
export const DEFAULT_DURATIONS_MIN = Object.freeze({ focus: 25, shortBreak: 5, longBreak: 15 });

const DURATION_KEY_FOR_PHASE = {
  [PHASES.FOCUS]: 'focus',
  [PHASES.SHORT_BREAK]: 'shortBreak',
  [PHASES.LONG_BREAK]: 'longBreak',
};

function isPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

// Clamps a deadline-minus-now reading to [0, the phase's pinned full duration].
// Without the upper clamp, a backward wall-clock jump (manual change, NTP
// correction) while a phase is running would show more than the phase's own full
// duration.
function clampRemaining(fullMs, remainingMs) {
  return Math.min(fullMs, Math.max(0, remainingMs));
}

// createTimerEngine() -> { start, pause, reset, getSnapshot, setConfiguredDurations,
// setCycleLength } is the module's only
// stateful export (AC-03: the engine only ever changes in response to these
// methods, called only by src/ui/, never from a 'message' listener or any other
// input source). Other exports (PHASES, controlStates, formatDuration) are frozen
// constants or pure functions with no access to engine state, so they cannot
// widen the guard (ADR-0002).
export function createTimerEngine() {
  let phase = PHASES.FOCUS;
  let running = false;
  let deadlineAt = null;
  // adjustable-durations: the live Configured durations (minutes) — read only when a
  // phase starts fresh. A started phase keeps `phaseFullMs`, the full duration
  // pinned when it entered its idle state, so a later commit never touches it.
  const configured = { ...DEFAULT_DURATIONS_MIN };
  function configuredMs(forPhase) {
    return configured[DURATION_KEY_FOR_PHASE[forPhase]] * MS_PER_MINUTE;
  }
  let phaseFullMs = configuredMs(phase);
  let remainingMs = phaseFullMs;
  // false while the phase is idle (never started since it began or was reset);
  // true once started, running or paused. Only an idle phase follows live config.
  let phaseStarted = false;
  let focusCount = 0;
  const cycleLength = 4; // T2 makes this configurable
  // session-tracking ADR-0001: the true wall-clock moment a Focus phase's deadline
  // passed, latched here (not in getSnapshot) so it survives regardless of which
  // public method's settle() call detects the transition. getSnapshot() consumes
  // and clears it exactly once.
  let justCompletedFocusAt = null;

  // Advances at most one phase boundary if the running phase's deadline has
  // passed. Any further elapsed time beyond that single boundary is discarded
  // (AC-05) — the new phase starts idle, so no chain of unattended transitions.
  function settle(now) {
    if (!running || now < deadlineAt) return;

    if (phase === PHASES.FOCUS) {
      focusCount += 1;
      justCompletedFocusAt = deadlineAt;
    }
    phase =
      phase === PHASES.FOCUS
        ? focusCount >= cycleLength
          ? PHASES.LONG_BREAK
          : PHASES.SHORT_BREAK
        : PHASES.FOCUS;
    if (phase === PHASES.LONG_BREAK) {
      focusCount = 0;
    }

    running = false;
    deadlineAt = null;
    phaseStarted = false;
    phaseFullMs = configuredMs(phase);
    remainingMs = phaseFullMs;
  }

  function start(now) {
    settle(now);
    if (running) return; // AC-01b: already running — no-op, no reset
    deadlineAt = now + remainingMs;
    running = true;
    phaseStarted = true;
  }

  function pause(now) {
    settle(now);
    if (!running) return; // AC-02b: not running — no-op
    remainingMs = clampRemaining(phaseFullMs, deadlineAt - now);
    running = false;
    deadlineAt = null;
  }

  function reset(now) {
    settle(now);
    running = false;
    deadlineAt = null;
    phaseStarted = false;
    phaseFullMs = configuredMs(phase);
    remainingMs = phaseFullMs;
  }

  // adjustable-durations (spec.md AC-03/04/04b/05/07): stores the new Configured
  // durations (whole minutes; a missing or non-positive value keeps its current
  // setting — validation proper lives in the UI/validators). An idle phase shows the
  // new value at once; a running or paused phase is untouched and picks it up at
  // its next fresh start. Never touches focusCount.
  function setConfiguredDurations(next) {
    if (next === null || typeof next !== 'object') return;
    for (const key of Object.keys(configured)) {
      if (isPositiveNumber(next[key])) configured[key] = next[key];
    }
    if (!phaseStarted) {
      phaseFullMs = configuredMs(phase);
      remainingMs = phaseFullMs;
    }
  }

  function getSnapshot(now) {
    settle(now);
    const remaining = running ? clampRemaining(phaseFullMs, deadlineAt - now) : remainingMs;
    const consumedCompletion = justCompletedFocusAt;
    justCompletedFocusAt = null;
    return Object.freeze({
      phase,
      running,
      remainingMs: remaining,
      focusCount,
      justCompletedFocusAt: consumedCompletion,
    });
  }

  return Object.freeze({ start, pause, reset, getSnapshot, setConfiguredDurations });
}

// Pure control-enablement mapping (AC-02): the Pause control is disabled
// whenever the timer is not running. Kept here, not in src/ui/, so it is
// unit-testable without a DOM.
export function controlStates(snapshot) {
  return Object.freeze({
    startDisabled: snapshot.running,
    pauseDisabled: !snapshot.running,
  });
}

// session-tracking T2 (spec.md AC-06/AC-06b): pure data-in/data-out, no engine-state
// access — kept here so it's unit-testable under plain Node, same reasoning as
// formatDuration/controlStates. Formats a ms timestamp as the LOCAL calendar day,
// lexicographically sortable so string comparison equals date-order comparison.
export function localDateString(ms) {
  const d = new Date(ms);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

// session-tracking T2 (spec.md AC-06/AC-06b, sad.md §4 point 7): whether the
// tracked day should roll forward. Compares the real current date against the
// stored date ONLY — never a completing session's own day (that is a separate
// comparison, done by the caller). Only ever resets forward: a stored date later
// than now's (a backward clock/date change, AC-06b) never rolls over.
export function shouldRollover(storedDate, now) {
  if (!storedDate) return true; // no prior date — force a fresh rollover
  return localDateString(now) > storedDate;
}

const TASK_LABEL_MAX_LENGTH = 100;
const STORED_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// session-tracking T3 (spec.md AC-02, §6 NFR "Task label length limit"): a hard
// stop at 100 raw characters — never a post-hoc truncation. `nextValue` is what
// the input's value would become after the browser applies the keystroke/paste;
// if it would exceed the limit the whole attempt is rejected, reverting to
// `previousValue` unchanged (a paste is never truncated to fit).
export function validateLabelInput(previousValue, nextValue) {
  if (nextValue.length > TASK_LABEL_MAX_LENGTH) {
    return { value: previousValue, rejected: true };
  }
  return { value: nextValue, rejected: false };
}

// session-tracking T3 (spec.md §6 NFR "Corrupted or missing persisted state"):
// pure per-field fallback — each field defaults independently, 0 exceptions
// thrown across missing/malformed/wrong-type stored data.
export function validateStoredCount(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return 0;
  return n;
}

// review fix (CHANGES REQUESTED, stage-2): format-matching alone accepts
// calendar-impossible values like '2026-13-45' — JS Date silently rolls those
// over, so re-deriving the date string and requiring it round-trip back to
// `raw` rejects anything the format regex alone would let through.
export function validateStoredDate(raw) {
  if (typeof raw !== 'string' || !STORED_DATE_PATTERN.test(raw)) return null;
  const [year, month, day] = raw.split('-').map(Number);
  const roundTripped = localDateString(new Date(year, month - 1, day).getTime());
  return roundTripped === raw ? raw : null;
}

// review fix (CHANGES REQUESTED, AC-02): a stored label over the 100-char limit
// (written by devtools or another tab) must not be loaded as-is — AC-02 already
// requires the field to never exceed 100 characters, and validateLabelInput
// rejects any edit that would keep an already-over-limit value above the limit,
// including Backspace. Falling back to empty (the same NFR fallback as a
// corrupted value) keeps the field editable.
export function validateStoredLabel(raw) {
  if (typeof raw !== 'string' || raw.length > TASK_LABEL_MAX_LENGTH) return '';
  return raw;
}

// review fix (CHANGES REQUESTED, T6 DoD): the day-rollover + completion-crediting
// decision src/ui/index.js's updateSessionCount() used to re-implement inline.
// Extracted here so it's the SAME code a test calls and the UI wires — a broken
// wiring can no longer hide behind a test that merely copies the logic.
export function applyCountUpdate(state, now, justCompletedFocusAt) {
  let { trackedDate, count } = state;
  if (shouldRollover(trackedDate, now)) {
    trackedDate = localDateString(now);
    count = 0;
  }
  if (justCompletedFocusAt !== null && localDateString(justCompletedFocusAt) === trackedDate) {
    count += 1;
  }
  return { trackedDate, count };
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
