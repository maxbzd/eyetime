// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The collector's dashboard in a browser, over the real handler and a made-up population: the key door, every page, the period and its comparison, the filters, the two languages and
// themes, the exports (what a downloaded file holds), the public view, a narrow screen, and no console error anywhere.
//   node scripts-dev/e2e/dashboard.cjs
const fs = require('fs');
const http = require('http');
const path = require('path');
let chromium;
try { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright')); } catch { ({ chromium } = require('playwright')); }

const SRC = path.join(__dirname, '../..');
const TOKEN = 'dashboard-e2e-token-0123456789';
const DAY = 86400000;
const PAGES = ['overview', 'growth', 'activation', 'retention', 'audience', 'feedback', 'features', 'experiments', 'product', 'quality', 'method'];

(async () => {
  const { handle } = await import(path.join(SRC, 'server/usage/handler.js'));
  const { MemoryStore } = await import(path.join(SRC, 'server/usage/memory-store.js'));
  const { makeDemoSnapshot } = await import(path.join(SRC, 'server/usage/demo-data.js'));
  const { makeDemoFeedback } = await import(path.join(SRC, 'server/usage/demo-feedback.js'));
  const { MemoryFeedbackStore } = await import(path.join(SRC, 'server/usage/feedback-store.js'));
  const html = fs.readFileSync(path.join(SRC, 'server/usage/dashboard.html'), 'utf8');
  const store = new MemoryStore(); store.snapshot = async () => makeDemoSnapshot(Date.now());
  const feedback = new MemoryFeedbackStore(); feedback.rows = makeDemoFeedback(Date.now()).reverse().map(({ can_reply, replies, ...r }) => ({ ...r, tk: can_reply ? 'e2e-' + r.id : null })); feedback.seq = feedback.rows.length;
  const opts = { dashToken: TOKEN, publicStats: true, dashboardHtml: html, demo: (now) => makeDemoSnapshot(now), feedback, demoFeedback: makeDemoFeedback };
  const server = http.createServer(async (rq, rs) => {
    const chunks = []; for await (const c of rq) chunks.push(c);
    const res = await handle(new Request(`http://127.0.0.1${rq.url}`, { method: rq.method, headers: rq.headers, body: chunks.length && !['GET', 'HEAD'].includes(rq.method) ? Buffer.concat(chunks) : undefined }), store, Date.now(), opts);
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
  const ready = (p) => p.waitForSelector('main .kpi');
  const range = (p) => p.textContent('.rangetxt');
  const h1 = (p) => p.textContent('main h1');

  // 1. the key door
  let p = await open('/');
  await p.waitForSelector('.gate');
  ok(await p.$('main .kpi') === null, 'nothing is shown before the key');
  await p.fill('.gate input', 'not-the-key'); await p.click('.gate button[type=submit]');
  await p.waitForSelector('.gate .err'); ok(/not accepted/.test(await p.textContent('.gate .err')), 'a wrong key is refused in words');
  await p.fill('.gate input', TOKEN); await p.click('.gate button[type=submit]'); await ready(p);
  ok(await p.evaluate(() => sessionStorage.getItem('et-token')) === TOKEN && !(await p.evaluate(() => localStorage.getItem('et-token'))), 'the key lives in this tab only');
  await p.click('#bOut'); await p.waitForSelector('.gate');
  await p.context().close();
  p = await open('/#t=' + TOKEN); await ready(p);
  ok(!(await p.evaluate(() => location.hash)), 'a key given in the address is taken out of the address bar');
  await p.context().close();

  // 2. every page opens, has its head and something to read, and the address follows
  p = await open('/?demo'); await ready(p);
  ok((await p.$$('nav.pages a')).length === PAGES.length, 'the navigation lists every page');
  for (const id of PAGES) {
    await p.click(`nav.pages a[href="#${id}"]`); await p.waitForSelector(`nav.pages a[href="#${id}"][aria-current="page"]`);
    ok((await h1(p)).trim().length > 2, 'page ' + id + ' has a title');
    ok((await p.$$('main .card')).length >= 1, 'page ' + id + ' has content');
    ok(await p.$eval(`nav.pages a[href="#${id}"]`, (a) => a.getAttribute('aria-current')) === 'page', 'the current page is marked: ' + id);
  }
  await p.context().close();
  p = await open('/?demo#retention'); await ready(p); ok(/Retention/.test(await h1(p)), 'an address with a page opens on it');
  ok(await p.$('table.hm') !== null && (await p.$$('svg.chart')).length >= 1, 'retention: the cohort map and the curve');
  await p.context().close();

  // 3. period and comparison
  p = await open('/?demo'); await ready(p);
  ok(/90 days/.test(await range(p)), 'the default period is 90 days');
  await p.click('.seg button:has-text("28 days")'); await p.waitForFunction(() => /28 days/.test(document.querySelector('.rangetxt').textContent));
  ok(/days=28/.test(await p.evaluate(() => location.search)), 'the period is in the address');
  ok((await p.$$('.kpi .dl')).length >= 3, 'the figures carry a change against the period before');
  ok(/significant|could be noise/.test(await p.textContent('main')), 'and say whether it is more than chance');
  ok(/Compared with the period before/.test(await range(p)), 'the comparison period is named');
  await p.uncheck('.switch input'); ok((await p.$$('.kpi .dl')).length === 0, 'comparison switched off');
  await p.check('.switch input');
  await p.click('.seg button:has-text("All time")'); await p.waitForFunction(() => /range=all/.test(location.search));
  ok((await p.$$('.kpi .dl')).length === 0 && !(await p.$('.switch')), 'all time has nothing to compare with');
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
  p = await open('/?demo&days=7'); await ready(p); ok(/7 days/.test(await range(p)), 'a period in the address is used'); await p.context().close();


  // 3b. the north star, events on the charts, targets, intake, coverage, why people leave, days of the week
  p = await open('/?demo'); await ready(p);
  ok(await p.$('.ns .big') !== null && (await p.$$('.ns svg.chart')).length === 1, 'overview: the north star with its chart');
  const marksBefore = (await p.$$('svg.chart g.note')).length; ok(marksBefore >= 2, 'the events of the demo are marks on the weekly charts: ' + marksBefore);
  await p.click('details.menu summary:has-text("Event")'); await p.fill('#note-text', 'My release'); await p.click('.pop button:has-text("Add")');
  await p.waitForFunction((n) => document.querySelectorAll('svg.chart g.note').length > n, marksBefore); ok(true, 'an event added in the demo shows at once');
  await p.click('details.menu summary:has-text("Targets")'); ok(await p.$eval('#tg-finish', (e) => e.disabled), 'targets cannot be saved in the demo, and say so');
  await p.goto(base + '/?demo#growth'); await p.waitForSelector('table.t'); ok(/My release|Release 3.8.1/.test(await p.textContent('main')), 'growth: the list of events');
  await p.goto(base + '/?demo#retention'); await p.waitForSelector('table.hm'); ok((await p.textContent('main')).includes('Mon') && /Why people remove it/.test(await p.textContent('main')), 'retention: days of the week and the reasons for leaving');
  await p.goto(base + '/?demo#quality'); await p.waitForSelector('main h1'); ok(/Report intake/.test(await p.textContent('main')), 'quality: the intake of reports');
  await p.goto(base + '/?demo#audience'); await p.waitForSelector('table.t'); ok(/Coverage of the sample/.test(await p.textContent('main')) && await p.$eval('#cv-users', (e) => e.disabled), 'audience: coverage, and the form is off in the demo');
  await p.goto(base + '/?demo#experiments'); await p.waitForSelector('table.t'); ok(/demo-len/.test(await p.textContent('main')) && /control/.test(await p.textContent('main')), 'experiments: the arms side by side');
  await p.click('details.menu summary:has-text("Filters")'); ok((await p.$$('#f-use option')).length >= 5 && await p.$('#f-session') !== null && await p.$('#f-blocking') !== null, 'filters by behaviour as well as by setup');
  await p.selectOption('#f-use', 'power'); await p.waitForFunction(() => /use=power/.test(location.search)); ok(await p.$('.fchip') !== null, 'narrowed to the daily users');
  await p.context().close();

  // 3c. the Windows app is a product of its own: the same pages where they mean the same, and a page about what it closes and how its challenge ends
  p = await open('/?demo'); await ready(p);
  await p.click('.seg button:has-text("Windows")'); await p.waitForFunction(() => /pr=win/.test(location.search)); await p.waitForSelector('nav.pages a[href="#windows"]');
  const winPages = await p.$$eval('nav.pages a', (a) => a.map((x) => x.getAttribute('href')));
  ok(winPages.includes('#windows') && !winPages.includes('#features') && !winPages.includes('#audience'), 'windows: its own page, and none of the extension feature pages: ' + winPages.join(' '));
  await p.goto(base + '/?demo&pr=win#windows'); await p.waitForSelector('main h1'); await p.waitForSelector('.hlist');
  ok(/What was closed|Что закрыто/.test(await p.textContent('main')) && (await p.$$('main .kpi')).length >= 10, 'windows: blocks, the challenge, sessions, the service');
  await p.click('.seg button:has-text("Extension"), .seg button:has-text("Расширение")'); await p.waitForFunction(() => !/pr=win/.test(location.search)); await p.waitForSelector('nav.pages a[href="#features"]'); ok(true, 'and back to the extension');
  await p.context().close();

  // 4. filters narrow the whole dashboard (and the address), and chips take them off
  p = await open('/?demo'); await ready(p);
  const all = Number((await p.textContent('main .kpi .val')).replace(/\D/g, ''));
  await p.click('details.menu summary:has-text("Filters")'); await p.selectOption('#f-br', 'firefox');
  await p.waitForFunction(() => /br=firefox/.test(location.search));
  const narrow = Number((await p.textContent('main .kpi .val')).replace(/\D/g, ''));
  ok(narrow > 0 && narrow < all, `a filter narrows the installs: ${all} -> ${narrow}`);
  ok(await p.$('.fchip') !== null && /Browser: firefox/.test(await p.textContent('.fchip')), 'the filter shows as a chip');
  ok(/Filters: Browser = firefox/.test(await p.textContent('main .pagehead')), 'and on the page itself');
  await p.click('.fchip'); await p.waitForFunction(() => !/br=/.test(location.search)); ok(Number((await p.textContent('main .kpi .val')).replace(/\D/g, '')) === all, 'removing the chip restores everything');
  await p.context().close();

  // 5. a feature opens into its detail; segments compare; the first-week habits table is there
  p = await open('/?demo#features'); await ready(p).catch(() => {}); await p.waitForSelector('.frow');
  await p.click('.frow >> nth=0'); await p.waitForSelector('#feature-detail');
  ok((await p.$$('#feature-detail svg.chart')).length >= 2, 'a feature shows its weekly trend and its uses');
  await p.click('#feature-detail button:has-text("Close")'); ok(await p.$('#feature-detail') === null, 'and closes');
  await p.goto(base + '/?demo#audience'); await p.waitForSelector('table.t');
  await p.click('.chip:has-text("Browser")'); ok((await p.$$('table.t tbody tr')).length >= 2, 'segments: the values of a setting side by side');
  await p.goto(base + '/?demo#activation'); await p.waitForSelector('table.t');
  ok((await p.$$('table.t tbody tr')).length >= 5, 'activation: the first-week habits table');
  await p.context().close();

  // 6. languages and themes
  p = await open('/?demo', { locale: 'ru-RU' }); await ready(p);
  ok(/Обзор/.test(await h1(p)), 'Russian by browser language');
  await p.click('#bLang'); ok(/Overview/.test(await h1(p)), 'English after the switch'); await p.click('#bLang');
  await p.click('#bTheme'); ok(await p.evaluate(() => document.documentElement.dataset.theme) === 'light', 'theme: light'); await p.click('#bTheme'); await p.click('#bTheme');
  ok(!(await p.evaluate(() => document.documentElement.dataset.theme)), 'theme: back to automatic');
  await p.context().close();

  // 7. exports
  p = await open('/?demo'); await ready(p);
  const grab = async (label) => { await p.click('details.menu summary.primary'); const [dl] = await Promise.all([p.waitForEvent('download'), p.click(`.pop button:has-text("${label}")`)]); return { name: dl.suggestedFilename(), text: fs.readFileSync(await dl.path(), 'utf8') }; };
  const csv = await grab('CSV table');
  ok(/^eyetime-demo_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/.test(csv.name), 'csv file name carries the period: ' + csv.name);
  ok(csv.text.startsWith('﻿section,id,metric,label,value,k,n\r\n'), 'csv: BOM (Excel), header, CRLF');
  const rows = csv.text.trim().split('\r\n').slice(1).map((l) => l.split(','));
  for (const key of ['retention,d1', 'funnel,started', 'features,focus_start', 'speed,under250', 'flags,ritual', 'weekly,', 'lifecycle,', 'engagement,dau_mau', 'first_week_habit,', 'release,', 'segment_br,', 'trend_users,', 'scorecard,', 'northstar,', 'weekday,', 'intake,', 'coverage,', 'removal_reasons,', 'experiment_demo-len,', 'notes,', 'targets,']) ok(rows.some((r) => (r[0] + ',' + r[1]).startsWith(key)), 'csv has ' + key);
  ok(rows.every((r) => r.length >= 7), 'csv: every row has its columns');
  const json = await grab('JSON data'); const j = JSON.parse(json.text);
  ok(j.v === 3 && j.range && j.retention && j.lifecycle && j.trends && j.segments && j.northstar && j.targets && j.exported_at && j.mode === 'demo', 'json holds the collector answer and when it was exported');
  const md = await grab('Markdown report');
  ok(md.name.endsWith('.md') && /^# EyeTime report/.test(md.text) && /\| Sent a first report \|/.test(md.text) && /## Product health/.test(md.text), 'markdown report');
  await p.context().close();

  // 8. the public view, a narrow screen, the keyboard
  p = await open('/?public'); await ready(p);
  ok(!(await p.$('.seg')) && !(await p.$('details.menu summary:has-text("Filters")')), 'public: no period bar, no filters');
  await p.goto(base + '/?public#quality'); await p.waitForSelector('main h1'); ok(!/Installs with an error/.test(await p.textContent('main')), 'public: no health');
  await p.goto(base + '/?public#retention'); await p.waitForSelector('main h1'); ok(!(await p.$('table.hm')), 'public: no cohorts');
  await p.context().close();
  p = await open('/?demo', { width: 390 }); await ready(p);
  for (const id of ['overview', 'growth', 'features', 'quality', 'audience']) { await p.goto(base + '/?demo#' + id); await p.waitForSelector('main h1'); ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll on a phone: ' + id); }
  await p.goto(base + '/?demo#features'); await p.waitForSelector('.frow'); await p.focus('.frow >> nth=0'); ok(await p.evaluate(() => document.getElementById('tip').classList.contains('on')), 'a row shows its tooltip on keyboard focus');
  await p.goto(base + '/?demo#growth'); await p.waitForSelector('svg.chart rect.hit[tabindex]'); await p.focus('svg.chart rect.hit[tabindex] >> nth=0'); await p.keyboard.press('ArrowLeft'); ok(await p.evaluate(() => document.getElementById('tip').classList.contains('on')), 'a line chart reads with the arrow keys');
  ok(await p.$$eval('button, summary, input, select', (els) => els.every((e) => ((e.getAttribute('aria-label') || e.textContent || e.getAttribute('placeholder') || '') + (e.labels && e.labels.length ? 'x' : '')).trim().length > 0)), 'every control has a name');
  await p.context().close();

  // 9. the Feedback page, as the owner: read, open, mark, answer (the answer reaches the collector and shows as sent)
  p = await open('/?pr=ext#t=' + TOKEN); await ready(p);
  await p.click('nav.pages a[href="#feedback"]'); await p.waitForSelector('.pmf .big');
  ok(/%/.test(await p.innerText('.pmf .big')) && await p.$('.gauge .tick') !== null, 'feedback: the fit score and the 40 % line');
  await p.click('.chip:has-text("Ideas")'); await p.waitForFunction(() => document.querySelectorAll('.msg').length > 0 && [...document.querySelectorAll('.msg .tag.kind')].every((x) => /Ideas/.test(x.textContent)));
  const open1 = p.locator('.msg', { has: p.locator('.tag.warn', { hasText: 'can be answered' }) }).first();
  await open1.locator('.row').click(); await p.waitForSelector('.msg .compose textarea');
  await p.fill('.msg .compose textarea', 'Thank you, this is planned.'); await p.click('.msg .compose button.primary');
  await p.waitForSelector('.msg .bubble'); ok(/planned/.test(await p.innerText('.msg .bubble')), 'feedback: the answer is in the thread, so it was stored');
  const found = await p.evaluate(async (tk) => (await (await fetch('/v1/feedback?q=planned', { headers: { authorization: 'Bearer ' + tk } })).json()).matching, TOKEN);
  ok(found === 0, 'feedback: the search looks in the message, not in the answer');
  await p.click('.msg .acts .btn:has-text("Starred")'); await p.waitForFunction(() => /Starred/.test(document.querySelector('.msg .top').textContent));
  await p.fill('.fbtools input[type=search]', 'zzzz-nothing'); await p.waitForSelector('text=Nothing found');
  await p.context().close();
  p = await open('/?demo#feedback'); await ready(p); await p.waitForSelector('.pmf .big');
  ok((await p.$$('.msg')).length > 3 && /made up/.test(await p.innerText('main')), 'feedback: the demo shows made-up messages and says so');
  await p.context().close();

  await browser.close(); server.close();
  if (bad.length) { console.error('FAIL\n' + bad.join('\n')); process.exit(1); }
  console.log('dashboard e2e: ok');
})().catch((e) => { console.error(e); process.exit(1); });
