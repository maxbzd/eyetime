// Hostile names must stay text. The window runs with the rights of the person (it can talk to the service), so a name that arrives from the
// computer (the name of a program in front: on NTFS a file may be called `<img src=x onerror=...>.exe`) or that someone typed (a rule, a site,
// a keyword) must never become markup. Two layers are checked: the screens escape what they show, and the page is served with the same
// Content-Security-Policy as the real window (read from tauri.conf.json), so that even a missed spot could not run a script.
//
// Run (the simulator must be running): node desktop/tests/xss_real.cjs   (needs playwright)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.SIM || 'http://127.0.0.1:8131';
const post = async (p, o) => (await fetch(BASE + p, { method: 'POST', body: JSON.stringify(o) })).json();
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.log('FAIL', m); } else console.log('ok  ', m); };

const conf = JSON.parse(fs.readFileSync(path.join(__dirname, '../app/src-tauri/tauri.conf.json'), 'utf8'));
const CSP = conf.app.security.csp;

// payloads that would run (or load something) if they were taken as markup
const EVIL = [
  '<img src=x onerror="window.__xss=1">',
  '"><svg onload="window.__xss=2">',
  '<script>window.__xss=3</script>',
  "'><iframe srcdoc='<script>parent.__xss=4</script>'>",
];

(async () => {
  // the policy that protects the real window: no inline script, no eval, nothing from outside
  const script = (CSP.match(/script-src([^;]*)/) || [])[1] || '';
  ok(!/unsafe-inline|unsafe-eval|\*|https?:/.test(script), "CSP script-src is 'self' only: " + script.trim());
  ok(/object-src 'none'/.test(CSP) && /base-uri 'none'/.test(CSP) && /frame-ancestors 'none'/.test(CSP), 'CSP closes objects, base and framing');
  const html = fs.readFileSync(path.join(__dirname, '../prototype/home.html'), 'utf8');
  ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), 'home.html has no inline script');
  ok(!/\son[a-z]+\s*=\s*["']/i.test(html), 'home.html has no inline event handler');

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    window.__TAURI__ = { core: { invoke: async (cmd, a) => { if (cmd === 'helper') { const r = await fetch('/req', { method: 'POST', body: JSON.stringify(a.req) }); return r.json(); } return null; } } };
  });
  // serve the page the way the window gets it: with the policy
  await ctx.route('**/*', async (route) => {
    const res = await route.fetch();
    const headers = { ...res.headers() };
    if (route.request().resourceType() === 'document') headers['content-security-policy'] = CSP;
    await route.fulfill({ response: res, headers });
  });
  const page = await ctx.newPage();
  const violations = [];
  page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text().slice(0, 120)); });
  await page.goto(BASE + '/home.html');
  await page.waitForTimeout(3500);

  // the name of a program in front, as the computer reports it
  await post('/sim', { procs: [['steam.exe', 10]], fg: EVIL[0] + '.exe' });
  // what someone typed: an item, a rule, a limit, a keyword, an exception
  await page.evaluate((evil) => {
    ET.store.set('et-items', JSON.stringify(evil.map((n, i) => ({ name: n, type: i % 2 ? 'app' : 'site', g: 'dis', color: '#f00', domain: '', exe: '' }))));
    ET.store.set('et-rules', JSON.stringify(evil.map((n, i) => ({ id: 'r' + i, name: n, kind: 'schedule', from: '09:00', to: '17:00', days: [0, 1, 2, 3, 4], block: 'dis', breaks: false, on: true, glyph: 'cal', level: 0 }))));
    ET.store.set('et-limits', JSON.stringify(evil.map((n, i) => ({ id: 'l' + i, name: n, kind: 'time', per: 'day', amount: 30, used: 0, on: true, color: '#f00' }))));
    ET.store.set('et-kw', JSON.stringify(evil));
    ET.store.set('et-ex', JSON.stringify(evil));
  }, EVIL);
  await page.waitForTimeout(1500);
  for (const screen of ['rules', 'insights', 'home']) {
    await page.evaluate((s) => ET.go(s), screen);
    await page.waitForTimeout(900);
    if (screen === 'rules') for (const tab of ['limits', 'lists', 'protect', 'triggers', 'rules']) { await page.evaluate((t) => ET.rulesTab(t), tab); await page.waitForTimeout(500); }
  }
  await page.waitForTimeout(6000); // the usage of the program in front reaches Insights
  await page.evaluate(() => ET.go('insights')); await page.waitForTimeout(900);

  ok(await page.evaluate(() => window.__xss === undefined), 'no script ran (window.__xss is untouched)');
  const injected = await page.evaluate(() => document.querySelectorAll('img[onerror], [onload], iframe[srcdoc], #app script:not([src]), main script:not([src])').length);
  ok(injected === 0, 'no hostile element was created in the screens (' + injected + ')');
  const shown = await page.evaluate(() => document.body.innerText);
  ok(/<img src=x/.test(shown) || /<svg onload/.test(shown) || /<script>window/.test(shown), 'the hostile names are shown as plain text');
  ok(violations.length === 0, 'the policy reported nothing: ' + violations.join(' | '));

  await browser.close();
  console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
