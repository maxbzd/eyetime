// The settings page shows one section at a time: the side list switches sections and lists the groups of the current one, a search looks through all of them,
// a link with #section opens that section, and the layout holds on a narrow window.
//   node scripts-dev/e2e/settings.cjs
const { launch } = require('./lib.cjs');

(async () => {
  const app = await launch({ viewport: { width: 1440, height: 900 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [];
  const ok = (cond, msg) => { if (!cond) bad.push(msg); };
  const p = await app.ctx.newPage();
  p.on('pageerror', (e) => bad.push('pageerror: ' + e)); p.on('console', (m) => { if (m.type() === 'error') bad.push('console: ' + m.text()); });
  await p.goto(ext('src/options/options.html')); await p.waitForTimeout(600);
  await p.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.onboarded = true; s.language = 'en'; }); await st.setRaw({ gsDismissed: true }); });
  await p.reload(); await p.waitForTimeout(900);
  const shown = () => p.evaluate(() => [...document.querySelectorAll('section.sec')].filter((s) => !s.hidden).map((s) => s.id));
  const h = () => p.evaluate(() => document.documentElement.scrollHeight);

  ok((await shown()).join() === 'general', 'starts on General alone: ' + await shown());
  ok(await h() < 1600, 'the page is short: ' + await h());
  await p.locator('#side > a', { hasText: 'Appearance' }).click(); await p.waitForTimeout(300);
  ok((await shown()).join() === 'appearance' && (await p.evaluate(() => location.hash)) === '#appearance', 'the side list opens a section');
  ok(await p.locator('#side .side-sub a').count() >= 3, 'the groups of the section are listed under it');
  ok(await p.locator('.look-card').count() >= 20 && await p.locator('.look-now').count() === 1, 'the looks are in a dense grid with the chosen one explained');

  // a group link scrolls to it and is marked
  await p.locator('#side .side-sub a', { hasText: 'Advanced' }).click(); await p.waitForTimeout(900);
  ok(await p.evaluate(() => window.scrollY) > 300, 'a group link scrolls to the group');
  ok(await p.locator('#side .side-sub a[aria-current="true"]').innerText().then((x) => /Advanced/.test(x)), 'the group being read is marked');

  // search looks through every section; Escape returns to the section view
  await p.focus('#q'); await p.keyboard.type('strict'); await p.waitForTimeout(300);
  const found = await shown();
  ok(found.length >= 1 && await p.locator('.setting.hit').count() >= 1, 'search shows matching rows: ' + found);
  ok(await p.locator('#side > a[aria-current="true"]').count() === 0, 'no section is marked while searching');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok((await shown()).length === 1 && (await p.inputValue('#q')) === '', 'Escape clears the search and returns to one section');

  // a deep link opens its section; the browser back/forward keeps working with the hash
  await p.goto(ext('src/options/options.html#blocking')); await p.waitForTimeout(900);
  ok((await shown()).join() === 'blocking', 'a #section link opens that section: ' + await shown());
  await p.evaluate(() => { location.hash = '#eye'; }); await p.waitForTimeout(400);
  ok((await shown()).join() === 'eye', 'changing the hash switches the section');

  // narrow window: the side list becomes a row, sub-items are hidden, nothing overflows
  await p.setViewportSize({ width: 600, height: 900 }); await p.waitForTimeout(400);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal scroll on a narrow window');
  ok(await p.locator('#side .side-sub').evaluateAll((els) => els.every((e) => getComputedStyle(e).display === 'none')), 'sub-items are hidden on a narrow window');

  console.log(bad.length ? 'FAIL\n' + bad.join('\n') : 'settings: all checks passed');
  await app.close();
  process.exit(bad.length ? 1 : 0);
})();
