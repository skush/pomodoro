// DOM layer: renders the phase label + countdown and wires Start/Pause/Reset.
// The only caller of the logic engine's methods (AC-03) — no other input source
// (no window 'message' listener, nothing else) is ever wired to it.

import { formatDuration, PHASES, controlStates } from '../logic/index.js';

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

  controls.append(startBtn, pauseBtn, resetBtn);
  card.append(label, countdown, controls);
  root.append(card);

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
