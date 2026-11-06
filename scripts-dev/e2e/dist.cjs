// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The package that is shipped, not the source: the production build (bundled, minified) is loaded into Chromium and used.
//   npm run build && EXT=$PWD/dist/chrome node scripts-dev/e2e/dist.cjs
// The other suites reach into the source tree (`import('/src/shared/storage.js')`), which does not exist in a bundle, so this one only uses what a person or the browser can:
// the pages, the messages of the extension, the storage and the web. It plays the things that break when a bundler gets something wrong: every page starts without an error,
// a language other than English is read as data, a session starts and ends in the worker, a distracting site meets the pause page, time on a site is counted, the
// short-video guard (a content script) runs, and the worker answers.
const fs = require('fs');
const path = require('path');
const { launch } = require('./lib.cjs');

const EXT = process.env.EXT || '';
if (!EXT || !fs.existsSync(path.join(EXT, 'manifest.json')) || fs.existsSync(path.join(EXT, 'src/shared/storage.js'))) {
  console.error('Run it on the built package: npm run build, then EXT=$PWD/dist/chrome node scripts-dev/e2e/dist.cjs (the source tree has src/shared/storage.js; the package has not).');
  process.exit(2);
}

(async () => {
  const app = await launch({ viewport: { width: 1200, height: 850 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [];
  const ok = (c, m) => { if (!c) bad.push(m); };
  const errors = [];
  app.sw.on('console', (m) => { if (m.type() === 'error') errors.push('worker: ' + m.text()); });
  const watch = (p, name) => { p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`)); p.on('console', (m) => { if (m.type() === 'error' && !/GL Driver|GPU stall|favicon/.test(m.text())) errors.push(`${name}: ${m.text()}`); }); };

  // 1. every page starts and shows something
  const page = await app.ctx.newPage(); watch(page, 'page');
  await page.goto(ext('src/options/options.html')); await page.waitForTimeout(500);
  await page.evaluate(async () => { const { settings } = await chrome.storage.local.get('settings'); await chrome.storage.local.set({ settings: { ...(settings || {}), onboarded: true } }); });
  for (const [name, p, sel] of [['popup', 'src/popup/popup.html', 'body'], ['new tab', 'src/newtab/newtab.html', '#clock'], ['insights', 'src/insights/insights.html', 'main, .kpi, body'], ['settings', 'src/options/options.html', '#data, body'], ['onboarding', 'src/onboarding/onboarding.html', 'body'], ['break', 'src/break/break.html', 'body'], ['block page', 'src/blocked/blocked.html?u=https%3A%2F%2Fwww.youtube.com%2F&r=friction&a=pause', '#stage']]) {
    await page.goto(ext(p)); await page.waitForSelector(sel, { timeout: 8000 }).catch(() => bad.push(name + ' never showed ' + sel));
    await page.waitForTimeout(400);
    const text = await page.evaluate(() => document.body.innerText.trim().length);
    ok(text > 20, `${name} is empty (${text} characters)`);
  }

  // 2. a language that is not English: read as data by the bundle
  await page.goto(ext('src/options/options.html')); await page.waitForTimeout(400);
  await page.evaluate(async () => { const { settings } = await chrome.storage.local.get('settings'); await chrome.storage.local.set({ settings: { ...settings, language: 'ru' } }); });
  await page.reload(); await page.waitForTimeout(800);
  ok(await page.evaluate(() => document.documentElement.lang) === 'ru', 'the page is not in Russian after the language was set (the language file was not read)');
  ok(/[А-Яа-я]{4,}/.test(await page.evaluate(() => document.body.innerText)), 'no Russian words on the Settings page');
  await page.evaluate(async () => { const { settings } = await chrome.storage.local.get('settings'); await chrome.storage.local.set({ settings: { ...settings, language: 'en' } }); });

  // 3. the worker: a session starts and ends, a distracting site meets the pause page, time on a site is counted
  const started = await page.evaluate(async () => chrome.runtime.sendMessage({ type: 'focus:start', minutes: 5 }));
  ok(started && started.minutes === 5, 'focus:start did not answer with the session: ' + JSON.stringify(started));
  ok(await page.evaluate(async () => !!(await chrome.storage.local.get('focus')).focus), 'the session is not in storage');
  const stopped = await page.evaluate(async () => chrome.runtime.sendMessage({ type: 'focus:stop' }));
  ok(stopped && stopped.ok === true, 'focus:stop did not answer: ' + JSON.stringify(stopped));
  const site = await app.ctx.newPage(); watch(site, 'site');
  await site.goto(app.url('youtube.com')).catch(() => {}); await site.waitForTimeout(1500);
  ok(/blocked\.html/.test(site.url()), 'a distracting site did not get the pause page: ' + site.url());
  await site.goto(app.url('github.com')).catch(() => {}); await site.bringToFront(); await site.waitForTimeout(2600);
  await page.evaluate(async () => chrome.runtime.sendMessage({ type: 'tracker:sync' }));
  await page.waitForTimeout(500);
  const counted = await page.evaluate(async () => { const all = await chrome.storage.local.get(null); const day = Object.entries(all).filter(([k]) => k.startsWith('d:')).map(([, v]) => v.d || {}); return Object.assign({}, ...day); });
  ok(Object.keys(counted).some((h) => /github\.com/.test(h)), 'no time was counted on the site that was open: ' + JSON.stringify(counted));

  // 4. the short-video guard (a content script, a classic script of its own)
  const yt = await app.ctx.newPage(); watch(yt, 'yt');
  await page.evaluate(async () => { const { settings } = await chrome.storage.local.get('settings'); await chrome.storage.local.set({ settings: { ...settings, shorts: { ...(settings.shorts || {}), enabled: true } } }); });
  await yt.goto(app.url('www.youtube.com', '/shorts/abc')).catch(() => {}); await yt.waitForTimeout(1200);
  ok(!(await yt.evaluate(() => document.documentElement.dataset.etBroken)), 'the content script reported a failure');

  // 5. the worker answers, and what it holds is a bundle (one file), not a tree
  ok(await app.sw.evaluate(() => typeof chrome.runtime.getManifest().version === 'string'), 'the worker does not answer');
  const files = fs.readdirSync(path.join(EXT, 'src/background'));
  ok(files.filter((f) => f.endsWith('.js')).length <= 2, 'the worker is not a bundle: ' + files.join(','));

  ok(errors.length === 0, 'errors in the console: ' + [...new Set(errors)].slice(0, 6).join(' | '));
  console.log(bad.length ? 'FAIL dist\n  ' + bad.join('\n  ') : 'PASS dist: the shipped package starts, speaks Russian, runs a session, blocks, counts, and is quiet in the console');
  await app.close();
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
