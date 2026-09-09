// DOM layer: renders the phase label + countdown and wires Start/Pause/Reset.
// The only caller of the logic engine's methods (AC-03) — no other input source
// (no window 'message' listener, nothing else) is ever wired to it.

import { createTimerEngine, formatDuration, PHASES } from '../logic/index.js';

const PHASE_LABELS = {
  [PHASES.FOCUS]: 'Focus',
  [PHASES.SHORT_BREAK]: 'Short break',
  [PHASES.LONG_BREAK]: 'Long break',
};

const RENDER_INTERVAL_MS = 250;

export function mount(root) {
  const engine = createTimerEngine();

  root.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'timer-card';

  const label = document.createElement('p');
  label.className = 'timer-phase';

  const countdown = document.createElement('p');
  countdown.className = 'timer-countdown';
  countdown.setAttribute('aria-live', 'polite');

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
    label.textContent = PHASE_LABELS[snapshot.phase] ?? snapshot.phase;
    countdown.textContent = formatDuration(snapshot.remainingMs);
    startBtn.disabled = snapshot.running;
    pauseBtn.disabled = !snapshot.running;
  }

  startBtn.addEventListener('click', () => {
    engine.start(Date.now());
    render();
  });
  pauseBtn.addEventListener('click', () => {
    engine.pause(Date.now());
    render();
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
