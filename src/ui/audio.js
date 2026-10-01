// sensory-feedback: the audio adapter. One lazily created AudioContext, unlocked only
// inside the User's own Start/Resume press (no permission prompt), and checked both at
// unlock and at each completion. Tones are synthesized from note lists
// (src/logic/feedback.js TONES) — no audio file ships. Fail-soft throughout: every
// failure is reported as "sound unavailable" (false), never thrown, and a chime that
// cannot play now is NEVER queued for later (docs/features/sensory-feedback/sad.md §4
// decision 5, spec.md AC-11).

const ATTACK_SECONDS = 0.02;

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
export function createChimePlayer({ AudioContextClass = defaultAudioContextClass() } = {}) {
  let context = null;

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

  async function unlock() {
    const ctx = ensureContext();
    if (!ctx) return false;
    try {
      await ctx.resume();
    } catch {
      return false;
    }
    return ctx.state === 'running';
  }

  function play(tone) {
    const ctx = context;
    if (!ctx || ctx.state !== 'running') return false;
    try {
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
