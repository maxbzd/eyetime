// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The Chrome Web Store screenshots: five scenes, 1280×800 exactly (the store refuses any other size), in each of the eleven languages, as JPEG without transparency.
//   node scripts-dev/e2e/store-shots.cjs [en ru es de fr pt it pl uk zh ja]
// Output: store/screenshots/<lang>/{1-home,2-focus,3-insights,4-pause,5-looks}.jpg — the same story in every language, with sample data in that language (seed.cjs):
// a calm new tab → a focus session running → honest statistics → the pause instead of a lockout (with your own if-then plan) → sixteen looks.
const { launch } = require('./lib.cjs');
const { seed, SAMPLES } = require('./seed.cjs');
const path = require('path');
const fs = require('fs');
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : ['en', 'ru', 'es', 'de', 'fr', 'pt', 'it', 'pl', 'uk', 'zh', 'ja'];
const VP = { width: 1280, height: 800 };

(async () => {
  const app = await launch({ viewport: VP });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const seedPage = await app.ctx.newPage(); await seedPage.goto(ext('src/options/options.html')); await seedPage.waitForTimeout(800);
  const open = async (url) => { const p = await app.ctx.newPage(); await p.setViewportSize(VP); await p.goto(ext(url)); return p; };
  for (const lang of LANGS) {
    const out = path.join(__dirname, '../../store/screenshots', lang); fs.mkdirSync(out, { recursive: true });
    const sample = SAMPLES[lang] || SAMPLES.en;
    const shot = async (file, p) => { await p.waitForTimeout(1400); await p.screenshot({ path: path.join(out, file), type: 'jpeg', quality: 92, clip: { x: 0, y: 0, ...VP } }); await p.close(); };
    const hideNudge = (p) => p.addStyleTag({ content: '#nudge { display: none !important }' });

    await seed(seedPage, { look: 'calm', mode: 'light', background: 'photo', clockStyle: 'thin', layout: 'today', frame: 'blush', lang });
    let p = await open('src/newtab/newtab.html'); await hideNudge(p); await shot('1-home.jpg', p);

    // a session running: Home becomes the countdown of the goal
    await app.sw.evaluate(async (goal) => { const now = Date.now(); await chrome.storage.local.set({ focus: { id: 'x', startedAt: now - 9 * 60000, endsAt: now + 16 * 60000, minutes: 25, goal, strict: false, taskId: 'a', scope: 'distractions' } }); }, sample.tasks[0]);
    p = await open('src/newtab/newtab.html'); await hideNudge(p); await shot('2-focus.jpg', p);
    await app.sw.evaluate(() => chrome.storage.local.set({ focus: null }));

    p = await open('src/insights/insights.html'); await p.evaluate(() => localStorage.setItem('et-itab', 'overview')); await p.reload(); await shot('3-insights.jpg', p);

    p = await open('src/blocked/blocked.html?u=http%3A%2F%2Freddit.com%2F&r=friction&a=pause'); await shot('4-pause.jpg', p);

    await seed(seedPage, { look: 'calm', mode: 'system', background: 'dawn', clockStyle: 'thin', lang });
    p = await open('src/options/options.html#appearance'); await p.evaluate(() => document.getElementById('appearance')?.scrollIntoView()); await shot('5-looks.jpg', p);
    console.log('done', lang);
  }
  await app.close();
})().catch((e) => { console.error(e); process.exit(1); });
