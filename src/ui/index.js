// DOM layer: renders the phase label + countdown and wires Start/Pause/Reset.
// The only caller of the logic engine's methods (AC-03) — no other input source
// (no window 'message' listener, nothing else) is ever wired to it.

import {
  formatDuration,
  PHASES,
  controlStates,
  validateStoredCount,
  validateStoredDate,
  validateStoredLabel,
  validateLabelInput,
  applyCountUpdate,
} from '../logic/index.js';

const LABEL_PLACEHOLDER = 'What are you focusing on?';
const LABEL_LIMIT_MESSAGE = 'Task label is limited to 100 characters.';

const COUNT_KEY = 'session-tracking:count';
const DATE_KEY = 'session-tracking:date';
const LABEL_KEY = 'session-tracking:label';

// session-tracking T4 (ADR-0002, AC-07): the ONLY function anywhere that may call
// `storage.setItem` for the count/date/label keys — the write guard's single
// choke point. review fix (CHANGES REQUESTED, AC-07): always writes the FULL
// {count, date, label} triple — never a partial patch — so the "overwrite,
// never adopt" guarantee holds for every key on every legitimate write, not
// only the keys that particular trigger happened to touch (a devtools/other-tab
// edit to an untouched key would otherwise survive into the next read). A
// thrown storage error (quota/private-mode/disabled) is swallowed so the app
// keeps running in-memory with nothing shown to the User (spec.md §6 NFR
// "Storage write failure"). `storage` is injected (never the bare `localStorage`
// global read here) so this is callable from plain Node.
export function persistState(storage, state) {
  try {
    storage.setItem(COUNT_KEY, String(state.count));
    storage.setItem(DATE_KEY, state.date);
    storage.setItem(LABEL_KEY, state.label);
  } catch {
    // fail-soft: never throw to the User, never surface an error (spec.md §6 NFR)
  }
}

// review fix (CHANGES REQUESTED, fail-soft): `storage.getItem` itself can throw
// (e.g. Safari private-mode quota) even when acquiring the storage object did
// not — caught per-field so one corrupted/blocked field never blocks the others.
function safeGetItem(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

// session-tracking T4: reads all three persisted fields, each validated through
// its own T3 fallback independently — a corrupted field never blocks the others.
export function readPersistedState(storage) {
  return {
    count: validateStoredCount(safeGetItem(storage, COUNT_KEY)),
    date: validateStoredDate(safeGetItem(storage, DATE_KEY)),
    label: validateStoredLabel(safeGetItem(storage, LABEL_KEY)),
  };
}

// review fix (CHANGES REQUESTED, fail-soft/QG-2 "storage disabled"): merely
// *accessing* window.localStorage throws in browsers that block site storage
// (e.g. Chrome with site data blocked) — this must never propagate out of
// mount() and take the whole timer down with it.
function acquireStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const PHASE_LABELS = {
  [PHASES.FOCUS]: 'Focus',
  [PHASES.SHORT_BREAK]: 'Short break',
  [PHASES.LONG_BREAK]: 'Long break',
};

const RENDER_INTERVAL_MS = 250;

export function mount(root, engine) {
  root.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'timer-card';

  const label = document.createElement('p');
  label.className = 'timer-phase';
  label.setAttribute('aria-live', 'polite');

  const countdown = document.createElement('p');
  countdown.className = 'timer-countdown';
  countdown.setAttribute('role', 'timer');

  const controls = document.createElement('div');
  controls.className = 'timer-controls';

  const startBtn = document.createElement('button');
  startBtn.type = 'button';
  startBtn.textContent = 'Start';

  const pauseBtn = document.createElement('button');
  pauseBtn.type = 'button';
  pauseBtn.textContent = 'Pause';

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.textContent = 'Reset';

  const labelFieldId = 'task-label';
  const labelLimitMessageId = 'task-label-limit-message';

  const labelFieldLabel = document.createElement('label');
  labelFieldLabel.className = 'task-label-field-label';
  labelFieldLabel.htmlFor = labelFieldId;
  labelFieldLabel.textContent = 'Task label';

  const labelField = document.createElement('input');
  labelField.type = 'text';
  labelField.id = labelFieldId;
  labelField.className = 'task-label';
  labelField.placeholder = LABEL_PLACEHOLDER;
  labelField.setAttribute('aria-describedby', labelLimitMessageId);

  const labelLimitMessage = document.createElement('p');
  labelLimitMessage.id = labelLimitMessageId;
  labelLimitMessage.className = 'task-label-limit-message';
  labelLimitMessage.setAttribute('aria-live', 'polite');
  labelLimitMessage.textContent = LABEL_LIMIT_MESSAGE;
  labelLimitMessage.hidden = true;

  const sessionCount = document.createElement('p');
  sessionCount.className = 'session-count';

  controls.append(startBtn, pauseBtn, resetBtn);
  card.append(label, countdown, controls, labelFieldLabel, labelField, labelLimitMessage, sessionCount);
  root.append(card);

  const storage = acquireStorage();
  const persisted = readPersistedState(storage);
  labelField.value = persisted.label;
  let lastAcceptedLabel = persisted.label;
  // session-tracking review fix (AC-07): the last label a write actually
  // persisted — a rollover/credit write never re-saves live, uncommitted field
  // text, only what commitLabel() last committed.
  let committedLabel = persisted.label;

  // session-tracking T6 (spec.md AC-04/AC-04b/AC-05/AC-06/AC-06b, sad.md §6 Flow 1):
  // in-memory tracked day + count, seeded from storage and kept in sync with it
  // on every rollover/credit write.
  let trackedDate = persisted.date;
  let count = persisted.count;

  function sessionCountText(n) {
    return `Today's completed sessions: ${n}`;
  }
  sessionCount.textContent = sessionCountText(count);

  // session-tracking T5 (spec.md AC-01/AC-01b/AC-02): live typing, no storage
  // write on every keystroke — commit happens only on blur/Enter below. A
  // keystroke or paste that would push the field past 100 raw characters is
  // rejected in full (never truncated) — the DOM value reverts to the last
  // accepted value and the inline limit message shows.
  labelField.addEventListener('input', () => {
    const { value, rejected } = validateLabelInput(lastAcceptedLabel, labelField.value);
    if (rejected) {
      labelField.value = value;
    }
    lastAcceptedLabel = value;
    labelLimitMessage.hidden = !rejected;
  });

  function commitLabel() {
    committedLabel = labelField.value;
    persistState(storage, { count, date: trackedDate, label: committedLabel });
  }
  labelField.addEventListener('blur', commitLabel);
  labelField.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      labelField.blur();
    }
  });

  // session-tracking T6 (sad.md §6 «Focus completion → true-day credit» /
  // «Page load — restore label and display today's count»): runs on every read
  // (load, interval tick, visibilitychange). review fix (CHANGES REQUESTED, T6
  // DoD): the rollover-then-credit decision itself now lives in the pure,
  // directly-tested applyCountUpdate() — this is a thin caller, not a
  // reimplementation, so a test calling applyCountUpdate proves this wiring too.
  // Reset/Short/Long-break completions never reach a credit at all:
  // `justCompletedFocusAt` is null for those transitions (AC-05).
  function updateSessionCount(now, justCompletedFocusAt) {
    const next = applyCountUpdate({ trackedDate, count }, now, justCompletedFocusAt);
    if (next.trackedDate !== trackedDate || next.count !== count) {
      trackedDate = next.trackedDate;
      count = next.count;
      persistState(storage, { count, date: trackedDate, label: committedLabel });
    }
    sessionCount.textContent = sessionCountText(count);
  }

  function render() {
    const now = Date.now();
    const snapshot = engine.getSnapshot(now);
    const phaseText = PHASE_LABELS[snapshot.phase] ?? snapshot.phase;
    if (label.textContent !== phaseText) label.textContent = phaseText;
    const countdownText = formatDuration(snapshot.remainingMs);
    if (countdown.textContent !== countdownText) countdown.textContent = countdownText;
    const { startDisabled, pauseDisabled } = controlStates(snapshot);
    startBtn.disabled = startDisabled;
    pauseBtn.disabled = pauseDisabled;
    updateSessionCount(now, snapshot.justCompletedFocusAt);
  }

  // Moves focus to the control that just became enabled when the one the
  // User's keyboard focus was on just got disabled, so Space/Enter activation
  // never strands focus on a now-inert button (US-02 keyboard activation).
  function refocusIfStranded(previouslyFocused, nowEnabledBtn) {
    if (document.activeElement === previouslyFocused && !nowEnabledBtn.disabled) {
      nowEnabledBtn.focus();
    }
  }

  startBtn.addEventListener('click', () => {
    engine.start(Date.now());
    render();
    refocusIfStranded(startBtn, pauseBtn);
  });
  pauseBtn.addEventListener('click', () => {
    engine.pause(Date.now());
    render();
    refocusIfStranded(pauseBtn, startBtn);
  });
  resetBtn.addEventListener('click', () => {
    engine.reset(Date.now());
    render();
  });

  // Reconcile against real elapsed time as soon as the tab becomes visible
  // again (AC-05), rather than waiting for the next interval tick.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') render();
  });

  setInterval(render, RENDER_INTERVAL_MS);
  render();
}
