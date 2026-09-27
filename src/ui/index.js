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
} from '../logic/index.js';

const LABEL_PLACEHOLDER = 'What are you focusing on?';
const LABEL_LIMIT_MESSAGE = 'Task label is limited to 100 characters.';

const COUNT_KEY = 'session-tracking:count';
const DATE_KEY = 'session-tracking:date';
const LABEL_KEY = 'session-tracking:label';

// session-tracking T4 (ADR-0002, AC-07): the ONLY function anywhere that may call
// `storage.setItem` for the count/date/label keys — the write guard's single
// choke point. Always writes exactly the given patch as a plain overwrite, never
// a read-then-merge; a thrown storage error (quota/private-mode/disabled) is
// swallowed so the app keeps running in-memory with nothing shown to the User
// (spec.md §6 NFR "Storage write failure"). `storage` is injected (never the
// bare `localStorage` global read here) so this is callable from plain Node.
export function persistState(storage, patch) {
  try {
    if ('count' in patch) storage.setItem(COUNT_KEY, String(patch.count));
    if ('date' in patch) storage.setItem(DATE_KEY, patch.date);
    if ('label' in patch) storage.setItem(LABEL_KEY, patch.label);
  } catch {
    // fail-soft: never throw to the User, never surface an error (spec.md §6 NFR)
  }
}

// session-tracking T4: reads all three persisted fields, each validated through
// its own T3 fallback independently — a corrupted field never blocks the others.
export function readPersistedState(storage) {
  return {
    count: validateStoredCount(storage.getItem(COUNT_KEY)),
    date: validateStoredDate(storage.getItem(DATE_KEY)),
    label: validateStoredLabel(storage.getItem(LABEL_KEY)),
  };
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

  const labelField = document.createElement('input');
  labelField.type = 'text';
  labelField.className = 'task-label';
  labelField.placeholder = LABEL_PLACEHOLDER;

  const labelLimitMessage = document.createElement('p');
  labelLimitMessage.className = 'task-label-limit-message';
  labelLimitMessage.textContent = LABEL_LIMIT_MESSAGE;
  labelLimitMessage.hidden = true;

  controls.append(startBtn, pauseBtn, resetBtn);
  card.append(label, countdown, controls, labelField, labelLimitMessage);
  root.append(card);

  const storage = window.localStorage;
  const persisted = readPersistedState(storage);
  labelField.value = persisted.label;
  let lastAcceptedLabel = persisted.label;

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
    persistState(storage, { label: labelField.value });
  }
  labelField.addEventListener('blur', commitLabel);
  labelField.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      labelField.blur();
    }
  });

  function render() {
    const snapshot = engine.getSnapshot(Date.now());
    const phaseText = PHASE_LABELS[snapshot.phase] ?? snapshot.phase;
    if (label.textContent !== phaseText) label.textContent = phaseText;
    const countdownText = formatDuration(snapshot.remainingMs);
    if (countdown.textContent !== countdownText) countdown.textContent = countdownText;
    const { startDisabled, pauseDisabled } = controlStates(snapshot);
    startBtn.disabled = startDisabled;
    pauseBtn.disabled = pauseDisabled;
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
