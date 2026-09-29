import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser, openApp } from './helpers.js';

let browser;
before(async () => {
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
});

test('smoke: the built page loads and the Focus countdown reads 25:00', async () => {
  const app = await openApp(browser);
  try {
    assert.equal(await app.phase(), 'Focus');
    assert.equal(await app.countdown(), '25:00');
  } finally {
    await app.context.close();
  }
});
