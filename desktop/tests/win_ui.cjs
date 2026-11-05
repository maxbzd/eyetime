// Drives the real EyeTime window on Windows (WebView2) through its debugging port, clicks through the screens, takes pictures.
// Started by smoke.ps1 after it launched eyetime.exe with WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || 'smoke-out';
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.log('FAIL', m); } else console.log('ok  ', m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let browser;
  for (let i = 0; i < 20 && !browser; i++) {
    try { browser = await chromium.connectOverCDP('http://127.0.0.1:9222'); } catch { await sleep(1000); }
  }
  ok(!!browser, 'connected to the window\'s debugging port');
  if (!browser) process.exit(1);
  const page = browser.contexts()[0].pages().find((p) => /home\.html|tauri|localhost/.test(p.url())) || browser.contexts()[0].pages()[0];
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 }).catch(() => {});
  await sleep(6000);
  const shot = (n) => page.screenshot({ path: path.join(OUT, `ui_${n}.png`) }).catch((e) => console.log('no picture', n, e.message));
  await shot('01_home');

  // text must be real text, in both languages (a wrong charset turns Russian into noise)
  const cs = await page.evaluate(() => document.characterSet);
  ok(cs === 'UTF-8', 'the page is read as UTF-8 (' + cs + ')');
  await page.evaluate(() => document.querySelector('#langBtn').click());
  await sleep(800);
  const ru = await page.evaluate(() => (document.querySelector('[data-i18n="mostUsed"]') || {}).textContent);
  ok(ru === 'Чаще всего', 'Russian shows as Russian: "' + ru + '"');
  await shot('02_home_ru');

  for (const name of ['rules', 'timer', 'insights', 'profile', 'settings']) {
    await page.evaluate((n) => ET.go(n), name);
    await sleep(2200);
    ok(await page.evaluate((n) => ET.view === n, name), 'the ' + name + ' screen opens');
    await shot('03_' + name);
  }
  await page.evaluate(() => ET.go('rules')); await sleep(1500);
  await page.evaluate(() => ET.rulesTab && ET.rulesTab('lists')); await sleep(1800);
  const marks = await page.evaluate(() => document.querySelectorAll('.app-tile[data-b] svg').length);
  ok(marks > 5, 'real app marks are shown (' + marks + ')');
  await shot('04_lists');
  await page.evaluate(() => ET.rulesTab && ET.rulesTab('protect')); await sleep(1500);
  await shot('05_protection');
  ok(await page.evaluate(() => !!document.querySelector('#etbPinCard')), 'the PIN card is in Protection');

  // a real session through the screens: start, it is in the service, leave it
  await page.evaluate(() => ET.go('home')); await sleep(1500);
  await page.evaluate(() => { ET.S.diff = 0; ET.S.min = 5; ET.S.name = 'Check'; ET.startSession(); });
  await sleep(6000);
  ok(await page.evaluate(() => ET.run.on), 'a session started in the window');
  const st = await page.evaluate(() => window.__TAURI__.core.invoke('helper', { req: { op: 'status' } }));
  ok(st && st.ok && st.data.session && st.data.session.name === 'Check', 'the service has that session');
  await shot('06_session');
  await page.evaluate(() => document.querySelector('#leaveBtn').click());
  await sleep(3000);
  const st2 = await page.evaluate(() => window.__TAURI__.core.invoke('helper', { req: { op: 'status' } }));
  ok(st2 && st2.ok && !st2.data.session, 'leaving ended it in the service');
  await shot('07_after');

  ok(errs.length === 0, 'no script errors in the window: ' + errs.slice(0, 3).join(' | '));
  await browser.close().catch(() => {});
  console.log(failed ? `${failed} FAILED` : 'ALL OK');
  process.exit(failed ? 1 : 0);
})();
