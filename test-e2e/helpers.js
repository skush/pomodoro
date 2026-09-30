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
// sensory-feedback: `viewport` and `reducedMotion` shape the context; `noAudio` removes the
// Web Audio API before the page runs (sound unavailable); `audioSpy` replaces AudioContext
// with a recording fake (see installAudioSpy) so a test can observe tones without hearing them.
export async function openApp(
  browser,
  { storage = {}, blockDurationWrites = false, viewport = { width: 900, height: 900 }, reducedMotion = 'no-preference', noAudio = false, audioSpy = null, realClock = false } = {},
) {
  const context = await browser.newContext({ viewport, reducedMotion });
  if (noAudio) {
    await context.addInitScript(() => {
      delete window.AudioContext;
      delete window.webkitAudioContext;
    });
  }
  if (audioSpy) await context.addInitScript(installAudioSpy, audioSpy);
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
  if (realClock) {
    // sensory-feedback: real time flows (the hidden-tab timing test); no fake clock.
    await page.goto(INDEX_URL);
    return { context, page, ...locators(page) };
  }
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

// Runs in the page before the app: replaces AudioContext with a fake that records every
// oscillator it is asked to start, on `window.__tones` as {frequency, at} where `at` is the
// page's Date.now() when the oscillator was scheduled. `state` is what resume() leaves the
// context in ('running' or 'suspended').
export function installAudioSpy({ state = 'running' } = {}) {
  window.__tones = [];
  window.AudioContext = class FakeAudioContext {
    constructor() {
      this.state = 'suspended';
      this.currentTime = 0;
      this.destination = {};
    }
    resume() {
      this.state = window.__audioState ?? state;
      return Promise.resolve();
    }
    createGain() {
      return { connect() {}, gain: { setValueAtTime() {}, linearRampToValueAtTime() {} } };
    }
    createOscillator() {
      const osc = { type: '', frequency: { value: 0 }, connect() {}, stop() {}, start() { window.__tones.push({ frequency: osc.frequency.value, at: Date.now() }); } };
      return osc;
    }
  };
}

export function locators(page) {
  const field = (id) => page.locator('#' + id);
  return {
    countdown: () => page.locator('.timer-countdown').textContent(),
    phase: () => page.locator('.timer-phase').textContent(),
    title: () => page.title(),
    notice: () => page.locator('.sound-notice'),
    tones: () => page.evaluate(() => window.__tones ?? []),
    // The Progress ring's remaining fraction, read back from the rendered SVG arc.
    ringFraction: () =>
      page.evaluate(() => {
        const arc = document.querySelector('.ring-arc');
        return 1 - Number(arc.getAttribute('stroke-dashoffset')) / Number(arc.getAttribute('stroke-dasharray'));
      }),
    ringPhase: () => page.locator('.progress-ring').getAttribute('data-phase'),
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
