// Regression crawl: (1) a profile upgraded from v2.2.0 (old-shaped settings, old tasks without estimates, 20 days of data) and
// (2) a brand-new empty profile. Every extension page, every Insights tab × range and every Settings section is opened;
// any console/page error fails the run. Empty and legacy states are where "works on my data" bugs hide.
//   node scripts-dev/e2e/upgrade.cjs
const { launch } = require('./lib.cjs');
const fs = require('fs');
const path = require('path');

const OLD = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/settings-v2.2.0.json'), 'utf8'));
const PAGES = ['src/newtab/newtab.html', 'src/popup/popup.html?site=github.com', 'src/insights/insights.html', 'src/options/options.html', 'src/break/break.html', 'src/blocked/blocked.html?u=http%3A%2F%2Freddit.com%2F&r=friction&a=pause', 'src/blocked/blocked.html?u=http%3A%2F%2Freddit.com%2F&r=limit&a=block', 'src/blocked/blocked.html?u=http%3A%2F%2Freddit.com%2F&r=always&a=block', 'src/blocked/blocked.html'];
let failed = 0;

async function crawl(label, { seed, lang }) {
  const app = await launch({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  app.ctx.on('page', (p) => { p.on('pageerror', (e) => errs.push(`pageerror ${p.url().split('/').slice(-2).join('/')} ${e.message}`)); p.on('console', (m) => { if (m.type() === 'error') errs.push(`console ${p.url().split('/').slice(-2).join('/')} ${m.text()}`); }); });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const sp = await app.ctx.newPage(); await sp.goto(ext('src/options/options.html')); await sp.waitForTimeout(500); await sp.close();
  await app.sw.evaluate(async ([seed, old, lang]) => {
    const base = seed ? { ...old, onboarded: true, language: lang } : { onboarded: true, language: lang };
    const out = { settings: base };
    if (seed) {
      const d = new Date();
      for (let i = 0; i < 20; i++) { const x = new Date(d); x.setDate(d.getDate() - i); const k = `d:${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; out[k] = { d: { 'github.com': 3000, 'reddit.com': 900 }, h: { 10: { 'github.com': 3000 }, 14: { 'reddit.com': 900 } }, fs: 3000, fc: 2, b: 3, ss: [{ id: 's' + i, t: x.setHours(10, 0, 0, 0), m: 25, c: 1, r: 2, g: 'Old goal' }] }; }
      out.tasks = [{ id: 'a', text: 'Old task', done: false, starred: true, createdAt: 1, focusSec: 600 }, { id: 'b', text: 'Done old', done: true, createdAt: 2, focusSec: 400 }];
    }
    await chrome.storage.local.set(out);
  }, [seed, OLD, lang]);
  for (const pg of PAGES) { const p = await app.ctx.newPage(); await p.goto(ext(pg)); await p.waitForTimeout(900); await p.close(); }
  const ins = await app.ctx.newPage();
  for (const tab of ['overview', 'focus', 'sites', 'patterns']) for (const r of ['today', '7', '30']) {
    await ins.goto(ext('src/insights/insights.html?range=' + r)); await ins.evaluate((t) => localStorage.setItem('et-itab', t), tab); await ins.reload(); await ins.waitForTimeout(450);
    await ins.keyboard.press('Control+k'); await ins.waitForTimeout(250); await ins.keyboard.press('Escape');
  }
  const opt = await app.ctx.newPage();
  for (const sec of ['general', 'appearance', 'focus', 'blocking', 'eye', 'tracking', 'data', 'about']) { await opt.goto(ext('src/options/options.html#' + sec)); await opt.waitForTimeout(350); }
  const nt = await app.ctx.newPage(); await nt.goto(ext('src/newtab/newtab.html')); await nt.waitForTimeout(900);
  await nt.keyboard.press('Control+k'); await nt.waitForTimeout(300); await nt.keyboard.type('zzzz plan 25m'); await nt.waitForTimeout(250); await nt.keyboard.press('Escape');
  await nt.keyboard.press('?'); await nt.waitForTimeout(200);
  console.log(errs.length ? `FAIL ${label}\n  ` + [...new Set(errs)].join('\n  ') : `PASS ${label}: no console errors on ${PAGES.length + 12 + 8 + 1} page loads`);
  if (errs.length) failed++;
  await app.close();
}

(async () => {
  await crawl('upgrade from v2.2.0 (en)', { seed: true, lang: 'en' });
  await crawl('upgrade from v2.2.0 (ru)', { seed: true, lang: 'ru' });
  await crawl('empty profile (en)', { seed: false, lang: 'en' });
  await crawl('empty profile (ru)', { seed: false, lang: 'ru' });
  process.exit(failed ? 1 : 0);
})();
