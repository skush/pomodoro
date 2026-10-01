// sensory-feedback: the audio adapter. One lazily created AudioContext, unlocked only
// inside the User's own Start/Resume press (no permission prompt), and checked both at
// unlock and at each completion. Tones are synthesized from note lists
// (src/logic/feedback.js TONES) — no audio file ships. Fail-soft throughout: every
// failure is reported as "sound unavailable" (false), never thrown, and a chime that
// cannot play now is NEVER queued for later (docs/features/sensory-feedback/sad.md §4
// decision 5, spec.md AC-11).

const ATTACK_SECONDS = 0.02;

// A running context's clock keeps pace with the wall clock. After a device sleep the browser
// can keep reporting `running` while the clock has stopped (observed: wall +157 s,
// currentTime +0.3 s), and tones scheduled on it are never heard. Below this share of the
// elapsed wall time, over at least the minimum span, the context counts as stalled.
const STALL_MIN_WALL_SECONDS = 2;
const STALL_MIN_PACE = 0.5;

function defaultAudioContextClass() {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

// createChimePlayer() -> { unlock(), play(tone) }
//  - unlock(): call synchronously from the Start/Resume click handler. Creates the
//    context on first use and resume()s it (the resume call itself happens inside the
//    gesture). Resolves true when the context is running, false otherwise.
//  - play(tone): plays the note list once; returns whether it was played. It checks the
//    context state at the moment of the call and never schedules anything for later.
//  Both first check that the context's clock still keeps pace with the wall clock; a
//  stalled context (device sleep) is closed and replaced by a fresh one.
export function createChimePlayer({ AudioContextClass = defaultAudioContextClass(), now = Date.now } = {}) {
  let context = null;
  let mark = null; // { wall, audio } at the last time the context was seen keeping pace

  function ensureContext() {
    if (context) return context;
    if (typeof AudioContextClass !== 'function') return null;
    try {
      context = new AudioContextClass();
    } catch {
      context = null;
    }
    return context;
  }

  function stamp(ctx) {
    mark = { wall: now(), audio: ctx.currentTime };
  }

  // Replaces a running context whose clock stopped while the wall clock went on. Fail-soft:
  // a context that cannot be inspected or replaced is left as it is.
  function replaceIfStalled() {
    const ctx = context;
    if (!ctx || !mark || ctx.state !== 'running') return;
    try {
      const wallSeconds = (now() - mark.wall) / 1000;
      const audioSeconds = ctx.currentTime - mark.audio;
      if (wallSeconds < STALL_MIN_WALL_SECONDS || audioSeconds >= wallSeconds * STALL_MIN_PACE) return;
      context = null;
      mark = null;
      Promise.resolve(ctx.close()).catch(() => {});
      // the page has been interacted with, so the new context starts running by itself; the
      // resume() only nudges one that does not (play() still requires `running` right now)
      ensureContext()?.resume?.()?.catch?.(() => {});
    } catch {
      // keep going with whatever context there is
    }
  }

  async function unlock() {
    replaceIfStalled();
    const ctx = ensureContext();
    if (!ctx) return false;
    try {
      await ctx.resume();
    } catch {
      return false;
    }
    if (ctx.state !== 'running') return false;
    stamp(ctx);
    return true;
  }

  function play(tone) {
    replaceIfStalled();
    const ctx = context;
    if (!ctx || ctx.state !== 'running') return false;
    try {
      stamp(ctx);
      const base = ctx.currentTime;
      for (const note of tone) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = note.frequency;
        const start = base + note.start;
        const end = start + note.duration;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(note.peakGain, start + Math.min(ATTACK_SECONDS, note.duration / 2));
        gain.gain.linearRampToValueAtTime(0, end);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(end);
      }
      return true;
    } catch {
      return false;
    }
  }

  return { unlock, play };
}
