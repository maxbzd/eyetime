// Card skins end to end: the theme's skin reaches every card, a widget can have its own, liquid glass gets its refraction filter (Chrome), the panels set them, bad values are cleaned.
//   node scripts-dev/e2e/skins.cjs
const { launch } = require('./lib.cjs');

(async () => {
  const app = await launch({ viewport: { width: 1440, height: 900 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [];
  process.on('unhandledRejection', (e) => { console.log('FAIL (crashed)\n' + bad.join('\n') + '\n' + e); process.exit(1); });
  const ok = (cond, msg) => { if (!cond) bad.push(msg); };
  const sp = await app.ctx.newPage(); await sp.goto(ext('src/options/options.html')); await sp.waitForTimeout(600);
  /** change settings by dotted path: set({ 'newtab.dna': {...} }); a function value gets the old one: set({ 'newtab.widgets': (w) => ... } is not possible (no eval), so pass whole values */
  const set = (patch) => sp.evaluate(async (b) => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { for (const [k, v] of Object.entries(b)) { const parts = k.split('.'); let o = s; for (const q of parts.slice(0, -1)) o = o[q]; o[parts.at(-1)] = v; } }); }, patch);
  const W = [{ id: 'wsk001', kind: 'bignumber', cfg: { metric: 'focusToday' } }, { id: 'wsk002', kind: 'mantra', cfg: { text: 'x' }, skin: { s: 'paper' } }];
  await sp.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.setRaw({ gsDismissed: true }); await st.updateSettings((s) => { s.onboarded = true; s.language = 'en'; s.newtab.widgets = [{ id: 'wsk001', kind: 'bignumber', cfg: { metric: 'focusToday' } }, { id: 'wsk002', kind: 'mantra', cfg: { text: 'x' }, skin: { s: 'paper' } }]; }); });
  const p = await app.ctx.newPage();
  p.on('pageerror', (e) => bad.push('pageerror: ' + e)); p.on('console', (m) => { if (m.type() === 'error') bad.push('console: ' + m.text()); });
  const info = (sel) => p.evaluate((q) => { const e = document.querySelector(q); if (!e) return null; const c = getComputedStyle(e); return { sk: e.dataset.sk || null, cls: e.className, bf: e.style.getPropertyValue('--sk-bf'), bg: c.backgroundColor, radius: c.borderTopLeftRadius, text: c.getPropertyValue('--text') }; }, sel);
  await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(1200);
  ok((await info('#focus')).sk === null && (await info('#wgt-wsk001')).sk === null, 'by default the look keeps its own cards');
  ok((await info('#wgt-wsk002')).sk === 'paper', 'a widget with its own skin has it');

  await set({ 'newtab.dna': { s: 'neon' } }); await p.waitForTimeout(800);
  ok((await info('#focus')).sk === 'neon' && (await info('#mod-tasks')).sk === 'neon' && (await info('#wgt-wsk001')).sk === 'neon', 'the theme skin reaches the focus card, the modules and the widgets');
  ok((await info('#wgt-wsk002')).sk === 'paper', 'a widget\'s own skin wins over the theme');
  ok((await info('#focus')).text.trim() === '#ffffff', 'neon forces light text');

  await set({ 'newtab.dna': { s: 'liquid' } }); await p.waitForTimeout(1000);
  const lq = await info('#focus');
  ok(lq.sk === 'liquid' && /sk-liquid/.test(lq.cls) && /url\(#et-lq-/.test(lq.bf), 'liquid glass gets its own refraction filter: ' + JSON.stringify(lq));
  ok(await p.evaluate(() => document.querySelectorAll('svg filter[id^="et-lq-"]').length) >= 3, 'one filter per card');
  ok(await p.evaluate(() => { const f = document.querySelector('svg filter[id^="et-lq-"] feImage'); return !!f && f.getAttribute('href').startsWith('data:image/png'); }), 'the filter holds a displacement map of the card\'s size');
  await set({ 'newtab.dna': { s: 'solid', r: 4 } }); await p.waitForTimeout(800);
  const so = await info('#focus'), nf = await p.evaluate(() => document.querySelectorAll('svg filter[id^="et-lq-"]').length); ok(so.radius === '4px' && so.bf === '' && nf === 0, 'leaving liquid removes its filters; the radius slider applies: ' + JSON.stringify(so) + ' filters ' + nf);
  await set({ 'newtab.dna': { s: 'look' } }); await p.waitForTimeout(700);
  ok((await info('#focus')).sk === null, 'back to the look clears the skin');

  // a hostile value never reaches a style
  await set({ 'newtab.dna': { s: 'glass', a: 'red; background: url(//evil)', r: 'x' }, 'newtab.widgets': [{ ...W[0], skin: { s: '</style>' } }, W[1]] }); await p.waitForTimeout(800);
  const evil = await p.evaluate(() => document.querySelector('#focus').getAttribute('style') || '');
  ok(!/evil|url\(/.test(evil), 'a bad colour is dropped: ' + evil.slice(0, 120));

  // the editor panels
  await set({ 'newtab.dna': { s: 'look' }, 'newtab.widgets': W, 'newtab.canvas': { on: true, items: { clock: { x: 50, y: 17, s: 1 }, focus: { x: 50, y: 60, w: 640 }, wsk001: { x: 18, y: 62, w: 280 } } } });
  await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(1200);
  await p.click('#customize'); await p.waitForTimeout(250); await p.click('#drawerBody .btn-primary'); await p.waitForTimeout(900);
  await p.evaluate(() => document.querySelector('.cv-coach .btn')?.click());
  await p.locator('.cv-bar button:has-text("Look")').click(); await p.waitForTimeout(700);
  ok(await p.locator('.cv-panel .sk-tile').count() === 9, 'the Look panel offers the nine card styles: ' + await p.locator('.cv-panel .sk-tile').count());
  await p.locator('.cv-panel .sk-tile', { hasText: 'Neon' }).click(); await p.waitForTimeout(900);
  const dna = await sp.evaluate(async () => (await (await import('/src/shared/storage.js')).getSettings()).newtab.dna);
  ok(dna.s === 'neon', 'a tile sets the theme skin: ' + JSON.stringify(dna));
  ok(await p.locator('.cv-panel details.sk-fine').count() === 1 && await p.locator('.cv-panel .sk-fine[open]').count() === 0, 'the sliders are folded away by default');
  await p.locator('.cv-panel .sk-fine summary').click(); await p.locator('.cv-panel input[aria-label="Corners"]').fill('30'); await p.locator('.cv-panel input[aria-label="Corners"]').dispatchEvent('change'); await p.waitForTimeout(700);
  ok((await sp.evaluate(async () => (await (await import('/src/shared/storage.js')).getSettings()).newtab.dna)).r === 30, 'a slider is saved');
  await p.locator('.cv-frame[data-block="wsk001"]').focus().catch(() => {}); await p.waitForTimeout(300);

  // a widget's own panel: "Same as the theme" first
  await p.locator('.cv-frame[data-block="wsk001"]').focus(); await p.waitForTimeout(700);
  ok(await p.locator('.cv-panel .sk-tile', { hasText: 'Same as the theme' }).count() === 1 && await p.locator('.cv-panel .sk-tile[aria-pressed="true"]', { hasText: 'Same as the theme' }).count() === 1, 'a widget panel starts on "Same as the theme"');
  await p.locator('.cv-panel .sk-tile', { hasText: 'Paper' }).click(); await p.waitForTimeout(800);
  ok((await sp.evaluate(async () => (await (await import('/src/shared/storage.js')).getSettings()).newtab.widgets[0].skin)).s === 'paper', 'a widget can be given its own skin');
  await p.locator('.cv-panel .sk-tile', { hasText: 'Same as the theme' }).click(); await p.waitForTimeout(800);
  ok(!('skin' in (await sp.evaluate(async () => (await (await import('/src/shared/storage.js')).getSettings()).newtab.widgets[0]))), 'and given back');

  console.log(bad.length ? 'FAIL\n' + bad.join('\n') : 'skins: all checks passed');
  await app.close();
  process.exit(bad.length ? 1 : 0);
})();
