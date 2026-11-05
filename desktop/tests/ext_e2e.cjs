// The browser extension in a real Chromium, talking through a native host to the real helper logic (the simulator).
// Needs: eyetime-sim running on 8131 (cargo build -p eyetime-helper --bin eyetime-sim; ./target/debug/eyetime-sim prototype 8131), playwright.
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const BASE = process.env.SIM || 'http://127.0.0.1:8131';
const EXT = path.resolve(__dirname, '../extension');
const HOST = path.resolve(__dirname, 'native_host_sim.py');
const ID = process.env.EXT_ID || 'ohpkalpfhikadmajknogifbcljaennho';
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.log('FAIL', m); } else console.log('ok  ', m); };
const post = async (p, o) => (await fetch(BASE + p, { method: 'POST', body: JSON.stringify(o) })).json();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// the page's real address (Playwright's cached one lags behind navigations that the extension makes)
const href = (p) => p.evaluate(() => location.href).catch(() => '');
const until = async (p, f, ms = 12000) => { const t = Date.now(); while (Date.now() - t < ms) { if (f(await href(p))) return true; await sleep(300); } return false; };

(async () => {
  fs.chmodSync(HOST, 0o755);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eyetime-ext-'));
  fs.mkdirSync(path.join(dir, 'NativeMessagingHosts'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'NativeMessagingHosts', 'com.eyetime.helper.json'), JSON.stringify({ name: 'com.eyetime.helper', description: 'test', path: HOST, type: 'stdio', allowed_origins: [`chrome-extension://${ID}/`] }));
  const ctx = await chromium.launchPersistentContext(dir, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker', { timeout: 15000 }));
  ok(sw.url().startsWith(`chrome-extension://${ID}/`), 'the extension loaded with its fixed id');

  await post('/req', { op: 'set_state', keys: { 'et-items': [{ name: 'YouTube', type: 'site', g: 'dis' }], 'et-kw': ['casino'], 'et-ex': ['youtube.com/watch?v=ok'] } });
  const page = await ctx.newPage();
  // nothing is closed before a session
  await page.goto('http://example.com/', { waitUntil: 'commit' }).catch(() => {});
  await sleep(1500);
  ok(!(await href(page)).includes('blocked.html'), 'nothing is closed without a session');

  await post('/req', { op: 'start_session', name: 't', minutes: 20, level: 0, blocks: [], scene: '', allow_breaks: false, dnd: false, mute: false, close_now: false });
  await sleep(4500); // the extension asks every 2.5 s
  const st = (await post('/req', { op: 'status' })).data;
  ok(st.extConnected === true, 'the helper sees the extension (extConnected)');

  await page.goto('https://www.youtube.com/', { waitUntil: 'commit' }).catch(() => {});
  await until(page, (u) => u.includes('blocked.html'));
  ok((await href(page)).startsWith(`chrome-extension://${ID}/blocked.html`), 'a closed site is replaced by the EyeTime page');
  ok(/youtube\.com/.test(await page.textContent('#s').catch(() => '')), 'the page says which site: ' + (await page.textContent('#s').catch(() => '')));
  await page.screenshot({ path: path.join(process.env.SHOTS || os.tmpdir(), 'ext_blocked.png') });

  await page.goto('https://example.org/best-casino-bonus', { waitUntil: 'commit' }).catch(() => {});
  await until(page, (u) => u.includes('blocked.html'));
  ok((await href(page)).includes('w=keyword'), 'a word closes a page on any site');

  await page.goto('https://www.youtube.com/watch?v=ok', { waitUntil: 'commit' }).catch(() => {});
  await sleep(1500);
  ok(!(await href(page)).includes('blocked.html'), 'an exception address stays open');

  // the session ends: the closed page opens again by itself
  await page.goto('https://www.youtube.com/', { waitUntil: 'commit' }).catch(() => {});
  await until(page, (u) => u.includes('blocked.html'));
  const c = (await post('/req', { op: 'challenge', action: 'end_session' })).data;
  const r = await post('/req', { op: 'complete', challenge_id: c.id, answer: '' });
  ok(r.ok, 'the session was ended');
  await until(page, (u) => !u.includes('blocked.html'), 15000);
  ok(!(await href(page)).includes('blocked.html'), 'the page opens again after the block');

  await ctx.close();
  console.log(failed ? `${failed} FAILED` : 'ALL OK');
  process.exit(failed ? 1 : 0);
})();
