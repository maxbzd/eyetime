// Exhaustive visual audit: every surface × state × width, for one "context" (profile + language + look).
//   node scripts-dev/e2e/audit2.cjs <outDir> <ctx>
//   ctx: fresh-en-light | fresh-ru-dark | data-en-light | data-ru-dark | stress-en-light | stress-ru-dark-125
const { launch } = require('./lib.cjs');
const fs = require('fs');
const [OUT, CTX = 'data-en-light'] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const CFG = {
  'fresh-en-light': { lang: 'en', look: 'calm', mode: 'light', data: 0 },
  'fresh-ru-dark': { lang: 'ru', look: 'midnight', mode: 'dark', data: 0 },
  'data-en-light': { lang: 'en', look: 'calm', mode: 'light', data: 1 },
  'data-ru-dark': { lang: 'ru', look: 'midnight', mode: 'dark', data: 1 },
  'stress-en-light': { lang: 'en', look: 'paper', mode: 'light', data: 2 },
  'stress-ru-dark-125': { lang: 'ru', look: 'terminal', mode: 'dark', data: 2, scale: 125, density: 'compact' },
}[CTX];
const LONG = 'Prepare the quarterly business review deck for the leadership team including revenue forecast, churn analysis and hiring plan for next year';
const VLONG_HOST = 'extremely-long-subdomain-name.some-company-internal-tools.example.com';

async function seed(page, level) {
  await page.evaluate(async ([level, LONG, VLONG_HOST]) => {
    const st = await import('/src/shared/storage.js');
    const { rangeKeys } = await import('/src/shared/time.js');
    const stress = level === 2;
    const keys = rangeKeys(stress ? 60 : 30);
    const hosts = [['github.com', 0], ['docs.google.com', 0], ['youtube.com', 1], ['reddit.com', 1], ['news.ycombinator.com', 2]].concat(stress ? [[VLONG_HOST, 2], ['a.io', 2], ['mail.google.com', 0], ['twitter.com', 1], ['notion.so', 0], ['figma.com', 0]] : []);
    let n = 7; const rnd = () => (n = (n * 9301 + 49297) % 233280) / 233280;
    const today = new Date().toISOString().slice(0, 10);
    for (let i = 0; i < keys.length; i++) await st.updateDay(keys[i], (d) => {
      d.d = {}; d.h = {}; d.ss = []; d.fs = 0; d.fc = 0;
      hosts.forEach(([h], k) => { const sec = Math.round((k < 2 ? 0.5 + rnd() : rnd()) * 4800); d.d[h] = sec; for (let hr = 8; hr < 20; hr++) (d.h[hr] ||= {})[h] = Math.round(sec / 12); });
      const c = 1 + Math.floor(rnd() * 3); d.fc = c;
      for (let k = 0; k < c; k++) { const t = new Date(); t.setDate(t.getDate() - (keys.length - 1 - i)); t.setHours(k === 0 ? 9 : k === 1 ? 10 : 15, 5); d.ss.push({ id: 's' + i + k, t: t.getTime(), m: 25 + k * 25, p: 25 + k * 25, g: stress ? LONG.slice(0, 80) : ['Write the quarterly report', 'Plan the sprint', 'Review pull requests'][k % 3], k: '', c: 1, r: 1 + ((i + k) % 3) }); d.fs += (25 + k * 25) * 60; }
      d.b = 2; d.pr = { back: 2, work: 1, bored: 1, habit: 2 }; d.sw = 20 + Math.floor(rnd() * 30); d.fa = Math.floor(rnd() * 4); d.pa = { 'reddit.com': 1 + Math.floor(rnd() * 5), 'youtube.com': Math.floor(rnd() * 4) }; if (stress) d.pa[VLONG_HOST] = 3; if (i % 3 === 0) d.w = stress ? LONG : ['Shipped the draft', 'Finished the review'][(i / 3 | 0) % 2];
      d.a = stress ? { 'Visual Studio Code': 3000, 'Slack': 1200 } : {};
    });
    const tasks = [
      { id: 'a', text: stress ? LONG : 'Write the quarterly report', done: false, starred: true, createdAt: 1, focusSec: 4500, resume: stress ? LONG : 'Draft section 2, then the charts', at: '23:50', atDay: today },
      { id: 'b', text: 'Review pull requests', done: false, starred: true, createdAt: 2, focusSec: 1500 },
      { id: 'c', text: 'Book flights for the conference', done: false, starred: false, createdAt: 3 },
      { id: 'd', text: 'Send the invoice', done: true, starred: false, createdAt: 4, focusSec: 900 }];
    if (stress) for (let i = 0; i < 56; i++) tasks.push({ id: 'x' + i, text: i % 5 === 0 ? LONG : 'Task number ' + i, done: i % 7 === 0, starred: false, createdAt: 10 + i, focusSec: i % 3 ? 0 : 600 });
    await st.setCollection('tasks', tasks);
    await st.setCollection('captures', Array.from({ length: stress ? 20 : 2 }, (_, i) => ({ id: 'n' + i, text: i % 4 === 0 && stress ? LONG + ' ' + LONG : 'Idea number ' + i + ': weekly retro template', at: Date.now() - i * 3600e3 })));
    await st.setCollection('habits', { items: Array.from({ length: stress ? 12 : 2 }, (_, i) => ({ id: 'h' + i, name: stress && i % 3 === 0 ? 'A very long habit name that goes on and on ' + i : 'Move 20 minutes ' + i })), log: {} });
    await st.updateSettings((s) => {
      s.newtab.links = Array.from({ length: stress ? 14 : 3 }, (_, i) => ({ id: 'l' + i, title: stress && i % 2 ? 'A long link title here' : ['GitHub', 'Docs', 'Calendar'][i % 3], url: 'https://github.com' }));
      s.blocking.plans = [{ id: 'p1', when: 'reddit.com', then: 'stand up and drink water' }, { id: 'p2', when: '', then: stress ? LONG.slice(0, 90) : 'take five slow breaths' }];
      s.focus.reminders = [{ id: 'r1', time: '09:00', days: [1, 2, 3, 4, 5], minutes: 50 }];
      s.blocking.custom = stress ? ['example.org', VLONG_HOST, 'a.io'] : ['example.org'];
      s.blocking.allow = stress ? ['docs.google.com', VLONG_HOST] : ['docs.google.com'];
      s.blocking.limits = { 'youtube.com': 30, 'reddit.com': 20 }; s.blocking.always = stress ? ['twitter.com', VLONG_HOST] : ['twitter.com'];
    });
  }, [level, LONG, VLONG_HOST]);
}

(async () => {
  const app = await launch({ viewport: { width: 1440, height: 900 }, colorScheme: CFG.mode });
  const errs = [];
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const sp = await app.ctx.newPage(); await sp.goto(ext('src/options/options.html')); await sp.waitForTimeout(800);
  await sp.evaluate(async ([c]) => {
    const st = await import('/src/shared/storage.js');
    await st.updateSettings((s) => { s.onboarded = true; s.language = c.lang; Object.assign(s.appearance, { look: c.look, mode: c.mode }); if (c.scale) s.appearance.scale = c.scale; if (c.density) s.appearance.density = c.density; });
  }, [CFG]);
  if (CFG.data) await seed(sp, CFG.data);
  await sp.close();

  const open = async (url, w, h) => { const p = await app.ctx.newPage(); await p.setViewportSize({ width: w, height: h }); p.on('pageerror', (e) => errs.push(url + ': ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/ERR_|favicon|net::/.test(m.text())) errs.push(url + ': ' + m.text()); }); await p.goto(ext(url)); await p.waitForTimeout(1100); return p; };
  const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
  const scene = async (name, fn) => { if (ONLY && !ONLY.test(name)) return; try { await fn(name); } catch (e) { console.log('scene failed:', name, String(e.message).split('\n')[0]); } };
  const snap = async (name, p, opts = {}) => {
    await p.waitForTimeout(250);
    // horizontal overflow report: widest offenders when the page scrolls sideways
    const bad = await p.evaluate(() => { const w = document.documentElement.clientWidth; if (document.documentElement.scrollWidth <= w + 1) return null; const out = []; const clipped = (el) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true; } return false; }; for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect(); if (r.width > 0 && r.right > w + 2 && !clipped(el)) out.push(`${el.tagName.toLowerCase()}.${String(el.className.baseVal ?? el.className).split(' ')[0]}:${Math.round(r.right)}`); } return `${document.documentElement.scrollWidth}>${w} ` + out.slice(0, 6).join(' '); }).catch(() => null);
    if (bad) console.log('OVERFLOW', name, bad);
    await p.screenshot({ path: `${OUT}/${name}.png`, ...opts });
  };
  /** patch = { 'dot.path': value } applied to settings inside the service worker (no eval: extension CSP forbids it). */
  const set = (patch) => app.sw.evaluate(async (patch) => { const { settings } = await chrome.storage.local.get('settings'); for (const [path, v] of Object.entries(patch)) { const keys = path.split('.'); let o = settings; for (const k of keys.slice(0, -1)) o = o[k]; o[keys[keys.length - 1]] = v; } await chrome.storage.local.set({ settings }); }, patch);
  const putRaw = (obj) => app.sw.evaluate((o) => chrome.storage.local.set(o), obj);
  const FOCUS = { id: 'x', startedAt: Date.now() - 9 * 60000, endsAt: Date.now() + 16 * 60000, minutes: 25, goal: CFG.data === 2 ? LONG : 'Write the quarterly report', strict: false, taskId: 'a', scope: 'distractions' };
  const long = CFG.data === 2;

  /* ---------- Home ---------- */
  for (const w of [1440, 1024, 820, 400]) await scene('home-' + w, async (n) => { const p = await open('src/newtab/newtab.html', w, 900); await snap(n, p, { fullPage: true }); await p.close(); });
  await scene('home-drawer', async (n) => { const p = await open('src/newtab/newtab.html', 1440, 900); await p.click('#customize'); await p.waitForTimeout(500); await snap(n, p); await p.evaluate(() => document.querySelector('#drawerBody').scrollTo(0, 700)); await snap(n + '-2', p); await p.evaluate(() => document.querySelector('#drawerBody').scrollTo(0, 99999)); await snap(n + '-3', p); await p.close(); });
  await scene('home-dialogs', async (n) => {
    const p = await open('src/newtab/newtab.html', 1280, 860);
    await p.keyboard.press('?'); await snap(n + '-shortcuts', p); await p.keyboard.press('Escape');
    await p.locator('.link.add').first().click(); await snap(n + '-addlink', p); await p.keyboard.press('Escape');
    await p.locator('.plan-link').click(); await p.waitForTimeout(400); await snap(n + '-closeday', p); await p.keyboard.press('Escape');
    await p.locator('.item').first().hover(); await p.locator('.item-acts button').nth(1).click(); await p.waitForTimeout(300); await snap(n + '-schedule', p); await p.keyboard.press('Escape');
    await p.close();
  });
  for (const lay of ['split', 'minimal']) await scene('home-layout-' + lay, async (n) => { await set({ 'newtab.layout': lay }); const p = await open('src/newtab/newtab.html', 1440, 900); await snap(n, p, { fullPage: true }); await p.close(); await set({ 'newtab.layout': 'center' }); });
  if (CFG.data === 1 && CTX === 'data-en-light') {
    for (const c of ['thin', 'bold', 'mono', 'serif', 'compact', 'stacked', 'none']) await scene('home-clock-' + c, async (n) => { await set({ 'newtab.clockStyle': c }); const p = await open('src/newtab/newtab.html', 1280, 620); await snap(n, p); await p.close(); });
    await set({ 'newtab.clockStyle': 'thin' });
    for (const b of ['look', 'dawn', 'ocean', 'forest', 'dusk', 'sand', 'slate', 'mesh', 'aurora', 'stars', 'waves', 'grain', 'dots', 'grid', 'living', 'plain', 'color']) await scene('home-bg-' + b, async (n) => { await set({ 'newtab.background': b }); const p = await open('src/newtab/newtab.html', 1280, 560); await snap(n, p); await p.close(); });
    await set({ 'newtab.background': 'look' });
  }
  await scene('home-running', async (n) => { await putRaw({ focus: FOCUS }); const p = await open('src/newtab/newtab.html', 1280, 900); await snap(n, p, { fullPage: true }); await p.close(); await putRaw({ focus: null }); });
  await scene('home-rest', async (n) => { await putRaw({ rest: { startedAt: Date.now() - 60000, endsAt: Date.now() + 240000, minutes: 5, long: true } }); const p = await open('src/newtab/newtab.html', 1280, 760); await snap(n, p); await p.close(); await putRaw({ rest: null }); });
  await scene('home-review', async (n) => { await putRaw({ review: { id: 's1', day: new Date().toISOString().slice(0, 10), goal: long ? LONG : 'Write the quarterly report', taskId: 'a', minutes: 25, completed: true } }); const p = await open('src/newtab/newtab.html', 1280, 900); await snap(n, p); await p.close(); await putRaw({ review: null }); });

  /* ---------- Popup ---------- */
  await scene('popup-idle', async (n) => { const p = await open('src/popup/popup.html', 380, 640); await snap(n, p); await p.close(); });
  await scene('popup-site', async (n) => { const p = await open('src/popup/popup.html?site=' + (long ? VLONG_HOST : 'github.com'), 380, 640); await snap(n, p); await p.close(); });
  await scene('popup-site-limit', async (n) => { const p = await open('src/popup/popup.html?site=youtube.com', 380, 640); await snap(n, p); await p.close(); });
  await scene('popup-running', async (n) => { await putRaw({ focus: FOCUS }); const p = await open('src/popup/popup.html?site=github.com', 380, 640); await snap(n, p); await p.close(); await putRaw({ focus: null }); });
  await scene('popup-strict', async (n) => { await putRaw({ focus: { ...FOCUS, strict: true } }); const p = await open('src/popup/popup.html', 380, 640); await snap(n, p); await p.close(); await putRaw({ focus: null }); });
  await scene('popup-rest', async (n) => { await putRaw({ rest: { startedAt: Date.now() - 60000, endsAt: Date.now() + 240000, minutes: 5, long: false } }); const p = await open('src/popup/popup.html', 380, 640); await snap(n, p); await p.close(); await putRaw({ rest: null }); });
  await scene('popup-paused', async (n) => { await putRaw({ pausedUntil: Date.now() + 3600e3 }); const p = await open('src/popup/popup.html', 380, 640); await snap(n, p); await p.close(); await putRaw({ pausedUntil: 0 }); });
  await scene('popup-review', async (n) => { await putRaw({ review: { id: 's1', day: new Date().toISOString().slice(0, 10), goal: long ? LONG : 'Write the quarterly report', taskId: 'a', minutes: 25, completed: false } }); const p = await open('src/popup/popup.html', 380, 760); await snap(n, p); await p.close(); await putRaw({ review: null }); });

  /* ---------- Insights ---------- */
  const tabs = ['overview', 'focus', 'sites', 'patterns'];
  for (const range of ['today', '7', '30']) for (const tab of tabs) await scene(`insights-${tab}-${range}`, async (n) => { const p = await open(`src/insights/insights.html?range=${range}`, 1440, 900); await p.evaluate((tab) => localStorage.setItem('et-itab', tab), tab); await p.reload(); await p.waitForTimeout(900); await snap(n, p, { fullPage: true }); await p.close(); });
  for (const w of [820, 400]) for (const tab of tabs) await scene(`insights-${tab}-w${w}`, async (n) => { const p = await open('src/insights/insights.html?range=7', w, 900); await p.evaluate((tab) => localStorage.setItem('et-itab', tab), tab); await p.reload(); await p.waitForTimeout(900); await snap(n, p, { fullPage: true }); await p.close(); });
  await scene('insights-tableview', async (n) => { const p = await open('src/insights/insights.html?range=7', 1280, 900); await p.evaluate(() => localStorage.setItem('et-itab', 'overview')); await p.reload(); await p.waitForTimeout(800); await p.locator('[aria-label*="able"]').first().click().catch(() => {}); await snap(n, p, { fullPage: true }); await p.close(); });

  /* ---------- Settings ---------- */
  const sections = ['general', 'appearance', 'focus', 'blocking', 'eye', 'tracking', 'data', 'about'];
  for (const w of [1440, 820, 400]) for (const id of sections) await scene(`settings-${id}-w${w}`, async (n) => { const p = await open('src/options/options.html', w, 900); await p.locator('section#' + id).screenshot({ path: `${OUT}/${n}.png` }); await p.close(); });
  await scene('settings-search', async (n) => { const p = await open('src/options/options.html', 1280, 900); await p.fill('#q', 'sound'); await p.waitForTimeout(400); await snap(n, p); await p.fill('#q', 'zzzzzz'); await snap(n + '-empty', p); await p.close(); });
  await scene('settings-dialogs', async (n) => {
    const p = await open('src/options/options.html#appearance', 1280, 900);
    await p.getByRole('button', { name: /Import|Импорт/ }).first().click(); await snap(n + '-import', p); await p.keyboard.press('Escape');
    await p.getByRole('button', { name: /Reset appearance|Сбросить/ }).first().click(); await snap(n + '-reset', p); await p.keyboard.press('Escape');
    await p.evaluate(() => document.querySelector('#appearance textarea')?.scrollIntoView({ block: 'center' })); await p.fill('#appearance textarea', '@import url(http://x.test/a.css);'); await p.locator('#appearance textarea').blur(); await snap(n + '-css-error', p);
    await p.close();
  });

  /* ---------- Onboarding ---------- */
  await scene('onboarding', async () => { await set({ onboarded: false }); const p = await open('src/onboarding/onboarding.html', 1280, 860); for (let i = 1; i <= 5; i++) { await snap(`onboarding-${i}`, p); if (i < 5) { await p.locator('#card .btn-primary').first().click(); await p.waitForTimeout(500); } } await p.close(); await set({ onboarded: true }); });

  /* ---------- Block pages & break ---------- */
  const bu = (r, u = 'http://reddit.com/') => `src/blocked/blocked.html?u=${encodeURIComponent(u)}&r=${r}&a=${r === 'friction' ? 'pause' : 'block'}`;
  await scene('blocked-friction', async (n) => { await set({ 'blocking.friction.enabled': true, 'blocking.limits': {}, 'blocking.always': [] }); await putRaw({ passes: {} }); const p = await open(bu('friction'), 1100, 760); await snap(n, p); await p.close(); });
  await scene('blocked-friction-long', async (n) => { const p = await open(bu('friction', 'http://' + VLONG_HOST + '/x'), 1100, 760); await snap(n, p); await p.close(); });
  await scene('blocked-focus', async (n) => { await putRaw({ focus: FOCUS }); const p = await open(bu('focus'), 1100, 760); await snap(n, p); await p.close(); });
  await scene('blocked-strict', async (n) => { await putRaw({ focus: { ...FOCUS, strict: true } }); const p = await open(bu('focus'), 1100, 760); await snap(n, p); await p.close(); });
  await scene('blocked-onlymine', async (n) => { await putRaw({ focus: { ...FOCUS, scope: 'only-mine' } }); const p = await open(bu('focus', 'http://example.org/'), 1100, 760); await snap(n, p); await p.close(); await putRaw({ focus: null }); });
  await scene('blocked-schedule', async (n) => { const now = new Date(); await set({ 'blocking.schedule': { enabled: true, days: [0, 1, 2, 3, 4, 5, 6], start: '00:00', end: '23:59', strict: false, passMinutes: 5 } }); const p = await open(bu('schedule'), 1100, 760); await snap(n, p); await p.close(); await set({ 'blocking.schedule.enabled': false }); });
  await scene('blocked-limit', async (n) => { await set({ 'blocking.limits': { 'reddit.com': 1 } }); const p = await open(bu('limit'), 1100, 760); await snap(n, p); await p.close(); });
  await scene('blocked-always', async (n) => { await set({ 'blocking.always': ['reddit.com'] }); const p = await open(bu('always'), 1100, 760); await snap(n, p); await p.close(); });
  await scene('blocked-invalid', async (n) => { const p = await open('src/blocked/blocked.html', 900, 600); await snap(n, p); await p.close(); });
  await scene('break', async (n) => { const p = await open('src/break/break.html', 1280, 800); await snap(n + '-1', p); await p.waitForTimeout(4000); await snap(n + '-2', p); await p.close(); });

  console.log('errors:', errs);
  await app.close();
})();
