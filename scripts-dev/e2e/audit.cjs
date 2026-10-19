// Visual audit: screenshots every surface/state into a folder.
//   node scripts-dev/e2e/audit.cjs <outDir> [look=calm] [mode=light] [lang=en] [seed=0|1]
// seed=0 is a brand-new profile (what a new user really sees); seed=1 adds 30 days of realistic data.
const { launch } = require('./lib.cjs');
const fs = require('fs');
const [OUT, look = 'calm', mode = 'light', lang = 'en', seedArg = '0', onlyArg = ''] = process.argv.slice(2);
const ONLY = onlyArg ? onlyArg.split(',') : null;
const want = (n) => !ONLY || ONLY.includes(n);
fs.mkdirSync(OUT, { recursive: true });

async function seed(page) {
  await page.evaluate(async () => {
    const st = await import('/src/shared/storage.js');
    const { rangeKeys } = await import('/src/shared/time.js');
    const keys = rangeKeys(30);
    const hosts = ['github.com', 'docs.google.com', 'youtube.com', 'reddit.com', 'news.ycombinator.com'];
    let n = 7; const rnd = () => (n = (n * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < keys.length; i++) await st.updateDay(keys[i], (d) => {
      d.d = {}; d.h = {}; d.ss = []; d.fs = 0; d.fc = 0;
      hosts.forEach((h, k) => { const sec = Math.round((k < 2 ? 0.5 + rnd() : rnd()) * 4800); d.d[h] = sec; for (let hr = 8; hr < 20; hr++) (d.h[hr] ||= {})[h] = Math.round(sec / 12); });
      const c = 1 + Math.floor(rnd() * 3); d.fc = c;
      for (let k = 0; k < c; k++) { const t = new Date(); t.setDate(t.getDate() - (29 - i)); t.setHours(k === 0 ? 9 : k === 1 ? 10 : 15, 5); d.ss.push({ id: 's' + i + k, t: t.getTime(), m: 25 + k * 25, p: 25 + k * 25, g: ['Write the quarterly report', 'Plan the sprint', 'Review pull requests'][k % 3], k: '', c: 1, r: 1 + ((i + k) % 3) }); d.fs += (25 + k * 25) * 60; }
      d.b = 2; d.pr = { back: 2, work: 1, bored: 1 }; d.sw = 20 + Math.floor(rnd() * 30); d.fa = Math.floor(rnd() * 4); d.pa = { 'reddit.com': 1 + Math.floor(rnd() * 5), 'youtube.com': Math.floor(rnd() * 4) }; if (i % 3 === 0) d.w = ['Shipped the draft', 'Finished the review'][(i / 3 | 0) % 2];
    });
    await st.setCollection('tasks', [
      { id: 'a', text: 'Write the quarterly report', done: false, starred: true, createdAt: 1, focusSec: 4500, resume: 'Draft section 2, then the charts' },
      { id: 'b', text: 'Review pull requests', done: false, starred: true, createdAt: 2, focusSec: 1500 },
      { id: 'c', text: 'Book flights for the conference', done: false, starred: false, createdAt: 3 },
      { id: 'd', text: 'Send the invoice', done: true, starred: false, createdAt: 4, focusSec: 900 }]);
    await st.setCollection('captures', [{ id: 'n1', text: 'Ask Sam about the budget review', at: Date.now() }, { id: 'n2', text: 'Idea: weekly retro template', at: Date.now() - 3600e3 }]);
    await st.setCollection('habits', { items: [{ id: 'h1', name: 'Move 20 minutes' }, { id: 'h2', name: 'Read 15 minutes' }], log: {} });
    await st.updateSettings((s) => { s.newtab.links = [{ id: 'l1', title: 'GitHub', url: 'https://github.com' }, { id: 'l2', title: 'Docs', url: 'https://docs.google.com' }, { id: 'l3', title: 'Calendar', url: 'https://calendar.google.com' }]; });
  });
}

(async () => {
  const app = await launch({ viewport: { width: 1440, height: 900 }, colorScheme: mode });
  const errs = [];
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const seedPage = await app.ctx.newPage(); await seedPage.goto(ext('src/options/options.html')); await seedPage.waitForTimeout(800);
  await seedPage.evaluate(async ([look, mode, lang]) => {
    const st = await import('/src/shared/storage.js');
    await st.updateSettings((s) => { s.onboarded = true; s.language = lang; s.appearance.look = look; s.appearance.mode = mode; });
  }, [look, mode, lang]);
  if (seedArg === '1') await seed(seedPage);
  await seedPage.close();

  const open = async (url, vp) => { const p = await app.ctx.newPage(); await p.setViewportSize(vp); p.on('pageerror', (e) => errs.push(url + ': ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/ERR_|favicon|net::/.test(m.text())) errs.push(url + ': ' + m.text()); }); await p.goto(ext(url)); await p.waitForTimeout(1300); return p; };
  const shot = async (name, p, opts = {}) => p.screenshot({ path: `${OUT}/${name}.png`, ...opts });

  if (want('home')) for (const [w, h] of [[1724, 900], [1280, 800], [820, 1100], [400, 900]]) { const p = await open('src/newtab/newtab.html', { width: w, height: h }); await shot(`home-${w}`, p, { fullPage: true }); await p.close(); }
  if (want('insights')) for (const [w, h] of [[1440, 900], [820, 1000], [400, 900]]) for (const tab of ['overview', 'focus', 'sites', 'patterns']) {
    const p = await open('src/insights/insights.html', { width: w, height: h }); await p.evaluate((tab) => localStorage.setItem('et-itab', tab), tab); await p.reload(); await p.waitForTimeout(900);
    await shot(`insights-${tab}-${w}`, p, { fullPage: true }); await p.close(); }
  if (want('popup')) { const p = await open('src/popup/popup.html?site=github.com', { width: 380, height: 700 }); console.log('popup idle height', await p.evaluate(() => Math.round(document.querySelector('#app').getBoundingClientRect().bottom + 12))); await shot('popup', p, { fullPage: true }); await p.close(); }
  if (want('running')) { // popup with a running session and with a rest
    await app.sw.evaluate(async () => { const now = Date.now(); await chrome.storage.local.set({ focus: { id: 'x', startedAt: now - 9 * 60000, endsAt: now + 16 * 60000, minutes: 25, goal: 'Write the quarterly report', strict: false, taskId: 'a', scope: 'distractions' } }); });
    let p = await open('src/popup/popup.html?site=github.com', { width: 380, height: 700 }); console.log('popup running height', await p.evaluate(() => Math.round(document.querySelector('#app').getBoundingClientRect().bottom + 12))); await shot('popup-running', p, { fullPage: true }); await p.close();
    p = await open('src/newtab/newtab.html', { width: 1440, height: 900 }); await shot('home-running', p, { fullPage: true }); await p.close();
    await app.sw.evaluate(async () => { const now = Date.now(); await chrome.storage.local.set({ focus: null, rest: { startedAt: now - 60000, endsAt: now + 4 * 60000, minutes: 5, long: false } }); });
    p = await open('src/popup/popup.html', { width: 380, height: 700 }); await shot('popup-rest', p, { fullPage: true }); await p.close();
    await app.sw.evaluate(() => chrome.storage.local.set({ rest: null }));
  }
  if (want('options')) { const p = await open('src/options/options.html', { width: 1440, height: 900 });
    const secs = await p.locator('section.sec').all();
    for (const s of secs) { const id = await s.getAttribute('id'); await s.screenshot({ path: `${OUT}/options-${id}.png` }); }
    await p.close(); }
  if (want('onboarding')) { const p = await open('src/onboarding/onboarding.html', { width: 1280, height: 820 });
    for (let i = 1; i <= 5; i++) { await shot(`onboarding-${i}`, p); const nxt = p.locator('#card .btn-primary').first(); if (i < 5) { await nxt.click(); await p.waitForTimeout(500); } }
    await p.close(); }
  if (want('break')) { const p = await open('src/break/break.html', { width: 1280, height: 800 }); await shot('break', p); await p.waitForTimeout(3000); await shot('break-2', p); await p.close(); }
  if (want('blocked')) { // block pages
    const bu = (r) => `src/blocked/blocked.html?u=${encodeURIComponent('http://reddit.com/')}&r=${r}&a=${r === 'friction' ? 'pause' : 'block'}`;
    let p = await open(bu('friction'), { width: 1100, height: 760 }); await shot('blocked-friction', p); await p.close();
    await app.sw.evaluate(async () => { const now = Date.now(); await chrome.storage.local.set({ focus: { id: 'x', startedAt: now - 9 * 60000, endsAt: now + 16 * 60000, minutes: 25, goal: 'Write the quarterly report', strict: false, taskId: 'a', scope: 'distractions' } }); });
    p = await open(bu('focus'), { width: 1100, height: 760 }); await shot('blocked-focus', p); await p.close();
    await app.sw.evaluate(async () => { const { focus } = await chrome.storage.local.get('focus'); focus.strict = true; await chrome.storage.local.set({ focus }); });
    p = await open(bu('focus'), { width: 1100, height: 760 }); await shot('blocked-strict', p); await p.close();
    await app.sw.evaluate(() => chrome.storage.local.set({ focus: null }));
    await app.sw.evaluate(async () => { const { settings } = await chrome.storage.local.get('settings'); settings.blocking.always = ['reddit.com']; await chrome.storage.local.set({ settings }); });
    p = await open(bu('always'), { width: 1100, height: 760 }); await shot('blocked-always', p); await p.close();
  }
  console.log('errors:', errs);
  await app.close();
})();
