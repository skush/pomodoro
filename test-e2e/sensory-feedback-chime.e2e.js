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

// Real time, no fake clock: the page's own 250 ms render loop is disabled, so ONLY the
// wake-up worker can bring the page back at the deadline (ADR-0001). The page reports hidden.
test('AC-06: hidden tab, real time — the wake-up alone completes the phase and the chime plays within 1 s, never before', async () => {
  const app = await openApp(browser, { realClock: true, audioSpy: {}, storage: { 'adjustable-durations:focus-duration': '1' } });
  try {
    await app.page.evaluate(() => {
      window.setInterval = () => 0; // no render loop from here on
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
    const { t0, t1 } = await app.page.evaluate(() => ({ t0: window.__t0, t1: window.__t1 }));
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
