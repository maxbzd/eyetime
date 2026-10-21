// Test helper: launches Chromium with the extension and answers EVERY http(s) request itself (context.route), so youtube.com,
// github.com … "load" offline — no DNS, no TLS, no HSTS upgrades, no proxy — and the real block/track flows can be exercised.
// Requires Playwright (npm i -D playwright, or set PLAYWRIGHT_PATH) and Chromium (channel 'chromium').
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright')); }
const path = require('path');
const EXT = process.env.EXT || path.join(__dirname, '../..'); // folder with manifest.json (repo root or dist/chrome)
const PORT = 8099;

const fakePage = (host, p) => `<!doctype html><title>${host}</title><body style="font:20px sans-serif;padding:40px"><h1>Fake site: ${host}</h1><p>path ${p}</p></body>`;

async function launch(opts = {}) {
  const ctx = await chromium.launchPersistentContext('/tmp/pw-profile-' + Date.now() + Math.random().toString(36).slice(2), {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-proxy-server'],
    viewport: opts.viewport || { width: 1280, height: 800 }, colorScheme: opts.colorScheme || 'light', ...(opts.recordVideo ? { recordVideo: opts.recordVideo } : {}),
  });
  await ctx.route(/^https?:\/\//, (route) => { const u = new URL(route.request().url()); return route.fulfill({ status: 200, contentType: 'text/html', body: fakePage(u.host, u.pathname + u.search) }); });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 20000 });
  const id = sw.url().split('/')[2];
  for (let i = 0; i < 40; i++) { if (await sw.evaluate(() => typeof chrome.storage !== 'undefined').catch(() => false)) break; await new Promise(r => setTimeout(r, 250)); }
  const close = async () => { await ctx.close(); };
  return { ctx, sw, id, close, url: (h, p = '/') => `http://${h}:${PORT}${p}` };
}
module.exports = { launch, PORT };
