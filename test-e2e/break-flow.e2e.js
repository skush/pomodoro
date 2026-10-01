// e2e-through-UI tests for break-flow (T9): the break that starts by itself after an On-time
// Focus end, the return-after-sleep case, Start focus and the Skip guard, the phase-labelled
// controls and where keyboard focus goes. Everything drives the BUILT root index.html in a real
// headless browser on the fake page clock — run `npm run build` first.
// Browser scope: only the desktop Chrome/Edge background-timing promise (sensory-feedback §3) is
// asserted anywhere in this suite; no claim is made about Firefox or any other browser.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser, openApp, MIN, PAUSE_ON, AUTO_START_OFF } from './helpers.js';

let browser;
before(async () => {
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
});

// These scenarios run on the DEFAULTS (Auto-start breaks on, Allow pausing focus off) unless a
// test seeds otherwise.
async function withApp(options, body) {
  const app = await openApp(browser, options);
  try {
    await body(app);
  } finally {
    await app.context.close();
  }
}

const FOCUS_NOTES = 3; // TONES.focusEnd (rising)
const BREAK_NOTES = 2; // TONES.breakEnd (falling)
const rising = (tones) => tones.every((t, i) => i === 0 || t.frequency > tones[i - 1].frequency);
const falling = (tones) => tones.every((t, i) => i === 0 || t.frequency < tones[i - 1].frequency);

// The labels of the controls a User can see, left to right as laid out: side-1, main, side-2.
async function visibleControls(app) {
  return app.page.evaluate(() => {
    const order = ['side-1', 'main', 'side-2'];
    return order
      .map((slot) => document.querySelector(`.timer-controls [data-slot="${slot}"]`))
      .filter((button) => button && !button.hidden)
      .map((button) => button.textContent);
  });
}

// Where keyboard focus is: a slot name, an element id, or the element's class.
const focusedWhere = (app) =>
  app.page.evaluate(() => {
    const el = document.activeElement;
    return el?.getAttribute('data-slot') ?? (el?.id || el?.className) ?? null;
  });
const mainState = (app) =>
  app.page.evaluate(() => {
    const main = document.querySelector('.timer-controls [data-slot="main"]');
    return { text: main.textContent, hidden: main.hidden, ariaDisabled: main.getAttribute('aria-disabled') };
  });

// Starts the Focus phase and runs it to its true end plus `lateMs`.
async function runFocusToEnd(app, lateMs = 0) {
  await app.startFocus().click();
  await app.advance(25 * MIN + lateMs);
}

test('AC-01/AC-13: an on-time Focus end starts the break by itself, from the Focus end, with one Focus-end chime', async () => {
  await withApp({ audioSpy: {} }, async (app) => {
    await runFocusToEnd(app, 4000); // noticed 4 s after the true end
    assert.equal(await app.phase(), 'Short break');
    assert.equal(await app.countdown(), '4:56'); // measured from the Focus end, not from when the page noticed
    assert.equal(await app.title(), '5 min · Short break'); // running: no "Ready"/"Paused" marker
    assert.equal(await app.ringPhase(), 'short_break');
    assert.ok((await app.ringFraction()) > 0.98 && (await app.ringFraction()) <= 1);
    const tones = await app.tones();
    assert.equal(tones.length, FOCUS_NOTES);
    assert.ok(rising(tones));
    assert.match(await app.sessionCount(), /: 1$/);
    await app.advance(1000);
    assert.equal(await app.countdown(), '4:55'); // it is really counting down
  });
});

test('AC-01/§6: a completion noticed 5000 ms late is on time; 5001 ms is late', async () => {
  await withApp({}, async (app) => {
    await runFocusToEnd(app, 5000);
    assert.equal(await app.countdown(), '4:55');
    assert.equal(await app.pauseBreak().isVisible(), true); // running
  });
  await withApp({}, async (app) => {
    await runFocusToEnd(app, 5001);
    assert.equal(await app.countdown(), '5:00'); // waiting at full length
    assert.equal(await app.startBreak().isVisible(), true);
    assert.equal(await app.pauseBreak().count(), 0);
  });
});

test('AC-01: the break length is the Configured duration, including one committed before the Focus end (AC-14)', async () => {
  await withApp({ storage: { 'adjustable-durations:short-break-duration': '8' } }, async (app) => {
    await app.startFocus().click();
    await app.advance(10 * MIN);
    await app.commit(app.shortBreakField(), '9'); // committed mid-Focus: applies to the break that auto-starts
    await app.advance(15 * MIN);
    assert.equal(await app.countdown(), '9:00');
    await app.commit(app.shortBreakField(), '12'); // after the auto-start: the running break keeps its length
    assert.equal(await app.countdown(), '9:00');
    await app.advance(1000);
    assert.equal(await app.countdown(), '8:59');
  });
});

test('AC-02: the auto-started break ends with one break-end chime and the next Focus waits — nothing starts by itself', async () => {
  await withApp({ audioSpy: {} }, async (app) => {
    await runFocusToEnd(app);
    await app.advance(5 * MIN);
    assert.equal(await app.phase(), 'Focus');
    assert.equal(await app.countdown(), '25:00');
    const tones = await app.tones();
    assert.equal(tones.length, FOCUS_NOTES + BREAK_NOTES);
    assert.ok(falling(tones.slice(FOCUS_NOTES)));
    assert.deepEqual(await visibleControls(app), ['Start focus']);
    await app.advance(10 * MIN);
    assert.equal(await app.countdown(), '25:00'); // still waiting
    assert.equal((await app.tones()).length, FOCUS_NOTES + BREAK_NOTES);
  });
});

test('AC-07/AC-08: with Auto-start breaks off the break waits, with Start break in the main position and Start focus beside it', async () => {
  await withApp({ storage: AUTO_START_OFF, audioSpy: {} }, async (app) => {
    await runFocusToEnd(app);
    assert.equal(await app.countdown(), '5:00');
    assert.equal(await app.title(), 'Ready · 5 min · Short break');
    assert.deepEqual(await visibleControls(app), ['Start focus', 'Start break']); // side-1 | main
    assert.equal((await mainState(app)).text, 'Start break');
    assert.equal((await app.tones()).length, FOCUS_NOTES);
  });
});

test('AC-03: a completion noticed long after (the device slept) leaves the break waiting, one Focus-end chime, no break-end chime', async () => {
  await withApp({ audioSpy: {} }, async (app) => {
    await runFocusToEnd(app, 3 * 60 * MIN);
    assert.equal(await app.phase(), 'Short break');
    assert.equal(await app.countdown(), '5:00'); // never counted down or used up while away
    assert.equal(await app.title(), 'Ready · 5 min · Short break');
    assert.deepEqual(await visibleControls(app), ['Start focus', 'Start break']);
    const tones = await app.tones();
    assert.equal(tones.length, FOCUS_NOTES);
    assert.ok(rising(tones));
    await app.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); // back to the tab
    await app.advance(60 * MIN);
    assert.equal((await app.tones()).length, FOCUS_NOTES); // exactly once, however long it stays
    assert.match(await app.sessionCount(), /: 1$/);
  });
});

test('AC-03: a Long break after a late completion also waits at its full length', async () => {
  await withApp({ audioSpy: {}, storage: { 'adjustable-durations:cycle-length': '2' } }, async (app) => {
    await runFocusToEnd(app); // Focus 1, on time: the short break auto-starts
    await app.advance(3000); // past the Skip guard
    await app.startFocus().click(); // skip it: Focus 2
    await app.advance(3 * 60 * MIN); // sleep through its end
    assert.equal(await app.phase(), 'Long break');
    assert.equal(await app.countdown(), '15:00');
    assert.deepEqual(await visibleControls(app), ['Start focus', 'Start break']);
    const tones = await app.tones();
    assert.equal(tones.length, FOCUS_NOTES * 2);
    assert.ok(tones.slice(FOCUS_NOTES).every((t, i, all) => i === 0 || t.frequency > all[i - 1].frequency));
  });
});

test('AC-04: Start focus outside the Skip guard ends the break at once, with no chime, and starts the Focus', async () => {
  await withApp({ audioSpy: {} }, async (app) => {
    await runFocusToEnd(app);
    await app.advance(3000); // the guard is over
    await app.startFocus().click();
    assert.equal(await app.phase(), 'Focus');
    assert.equal(await app.countdown(), '25:00');
    assert.equal(await app.title(), '25 min · Focus');
    assert.equal((await app.tones()).length, FOCUS_NOTES); // no break-end chime
    assert.match(await app.sessionCount(), /: 1$/); // the skipped break credits nothing
    await app.advance(1000);
    assert.equal(await app.countdown(), '24:59');
  });
});

test('AC-04: Start focus on a break that is waiting works at once — there is no guard on a waiting break', async () => {
  await withApp({ storage: AUTO_START_OFF }, async (app) => {
    await runFocusToEnd(app);
    await app.startFocus().click();
    assert.equal(await app.phase(), 'Focus');
    assert.equal(await app.countdown(), '25:00');
  });
});

test('AC-04: Start focus is also the way into the next Focus after a break ends', async () => {
  await withApp({}, async (app) => {
    await runFocusToEnd(app);
    await app.advance(5 * MIN);
    await app.startFocus().click();
    assert.equal(await app.phase(), 'Focus');
    await app.advance(1000);
    assert.equal(await app.countdown(), '24:59');
  });
});

test('AC-05: Start focus inside the 3 s Skip guard is greyed out and does nothing; it frees itself at 3 s', async () => {
  await withApp({ audioSpy: {} }, async (app) => {
    await runFocusToEnd(app); // the break auto-starts at the Focus end
    assert.deepEqual(await mainState(app), { text: 'Start focus', hidden: false, ariaDisabled: 'true' });
    await app.advance(2000);
    await app.startFocus().click({ force: true }); // a reflex press on the greyed control
    assert.equal(await app.phase(), 'Short break');
    assert.equal(await app.countdown(), '4:58'); // the break kept going
    assert.equal((await mainState(app)).ariaDisabled, 'true');
    await app.advance(999); // 2.999 s of real time
    await app.startFocus().click({ force: true });
    assert.equal(await app.phase(), 'Short break'); // still guarded — enforced by the engine, to the millisecond
    await app.advance(1); // exactly 3 s
    await app.startFocus().click({ force: true }); // the greyed look may trail one tick; the press already works
    assert.equal(await app.phase(), 'Focus');
    assert.equal((await app.tones()).length, FOCUS_NOTES);
  });
});

test('AC-05: the greyed look clears on its own within one render tick of the guard ending', async () => {
  await withApp({}, async (app) => {
    await runFocusToEnd(app);
    await app.advance(2000);
    assert.equal((await mainState(app)).ariaDisabled, 'true');
    await app.advance(1250); // 3.25 s: the guard ended and a tick has drawn it
    assert.equal((await mainState(app)).ariaDisabled, null);
    assert.equal(await app.phase(), 'Short break'); // nothing started by itself
  });
});

test('AC-05: pausing the break does not extend the guard, and Resume break starts no new one', async () => {
  await withApp({}, async (app) => {
    await runFocusToEnd(app);
    await app.advance(1000);
    await app.pauseBreak().click();
    assert.equal((await mainState(app)).ariaDisabled, 'true'); // paused inside the guard: still greyed
    await app.advance(10_000); // paused: nothing moves, but real time passes
    assert.equal(await app.countdown(), '4:59');
    assert.equal((await mainState(app)).ariaDisabled, null); // the guard ended in real time, paused or not
    await app.resumeBreak().click();
    assert.equal((await mainState(app)).ariaDisabled, null); // Resume starts no new guard
    await app.startFocus().click();
    assert.equal(await app.phase(), 'Focus');
  });
});

test('AC-05: a break started with Start break is guarded for 3 s from the press', async () => {
  await withApp({ storage: AUTO_START_OFF }, async (app) => {
    await runFocusToEnd(app);
    await app.startBreak().click();
    assert.equal((await mainState(app)).ariaDisabled, 'true');
    await app.advance(2999);
    await app.startFocus().click({ force: true });
    assert.equal(await app.phase(), 'Short break'); // 2.999 s after the Start break press: guarded
    await app.advance(1);
    await app.startFocus().click({ force: true });
    assert.equal(await app.phase(), 'Focus'); // 3 s: the break can be left
  });
});

test('AC-06: the break controls act only on the break — Reset break leaves it waiting at full length, Start break restarts it', async () => {
  await withApp({ audioSpy: {} }, async (app) => {
    await runFocusToEnd(app);
    await app.advance(10_000);
    await app.resetBreak().click();
    assert.equal(await app.phase(), 'Short break');
    assert.equal(await app.countdown(), '5:00');
    assert.deepEqual(await visibleControls(app), ['Start focus', 'Start break']);
    await app.startBreak().click();
    await app.advance(1000);
    assert.equal(await app.countdown(), '4:59');
    assert.equal((await app.tones()).length, FOCUS_NOTES); // none of it chimed or started a Focus
  });
});

test('AC-10: every control names its phase, and only the listed controls appear in each state', async () => {
  await withApp({ storage: PAUSE_ON }, async (app) => {
    assert.deepEqual(await visibleControls(app), ['Start focus']); // Focus waiting
    await app.startFocus().click();
    assert.deepEqual(await visibleControls(app), ['Reset focus', 'Pause focus']); // Focus running, pausing on
    await app.pauseFocus().click();
    assert.deepEqual(await visibleControls(app), ['Reset focus', 'Resume focus']);
    await app.resumeFocus().click();
    await app.advance(25 * MIN);
    assert.deepEqual(await visibleControls(app), ['Pause break', 'Start focus', 'Reset break']); // break running
    await app.pauseBreak().click();
    assert.deepEqual(await visibleControls(app), ['Resume break', 'Start focus', 'Reset break']); // break paused
    const labels = await app.page.evaluate(() => [...document.querySelectorAll('.timer-controls button')].map((b) => b.textContent));
    for (const label of labels) assert.doesNotMatch(label, /^(Start|Pause|Resume|Reset)$/);
    assert.equal(await app.phase(), 'Short break'); // the phase name stays visible as text
  });
});

test('AC-15: with Allow pausing focus off (the default) a running Focus has no pause control and Reset focus discards it uncounted', async () => {
  await withApp({ audioSpy: {} }, async (app) => {
    await app.startFocus().click();
    assert.deepEqual(await visibleControls(app), ['Reset focus']); // main is empty, Reset beside it
    assert.equal(await app.pauseFocus().count(), 0);
    await app.advance(10 * MIN);
    await app.resetFocus().click();
    assert.equal(await app.countdown(), '25:00');
    assert.deepEqual(await visibleControls(app), ['Start focus']);
    assert.match(await app.sessionCount(), /: 0$/); // never counted as a session
    assert.deepEqual(await app.tones(), []);
  });
});

test('AC-16/AC-17: Allow pausing focus on shows Pause focus; turning it off mid-Focus removes it at once and the Focus keeps running', async () => {
  await withApp({ storage: PAUSE_ON }, async (app) => {
    await app.startFocus().click();
    assert.deepEqual(await visibleControls(app), ['Reset focus', 'Pause focus']);
    await app.page.locator('#allow-pausing-focus').uncheck();
    assert.deepEqual(await visibleControls(app), ['Reset focus']);
    await app.advance(1000);
    assert.equal(await app.countdown(), '24:59'); // never altered the running phase
    assert.equal((await app.storage())['break-flow:allow-pausing-focus'], 'false');
    await app.page.locator('#allow-pausing-focus').check();
    assert.deepEqual(await visibleControls(app), ['Reset focus', 'Pause focus']);
  });
});

test('AC-07/AC-09: both toggles show next to the durations with the defaults, and the choice survives a reload', async () => {
  await withApp({}, async (app) => {
    assert.equal(await app.page.locator('#auto-start-breaks').isChecked(), true);
    assert.equal(await app.page.locator('#allow-pausing-focus').isChecked(), false);
    await app.page.locator('#auto-start-breaks').uncheck();
    await app.page.locator('#allow-pausing-focus').check();
    assert.deepEqual(
      Object.fromEntries(Object.entries(await app.storage()).filter(([k]) => k.startsWith('break-flow:'))),
      { 'break-flow:auto-start-breaks': 'false', 'break-flow:allow-pausing-focus': 'true' },
    );
    await app.page.reload();
    assert.equal(await app.page.locator('#auto-start-breaks').isChecked(), false);
    assert.equal(await app.page.locator('#allow-pausing-focus').isChecked(), true);
  });
});

test('AC-09: invalid saved values read as the defaults and the page works', async () => {
  await withApp({ storage: { 'break-flow:auto-start-breaks': 'maybe', 'break-flow:allow-pausing-focus': '1' } }, async (app) => {
    assert.equal(await app.page.locator('#auto-start-breaks').isChecked(), true);
    assert.equal(await app.page.locator('#allow-pausing-focus').isChecked(), false);
    await app.startFocus().click();
    await app.advance(1000);
    assert.equal(await app.countdown(), '24:59');
  });
});

// ---- AC-11: keyboard focus ----

test('AC-11: after a keyboard Start focus with pausing off (main empty) focus lands on the phase name, never on Reset focus', async () => {
  await withApp({}, async (app) => {
    await app.startFocus().focus();
    await app.page.keyboard.press('Enter');
    assert.equal(await app.phase(), 'Focus');
    assert.deepEqual(await visibleControls(app), ['Reset focus']);
    assert.equal(await focusedWhere(app), 'timer-phase');
    await app.page.keyboard.press('Enter'); // a repeated press lands on the phase name: it cannot reach Reset focus
    assert.equal(await app.phase(), 'Focus');
    assert.deepEqual(await visibleControls(app), ['Reset focus']); // the Focus was not discarded
    await app.advance(1000);
    assert.equal(await app.countdown(), '24:59');
  });
});

test('AC-11: a break auto-starting under keyboard focus on Pause focus moves it to the greyed Start focus, where Enter does nothing', async () => {
  await withApp({ storage: PAUSE_ON }, async (app) => {
    await app.startFocus().click();
    await app.pauseFocus().focus();
    await app.advance(25 * MIN); // the Focus ends and the break auto-starts under the User's keyboard focus
    assert.equal(await app.phase(), 'Short break');
    assert.equal(await focusedWhere(app), 'main');
    assert.deepEqual(await mainState(app), { text: 'Start focus', hidden: false, ariaDisabled: 'true' });
    await app.page.keyboard.press('Enter'); // a reflex key press inside the guard
    assert.equal(await app.phase(), 'Short break');
    await app.advance(3250); // the guard ends and a tick draws it: same control, focus stays
    assert.equal(await focusedWhere(app), 'main');
    assert.equal((await mainState(app)).ariaDisabled, null);
    await app.page.keyboard.press('Enter');
    assert.equal(await app.phase(), 'Focus');
  });
});

test('AC-11: Pause break and Resume break are one toggle — focus stays on it, so a double press pauses then resumes', async () => {
  await withApp({}, async (app) => {
    await runFocusToEnd(app);
    await app.advance(3000);
    await app.pauseBreak().focus();
    await app.page.keyboard.press('Enter');
    assert.equal(await app.resumeBreak().isVisible(), true);
    assert.equal(await focusedWhere(app), 'side-1');
    await app.page.keyboard.press('Enter');
    assert.equal(await app.pauseBreak().isVisible(), true);
    assert.equal(await focusedWhere(app), 'side-1');
    assert.equal(await app.phase(), 'Short break'); // a double press never skipped the break
  });
});

test('AC-11/AC-10: after Reset break focus moves to Start break, Start focus is not where Reset break was, and a repeated press cannot skip the break', async () => {
  await withApp({}, async (app) => {
    await runFocusToEnd(app);
    await app.advance(3000);
    await app.resetBreak().focus();
    const resetSlot = await focusedWhere(app);
    assert.equal(resetSlot, 'side-2');
    await app.page.keyboard.press('Enter');
    assert.equal(await focusedWhere(app), 'main');
    assert.equal((await mainState(app)).text, 'Start break');
    assert.equal(await app.page.locator('.timer-controls [data-slot="side-2"]').evaluate((el) => el.hidden), true); // nothing where Reset was
    await app.page.keyboard.press('Enter'); // the repeated press starts the break; it does not skip it
    assert.equal(await app.phase(), 'Short break');
    assert.equal(await app.pauseBreak().isVisible(), true);
  });
});

test('AC-11: keyboard focus outside the timer controls is never moved', async () => {
  await withApp({ storage: PAUSE_ON }, async (app) => {
    await app.startFocus().click();
    await app.page.locator('#task-label').focus();
    await app.advance(25 * MIN); // a break auto-starts: the set of controls changes
    assert.equal(await app.phase(), 'Short break');
    assert.equal(await focusedWhere(app), 'task-label');
    await app.page.locator('#duration-focus').focus();
    await app.advance(5 * MIN); // the break ends
    assert.equal(await focusedWhere(app), 'duration-focus');
    await app.page.locator('#allow-pausing-focus').focus();
    await app.page.keyboard.press('Space'); // a toggle changes the controls too
    assert.equal(await focusedWhere(app), 'allow-pausing-focus');
  });
});

// ---- AC-13: sound unavailable ----

test('AC-13: when sound is lost mid-phase the notice appears at the moment the break auto-starts, not at the next press', async () => {
  await withApp({ audioSpy: {} }, async (app) => {
    await app.startFocus().click(); // sound works at Start: no notice
    assert.equal(await app.notice().isVisible(), false);
    await app.page.evaluate(() => {
      window.__audioContexts[0].state = 'suspended'; // the browser took the sound away while the Focus ran
    });
    await app.advance(25 * MIN + 2000);
    assert.equal(await app.phase(), 'Short break'); // the break auto-started
    assert.equal(await app.notice().isVisible(), true); // and the notice is already there
    assert.deepEqual(await app.tones(), []); // the chime was not held back for later
  });
});

test('AC-13: with no Web Audio the page still auto-starts the break and shows the notice', async () => {
  await withApp({ noAudio: true }, async (app) => {
    await runFocusToEnd(app, 1000);
    assert.equal(await app.phase(), 'Short break');
    assert.equal(await app.countdown(), '4:59');
    assert.equal(await app.notice().isVisible(), true);
  });
});
