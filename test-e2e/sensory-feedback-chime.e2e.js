// e2e-through-UI tests for sensory-feedback (T12): the Completion chime, observed through a
// recording fake AudioContext (tones are seen, not heard). Everything drives the BUILT root
// index.html in a real headless browser — run `npm run build` first.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser, openApp, MIN } from './helpers.js';

let browser;
before(async () => {
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
});

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

test('AC-07: no chime on Start, Pause, Resume, Reset, a duration commit or a cycle-length commit', async () => {
  await withApp({ audioSpy: {} }, async (app) => {
    await app.start().click();
    await app.advance(2 * MIN);
    await app.pause().click();
    await app.start().click(); // Resume
    await app.advance(MIN);
    await app.commit(app.focusField(), '30');
    await app.commit(app.cycleLengthField(), '3');
    await app.reset().click();
    await app.start().click();
    await app.advance(MIN);
    assert.deepEqual(await app.tones(), []);
  });
});

test('AC-05/AC-07: exactly one Focus-end chime (rising) per Focus completion, none again on returning to the tab', async () => {
  await withApp({ audioSpy: {} }, async (app) => {
    await app.start().click();
    await app.advance(25 * MIN);
    const tones = await app.tones();
    assert.equal(tones.length, FOCUS_NOTES);
    assert.ok(rising(tones));
    await app.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); // back to the tab
    await app.advance(10 * MIN);
    assert.equal((await app.tones()).length, FOCUS_NOTES); // waiting for Start: nothing further completes
  });
});

test('§6: on a visible tab the Focus-end chime starts at the deadline and no later than 250 ms after it', async () => {
  await withApp({ audioSpy: {} }, async (app) => {
    await app.start().click();
    const deadline = (await app.page.evaluate(() => Date.now())) + 25 * MIN; // the clock is paused: Start's instant
    await app.advance(25 * MIN);
    const tones = await app.tones();
    assert.equal(tones.length, FOCUS_NOTES);
    const lateBy = tones[0].at - deadline;
    assert.ok(lateBy >= 0 && lateBy <= 250, `chime ${lateBy} ms after the deadline (allowed 0..250)`);
  });
});

test('AC-05: a break completion plays the break-end tone (falling), once', async () => {
  await withApp({ audioSpy: {} }, async (app) => {
    await app.start().click();
    await app.advance(25 * MIN); // Focus chime
    await app.start().click();
    await app.advance(5 * MIN); // Short break completes
    const tones = await app.tones();
    assert.equal(tones.length, FOCUS_NOTES + BREAK_NOTES);
    assert.ok(falling(tones.slice(FOCUS_NOTES)));
  });
});

test('AC-10: a Focus completion plays one Focus-end chime and credits the Session counter exactly once; a break chimes and leaves it', async () => {
  await withApp({ audioSpy: {} }, async (app) => {
    assert.match(await app.sessionCount(), /: 0$/);
    await app.start().click();
    await app.advance(25 * MIN);
    assert.equal((await app.tones()).length, FOCUS_NOTES);
    assert.match(await app.sessionCount(), /: 1$/);
    await app.start().click();
    await app.advance(5 * MIN); // Short break completes
    assert.equal((await app.tones()).length, FOCUS_NOTES + BREAK_NOTES); // chimed
    assert.match(await app.sessionCount(), /: 1$/); // never changes the counter
  });
});

test('AC-10: a Focus that completed before a midnight that has since passed still chimes once but is not credited to the new day', async () => {
  await withApp({ audioSpy: {} }, async (app) => {
    await app.page.clock.setSystemTime(new Date('2026-09-29T23:30:00'));
    await app.start().click();
    await app.advance(40 * MIN); // true completion 23:55, the page next looks at 00:10 on the 30th
    assert.equal((await app.tones()).length, FOCUS_NOTES);
    assert.equal(await app.phase(), 'Short break');
    assert.match(await app.sessionCount(), /: 0$/); // the new day starts at zero
  });
});

test('AC-07: a Pause or Reset an instant before zero means no completion and no chime', async () => {
  await withApp({ audioSpy: {} }, async (app) => {
    await app.start().click();
    await app.advance(25 * MIN - 1500);
    await app.pause().click();
    await app.advance(10 * MIN);
    assert.deepEqual(await app.tones(), []);
    await app.reset().click();
    await app.start().click();
    await app.advance(25 * MIN - 1500);
    await app.reset().click();
    await app.advance(10 * MIN);
    assert.deepEqual(await app.tones(), []);
  });
});

test('AC-06b: after a long jump past the deadline the chime plays exactly once and the next phase waits for Start', async () => {
  await withApp({ audioSpy: {} }, async (app) => {
    await app.start().click();
    await app.advance(3 * 60 * MIN); // device slept for three hours
    assert.equal((await app.tones()).length, FOCUS_NOTES);
    assert.equal(await app.phase(), 'Short break');
    assert.equal(await app.title(), 'Ready · 5 min · Short break');
    await app.advance(60 * MIN);
    assert.equal((await app.tones()).length, FOCUS_NOTES);
  });
});

test('AC-11: when sound is suspended the notice shows at Start and at completion, the phase completes as usual, and nothing is chimed later', async () => {
  await withApp({ audioSpy: { state: 'suspended' } }, async (app) => {
    assert.equal(await app.notice().isVisible(), false);
    await app.start().click();
    await app.advance(1000);
    assert.equal(await app.notice().isVisible(), true); // found at Start, before the phase runs unattended
    await app.advance(25 * MIN);
    assert.equal(await app.phase(), 'Short break'); // completed as usual
    assert.match(await app.sessionCount(), /: 1$/); // Session counter credited
    assert.equal(await app.notice().isVisible(), true);
    await app.advance(60 * MIN);
    assert.deepEqual(await app.tones(), []); // never held back, never late
  });
});

test('AC-11: the notice stays until a later Start finds sound working', async () => {
  await withApp({ audioSpy: { state: 'suspended' } }, async (app) => {
    await app.start().click();
    await app.advance(1000);
    assert.equal(await app.notice().isVisible(), true);
    await app.page.evaluate(() => {
      window.__audioState = 'running';
    });
    await app.pause().click();
    assert.equal(await app.notice().isVisible(), true); // Pause does not clear it
    await app.start().click(); // Resume finds sound working
    await app.advance(1000);
    assert.equal(await app.notice().isVisible(), false);
  });
});

test('AC-11: with no Web Audio at all the page still runs and shows the notice', async () => {
  await withApp({ noAudio: true }, async (app) => {
    await app.start().click();
    await app.advance(1000);
    assert.equal(await app.notice().isVisible(), true);
    await app.advance(25 * MIN);
    assert.equal(await app.phase(), 'Short break');
  });
});

test('AC-12: a full run raises no permission prompt or dialog and makes no request beyond index.html', async () => {
  await withApp({ audioSpy: {} }, async (app) => {
    const requests = [];
    const dialogs = [];
    app.page.on('request', (r) => {
      if (!r.url().startsWith('blob:')) requests.push(r.url());
    });
    app.page.on('dialog', (d) => dialogs.push(d.type()));
    await app.start().click();
    await app.advance(25 * MIN);
    assert.deepEqual(requests, []);
    assert.deepEqual(dialogs, []);
    const permission = await app.page.evaluate(() => (typeof Notification === 'undefined' ? 'default' : Notification.permission));
    assert.equal(permission, 'default'); // nothing ever asked for notifications
  });
});

// Real time, no fake clock. The page's own 250 ms render loop never starts (noRenderLoop, applied
// before the app runs), so ONLY the wake-up worker can bring the page back at the deadline
// (ADR-0001). The page reports hidden.
const HIDDEN_ONE_MINUTE = { realClock: true, audioSpy: {}, noRenderLoop: true, storage: { 'adjustable-durations:focus-duration': '1' } };

async function startHiddenWithClickTimes(app) {
  await app.page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    window.addEventListener('click', () => {
      window.__t1 = Date.now(); // bubbles after the app's own handler
    });
    document.addEventListener(
      'click',
      () => {
        window.__t0 = Date.now(); // capture: before the app's own handler
      },
      true,
    );
  });
  await app.start().click();
  return app.page.evaluate(() => ({ t0: window.__t0, t1: window.__t1 }));
}

test('AC-06: hidden tab, real time — the wake-up alone completes the phase and the chime plays within 1 s, never before', async () => {
  const app = await openApp(browser, HIDDEN_ONE_MINUTE);
  try {
    const { t0, t1 } = await startHiddenWithClickTimes(app);
    // The deadline is one minute after Start — poll for the chime rather than sleeping blindly.
    await app.page.waitForFunction(() => window.__tones.length > 0, null, { timeout: 75_000, polling: 100 });
    const tones = await app.tones();
    assert.equal(tones.length, FOCUS_NOTES);
    const at = tones[0].at;
    assert.ok(at >= t0 + 60_000, `chime ${t0 + 60_000 - at} ms too early`);
    assert.ok(at <= t1 + 60_000 + 1000, `chime ${at - (t1 + 60_000)} ms after the deadline (limit 1000)`);
    assert.equal(await app.title(), 'Ready · 5 min · Short break'); // title already shows the next phase
  } finally {
    await app.context.close();
  }
});

// Negative control (review F1): the same setup with a worker that never answers. Nothing else
// can complete the phase, so it must still be running well after the deadline — proving the
// test above passes because of the worker, not the render loop.
test('AC-06 control: without a working wake-up worker the hidden page does not complete the phase', async () => {
  const app = await openApp(browser, { ...HIDDEN_ONE_MINUTE, deadWorker: true });
  try {
    const { t1 } = await startHiddenWithClickTimes(app);
    await app.page.waitForTimeout(Math.max(0, t1 + 60_000 + 2000 - Date.now()));
    assert.deepEqual(await app.tones(), []);
    assert.match(await app.title(), /Focus/); // still counting: nothing woke the page
  } finally {
    await app.context.close();
  }
});
