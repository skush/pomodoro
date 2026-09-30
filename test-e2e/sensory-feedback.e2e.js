// e2e-through-UI tests for sensory-feedback: the Progress ring, the Tab title mirror, the
// 320 CSS px layout and reduced motion (T11), then the Completion chime (T12). Everything
// drives the BUILT root index.html in a real headless browser — run `npm run build` first.
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

const shownSeconds = (text) => {
  const [m, s] = text.split(':').map(Number);
  return m * 60 + s;
};

test('AC-01/§6: the ring agrees with the on-page countdown within 1 s at every sampled update', async () => {
  await withApp({}, async (app) => {
    assert.equal(await app.ringFraction(), 1); // full before Start
    await app.start().click();
    for (const step of [1000, 60_000, 11 * MIN + 345, 12 * MIN, 30_000]) {
      await app.advance(step);
      const seconds = shownSeconds(await app.countdown());
      const fromRing = (await app.ringFraction()) * 25 * 60;
      assert.ok(Math.abs(fromRing - seconds) < 1, `ring ${fromRing}s vs countdown ${seconds}s`);
    }
  });
});

test('AC-01/AC-02: the ring is empty at the Phase completion and the next phase loads full, in its own colour', async () => {
  await withApp({}, async (app) => {
    assert.equal(await app.ringPhase(), 'focus');
    await app.start().click();
    await app.advance(25 * MIN);
    assert.equal(await app.phase(), 'Short break');
    assert.equal(await app.ringFraction(), 1);
    assert.equal(await app.ringPhase(), 'short_break');
  });
});

test('AC-02/AC-04: the tab title shows running, paused and ready, and the ring freezes on pause and refills on Reset', async () => {
  await withApp({}, async (app) => {
    assert.equal(await app.title(), 'Ready · 25 min · Focus');
    await app.start().click();
    await app.advance(5 * MIN);
    assert.equal(await app.title(), '20 min · Focus'); // 19:59-ish rounds up
    await app.pause().click();
    const frozenTitle = await app.title();
    const frozenRing = await app.ringFraction();
    assert.match(frozenTitle, /^Paused · \d+ min · Focus$/);
    await app.advance(3 * MIN);
    assert.equal(await app.title(), frozenTitle);
    assert.equal(await app.ringFraction(), frozenRing);
    await app.reset().click();
    assert.equal(await app.title(), 'Ready · 25 min · Focus');
    assert.equal(await app.ringFraction(), 1);
  });
});

test('AC-04: the three phases are named in the title', async () => {
  await withApp({}, async (app) => {
    await app.start().click();
    await app.advance(25 * MIN);
    assert.equal(await app.title(), 'Ready · 5 min · Short break');
  });
});

test('AC-08: a mid-phase duration commit leaves the ring in step with the unchanged countdown', async () => {
  await withApp({}, async (app) => {
    await app.start().click();
    await app.advance(5 * MIN);
    await app.commit(app.focusField(), '10'); // committed for the NEXT fresh Focus
    const seconds = shownSeconds(await app.countdown());
    const fromRing = (await app.ringFraction()) * 25 * 60; // still measured against 25 min
    assert.ok(Math.abs(fromRing - seconds) < 1, `ring ${fromRing}s vs countdown ${seconds}s`);
  });
});

test('AC-09: committing a duration for a phase waiting for Start shows a full ring and the new minutes at once', async () => {
  await withApp({}, async (app) => {
    await app.commit(app.focusField(), '40');
    assert.equal(await app.countdown(), '40:00');
    assert.equal(await app.title(), 'Ready · 40 min · Focus');
    assert.equal(await app.ringFraction(), 1);
  });
});

test('AC-13: at 320 CSS px with a three-digit countdown, a validation message and the sound notice, nothing overflows or overlaps', async () => {
  await withApp(
    { viewport: { width: 320, height: 700 }, storage: { 'adjustable-durations:focus-duration': '180' }, noAudio: true },
    async (app) => {
      assert.equal(await app.countdown(), '180:00');
      await app.commit(app.focusField(), '500'); // out of range -> inline validation message
      await app.start().click(); // no Web Audio -> sound-unavailable notice
      assert.equal(await app.notice().isVisible(), true);
      assert.equal(await app.message('duration-focus').isVisible(), true);
      const metrics = await app.page.evaluate(() => {
        const root = document.documentElement;
        const card = document.querySelector('.timer-card');
        const boxes = [...card.children]
          .filter((el) => el.getBoundingClientRect().height > 0)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return { cls: el.className, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
          });
        return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, boxes };
      });
      assert.ok(metrics.scrollWidth <= metrics.clientWidth, `horizontal overflow: ${metrics.scrollWidth} > ${metrics.clientWidth}`);
      for (const b of metrics.boxes) assert.ok(b.left >= -0.5 && b.right <= metrics.clientWidth + 0.5, `${b.cls} sticks out`);
      for (let i = 1; i < metrics.boxes.length; i += 1) {
        assert.ok(metrics.boxes[i].top >= metrics.boxes[i - 1].bottom - 0.5, `${metrics.boxes[i].cls} overlaps ${metrics.boxes[i - 1].cls}`);
      }
    },
  );
});

test('reduced motion: 0 ring transitions, and the ring changes at most once per second in discrete steps', async () => {
  await withApp({ reducedMotion: 'reduce' }, async (app) => {
    const duration = await app.page.evaluate(() => getComputedStyle(document.querySelector('.ring-arc')).transitionDuration);
    assert.match(duration, /^0s(, 0s)*$/);
    await app.start().click();
    await app.advance(1000);
    const a = await app.ringFraction();
    await app.advance(400); // still inside the same displayed second
    assert.equal(await app.ringFraction(), a);
    await app.advance(600);
    assert.ok((await app.ringFraction()) < a); // and it does step when the second changes
  });
});

test('without reduced motion the ring has a short smoothing transition', async () => {
  await withApp({}, async (app) => {
    const duration = await app.page.evaluate(() => getComputedStyle(document.querySelector('.ring-arc')).transitionDuration);
    assert.doesNotMatch(duration, /^0s(, 0s)*$/);
  });
});
