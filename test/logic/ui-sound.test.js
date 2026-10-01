import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { applyCompletionCue, unlockSound } from '../../src/ui/index.js';
import { PHASES, TONES } from '../../src/logic/index.js';

// sensory-feedback T9: the chime/notice helpers exported from src/ui/index.js, against fakes.

describe('applyCompletionCue (AC-05, AC-07, AC-11)', () => {
  const played = () => {
    const tones = [];
    return { tones, player: { play: (tone) => (tones.push(tone), true) } };
  };
  const snapshotWith = (justCompleted) => ({ justCompleted });

  test('no completion: nothing plays, the notice is untouched', () => {
    const { tones, player } = played();
    const notices = [];
    applyCompletionCue(snapshotWith(null), { player, setNotice: (v) => notices.push(v) });
    assert.deepEqual(tones, []);
    assert.deepEqual(notices, []);
  });

  test('AC-05: a Focus completion plays the Focus-end tone once; a break completion the break-end tone', () => {
    const a = played();
    applyCompletionCue(snapshotWith({ phase: PHASES.FOCUS, at: 1 }), { player: a.player, setNotice() {} });
    assert.deepEqual(a.tones, [TONES.focusEnd]);
    const b = played();
    applyCompletionCue(snapshotWith({ phase: PHASES.SHORT_BREAK, at: 1 }), { player: b.player, setNotice() {} });
    applyCompletionCue(snapshotWith({ phase: PHASES.LONG_BREAK, at: 1 }), { player: b.player, setNotice() {} });
    assert.deepEqual(b.tones, [TONES.breakEnd, TONES.breakEnd]);
  });

  test('AC-06b: a stale completion (more than 2 minutes late) plays no chime and shows no notice', () => {
    const { tones, player } = played();
    const notices = [];
    const cue = { player, setNotice: (v) => notices.push(v) };
    const at = 5_000_000;
    applyCompletionCue(snapshotWith({ phase: PHASES.FOCUS, at }), cue, at + 120_001);
    applyCompletionCue(snapshotWith({ phase: PHASES.SHORT_BREAK, at }), cue, at + 3 * 60 * 60 * 1000);
    assert.deepEqual(tones, []);
    assert.deepEqual(notices, []);
    // not stale: still chimes, up to and including 120 s late
    applyCompletionCue(snapshotWith({ phase: PHASES.FOCUS, at }), cue, at + 120_000);
    assert.deepEqual(tones, [TONES.focusEnd]);
  });

  test('AC-06b: a stale completion shows no notice even when sound could not play', () => {
    const notices = [];
    let attempts = 0;
    const at = 5_000_000;
    applyCompletionCue(snapshotWith({ phase: PHASES.FOCUS, at }), {
      player: { play: () => (attempts += 1, false) },
      setNotice: (v) => notices.push(v),
    }, at + 10 * 60 * 1000);
    assert.equal(attempts, 0);
    assert.deepEqual(notices, []);
  });

  test('AC-11: when the tone cannot play, the notice shows and nothing is held back', () => {
    const notices = [];
    let attempts = 0;
    applyCompletionCue(snapshotWith({ phase: PHASES.FOCUS, at: 1 }), {
      player: { play: () => (attempts += 1, false) },
      setNotice: (v) => notices.push(v),
    });
    assert.deepEqual(notices, [true]);
    assert.equal(attempts, 1);
  });

  test('fail-soft: a throwing player shows the notice instead of throwing', () => {
    const notices = [];
    assert.doesNotThrow(() =>
      applyCompletionCue(snapshotWith({ phase: PHASES.FOCUS, at: 1 }), {
        player: { play: () => { throw new Error('boom'); } },
        setNotice: (v) => notices.push(v),
      }),
    );
    assert.deepEqual(notices, [true]);
  });
});

describe('unlockSound (AC-11, AC-12)', () => {
  test('hides the notice when sound is available and shows it when not, without ever playing a tone', async () => {
    const notices = [];
    let plays = 0;
    await unlockSound({ unlock: async () => true, play: () => (plays += 1) }, (v) => notices.push(v));
    await unlockSound({ unlock: async () => false, play: () => (plays += 1) }, (v) => notices.push(v));
    assert.deepEqual(notices, [false, true]);
    assert.equal(plays, 0); // no chime on Start or Resume (AC-07)
  });

  test('calls unlock synchronously (inside the click handler) and survives a rejecting unlock', async () => {
    let called = false;
    const notices = [];
    const pending = unlockSound(
      { unlock: () => ((called = true), Promise.reject(new Error('x'))) },
      (v) => notices.push(v),
    );
    assert.equal(called, true); // before any await
    await pending;
    assert.deepEqual(notices, [true]);
  });
});
