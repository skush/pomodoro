// DOM layer: renders the phase label + countdown, wires the phase-labelled controls, the task
// label, the session count, and the adjustable-durations settings fields (three
// durations + cycle length) and the two break-flow toggles. Owns all localStorage
// access, through three write gatekeepers: persistState (session-tracking),
// persistDurationConfig (adjustable-durations) and persistBreakFlowSettings
// (break-flow). The only caller of the logic engine's methods (AC-03) — no
// other input source (no window 'message' or 'storage' listener, nothing else) is
// ever wired to it.

import {
  formatDuration,
  PHASES,
  controlLayout,
  validateStoredCount,
  validateStoredDate,
  validateStoredLabel,
  validateLabelInput,
  applyCountUpdate,
  validateStoredDuration,
  validateStoredCycleLength,
  validateStoredToggle,
  DEFAULT_BREAK_FLOW_SETTINGS,
  isOnTimeCompletion,
  validateDurationInput,
  validateCycleLengthInput,
  ringFraction,
  tabTitle,
  toneFor,
} from '../logic/index.js';
import { createRing } from './ring.js';
import { createControls } from './controls.js';
import { createChimePlayer } from './audio.js';
import { createWakeup } from './wakeup.js';

const LABEL_PLACEHOLDER = 'What are you focusing on?';
const LABEL_LIMIT_MESSAGE = 'Task label is limited to 100 characters.';
const DURATION_RANGE_MESSAGE = 'Enter a whole number from 1 to 180.';
const CYCLE_LENGTH_RANGE_MESSAGE = 'Enter a whole number from 2 to 8.';

const COUNT_KEY = 'session-tracking:count';
const DATE_KEY = 'session-tracking:date';
const LABEL_KEY = 'session-tracking:label';

const FOCUS_DURATION_KEY = 'adjustable-durations:focus-duration';
const SHORT_BREAK_DURATION_KEY = 'adjustable-durations:short-break-duration';
const LONG_BREAK_DURATION_KEY = 'adjustable-durations:long-break-duration';
const CYCLE_LENGTH_KEY = 'adjustable-durations:cycle-length';

const AUTO_START_BREAKS_KEY = 'break-flow:auto-start-breaks';
const ALLOW_PAUSING_FOCUS_KEY = 'break-flow:allow-pausing-focus';

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

// adjustable-durations T4 (ADR-0002, spec.md AC-08): the SECOND storage gatekeeper —
// the only function that may call `storage.setItem` for the four adjustable-durations
// keys, alongside (never widening) persistState's count/date/label guard. Always
// writes the FULL {focus, shortBreak, longBreak, cycleLength} state (minutes / count),
// so a foreign edit to any of the four keys is overwritten, never adopted, by the
// next legitimate write. Fail-soft like persistState: a throwing (or absent) storage
// is swallowed and the app keeps running on its in-memory state. Returns whether the
// write succeeded, so the caller knows storage no longer matches memory (review fix #1).
export function persistDurationConfig(storage, config) {
  try {
    storage.setItem(FOCUS_DURATION_KEY, String(config.focus));
    storage.setItem(SHORT_BREAK_DURATION_KEY, String(config.shortBreak));
    storage.setItem(LONG_BREAK_DURATION_KEY, String(config.longBreak));
    storage.setItem(CYCLE_LENGTH_KEY, String(config.cycleLength));
    return true;
  } catch {
    // fail-soft: never throw to the User, never surface an error
    return false;
  }
}

// adjustable-durations T4 (spec.md AC-06/AC-12): reads all four values, each through
// its own stored-value validator so one bad key never blocks the others. If any
// stored value was missing or invalid (i.e. the validated value is not what was
// stored), the corrected full state is written straight back via
// persistDurationConfig. Never throws, including for a null/throwing storage.
export function readPersistedDurationConfig(storage) {
  const rawFocus = safeGetItem(storage, FOCUS_DURATION_KEY);
  const rawShort = safeGetItem(storage, SHORT_BREAK_DURATION_KEY);
  const rawLong = safeGetItem(storage, LONG_BREAK_DURATION_KEY);
  const rawCycle = safeGetItem(storage, CYCLE_LENGTH_KEY);
  const config = {
    focus: validateStoredDuration(rawFocus, 'focus'),
    shortBreak: validateStoredDuration(rawShort, 'shortBreak'),
    longBreak: validateStoredDuration(rawLong, 'longBreak'),
    cycleLength: validateStoredCycleLength(rawCycle),
  };
  const needsCorrection =
    String(config.focus) !== rawFocus ||
    String(config.shortBreak) !== rawShort ||
    String(config.longBreak) !== rawLong ||
    String(config.cycleLength) !== rawCycle;
  if (needsCorrection) persistDurationConfig(storage, config);
  return config;
}

// break-flow T5 (sad.md §8 Persistence, spec.md AC-09): the THIRD storage gatekeeper —
// the only function that may call `storage.setItem` for the two break-flow keys. Always
// writes BOTH, as 'true'/'false', so a foreign edit to either key is overwritten, never
// adopted, by the next legitimate write. A throwing (or absent) storage is swallowed: the
// toggle still applies in memory for the rest of the page load. Returns whether it saved.
export function persistBreakFlowSettings(storage, settings) {
  try {
    storage.setItem(AUTO_START_BREAKS_KEY, String(Boolean(settings.autoStartBreaks)));
    storage.setItem(ALLOW_PAUSING_FOCUS_KEY, String(Boolean(settings.allowPausingFocus)));
    return true;
  } catch {
    // fail-soft: never throw to the User, never surface an error
    return false;
  }
}

// break-flow T5 (spec.md AC-07/AC-09): each key validated on its own (validateStoredToggle),
// so a bad value never affects the other. Unlike the durations reader this does NO
// write-back — the next toggle writes the full pair. Never throws, null storage included.
export function readPersistedBreakFlowSettings(storage) {
  return {
    autoStartBreaks: validateStoredToggle(safeGetItem(storage, AUTO_START_BREAKS_KEY), DEFAULT_BREAK_FLOW_SETTINGS.autoStartBreaks),
    allowPausingFocus: validateStoredToggle(
      safeGetItem(storage, ALLOW_PAUSING_FOCUS_KEY),
      DEFAULT_BREAK_FLOW_SETTINGS.allowPausingFocus,
    ),
  };
}

// adjustable-durations T5/T7 (spec.md AC-06/AC-09/AC-12, sad.md §6 Flow 3): the ONE
// path both mount() and the pre-start correction use — read + validate each stored
// value (writing any correction straight back), then push the values now in effect
// into the engine. A started phase ignores the durations until its next fresh start
// (engine ADR-0001), so calling this right before a Start is always safe.
export function syncConfigFromStorage(storage, engine) {
  const config = readPersistedDurationConfig(storage);
  engine.setConfiguredDurations(config);
  engine.setCycleLength(config.cycleLength);
  return config;
}

// adjustable-durations T7 + review fixes (spec.md AC-01/AC-03/AC-06/AC-08): what the
// Start handler does before starting. Returns { config, lastWriteOk } — the config now
// in effect and whether storage now matches it.
// - Resume (the phase is paused, not idle) is not a fresh start: nothing is read or
//   written, the in-memory config stands. `freshStart` (default: the snapshot is idle)
//   lets break-flow's Start focus count as one when it ends a running or paused break
//   (the break itself is untouched: a started phase ignores the durations).
// - Storage unavailable: nothing to read or write, the in-memory config stands.
// - The last save failed: storage lags what the User committed, so adopting it would
//   silently discard that commit. Retry the save ONCE (this Start only — no loop, no
//   timer); if it still fails, the in-memory config stands until the next fresh
//   Start or commit.
// - Otherwise (or once the retry succeeded) this is the pre-start correction: the same
//   read-validate-correct path mount() uses.
// `snapshot` is the last rendered snapshot — never a fresh getSnapshot() here, which
// would consume a pending Focus-completion credit before render() could count it.
export function prepareStart(storage, engine, config, snapshot, lastWriteOk, freshStart = snapshot.idle) {
  if (!freshStart || storage === null) return { config, lastWriteOk };
  if (!lastWriteOk && !persistDurationConfig(storage, config)) {
    return { config, lastWriteOk: false };
  }
  return { config: syncConfigFromStorage(storage, engine), lastWriteOk: true };
}

// adjustable-durations T5 (screens.md «Numeric setting field», sad.md §4 decision 7):
// a labelled whole-number field that accepts any typed text live and validates only
// at commit time (blur / Enter — mirroring commitLabel's trigger, not its
// per-keystroke check). An invalid commit reverts to the last valid value and shows
// the range message; a valid one hides the message and calls `onCommit(value)`.
function createNumericField({ id, labelText, rangeMessage, validate, initialValue, onCommit }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'setting-field';

  const messageId = `${id}-message`;

  const fieldLabel = document.createElement('label');
  fieldLabel.className = 'setting-field-label';
  fieldLabel.htmlFor = id;
  fieldLabel.textContent = labelText;

  const input = document.createElement('input');
  input.type = 'text';
  input.inputMode = 'numeric';
  input.autocomplete = 'off';
  input.id = id;
  input.className = 'setting-input';
  input.value = String(initialValue);
  input.setAttribute('aria-describedby', messageId);

  const message = document.createElement('p');
  message.id = messageId;
  message.className = 'setting-message';
  message.setAttribute('aria-live', 'polite');
  message.textContent = rangeMessage;
  message.hidden = true;

  let lastValid = initialValue;

  function commit() {
    const result = validate(input.value);
    if (!result.valid) {
      input.value = String(lastValid);
      message.hidden = false;
      return;
    }
    message.hidden = true;
    lastValid = result.value;
    input.value = String(result.value); // "07" becomes "7": an idle field always matches lastValid
    onCommit(result.value);
  }
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      input.blur();
    }
  });

  // A field holding text the User typed keeps it: a correction that runs without the User
  // (the auto-start step) refreshes only the value a rejected commit reverts to. A focused
  // field the User has not edited still shows the value now in effect, so leaving it
  // cannot write an old value back.
  function setValue(value) {
    const typedInto = document.activeElement === input && input.value !== String(lastValid);
    lastValid = value;
    if (!typedInto) input.value = String(value);
  }

  wrapper.append(fieldLabel, input, message);
  return { element: wrapper, setValue };
}

// break-flow T5 (sad.md §8 Settings UI): a labelled checkbox that applies immediately.
function createToggle({ id, labelText, checked, onChange }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'toggle-field';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = id;
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));

  const fieldLabel = document.createElement('label');
  fieldLabel.htmlFor = id;
  fieldLabel.textContent = labelText;

  wrapper.append(input, fieldLabel);
  return { element: wrapper };
}

const PHASE_LABELS = {
  [PHASES.FOCUS]: 'Focus',
  [PHASES.SHORT_BREAK]: 'Short break',
  [PHASES.LONG_BREAK]: 'Long break',
};

const RENDER_INTERVAL_MS = 250;

// sensory-feedback: shown when the page finds it cannot play the completion sound
// (spec.md AC-11). Plain language; it points the User at the cues that still work.
const SOUND_NOTICE_TEXT =
  'The completion sound is unavailable in this browser. Follow the timer by the ring and the tab title instead.';

// sensory-feedback T9 (sad.md §6 Flow 1): the Completion chime for one snapshot. A
// snapshot carrying `justCompleted` plays that phase's tone exactly once (the engine
// hands the record over once, ADR-0002); if the tone cannot play the notice shows and
// nothing is held back for later (AC-11). Nothing here runs for a Start, Pause, Resume,
// Reset or commit, because those never produce a `justCompleted` (AC-07).
export function applyCompletionCue(snapshot, { player, setNotice }) {
  const completed = snapshot.justCompleted;
  if (!completed) return;
  let played = false;
  try {
    played = player.play(toneFor(completed.phase)) === true;
  } catch {
    played = false;
  }
  if (!played) setNotice(true);
}

// sensory-feedback T9 (sad.md §6 Flow 2): unlock sound inside the User's own Start/Resume
// press. Must be called synchronously from the click handler (the AudioContext
// resume() happens inside the gesture); shows the notice now when sound is unavailable,
// hides it when sound works. Never plays a tone (AC-07). No permission prompt (AC-12).
export async function unlockSound(player, setNotice) {
  let available = false;
  try {
    available = (await player.unlock()) === true;
  } catch {
    available = false;
  }
  setNotice(!available);
}

// sensory-feedback T10 (ADR-0001, sad.md §6 Flows 1-3): keeps the wake-up clock in step
// with the last rendered snapshot. A running phase arms it for the remaining time (this
// is also the re-arm after an early wake-up); anything else cancels it. It only decides
// when the page next looks at the clock — never whether a phase completed. Fail-soft.
export function syncWakeup(snapshot, wakeup) {
  try {
    if (snapshot.running) wakeup.arm(snapshot.remainingMs);
    else wakeup.cancel();
  } catch {
    // ignore: the render loop and visibilitychange still reconcile against the clock
  }
}

// sensory-feedback T8 (sad.md §6 Flow 4): the visual cues for one snapshot — the Tab
// title mirror, then the Progress ring. Both are pure functions of the snapshot
// (src/logic/feedback.js). Fail-soft: a cue that cannot be drawn never stops the timer.
export function applyVisualCues(snapshot, { ring, setTitle }) {
  try {
    setTitle(tabTitle(snapshot));
  } catch {
    // ignore: the countdown on the page still shows the time
  }
  try {
    ring.update(ringFraction(snapshot), snapshot.phase);
  } catch {
    // ignore
  }
}

// break-flow T7 (ADR-0001, sad.md §6 Flow 1, spec.md AC-01/AC-03): the auto-start step.
// `snapshot` is snapshot A, the one carrying the one-shot completion record. When it is an
// On-time Focus completion (noticed <= 5 s after its true end) and Auto-start breaks is on,
// the break the engine just loaded idle is started — after the same pre-start correction any
// fresh start gets — with the Focus phase's TRUE end as its start time, so the countdown is
// exact whenever the page got round to noticing. Returns the display snapshot: snapshot B
// (break running) after an auto-start, else A untouched. A late completion, the setting off,
// or a break completion starts nothing: a Focus phase never starts on its own (AC-02), and
// the engine's settle rule is unchanged. Fail-soft: a failing correction leaves the break
// waiting, exactly as a late completion would.
export function autoStartBreak({ snapshot, now, enabled, engine, prepare }) {
  const completed = snapshot.justCompleted;
  if (!enabled || !completed || completed.phase !== PHASES.FOCUS) return snapshot;
  if (!isOnTimeCompletion(completed.at, now)) return snapshot;
  try {
    prepare();
  } catch {
    return snapshot;
  }
  engine.start(completed.at);
  return engine.getSnapshot(now);
}

// break-flow T7 (sad.md §8 One-shot consumption): everything one render does with the
// engine, in its fixed order — getSnapshot A -> auto-start (correction, start(at),
// getSnapshot B, re-arm the wake-up) -> title -> ring -> chime/notice -> Session credit.
// The chime, the notice and the credit read snapshot A (it alone carries the completion);
// the title, ring, controls and wake-up read the DISPLAY snapshot (B after an auto-start,
// else A), which the caller keeps as `lastSnapshot` so the wake-up callback's
// syncWakeup(lastSnapshot) re-arms the break instead of cancelling the alarm the auto-start
// just set. Returns both so the caller can finish the render (text, controls).
export function renderCycle({ engine, now, autoStartBreaks, prepare, visual, cue, credit, wakeup }) {
  const snapshot = engine.getSnapshot(now);
  const display = autoStartBreak({ snapshot, now, enabled: autoStartBreaks, engine, prepare });
  if (display !== snapshot) syncWakeup(display, wakeup);
  applyVisualCues(display, visual);
  applyCompletionCue(snapshot, cue);
  credit(now, snapshot.justCompletedFocusAt);
  return { snapshot, display };
}

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

  // sensory-feedback: the Progress ring sits above the phase name and the countdown.
  const ring = createRing();

  const soundNotice = document.createElement('p');
  soundNotice.className = 'sound-notice';
  soundNotice.textContent = SOUND_NOTICE_TEXT;
  soundNotice.hidden = true;

  const setNotice = (visible) => {
    soundNotice.hidden = !visible;
  };
  const chimePlayer = createChimePlayer();

  // break-flow T6 (ADR-0003): three fixed slot buttons painted from controlLayout(); every
  // press reports an action name to handleAction, which is the only route to the engine.
  const controls = createControls((action) => handleAction(action));

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

  card.append(ring.element, label, countdown, controls.element, soundNotice, labelFieldLabel, labelField, labelLimitMessage, sessionCount);
  root.append(card);

  const storage = acquireStorage();
  // adjustable-durations T5 (sad.md §6 Flows 1/3): in-memory full config, seeded by
  // the same read-validate-correct path the pre-start check uses.
  let config = syncConfigFromStorage(storage, engine);
  // review fix #1: false once a commit's write failed — storage then lags memory.
  let lastWriteOk = true;
  // break-flow T5 (sad.md §4 decision 7): read once, at load only (AC-12). Auto-start
  // breaks lives in memory because only the auto-start branch reads it; Allow pausing
  // focus is pushed into the engine, the only place it lives.
  let breakFlow = readPersistedBreakFlowSettings(storage);
  engine.setAllowPausingFocus(breakFlow.allowPausingFocus);
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

  // adjustable-durations T5 (spec.md AC-01/AC-03, sad.md §6 Flow 1): a valid committed
  // duration goes to the engine (idle phase updates at once, running/paused untouched)
  // and then to storage as the FULL four-value state — the only writer besides
  // commitCycleLength and the read-time correction (ADR-0002).
  function commitDuration(key, value) {
    config = { ...config, [key]: value };
    engine.setConfiguredDurations(config);
    lastWriteOk = persistDurationConfig(storage, config);
    render();
  }

  const durationFields = [
    { key: 'focus', id: 'duration-focus', labelText: 'Focus' },
    { key: 'shortBreak', id: 'duration-short-break', labelText: 'Short break' },
    { key: 'longBreak', id: 'duration-long-break', labelText: 'Long break' },
  ].map(({ key, id, labelText }) => ({
    key,
    field: createNumericField({
      id,
      labelText,
      rangeMessage: DURATION_RANGE_MESSAGE,
      validate: validateDurationInput,
      initialValue: config[key],
      onCommit: (value) => commitDuration(key, value),
    }),
  }));

  const durationsGroup = document.createElement('fieldset');
  durationsGroup.className = 'settings-group';
  const durationsLegend = document.createElement('legend');
  durationsLegend.textContent = 'Durations (minutes)';
  durationsGroup.append(durationsLegend, ...durationFields.map(({ field }) => field.element));
  card.append(durationsGroup);

  // adjustable-durations T6 (spec.md AC-10/AC-11/AC-14, sad.md §6 Flow 4): the engine
  // only stores the new length — no retroactive Long break, in-cycle count and the
  // session count untouched — then storage gets the FULL four-value state.
  function commitCycleLength(value) {
    config = { ...config, cycleLength: value };
    engine.setCycleLength(value);
    lastWriteOk = persistDurationConfig(storage, config);
  }

  const cycleLengthField = createNumericField({
    id: 'cycle-length',
    labelText: 'Focus sessions before a long break',
    rangeMessage: CYCLE_LENGTH_RANGE_MESSAGE,
    validate: validateCycleLengthInput,
    initialValue: config.cycleLength,
    onCommit: commitCycleLength,
  });
  const cycleGroup = document.createElement('div');
  cycleGroup.className = 'settings-group';
  cycleGroup.append(cycleLengthField.element);
  card.append(cycleGroup);

  // break-flow T5 (spec.md AC-07/AC-09/AC-17): a toggle applies at once and never alters
  // a phase already in progress — the engine only changes what pause() may do from now on.
  // Both values go to storage as the full pair; a refused write is swallowed and the new
  // value still applies for this page load.
  function commitBreakFlowSettings(next) {
    breakFlow = { ...breakFlow, ...next };
    engine.setAllowPausingFocus(breakFlow.allowPausingFocus);
    persistBreakFlowSettings(storage, breakFlow);
    render();
  }

  const autoStartToggle = createToggle({
    id: 'auto-start-breaks',
    labelText: 'Auto-start breaks',
    checked: breakFlow.autoStartBreaks,
    onChange: (checked) => commitBreakFlowSettings({ autoStartBreaks: checked }),
  });
  const allowPausingToggle = createToggle({
    id: 'allow-pausing-focus',
    labelText: 'Allow pausing focus',
    checked: breakFlow.allowPausingFocus,
    onChange: (checked) => commitBreakFlowSettings({ allowPausingFocus: checked }),
  });
  const breakFlowGroup = document.createElement('div');
  breakFlowGroup.className = 'settings-group toggle-group';
  breakFlowGroup.append(autoStartToggle.element, allowPausingToggle.element);
  card.append(breakFlowGroup);

  // The snapshot render() last showed — what the User saw when they pressed Start.
  let lastSnapshot = null;

  function render() {
    const now = Date.now();
    // sad.md §8 One-shot consumption: renderCycle owns the fixed order (snapshot A ->
    // auto-start -> title -> ring -> chime/notice -> Session credit); what the page shows
    // and re-arms from is the display snapshot it returns.
    const { display } = renderCycle({
      engine,
      now,
      autoStartBreaks: breakFlow.autoStartBreaks,
      prepare: prepareAutoStart,
      visual: {
        ring,
        setTitle: (text) => {
          if (document.title !== text) document.title = text;
        },
      },
      cue: { player: chimePlayer, setNotice },
      credit: updateSessionCount,
      wakeup,
    });
    lastSnapshot = display;
    const phaseText = PHASE_LABELS[display.phase] ?? display.phase;
    if (label.textContent !== phaseText) label.textContent = phaseText;
    const countdownText = formatDuration(display.remainingMs);
    if (countdown.textContent !== countdownText) countdown.textContent = countdownText;
    // break-flow T6 (AC-10/AC-11): the controls follow the snapshot; keyboard focus that
    // would be stranded moves to the main slot, or to the phase name when main is empty.
    controls.update(controlLayout(display, now), label);
  }

  // sensory-feedback T10: the wake-up only re-runs render() (a read) and re-arms from
  // the snapshot it just showed — no second getSnapshot() caller, no control method.
  const wakeup = createWakeup(() => {
    render();
    syncWakeup(lastSnapshot, wakeup);
  });

  // adjustable-durations T7 (spec.md AC-06/AC-12, sad.md §6 Flow 3): the pre-start
  // correction — for a fresh start, re-reads storage through the same path mount()
  // used, so an invalid value that appeared between load and Start is corrected (and
  // written back) before the phase begins; prepareStart() decides when that applies.
  // The fields then show the values now in effect.
  function refreshConfigFromStorage(freshStart) {
    ({ config, lastWriteOk } = prepareStart(storage, engine, config, lastSnapshot, lastWriteOk, freshStart));
    for (const { key, field } of durationFields) field.setValue(config[key]);
    cycleLengthField.setValue(config.cycleLength);
  }

  function afterAction() {
    render();
    syncWakeup(lastSnapshot, wakeup);
  }

  // break-flow T6 (sad.md §6 Flows 2-4): every control press lands here, and each handler
  // calls the engine at most once. Start focus, Start break and Resume are the User's own
  // gesture, so they enable sound synchronously — before the phase runs unattended and a
  // later auto-start has to chime. The engine itself enforces the Skip guard and the
  // focus-pause policy (ADR-0002): this layer only forwards.
  // break-flow T7: the auto-start step's pre-start correction — a fresh start like any other
  // (adjustable-durations AC-06), though the displayed Focus phase is not idle.
  function prepareAutoStart() {
    refreshConfigFromStorage(true);
  }

  function handleStartBreak() {
    unlockSound(chimePlayer, setNotice);
    refreshConfigFromStorage();
    engine.start(Date.now());
    afterAction();
  }

  // Start focus ends a break (running, paused or waiting) through engine.startFocus; on a
  // waiting Focus phase — the main control after a completed break — it is a plain start.
  // Either way it is a fresh Focus, so the pre-start correction runs first.
  function handleStartFocus() {
    unlockSound(chimePlayer, setNotice);
    refreshConfigFromStorage(true);
    const now = Date.now();
    if (lastSnapshot.phase === PHASES.FOCUS) engine.start(now);
    else engine.startFocus(now);
    afterAction();
  }

  // Resume Focus and Resume break: not a fresh start, so no correction.
  function handleResume() {
    unlockSound(chimePlayer, setNotice);
    engine.start(Date.now());
    afterAction();
  }

  function handlePause() {
    engine.pause(Date.now());
    afterAction();
  }

  function handleReset() {
    engine.reset(Date.now());
    afterAction();
  }

  const ACTION_HANDLERS = {
    startFocus: handleStartFocus,
    pauseFocus: handlePause,
    resumeFocus: handleResume,
    resetFocus: handleReset,
    startBreak: handleStartBreak,
    pauseBreak: handlePause,
    resumeBreak: handleResume,
    resetBreak: handleReset,
  };

  function handleAction(action) {
    ACTION_HANDLERS[action]?.();
  }

  // Reconcile against real elapsed time as soon as the tab becomes visible
  // again (AC-05), rather than waiting for the next interval tick.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') render();
  });

  setInterval(render, RENDER_INTERVAL_MS);
  render();
}
