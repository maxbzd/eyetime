// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Test helper: launches Chromium with the extension and answers EVERY http(s) request itself (context.route), so youtube.com,
// github.com … "load" offline — no DNS, no TLS, no HSTS upgrades, no proxy — and the real block/track flows can be exercised.
// Requires Playwright (npm i -D playwright, or set PLAYWRIGHT_PATH) and Chromium (channel 'chromium').
let chromium;
try { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright')); } catch { ({ chromium } = require('playwright')); } // PLAYWRIGHT_PATH first: it is how a suite is run on the version CI pins
const path = require('path');
const EXT = process.env.EXT || path.join(__dirname, '../..'); // folder with manifest.json (repo root or dist/chrome)
const PORT = 8099;

const fakePage = (host, p) => `<!doctype html><title>${host}</title><body style="font:20px sans-serif;padding:40px"><h1>Fake site: ${host}</h1><p>path ${p}</p></body>`;

async function launch(opts = {}) {
  const ctx = await chromium.launchPersistentContext('/tmp/pw-profile-' + Date.now() + Math.random().toString(36).slice(2), {
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chromium' }), headless: true, // CHROME_PATH: another Chrome for Testing (beta, dev, canary: the nightly run)
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-proxy-server'],
    viewport: opts.viewport || { width: 1280, height: 800 }, ...(opts.deviceScaleFactor ? { deviceScaleFactor: opts.deviceScaleFactor } : {}), colorScheme: opts.colorScheme || 'light', ...(opts.recordVideo ? { recordVideo: opts.recordVideo } : {}),
  });
  // Settings opens on its essentials for a new person; the suites that drive a setting need all of them (a test that is about the essentials sets 'essentials' itself)
  await ctx.addInitScript(() => { try { if (location.protocol === 'chrome-extension:' && !localStorage.getItem('et-settings-mode')) localStorage.setItem('et-settings-mode', 'all'); } catch { /* no storage */ } });
  await ctx.route(/^https?:\/\//, (route) => { const u = new URL(route.request().url()); return route.fulfill({ status: 200, contentType: 'text/html', body: fakePage(u.host, u.pathname + u.search) }); });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 20000 });
  const id = sw.url().split('/')[2];
  for (let i = 0; i < 40; i++) { if (await sw.evaluate(() => typeof chrome.storage !== 'undefined').catch(() => false)) break; await new Promise(r => setTimeout(r, 250)); }
  // The daily ritual shows a card that depends on the time of day (morning, evening): the suites are about other things and must not depend on when they run.
  // ritual.cjs asks for it (`ritual: true`).
  if (!opts.ritual) await sw.evaluate(async () => { const { settings } = await chrome.storage.local.get('settings'); await chrome.storage.local.set({ settings: { ...(settings || {}), ritual: { on: false, eveningAt: '18:00' } } }); });
  const close = async () => { await ctx.close(); };
  return { ctx, sw, id, close, url: (h, p = '/') => `http://${h}:${PORT}${p}` };
}
module.exports = { launch, PORT };
