// sensory-feedback: the wake-up clock (docs/features/sensory-feedback/adr/0001-wake-the-
// page-at-the-deadline-from-an-inline-worker.md). A hidden tab throttles the page's own
// timers, so a tiny inline dedicated worker holds ONE pending timeout for the current
// phase deadline and nudges the page when it fires. The nudge only makes the caller run
// its ordinary render; whether a phase completed is still decided by the wall-clock
// deadline, so an early, stale or duplicate wake-up is harmless.
//
// This file owns the ONE private message channel in src/: page <-> the Worker it creates
// itself. The page-side handler lives on that Worker object, never on window, and calls
// only `onWake`. It never reaches a timer control method, the DOM or persisted state.

// Runs inside the Worker. `arm` replaces any pending timeout; `cancel` clears it.
export const WORKER_SOURCE = `
let timer = null;
self.onmessage = (event) => {
  const message = event.data || {};
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  if (message.type === 'arm') {
    timer = setTimeout(() => {
      timer = null;
      self.postMessage({ type: 'wake', id: message.id });
    }, message.delayMs);
  }
};
`;

function clampDelay(delayMs) {
  return Number.isFinite(delayMs) ? Math.max(0, delayMs) : 0;
}

function defaultWorkerClass() {
  return typeof Worker === 'function' ? Worker : null;
}

// createWakeup(onWake) -> { arm(delayMs), cancel() }
// One worker per page, built lazily from an in-bundle Blob source (URL revoked right
// after construction). If a worker cannot be constructed (blocked by policy, an
// extension, a browser without support), it falls back to a main-thread setTimeout with
// the same arm/cancel: the wake-up still happens, possibly late while the tab is hidden.
export function createWakeup(
  onWake,
  {
    WorkerClass = defaultWorkerClass(),
    createObjectURL = (blob) => URL.createObjectURL(blob),
    revokeObjectURL = (url) => URL.revokeObjectURL(url),
    setTimeoutFn = (fn, ms) => setTimeout(fn, ms),
    clearTimeoutFn = (id) => clearTimeout(id),
  } = {},
) {
  let worker = null;
  let workerFailed = false;
  let fallbackTimer = null;
  // Each arm gets a fresh id; only a wake carrying the latest id is honoured, so a wake
  // that was already in flight when the User paused, reset or re-armed does nothing.
  let currentId = 0;
  let armed = false;

  function ensureWorker() {
    if (worker || workerFailed) return worker;
    if (typeof WorkerClass !== 'function') {
      workerFailed = true;
      return null;
    }
    try {
      const url = createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
      try {
        worker = new WorkerClass(url);
      } finally {
        revokeObjectURL(url);
      }
      worker.onmessage = (event) => {
        const data = event && event.data;
        if (armed && data && data.type === 'wake' && data.id === currentId) {
          armed = false;
          onWake();
        }
      };
    } catch {
      worker = null;
      workerFailed = true;
    }
    return worker;
  }

  function clearFallback() {
    if (fallbackTimer !== null) {
      clearTimeoutFn(fallbackTimer);
      fallbackTimer = null;
    }
  }

  function arm(delayMs) {
    currentId += 1;
    armed = true;
    const delay = clampDelay(delayMs);
    const w = ensureWorker();
    if (w) {
      w.postMessage({ type: 'arm', delayMs: delay, id: currentId });
      return;
    }
    clearFallback();
    fallbackTimer = setTimeoutFn(() => {
      fallbackTimer = null;
      armed = false;
      onWake();
    }, delay);
  }

  function cancel() {
    currentId += 1;
    armed = false;
    if (worker) worker.postMessage({ type: 'cancel' });
    clearFallback();
  }

  return { arm, cancel };
}
