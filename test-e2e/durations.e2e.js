// e2e-through-UI tests for adjustable-durations (T11): every flow is driven through the
// real rendered page — typing into the fields, pressing Enter / blurring, clicking
// Start/Pause/Reset — against the BUILT index.html, with a controllable fake clock.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { launchBrowser, openApp, launchPersistent, locators, MIN, INDEX_URL } from './helpers.js';

const FOCUS_KEY = 'adjustable-durations:focus-duration';
const SHORT_KEY = 'adjustable-durations:short-break-duration';
const LONG_KEY = 'adjustable-durations:long-break-duration';
const CYCLE_KEY = 'adjustable-durations:cycle-length';

let browser;
before(async () => {
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
});

// Runs `body(app)` against a fresh, isolated page and always closes its context.
async function withApp(options, body) {
  const app = await openApp(browser, options);
  try {
    await body(app);
  } finally {
    await app.context.close();
  }
}

test('AC-01: a committed Focus duration is what the next fresh Focus runs for', async () => {
  await withApp({}, async (app) => {
    await app.commit(app.focusField(), '50');
    await app.start().click();
    await app.advance(1000);
    assert.equal(await app.countdown(), '49:59');
    assert.equal((await app.storage())[FOCUS_KEY], '50');
  });
});

test('AC-01: the Enter key and a blur both commit', async () => {
  await withApp({}, async (app) => {
    await app.commit(app.shortBreakField(), '10', 'enter');
    await app.commit(app.longBreakField(), '20', 'blur');
    const stored = await app.storage();
    assert.equal(stored[SHORT_KEY], '10');
    assert.equal(stored[LONG_KEY], '20');
  });
});

test('AC-02: an invalid duration commit reverts the field and shows the 1–180 message, storage unchanged', async () => {
  await withApp({}, async (app) => {
    for (const bad of ['0', '181', '-5', '12.5', '25abc', '1e2', 'abc', '']) {
      await app.commit(app.focusField(), bad);
      assert.equal(await app.focusField().inputValue(), '25', 'reverted after ' + JSON.stringify(bad));
      assert.equal(await app.message('duration-focus').isVisible(), true);
      assert.match(await app.message('duration-focus').textContent(), /1 to 180/);
      assert.equal((await app.storage())[FOCUS_KEY], '25');
    }
    assert.equal(await app.countdown(), '25:00');
  });
});

test('AC-02: a valid commit after an invalid one hides the message', async () => {
  await withApp({}, async (app) => {
    await app.commit(app.focusField(), '0');
    assert.equal(await app.message('duration-focus').isVisible(), true);
    await app.commit(app.focusField(), '30');
    assert.equal(await app.message('duration-focus').isVisible(), false);
  });
});

test('AC-03: committing while idle updates the idle countdown immediately', async () => {
  await withApp({}, async (app) => {
    assert.equal(await app.countdown(), '25:00');
    await app.commit(app.focusField(), '50');
    assert.equal(await app.countdown(), '50:00');
  });
});

test('AC-04: committing while running leaves the countdown untouched; AC-04b: Reset then shows the new duration', async () => {
  await withApp({}, async (app) => {
    await app.start().click();
    await app.advance(MIN);
    assert.equal(await app.countdown(), '24:00');
    await app.commit(app.focusField(), '50');
    assert.equal(await app.countdown(), '24:00');
    await app.advance(1000);
    assert.equal(await app.countdown(), '23:59');
    await app.reset().click();
    assert.equal(await app.countdown(), '50:00'); // AC-04b
  });
});

test('AC-05: committing while paused keeps the frozen time; resuming counts down from it', async () => {
  await withApp({}, async (app) => {
    await app.start().click();
    await app.advance(7 * MIN);
    await app.pause().click();
    assert.equal(await app.countdown(), '18:00');
    await app.commit(app.focusField(), '90');
    assert.equal(await app.countdown(), '18:00');
    await app.advance(5 * MIN); // paused: nothing moves
    assert.equal(await app.countdown(), '18:00');
    await app.start().click();
    await app.advance(1000);
    assert.equal(await app.countdown(), '17:59');
  });
});

test('AC-08: a write from another same-origin tab is ignored, then overwritten (never adopted) by the next legitimate write; session keys untouched', async () => {
  await withApp({}, async (app) => {
    const before = await app.storage();
    // review fix #2: a genuinely separate tab in the same browser context — this page
    // receives its localStorage write as a real 'storage' event.
    const otherTab = await app.context.newPage();
    await otherTab.goto(INDEX_URL);
    await otherTab.evaluate((key) => window.localStorage.setItem(key, '99'), LONG_KEY);
    await otherTab.close();
    await app.advance(1000); // let the app tick; nothing may react
    assert.equal(await app.longBreakField().inputValue(), '15'); // no UI reaction
    assert.equal(await app.countdown(), '25:00');
    await app.commit(app.shortBreakField(), '10');
    const after = await app.storage();
    assert.equal(after[LONG_KEY], '15'); // overwritten with the in-memory value
    assert.equal(after[SHORT_KEY], '10');
    for (const key of ['session-tracking:count', 'session-tracking:date', 'session-tracking:label']) {
      assert.equal(after[key], before[key], key + ' must not be touched by a duration commit');
    }
  });
});

test('AC-09: committed durations are pre-filled after a reload, and the idle countdown shows them', async () => {
  await withApp({}, async (app) => {
    await app.commit(app.focusField(), '50');
    await app.commit(app.shortBreakField(), '10');
    await app.commit(app.longBreakField(), '20');
    await app.page.reload();
    assert.equal(await app.focusField().inputValue(), '50');
    assert.equal(await app.shortBreakField().inputValue(), '10');
    assert.equal(await app.longBreakField().inputValue(), '20');
    assert.equal(await app.countdown(), '50:00');
  });
});

test('AC-09: invalid stored values are corrected on load — classic defaults shown and written back', async () => {
  await withApp({ storage: { [FOCUS_KEY]: '0', [SHORT_KEY]: 'abc', [LONG_KEY]: '181', [CYCLE_KEY]: '99' } }, async (app) => {
    assert.equal(await app.focusField().inputValue(), '25');
    assert.equal(await app.shortBreakField().inputValue(), '5');
    assert.equal(await app.longBreakField().inputValue(), '15');
    assert.equal(await app.cycleLengthField().inputValue(), '4');
    const stored = await app.storage();
    assert.deepEqual([stored[FOCUS_KEY], stored[SHORT_KEY], stored[LONG_KEY], stored[CYCLE_KEY]], ['25', '5', '15', '4']);
  });
});

test('AC-10: a committed cycle length governs the next Long-break decision', async () => {
  await withApp({}, async (app) => {
    await app.commit(app.cycleLengthField(), '2');
    assert.equal((await app.storage())[CYCLE_KEY], '2');
    await app.start().click();
    await app.advance(25 * MIN);
    assert.equal(await app.phase(), 'Short break');
    await app.start().click();
    await app.advance(5 * MIN);
    assert.equal(await app.phase(), 'Focus');
    await app.start().click();
    await app.advance(25 * MIN);
    assert.equal(await app.phase(), 'Long break'); // 2nd Focus, not the classic 4th
  });
});

test('AC-11: an invalid cycle-length commit reverts the field and shows the 2–8 message', async () => {
  await withApp({}, async (app) => {
    for (const bad of ['1', '9', '0', '-4', '4.5', 'abc', '']) {
      await app.commit(app.cycleLengthField(), bad);
      assert.equal(await app.cycleLengthField().inputValue(), '4', 'reverted after ' + JSON.stringify(bad));
      assert.equal(await app.message('cycle-length').isVisible(), true);
      assert.match(await app.message('cycle-length').textContent(), /2 to 8/);
      assert.equal((await app.storage())[CYCLE_KEY], '4');
    }
  });
});

test('AC-14: a committed cycle length is pre-filled after a reload; the session count is unchanged by the commit', async () => {
  await withApp({}, async (app) => {
    const countBefore = await app.sessionCount();
    await app.commit(app.cycleLengthField(), '6');
    assert.equal(await app.sessionCount(), countBefore);
    await app.page.reload();
    assert.equal(await app.cycleLengthField().inputValue(), '6');
  });
});

test('AC-13: lowering the cycle length mid-cycle changes nothing until the next Focus completes, then yields a Long break', async () => {
  await withApp({}, async (app) => {
    for (let i = 0; i < 2; i += 1) {
      await app.start().click();
      await app.advance(25 * MIN); // Focus done
      await app.start().click();
      await app.advance(5 * MIN); // Short break done
    }
    assert.equal(await app.phase(), 'Focus');
    await app.commit(app.cycleLengthField(), '2'); // 2 already reached
    assert.equal(await app.phase(), 'Focus'); // no retroactive Long break
    await app.start().click();
    await app.advance(25 * MIN);
    assert.equal(await app.phase(), 'Long break');
  });
});

test('NFR commit discipline: typing without Enter/blur applies nothing — display, storage and engine unchanged', async () => {
  await withApp({}, async (app) => {
    await app.focusField().click();
    await app.focusField().fill('50'); // still editing
    await app.focusField().pressSequentially('5'); // 505, intermediately invalid
    assert.equal(await app.countdown(), '25:00');
    assert.equal((await app.storage())[FOCUS_KEY], '25');
    assert.equal(await app.message('duration-focus').isVisible(), false); // not validated yet
  });
});

test('NFR self-contained load: zero network requests beyond the initial index.html', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const urls = [];
    // sensory-feedback T1: a blob: URL (the inline wake-up worker's source) is not a
    // network request, so it is not counted; every other URL still is.
    page.on('request', (request) => {
      if (!request.url().startsWith('blob:')) urls.push(request.url());
    });
    await page.goto(INDEX_URL);
    assert.deepEqual(urls, [INDEX_URL]);
    // Positive control: a real http request made by the page IS counted.
    await page.evaluate(() => fetch('http://127.0.0.1:9/control').catch(() => {}));
    assert.deepEqual(urls, [INDEX_URL, 'http://127.0.0.1:9/control']);
  } finally {
    await context.close();
  }
});

test('sensory-feedback spike: an inline Blob worker starts from file:// and posts a message back', async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(INDEX_URL);
    const reply = await page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const src = 'self.onmessage = (e) => setTimeout(() => self.postMessage(e.data + 1), 50);';
          const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
          const worker = new Worker(url);
          URL.revokeObjectURL(url);
          worker.onmessage = (e) => resolve(e.data);
          worker.onerror = () => reject(new Error('worker failed to start'));
          worker.postMessage(1);
        }),
    );
    assert.equal(reply, 2);
  } finally {
    await context.close();
  }
});

test('NFR display width: no control shifts across 1–180 minutes or the 100:00 → 99:59 crossing', async () => {
  await withApp({ storage: { [FOCUS_KEY]: '101' } }, async (app) => {
    const boxes = async () =>
      Promise.all([app.start(), app.pause(), app.reset(), app.focusField(), app.cycleLengthField()].map((l) => l.boundingBox()));
    const at101 = await boxes();
    assert.equal(await app.countdown(), '101:00');
    await app.start().click();
    await app.advance(MIN + 30 * 1000); // 101:00 → 99:30, across the 100 → 99 crossing
    assert.equal(await app.countdown(), '99:30');
    assert.deepEqual(await boxes(), at101);
    await app.reset().click();
    await app.commit(app.focusField(), '180');
    const at180 = await boxes();
    await app.commit(app.focusField(), '1');
    assert.deepEqual(await boxes(), at180);
  });
});

test('review fix #1 (AC-01/AC-03): with storage writes failing, a committed duration still governs the next Start', async () => {
  await withApp({ blockDurationWrites: true }, async (app) => {
    await app.commit(app.focusField(), '50');
    assert.equal(await app.countdown(), '50:00');
    await app.start().click();
    await app.advance(1000);
    assert.equal(await app.countdown(), '49:59');
    assert.equal(await app.focusField().inputValue(), '50');
  });
});

test('review fix #3 (AC-06/AC-08): Resume is not a fresh start — a stored change is neither adopted nor written', async () => {
  await withApp({}, async (app) => {
    await app.start().click();
    await app.advance(7 * MIN);
    await app.pause().click();
    await app.page.evaluate((key) => window.localStorage.setItem(key, '90'), FOCUS_KEY); // foreign, valid
    await app.page.evaluate((key) => window.localStorage.setItem(key, 'junk'), CYCLE_KEY); // foreign, invalid
    await app.start().click(); // Resume
    await app.advance(1000);
    assert.equal(await app.countdown(), '17:59');
    assert.equal(await app.focusField().inputValue(), '25');
    assert.equal(await app.cycleLengthField().inputValue(), '4');
    const stored = await app.storage();
    assert.equal(stored[FOCUS_KEY], '90'); // no write on Resume
    assert.equal(stored[CYCLE_KEY], 'junk');
  });
});

test('NFR persistence (AC-09/AC-14): committed durations and cycle length survive a full browser close and reopen', async () => {
  const profile = mkdtempSync(path.join(tmpdir(), 'pomodoro-e2e-'));
  try {
    const first = await launchPersistent(profile);
    try {
      await first.commit(first.focusField(), '50');
      await first.commit(first.shortBreakField(), '10');
      await first.commit(first.longBreakField(), '20');
      await first.commit(first.cycleLengthField(), '6');
    } finally {
      await first.context.close(); // the whole browser process exits — even if a commit failed
    }

    const second = await launchPersistent(profile);
    try {
      const app = { ...second, ...locators(second.page) };
      assert.equal(await app.focusField().inputValue(), '50');
      assert.equal(await app.shortBreakField().inputValue(), '10');
      assert.equal(await app.longBreakField().inputValue(), '20');
      assert.equal(await app.cycleLengthField().inputValue(), '6');
      assert.equal(await app.countdown(), '50:00');
    } finally {
      await second.context.close();
    }
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
});
