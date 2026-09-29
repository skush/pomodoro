// Dev-only e2e-through-UI harness (adjustable-durations T10). Drives the BUILT root
// index.html in a real headless browser — run `npm run build` first so it is current.
// Never imported by src/ and never inlined into index.html.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const INDEX_URL = pathToFileURL(path.resolve(HERE, '../index.html')).href;

// A fixed instant so every test's fake clock starts identically.
const START_TIME = new Date('2026-09-29T09:00:00');
export const MIN = 60 * 1000;

// Uses the system Edge by default (no browser download); set E2E_BROWSER_CHANNEL
// (e.g. "chrome") or E2E_BROWSER_PATH to point at another Chromium-family browser.
export async function launchBrowser() {
  const executablePath = process.env.E2E_BROWSER_PATH;
  const channel = process.env.E2E_BROWSER_CHANNEL ?? 'msedge';
  try {
    return await chromium.launch(executablePath ? { executablePath } : { channel });
  } catch (error) {
    throw new Error(
      'Could not launch a Chromium-family browser for the e2e tests. Install Microsoft Edge or ' +
        'Google Chrome, or set E2E_BROWSER_CHANNEL=chrome / E2E_BROWSER_PATH=<path to a browser ' +
        'binary>. Original error: ' + error.message,
    );
  }
}

// Opens a fresh browser context (isolated storage) with a controllable fake clock.
// `storage` is seeded into localStorage ONCE, before the app's scripts run — a
// sessionStorage marker stops the init script re-seeding on reload. With
// `blockDurationWrites`, every localStorage write to an adjustable-durations key
// throws (a quota/private-mode failure), while all other keys still work.
export async function openApp(browser, { storage = {}, blockDurationWrites = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 900, height: 900 } });
  await context.addInitScript((seed) => {
    if (window.sessionStorage.getItem('__e2e_seeded')) return;
    window.sessionStorage.setItem('__e2e_seeded', '1');
    for (const [key, value] of Object.entries(seed)) window.localStorage.setItem(key, value);
  }, storage);
  if (blockDurationWrites) {
    await context.addInitScript(() => {
      const { Storage } = window;
      const realSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function setItem(key, value) {
        if (String(key).startsWith('adjustable-durations:')) throw new Error('QuotaExceededError');
        return realSetItem.call(this, key, value);
      };
    });
  }
  const page = await context.newPage();
  await page.clock.install({ time: START_TIME });
  await page.goto(INDEX_URL);
  // Freeze time so only advance() moves it — no real-time flow, fully deterministic.
  await page.clock.pauseAt(new Date(START_TIME.getTime() + 1000));
  return { context, page, ...locators(page) };
}

// A real, on-disk browser profile, so a test can close the whole browser and launch
// it again on the same profile (the "close and reopen" persistence NFR). Real clock.
export async function launchPersistent(userDataDir) {
  const executablePath = process.env.E2E_BROWSER_PATH;
  const channel = process.env.E2E_BROWSER_CHANNEL ?? 'msedge';
  const context = await chromium.launchPersistentContext(userDataDir, executablePath ? { executablePath } : { channel });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(INDEX_URL);
  return { context, page, ...locators(page) };
}

export function locators(page) {
  const field = (id) => page.locator('#' + id);
  return {
    countdown: () => page.locator('.timer-countdown').textContent(),
    phase: () => page.locator('.timer-phase').textContent(),
    sessionCount: () => page.locator('.session-count').textContent(),
    start: () => page.getByRole('button', { name: 'Start' }),
    pause: () => page.getByRole('button', { name: 'Pause' }),
    reset: () => page.getByRole('button', { name: 'Reset' }),
    focusField: () => field('duration-focus'),
    shortBreakField: () => field('duration-short-break'),
    longBreakField: () => field('duration-long-break'),
    cycleLengthField: () => field('cycle-length'),
    message: (id) => page.locator('#' + id + '-message'),
    // Types `text` into the field and commits it the way a User does: Enter, or blur.
    async commit(fieldLocator, text, how = 'enter') {
      await fieldLocator.click();
      await fieldLocator.fill(text);
      if (how === 'enter') await fieldLocator.press('Enter');
      else await page.locator('.timer-phase').click(); // click elsewhere → blur
    },
    // Jumps the fake clock forward; due timers fire once at the new time (fast — no per-tick replay).
    advance: (ms) => page.clock.fastForward(ms),
    storage: () =>
      page.evaluate(() => {
        const out = {};
        for (let i = 0; i < window.localStorage.length; i += 1) {
          const key = window.localStorage.key(i);
          out[key] = window.localStorage.getItem(key);
        }
        return out;
      }),
  };
}
