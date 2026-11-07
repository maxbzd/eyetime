// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The pictures the product demo is made of: the real interface at twice the resolution, with the realistic demo data (the same seed as the store screenshots).
//   node scripts-dev/e2e/demo-shots.cjs [outDir]      (default /tmp/eyetime-demo-assets; demo-video.cjs calls it)
const { launch } = require('./lib.cjs');
const { seed } = require('./seed.cjs');
const path = require('path');
const fs = require('fs');

const OUT = process.argv[2] || '/tmp/eyetime-demo-assets';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const app = await launch({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const seedPage = await app.ctx.newPage(); await seedPage.goto(ext('src/options/options.html')); await seedPage.waitForTimeout(800);
  const open = async (url, vp) => { const p = await app.ctx.newPage(); await p.setViewportSize(vp || { width: 1280, height: 800 }); await p.goto(ext(url)); return p; };
  const shot = async (name, p, opts = {}) => { await p.waitForTimeout(1500); await p.screenshot({ path: path.join(OUT, name + '.png'), ...opts }); await p.close(); };
  const quiet = (p) => p.addStyleTag({ content: '#nudge, .gs, .wn { display: none !important }' });
  const goal = async () => { await seedPage.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.focus.dailyGoal = 120; }); await st.setRaw({ gsDismissed: true }); }); };

  await seed(seedPage, { look: 'calm', mode: 'light', background: 'photo', clockStyle: 'thin', layout: 'today', frame: 'blush' }); await goal();
  let p = await open('src/newtab/newtab.html'); await quiet(p); await shot('home', p);

  // a running session on the new tab and in the popup
  await app.sw.evaluate(async () => { const now = Date.now(); await chrome.storage.local.set({ focus: { id: 'x', startedAt: now - 9 * 60000, endsAt: now + 16 * 60000, minutes: 25, goal: 'Write the quarterly report', strict: false, taskId: 'a', scope: 'distractions' } }); });
  p = await open('src/newtab/newtab.html'); await quiet(p); await shot('home-focus', p);
  p = await open('src/popup/popup.html?site=github.com', { width: 380, height: 600 }); await shot('popup', p);
  await app.sw.evaluate(() => chrome.storage.local.set({ focus: null }));

  p = await open('src/blocked/blocked.html?u=http%3A%2F%2Freddit.com%2F&r=friction&a=pause'); await shot('pause', p);
  p = await open('src/insights/insights.html', { width: 1280, height: 1500 }); await p.evaluate(() => localStorage.setItem('et-itab', 'overview')); await p.reload(); await shot('insights', p);
  p = await open('src/insights/insights.html', { width: 1280, height: 1000 }); await p.evaluate(() => localStorage.setItem('et-itab', 'patterns')); await p.reload(); await shot('patterns', p);
  p = await open('src/newtab/newtab.html'); await p.waitForTimeout(900); await p.keyboard.press('Control+k'); await p.waitForSelector('dialog.palette[open]'); await p.keyboard.type('rep'); await shot('palette', p);

  const combos = [['terminal', 'dark', 'grid', 'mono'], ['sakura', 'light', 'mesh', 'stacked'], ['paper', 'light', 'grain', 'serif'], ['aurora', 'dark', 'aurora', 'thin']];
  for (const [i, [look, mode, bg, clock]] of combos.entries()) {
    await seed(seedPage, { look, mode, background: bg, clockStyle: clock, layout: 'center' });
    await goal(); p = await open('src/newtab/newtab.html'); await quiet(p); await shot('look-' + (i + 1), p);
  }
  await seed(seedPage, { look: 'calm', mode: 'dark', background: 'photo', clockStyle: 'thin', layout: 'today', frame: 'dusk' }); await goal();
  p = await open('src/newtab/newtab.html'); await quiet(p); await shot('home-dark', p);
  await app.close();
  console.log('assets in', OUT);
})();
