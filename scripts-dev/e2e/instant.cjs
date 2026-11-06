// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Instant blocking in a real browser, against a real server: how many requests reach the distracting site before the pause page is up.
//   node scripts-dev/e2e/instant.cjs
// (the other suites answer every request themselves, which hides exactly this: the request that leaves before the extension can say no)
// Chrome only gives an extension access to websites after a click in its own prompt, which a script cannot press, so the suite runs a copy of the extension that declares
// that access up front (the same code, one line added to the manifest).
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright')); }

const SRC = process.env.EXT || path.join(__dirname, '../..');
const PORT = 8099;

(async () => {
  const ext = fs.mkdtempSync(path.join(os.tmpdir(), 'et-instant-'));
  for (const f of ['manifest.json', '_locales', 'icons', 'src']) fs.cpSync(path.join(SRC, f), path.join(ext, f), { recursive: true });
  const man = JSON.parse(fs.readFileSync(path.join(ext, 'manifest.json'), 'utf8'));
  man.host_permissions = ['http://*/*', 'https://*/*'];
  fs.writeFileSync(path.join(ext, 'manifest.json'), JSON.stringify(man));

  let hits = []; // the page requests that reached the site (not the icon the browser also asks for)
  const server = http.createServer((q, r) => { if (q.url !== '/favicon.ico') hits.push(q.headers.host + q.url); r.setHeader('content-type', 'text/html'); r.end(`<title>site</title><h1>the real site</h1>${q.url}`); }).listen(PORT);
  const ctx = await chromium.launchPersistentContext(path.join(os.tmpdir(), 'pw-instant-' + Date.now()), {
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chromium' }), headless: true,
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--no-proxy-server', '--host-resolver-rules=MAP *.example.test 127.0.0.1, MAP example.test 127.0.0.1'],
  });
  const bad = [];
  const ok = (c, m) => { if (!c) bad.push(m); };
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 20000 });
  for (let i = 0; i < 40; i++) { if (await sw.evaluate(() => typeof chrome.storage !== 'undefined').catch(() => false)) break; await new Promise((r) => setTimeout(r, 250)); }
  const id = sw.url().split('/')[2];
  // a deep merge of a plain object into the stored settings
  const settings = (patch) => sw.evaluate(async (pt) => {
    const merge = (a, b) => { for (const [k, v] of Object.entries(b)) a[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(a[k] && typeof a[k] === 'object' ? a[k] : {}, v) : v; return a; };
    const { settings } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({ settings: merge(settings || {}, pt) });
  }, patch);
  const rules = () => sw.evaluate(async () => (await chrome.declarativeNetRequest.getDynamicRules()).length);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const open = async (url) => { const p = await ctx.newPage(); hits = []; await p.goto(url).catch(() => {}); await wait(900); return p; };
  const base = (h, p = '/') => `http://${h}:${PORT}${p}`;
  // a name that is in no browser's built-in HSTS list (youtube.com is: a real Chrome would turn http into https and never reach this server)
  await settings({ onboarded: true, ritual: { on: false, eveningAt: '18:00' }, blocking: { custom: ['distract.example.test'] } });

  // 1. without it: the request leaves, then the pause page takes over (the leak this feature closes)
  ok((await rules()) === 0, 'rules without the setting');
  let p = await open(base('www.distract.example.test', '/watch?v=a&t=5'));
  ok(/blocked\.html/.test(p.url()), 'off: no pause page ' + p.url());
  const leak = hits.length;
  await p.close();

  // 2. on: no request reaches the site, and the address arrives whole
  await settings({ blocking: { instant: true } });
  for (let i = 0; i < 40 && !(await rules()); i++) await wait(100);
  ok((await rules()) > 10, 'the rules were not put in place: ' + (await rules()));
  for (let i = 0; i < 5; i++) {
    const q = await open(base('www.distract.example.test', '/watch?v=a&t=5'));
    ok(hits.length === 0, `on: ${hits.length} request(s) reached the site: ${hits.join(' ')}`);
    ok(/blocked\.html\?d=1&r=friction&a=pause&u=http:\/\/www\.distract\.example\.test:8099\/watch\?v=a&t=5$/.test(q.url()), 'the address did not arrive whole: ' + q.url());
    if (i < 4) await q.close(); else p = q;
  }
  ok(await p.locator('#sitePill .host').innerText() === 'distract.example.test', 'the pause page does not name the site');
  ok(await p.locator('#cont').isVisible(), 'no continue button');

  // 3. the attempt is counted once, although two things (the rule and the tab blocker) saw it
  const day = await sw.evaluate(async () => { const all = await chrome.storage.local.get(null); return Object.entries(all).filter(([k]) => k.startsWith('d:')).map(([, v]) => v.pa || {}); });
  ok(day.some((pa) => pa['distract.example.test'] >= 1), 'the temptation was not counted: ' + JSON.stringify(day));

  // 4. "continue" ends at the real page, address and fragment intact, and the rule does not send it back
  await p.waitForFunction(() => { const b = document.querySelector('#cont'); return b && !b.disabled; }, null, { timeout: 15000 });
  hits = [];
  await Promise.all([p.waitForURL(/distract\.example\.test:8099/, { timeout: 15000 }), p.locator('#cont').click()]);
  await wait(700);
  ok(p.url() === base('www.distract.example.test', '/watch?v=a&t=5'), 'did not land on the site: ' + p.url());
  ok(hits.length === 1, 'the site was asked ' + hits.length + ' times after continue');
  const again = await open(base('www.distract.example.test', '/other'));
  ok(again.url() === base('www.distract.example.test', '/other'), 'inside the pass the site was stopped again: ' + again.url());
  await again.close();

  // 5. a rule that is out of date must not trap the page: policy says allow, a rule says redirect
  await sw.evaluate(async () => {
    const u = chrome.runtime.getURL('src/blocked/blocked.html');
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [{ id: 99999, priority: 50, action: { type: 'redirect', redirect: { regexSubstitution: u + '?d=1&r=friction&a=pause&u=\\1' } }, condition: { regexFilter: '^(https?://[^/]*neutral\\.example\\.test(?::\\d+)?/.*)$', resourceTypes: ['main_frame'] } }] });
  });
  const stale = await open(base('neutral.example.test', '/a?x=1&y=2'));
  ok(stale.url() === base('neutral.example.test', '/a?x=1&y=2'), 'an out-of-date rule trapped the page: ' + stale.url());
  ok(hits.length === 1, 'neutral site was asked ' + hits.length + ' times');
  ok((await sw.evaluate(async () => (await chrome.declarativeNetRequest.getDynamicRules()).some((r) => r.id === 99999))) === false, 'the out-of-date rule is still there');
  await stale.close();

  // 6. a session: the same site is now a hard block, with no request either (the pass of step 4 is over)
  await sw.evaluate(() => chrome.storage.local.remove('passes'));
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${id}/src/options/options.html`); await wait(400);
  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'focus:start', minutes: 5 }));
  await wait(600);
  const f = await open(base('m.distract.example.test', '/'));
  ok(hits.length === 0, 'during a session ' + hits.length + ' request(s) reached the site');
  ok(/r=focus&a=block/.test(f.url()), 'during a session the rule did not say block: ' + f.url());
  await f.close();
  await page.evaluate(() => chrome.runtime.sendMessage({ type: 'focus:stop' }));

  // 7. off again: every rule is gone and the site opens
  await settings({ blocking: { instant: false, friction: { enabled: false } } });
  for (let i = 0; i < 40 && (await rules()); i++) await wait(100);
  ok((await rules()) === 0, 'rules remain after the switch was turned off');
  await wait(300);
  const off = await open(base('www.distract.example.test', '/free'));
  ok(off.url() === base('www.distract.example.test', '/free'), 'with it off and the pause off the site did not open: ' + off.url());

  console.log(`requests that reached the site before the pause page: off ${leak}, on 0 (5 tries)`);
  console.log(bad.length ? 'FAIL instant\n  ' + bad.join('\n  ') : 'PASS instant: no request reaches a distracting site, the address arrives whole, "continue" and sessions work, a stale rule cannot trap the page');
  await ctx.close(); server.close(); fs.rmSync(ext, { recursive: true, force: true });
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
