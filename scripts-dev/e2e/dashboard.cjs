// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The collector's dashboard in a browser, over the real handler and a made-up population: the key door, the period and its comparison, the two languages and themes,
// the exports (what a downloaded file holds), the public view, a narrow screen, and no console error anywhere.
//   node scripts-dev/e2e/dashboard.cjs
const fs = require('fs');
const http = require('http');
const path = require('path');
let chromium;
try { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright')); } catch { ({ chromium } = require('playwright')); }

const SRC = path.join(__dirname, '../..');
const TOKEN = 'dashboard-e2e-token-0123456789';
const DAY = 86400000;

(async () => {
  const { handle } = await import(path.join(SRC, 'server/usage/handler.js'));
  const { MemoryStore } = await import(path.join(SRC, 'server/usage/memory-store.js'));
  const { makeDemoSnapshot } = await import(path.join(SRC, 'server/usage/demo-data.js'));
  const html = fs.readFileSync(path.join(SRC, 'server/usage/dashboard.html'), 'utf8');
  const store = new MemoryStore(); store.snapshot = async () => makeDemoSnapshot(Date.now());
  const opts = { dashToken: TOKEN, publicStats: true, dashboardHtml: html, demo: (now) => makeDemoSnapshot(now) };
  const server = http.createServer(async (rq, rs) => {
    const res = await handle(new Request(`http://127.0.0.1${rq.url}`, { method: rq.method, headers: rq.headers }), store, Date.now(), opts);
    rs.writeHead(res.status, Object.fromEntries(res.headers)); rs.end(Buffer.from(await res.arrayBuffer()));
  }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const bad = [], ok = (c, m) => { if (!c) bad.push(m); };
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const open = async (url, { width = 1280, locale = 'en-US', scheme = 'light' } = {}) => {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale, colorScheme: scheme, acceptDownloads: true });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => bad.push('pageerror: ' + e.message));
    p.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/status of 40[01]/.test(m.text())) bad.push('console: ' + m.text()); });
    p.on('request', (r) => { if (!r.url().startsWith(base) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) bad.push('outside request: ' + r.url()); });
    await p.goto(base + url);
    return p;
  };
  const ready = (p) => p.waitForSelector('#now .kpi');
  const range = (p) => p.textContent('.rangetxt');

  // 1. the key door
  let p = await open('/');
  await p.waitForSelector('.gate');
  ok(await p.$('#now') === null, 'nothing is shown before the key');
  await p.fill('.gate input', 'not-the-key'); await p.click('.gate button[type=submit]');
  await p.waitForSelector('.gate .err'); ok(/not accepted/.test(await p.textContent('.gate .err')), 'a wrong key is refused in words');
  await p.fill('.gate input', TOKEN); await p.click('.gate button[type=submit]'); await ready(p);
  ok(await p.evaluate(() => sessionStorage.getItem('et-token')) === TOKEN && !(await p.evaluate(() => localStorage.getItem('et-token'))), 'the key lives in this tab only');
  await p.click('#bOut'); await p.waitForSelector('.gate');
  await p.context().close();
  p = await open('/#t=' + TOKEN); await ready(p);
  ok(!(await p.evaluate(() => location.hash)), 'a key given in the address is taken out of the address bar');
  await p.context().close();

  // 2. period and comparison
  p = await open('/?demo'); await ready(p);
  ok(/90 days/.test(await range(p)), 'the default period is 90 days');
  await p.click('.seg button:has-text("28 days")'); await p.waitForFunction(() => /28 days/.test(document.querySelector('.rangetxt').textContent));
  ok(/days=28/.test(await p.evaluate(() => location.search)), 'the period is in the address');
  ok((await p.$$('.dl')).length >= 3, 'the figures carry a change against the period before');
  ok(/Compared with the period before/.test(await range(p)), 'the comparison period is named');
  await p.uncheck('.switch input'); ok((await p.$$('.dl')).length === 0, 'comparison switched off');
  await p.check('.switch input');
  await p.click('.seg button:has-text("All time")'); await p.waitForFunction(() => /range=all/.test(location.search));
  ok((await p.$$('.dl')).length === 0 && !(await p.$('.switch')), 'all time has nothing to compare with');
  await p.click('.seg button:has-text("Custom")');
  await p.fill('.custom input >> nth=0', '2026-10-30'); await p.fill('.custom input >> nth=1', '2026-10-01'); await p.click('.custom .btn.primary');
  ok(/must not be later/.test(await p.textContent('.err')), 'a backwards period is explained');
  const to = await p.evaluate(() => document.querySelector('.custom input').max);
  const end = new Date(Date.parse(to) - 20 * DAY).toISOString().slice(0, 10), start = new Date(Date.parse(to) - 40 * DAY).toISOString().slice(0, 10);
  await p.fill('.custom input >> nth=0', start); await p.fill('.custom input >> nth=1', end); await p.click('.custom .btn.primary');
  await p.waitForFunction((a) => location.search.includes('from=' + a), start);
  ok(await p.$('.err') === null, 'a good period clears the error');
  ok(/\(21 days\)/.test(await range(p)), 'the chosen period is spelled out: ' + (await range(p)).slice(0, 80));
  await p.context().close();
  // an address with a period opens on it
  p = await open('/?demo&days=7'); await ready(p); ok(/7 days/.test(await range(p)), 'a period in the address is used'); await p.context().close();

  // 3. languages and themes
  p = await open('/?demo', { locale: 'ru-RU' }); await ready(p);
  ok(/Главное/.test(await p.textContent('#now h2')), 'Russian by browser language');
  await p.click('#bLang'); ok(/At a glance/.test(await p.textContent('#now h2')), 'English after the switch'); await p.click('#bLang');
  await p.click('#bTheme'); ok(await p.evaluate(() => document.documentElement.dataset.theme) === 'light', 'theme: light'); await p.click('#bTheme'); await p.click('#bTheme');
  ok(!(await p.evaluate(() => document.documentElement.dataset.theme)), 'theme: back to automatic');
  await p.context().close();

  // 4. exports
  p = await open('/?demo'); await ready(p);
  const grab = async (label) => { await p.click('details.menu summary'); const [dl] = await Promise.all([p.waitForEvent('download'), p.click(`.pop button:has-text("${label}")`)]); return { name: dl.suggestedFilename(), text: fs.readFileSync(await dl.path(), 'utf8') }; };
  const csv = await grab('CSV table');
  ok(/^eyetime-demo_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/.test(csv.name), 'csv file name carries the period: ' + csv.name);
  ok(csv.text.startsWith('﻿section,id,metric,label,value,k,n\r\n'), 'csv: BOM (Excel), header, CRLF');
  const rows = csv.text.trim().split('\r\n').slice(1).map((l) => l.split(','));
  for (const key of ['retention,d1', 'funnel,started', 'features,focus_start', 'speed,under250', 'flags,ritual', 'weekly,']) ok(rows.some((r) => (r[0] + ',' + r[1]).startsWith(key)), 'csv has ' + key);
  ok(rows.every((r) => r.length >= 7), 'csv: every row has its columns');
  const json = await grab('JSON data'); const j = JSON.parse(json.text);
  ok(j.v === 1 && j.range && j.retention && j.exported_at && j.mode === 'demo', 'json holds the collector answer and when it was exported');
  const md = await grab('Markdown report');
  ok(md.name.endsWith('.md') && /^# EyeTime report/.test(md.text) && /\| Sent a first report \|/.test(md.text), 'markdown report');
  await p.context().close();

  // 5. the public view, a narrow screen, the keyboard
  p = await open('/?public'); await ready(p);
  ok(!(await p.$('.seg')) && !(await p.$('#health')) && !(await p.$('#ret .hm')), 'public: no period bar, no health, no cohorts');
  await p.context().close();
  p = await open('/?demo', { width: 390 }); await ready(p);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll on a phone');
  await p.focus('.hrow >> nth=0'); ok(await p.evaluate(() => document.getElementById('tip').classList.contains('on')), 'a row shows its tooltip on keyboard focus');
  ok(await p.$$eval('button, summary, input', (els) => els.every((e) => ((e.getAttribute('aria-label') || e.textContent || e.getAttribute('placeholder') || '') + (e.labels && e.labels.length ? 'x' : '')).trim().length > 0)), 'every control has a name');
  await p.context().close();

  await browser.close(); server.close();
  if (bad.length) { console.error('FAIL\n' + bad.join('\n')); process.exit(1); }
  console.log('dashboard e2e: ok');
})().catch((e) => { console.error(e); process.exit(1); });
