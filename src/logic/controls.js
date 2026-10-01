// break-flow: pure rules for the break-flow controls — the On-time tolerance, the Skip
// guard and the fail-soft stored-toggle reading. Every rule is a pure function of
// wall-clock timestamps passed in as `now`; no DOM, no timers, no browser APIs.

// spec.md §6: a Focus completion noticed <= 5 s after its true end is On-time and
// auto-starts the break; later is late and leaves the break waiting.
export const ON_TIME_TOLERANCE_MS = 5000;
// sensory-feedback AC-06b (owner decision 2026-10-01): a completion noticed more than 2
// minutes after its true moment is stale — the User has been away (device sleep, frozen
// tab), so it plays no chime and shows no sound-unavailable notice. The page cannot tell a
// sleep from a freeze, only how late it is; a hidden tab throttled by up to about a minute
// still chimes.
export const STALE_COMPLETION_MS = 120000;
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

// AC-06b: `at` is the phase's true end, `now` when it was noticed. A clock that is missing
// or went backwards is never stale, so such a completion keeps its chime.
export function isStaleCompletion(at, now) {
  if (!Number.isFinite(at) || !Number.isFinite(now)) return false;
  return now - at > STALE_COMPLETION_MS;
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

// AC-10: every control names the phase it acts on — no bare "Start"/"Pause"/"Resume"/"Reset".
export const CONTROL_LABELS = Object.freeze({
  startFocus: 'Start focus',
  pauseFocus: 'Pause focus',
  resumeFocus: 'Resume focus',
  resetFocus: 'Reset focus',
  startBreak: 'Start break',
  pauseBreak: 'Pause break',
  resumeBreak: 'Resume break',
  resetBreak: 'Reset break',
});

function layout(main, side = [], mainGreyed = false) {
  return Object.freeze({ main, side: Object.freeze(side), mainGreyed });
}

// AC-06/AC-08/AC-10: the controls a snapshot shows, as {main, side: [a, b], mainGreyed}.
// `main` is the action in the main position (null = empty), `side` the up-to-two actions
// beside it, `mainGreyed` true only for Start focus inside the Skip guard. A slot with no
// action is simply absent — a control the settings never allow is hidden, not greyed.
//
// The arrangement keeps the pause toggle always at side[0] and Reset break always at
// side[1] (a pause/resume pair therefore shares one slot, AC-11), so after Reset break
// the Start focus beside Start break sits at side[0] — never where Reset break was.
// Reset focus always sits in side[1], never side[0], so it never shares a slot with the
// Start focus of a waiting break: a double-click cannot start a Focus and then discard it.
// A paused Focus keeps Resume + Reset even if the policy has since gone off: a phase in
// progress is never altered by a setting.
export function controlLayout(snapshot, now) {
  if (!snapshot || typeof snapshot !== 'object') return layout('startFocus');
  const { phase, running } = snapshot;
  const waiting = snapshot.idle === true;

  if (phase === 'focus' || phase === undefined) {
    if (waiting) return layout('startFocus');
    if (running) return layout(snapshot.allowPausingFocus ? 'pauseFocus' : null, [null, 'resetFocus']);
    return layout('resumeFocus', [null, 'resetFocus']);
  }

  if (waiting) return layout('startBreak', ['startFocus']);
  return layout('startFocus', [running ? 'pauseBreak' : 'resumeBreak', 'resetBreak'], isSkipGuardActive(snapshot, now));
}
