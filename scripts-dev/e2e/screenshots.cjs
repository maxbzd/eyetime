// Regenerates store/screenshots/*.png with realistic demo data:  node scripts-dev/e2e/screenshots.cjs
// (6-onboarding.png is kept as is.) Requires Playwright + Chromium like the e2e run.
const { launch } = require('./lib.cjs');
const path = require('path');
const OUT = path.join(__dirname, '../../store/screenshots');

async function seed(page, { look, mode, background, clockStyle }) {
  await page.evaluate(async ([look, mode, background, clockStyle]) => {
    const st = await import('/src/shared/storage.js');
    const { rangeKeys } = await import('/src/shared/time.js');
    await st.updateSettings((s) => {
      s.onboarded = true; s.language = 'en'; s.focus.dailyGoal = 120; s.blocking.plans = [{ id: 'p', when: '', then: 'stand up and drink water' }];
      Object.assign(s.appearance, { look, mode }); Object.assign(s.newtab, { background, clockStyle });
    });
    const keys = rangeKeys(30);
    const hosts = ['github.com', 'docs.google.com', 'youtube.com', 'reddit.com', 'news.ycombinator.com'];
    let n = 7; const rnd = () => (n = (n * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < keys.length; i++) {
      await st.updateDay(keys[i], (d) => {
        d.d = {}; d.h = {}; d.ss = []; d.fs = 0; d.fc = 0;
        hosts.forEach((h, k) => { const sec = Math.round((k < 2 ? 0.5 + rnd() : rnd()) * 4800); d.d[h] = sec; const W = [0.5, 1.2, 1.5, 1.1, 0.7, 0.25, 0.8, 1.3, 1.2, 0.9, 0.6, 0.25]; for (let hr = 8; hr < 20; hr++) { (d.h[hr] ||= {})[h] = Math.round((sec / 12) * W[hr - 8] * (0.7 + rnd() * 0.6)); } });
        const c = 1 + Math.floor(rnd() * 3); d.fc = c;
        for (let k = 0; k < c; k++) { const t = new Date(); t.setDate(t.getDate() - (29 - i)); t.setHours(k === 0 ? 9 : k === 1 ? 10 : 15, 5); d.ss.push({ id: 's' + i + k, t: t.getTime(), m: 25 + k * 25, p: 25 + k * 25, g: ['Write the quarterly report', 'Plan the sprint', 'Review pull requests'][k % 3], k: '', c: 1, r: 1 + ((i + k) % 3) }); d.fs += (25 + k * 25) * 60; }
        d.b = 2; d.pr = { back: 2, work: 1, bored: 1 }; d.sw = 20 + Math.floor(rnd() * 30); d.fa = Math.floor(rnd() * 4); d.pa = { 'reddit.com': 1 + Math.floor(rnd() * 5), 'youtube.com': Math.floor(rnd() * 4) }; if (i % 3 === 0) d.w = ['Shipped the draft', 'Finished the review', 'Walked every break'][(i / 3 | 0) % 3];
      });
    }
    await st.setCollection('tasks', [
      { id: 'a', text: 'Write the quarterly report', done: false, starred: true, createdAt: 1, est: 90, focusSec: 4500, resume: 'Draft section 2, then the charts' },
      { id: 'b', text: 'Review pull requests', done: false, starred: true, createdAt: 2, focusSec: 1500 },
      { id: 'c', text: 'Book flights for the conference', done: false, starred: false, createdAt: 3 },
      { id: 'd', text: 'Send the invoice', done: true, starred: false, createdAt: 4, focusSec: 900 }]);
    await st.setCollection('habits', [{ id: 'h1', text: 'Move 20 minutes', createdAt: 1, log: Object.fromEntries(keys.slice(-5).map((k) => [k, true])) }]);
  }, [look, mode, background, clockStyle]);
}

(async () => {
  const app = await launch({ viewport: { width: 1280, height: 800 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const seedPage = await app.ctx.newPage(); await seedPage.goto(ext('src/options/options.html')); await seedPage.waitForTimeout(800);
  const shot = async (file, p, opts = {}) => { await p.waitForTimeout(1300); await p.screenshot({ path: path.join(OUT, file), ...opts }); };
  const open = async (url, vp) => { const p = await app.ctx.newPage(); if (vp) await p.setViewportSize(vp); await p.goto(ext(url)); return p; };

  await seed(seedPage, { look: 'calm', mode: 'light', background: 'dawn', clockStyle: 'thin' });
  let p = await open('src/newtab/newtab.html'); await shot('1-home.png', p); await p.close();

  await app.sw.evaluate(async () => { const now = Date.now(); await chrome.storage.local.set({ focus: { id: 'x', startedAt: now - 9 * 60000, endsAt: now + 16 * 60000, minutes: 25, goal: 'Write the quarterly report', strict: false, taskId: 'a', scope: 'distractions' } }); });
  p = await open('src/popup/popup.html?site=github.com', { width: 380, height: 600 }); await shot('2-focus.png', p); await p.close();
  await app.sw.evaluate(() => chrome.storage.local.set({ focus: null }));

  p = await open('src/insights/insights.html', { width: 1280, height: 1100 }); await p.evaluate(() => localStorage.setItem('et-itab', 'overview')); await p.reload(); await shot('3-insights.png', p); await p.evaluate(() => localStorage.setItem('et-itab', 'focus')); await p.reload(); await p.waitForTimeout(800); await p.screenshot({ path: path.join(OUT, '3b-insights-focus.png') }); await p.close();

  await seed(seedPage, { look: 'midnight', mode: 'dark', background: 'stars', clockStyle: 'bold' });
  p = await open('src/newtab/newtab.html'); await shot('4-home-dark.png', p); await p.close();

  await seed(seedPage, { look: 'calm', mode: 'system', background: 'dawn', clockStyle: 'thin' });
  p = await open('src/options/options.html#appearance', { width: 1280, height: 1000 }); await p.evaluate(() => document.getElementById('appearance').scrollIntoView());
  await shot('5-settings.png', p); await p.addStyleTag({ content: '.app-header{display:none!important}' }); await p.locator('.looks').screenshot({ path: path.join(OUT, '7-looks.png') }); await p.close();

  // a taste of the variety: the same Home in four looks
  const combos = [['terminal', 'dark', 'grid', 'mono'], ['sakura', 'light', 'mesh', 'stacked'], ['paper', 'light', 'grain', 'serif'], ['aurora', 'dark', 'aurora', 'thin']];
  for (const [i, [look, mode, bg, clock]] of combos.entries()) {
    await seed(seedPage, { look, mode, background: bg, clockStyle: clock });
    p = await open('src/newtab/newtab.html'); await shot(`8-variant-${i + 1}-${look}.png`, p); await p.close();
  }
  // the research-driven moments: pause page with your own if-then plan, and the evening ritual
  await seed(seedPage, { look: 'calm', mode: 'light', background: 'dawn', clockStyle: 'thin' });
  p = await open('src/blocked/blocked.html?u=http%3A%2F%2Freddit.com%2F&r=friction&a=pause', { width: 1000, height: 700 }); await shot('9-pause-plan.png', p); await p.close();
  p = await open('src/newtab/newtab.html', { width: 1280, height: 900 }); await p.waitForTimeout(800); await p.locator('.plan-link').click(); await shot('10-close-the-day.png', p); await p.close();
  // command palette, the day timeline and the shareable week card
  p = await open('src/newtab/newtab.html', { width: 1280, height: 800 }); await p.waitForTimeout(900); await p.keyboard.press('Control+k'); await p.waitForSelector('dialog.palette[open]'); await p.keyboard.type('rep'); await shot('11-palette.png', p); await p.close();
  p = await open('src/insights/insights.html', { width: 1280, height: 1000 }); await p.evaluate(() => localStorage.setItem('et-itab', 'patterns')); await p.reload(); await shot('12-timeline.png', p); await p.close();
  p = await open('src/insights/insights.html?range=7', { width: 1280, height: 900 }); await p.evaluate(() => localStorage.setItem('et-itab', 'overview')); await p.reload(); await p.waitForTimeout(800); await p.locator('.review .btn').first().click(); await p.waitForSelector('.wrapped-img');
  const src = await p.locator('.wrapped-img').getAttribute('src'); const b64 = await p.evaluate(async (u) => { const b = await (await fetch(u)).blob(); return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); }, src);
  require('fs').writeFileSync(path.join(OUT, '13-week-card.png'), Buffer.from(b64.split(',')[1], 'base64')); await p.close();
  await app.close();
})();