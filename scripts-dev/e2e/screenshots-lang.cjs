// Localized store screenshots (JPEG, 1280×800) for every non-English language:  node scripts-dev/e2e/screenshots-lang.cjs [ru es de fr pt]
// Output: store/screenshots/<lang>/{1-home,2-focus,3-insights,4-home-dark,11-palette,12-timeline}.jpg — the same scenes as the English set, with sample data in that language.
const { launch } = require('./lib.cjs');
const { seed, SAMPLES } = require('./seed.cjs');
const path = require('path');
const fs = require('fs');
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : ['ru', 'es', 'de', 'fr', 'pt'];

(async () => {
  const app = await launch({ viewport: { width: 1280, height: 800 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const seedPage = await app.ctx.newPage(); await seedPage.goto(ext('src/options/options.html')); await seedPage.waitForTimeout(800);
  const open = async (url, vp) => { const p = await app.ctx.newPage(); if (vp) await p.setViewportSize(vp); await p.goto(ext(url)); return p; };
  for (const lang of LANGS) {
    const out = path.join(__dirname, '../../store/screenshots', lang); fs.mkdirSync(out, { recursive: true });
    const sample = SAMPLES[lang];
    const shot = async (file, p) => { await p.waitForTimeout(1300); await p.screenshot({ path: path.join(out, file), type: 'jpeg', quality: 90 }); };
    await seed(seedPage, { look: 'calm', mode: 'light', background: 'dawn', clockStyle: 'thin', lang });
    let p = await open('src/newtab/newtab.html'); await shot('1-home.jpg', p); await p.close();
    await app.sw.evaluate(async (goal) => { const now = Date.now(); await chrome.storage.local.set({ focus: { id: 'x', startedAt: now - 9 * 60000, endsAt: now + 16 * 60000, minutes: 25, goal, strict: false, taskId: 'a', scope: 'distractions' } }); }, sample.tasks[0]);
    p = await open('src/popup/popup.html?site=github.com', { width: 380, height: 600 }); await shot('2-focus.jpg', p); await p.close();
    await app.sw.evaluate(() => chrome.storage.local.set({ focus: null }));
    p = await open('src/insights/insights.html', { width: 1280, height: 1100 }); await p.evaluate(() => localStorage.setItem('et-itab', 'overview')); await p.reload(); await shot('3-insights.jpg', p);
    await p.evaluate(() => localStorage.setItem('et-itab', 'patterns')); await p.reload(); await shot('12-timeline.jpg', p); await p.close();
    p = await open('src/newtab/newtab.html', { width: 1280, height: 800 }); await p.waitForTimeout(900); await p.keyboard.press('Control+k'); await p.waitForSelector('dialog.palette[open]'); await p.keyboard.type(sample.query); await shot('11-palette.jpg', p); await p.close();
    await seed(seedPage, { look: 'midnight', mode: 'dark', background: 'stars', clockStyle: 'bold', lang });
    p = await open('src/newtab/newtab.html'); await shot('4-home-dark.jpg', p); await p.close();
    console.log('done', lang);
  }
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
