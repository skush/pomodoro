// break-flow: pure rules for the break-flow controls — the On-time tolerance, the Skip
// guard and the fail-soft stored-toggle reading. Every rule is a pure function of
// wall-clock timestamps passed in as `now`; no DOM, no timers, no browser APIs.

// spec.md §6: a Focus completion noticed <= 5 s after its true end is On-time and
// auto-starts the break; later is late and leaves the break waiting.
export const ON_TIME_TOLERANCE_MS = 5000;
// spec.md §6: Start focus does nothing for 3 s of real time from the break's start.
export const SKIP_GUARD_MS = 3000;

export const DEFAULT_BREAK_FLOW_SETTINGS = Object.freeze({ autoStartBreaks: true, allowPausingFocus: false });

// AC-01: `at` is the Focus phase's true end, `now` when it was noticed. A backward clock
// (now < at) is never On-time, so a nonsensical clock never auto-starts a break.
export function isOnTimeCompletion(at, now) {
  if (!Number.isFinite(at) || !Number.isFinite(now)) return false;
  const lateness = now - at;
  return lateness >= 0 && lateness <= ON_TIME_TOLERANCE_MS;
}

// AC-05: the guard exists only for a started break (non-null startedAt), is measured in
// real time from startedAt (pausing does not stop it) and never lasts past 3 s. A
// backward clock (now < startedAt) does not hold it open.
export function isSkipGuardActive(snapshot, now) {
  if (!snapshot || snapshot.phase === 'focus') return false;
  const { startedAt } = snapshot;
  if (!Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  const elapsed = now - startedAt;
  return elapsed >= 0 && elapsed < SKIP_GUARD_MS;
}

// AC-09: the stored form is the strings 'true' / 'false'; anything else — missing,
// malformed, another type — reads as `fallback`.
export function validateStoredToggle(raw, fallback) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return fallback;
}
