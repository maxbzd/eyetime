// The whole widget catalogue: every kind builds at S, M and L without errors or overflow, the gallery shows categories, the size row resizes, and the interactive ones work (counter, water, mood, habit, to-do, breathing, sound).
//   node scripts-dev/e2e/catalogue.cjs
const { launch } = require('./lib.cjs');

(async () => {
  const app = await launch({ viewport: { width: 1500, height: 1000 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [];
  const ok = (cond, msg) => { if (!cond) bad.push(msg); };
  const sp = await app.ctx.newPage(); await sp.goto(ext('src/options/options.html')); await sp.waitForTimeout(600);
  const p = await app.ctx.newPage();
  p.on('pageerror', (e) => bad.push('pageerror: ' + e)); p.on('console', (m) => { if (m.type() === 'error') bad.push('console: ' + m.text()); });

  const kinds = await sp.evaluate(async () => Object.keys((await import('/src/shared/widgets.js')).WIDGET_KINDS));
  ok(kinds.length >= 45, 'the catalogue has at least 45 kinds: ' + kinds.length);

  // 1. every kind at S, M and L (three widgets per kind, in batches that fit the canvas)
  const seeded = await sp.evaluate(async () => {
    const st = await import('/src/shared/storage.js'), tm = await import('/src/shared/time.js');
    await st.setRaw({ gsDismissed: true });
    const today = tm.dayKey();
    await st.updateDay(today, (d) => { d.ss = [{ id: 'x1', t: Date.now() - 3600_000, m: 25, p: 25, g: 'Write', k: '', c: 1, r: 2 }]; d.fs = 1500; d.fc = 1; d.d = { 'github.com': 1200, 'youtube.com': 600 }; });
    await st.setCollection('tasks', [{ id: 'a', text: 'Write the post', done: false, starred: true, createdAt: 1, due: today }, { id: 'b', text: 'Plan the week', done: false, starred: false, createdAt: 2 }]);
    await st.setCollection('habits', { items: [{ id: 'h1', name: 'Read' }], log: {} });
    await st.setCollection('calendar', [{ day: today, start: '23:00', end: '23:30', title: 'Late sync' }]);
    return true;
  });
  ok(seeded, 'seeded');
  for (const kind of kinds) {
    await sp.evaluate(async (kind) => {
      const st = await import('/src/shared/storage.js'), W = await import('/src/shared/widgets.js');
      const m = W.WIDGET_KINDS[kind], ids = ['wca000', 'wcb000', 'wcc000'], items = {};
      ids.forEach((id, i) => { items[id] = { x: [4, 28, 58][i], y: 20, w: m.sizes[i] }; });
      await st.updateSettings((s) => { s.onboarded = true; s.language = 'en'; s.newtab.greeting = false; s.newtab.modules = { focus: false, today: false, tasks: false, habits: false, notes: false, links: false }; s.newtab.widgets = ids.map((id) => ({ id, kind, cfg: W.defaultCfg(kind) })); s.newtab.canvas = { on: true, items }; });
    }, kind);
    await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(700);
    const r = await p.evaluate(() => [...document.querySelectorAll('.wgt:not(.wgt-preview)')].map((c) => ({ w: Math.round(c.getBoundingClientRect().width), h: Math.round(c.getBoundingClientRect().height), over: c.scrollWidth - c.clientWidth > 2, empty: !c.textContent.trim() && !c.querySelector('svg, img, .ob-orb, .ph-img, .br-circle') })));
    ok(r.length === 3, `${kind}: three widgets are on the page (${r.length})`);
    r.forEach((c, i) => { ok(!c.over, `${kind} ${'SML'[i]}: no horizontal overflow (${c.w}px)`); ok(!c.empty, `${kind} ${'SML'[i]}: is not empty`); ok(c.h > 20, `${kind} ${'SML'[i]}: has a height`); });
  }

  // 2. the gallery: categories and tiles
  await sp.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.newtab.widgets = []; s.newtab.canvas = { on: false, items: {} }; }); });
  await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(900);
  await p.click('#customize'); await p.waitForTimeout(250); await p.click('#drawerBody .btn-primary'); await p.waitForTimeout(900);
  await p.click('.cv-bar button:has-text("Add widget")'); await p.waitForTimeout(500);
  ok(await p.locator('.wg-cats .chip').count() === 8, 'the gallery has "All" and seven categories: ' + await p.locator('.wg-cats .chip').count());
  await p.locator('.wg-cats .chip', { hasText: 'Body' }).click(); await p.waitForTimeout(300);
  ok(await p.locator('.wg-tile').count() === 5, 'Body & mind lists its five widgets: ' + await p.locator('.wg-tile').count());
  await p.locator('.wg-tile', { hasText: 'Counter' }).first().click().catch(() => {});
  await p.locator('.wg-cats .chip', { hasText: 'Tasks' }).click(); await p.waitForTimeout(300);
  await p.locator('.wg-tile', { hasText: 'Counter' }).click(); await p.waitForTimeout(900);
  const size = p.locator('.cv-panel .sk-row .segmented button');
  ok(await size.count() === 3, 'the size row has S, M and L');
  const wBefore = await p.locator('.wgt-counter').first().evaluate((e) => e.getBoundingClientRect().width);
  await size.nth(2).click(); await p.waitForTimeout(500);
  const wAfter = await p.locator('.wgt-counter').first().evaluate((e) => e.getBoundingClientRect().width);
  ok(wAfter > wBefore + 40, `L is wider than the default (${Math.round(wBefore)} → ${Math.round(wAfter)})`);

  // 3. the interactive ones
  await sp.evaluate(async () => {
    const st = await import('/src/shared/storage.js'), W = await import('/src/shared/widgets.js');
    const ks = ['counter', 'water', 'mood', 'habit', 'todo', 'breath', 'sound', 'label'], items = {};
    ks.forEach((k, i) => { items['wi000' + i] = { x: 3 + (i % 4) * 24, y: i < 4 ? 8 : 48, w: W.WIDGET_KINDS[k].sizes[1] }; });
    await st.updateSettings((s) => { s.newtab.widgets = ks.map((k, i) => ({ id: 'wi000' + i, kind: k, cfg: W.defaultCfg(k) })); s.newtab.canvas = { on: true, items }; });
  });
  await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(1200);
  const cfgOf = (kind) => sp.evaluate(async (kind) => (await (await import('/src/shared/storage.js')).getSettings()).newtab.widgets.find((w) => w.kind === kind).cfg, kind);
  await p.locator('.wgt-counter .btn-primary').click(); await p.locator('.wgt-counter .btn-primary').click(); await p.waitForTimeout(500);
  ok((await cfgOf('counter')).count === 2, 'the counter counts');
  await p.locator('.wgt-counter button[aria-label="Reset to zero"]').click(); await p.waitForTimeout(400);
  ok((await cfgOf('counter')).count === 0, 'the counter resets');
  await p.locator('.wgt-water .wa-cup').nth(2).click(); await p.waitForTimeout(500);
  ok((await cfgOf('water')).n === 3, 'the third glass fills three');
  ok(/3 of 8/.test(await p.locator('.wgt-water').textContent()), 'the water text follows');
  await p.locator('.wgt-mood .md-btn').nth(3).click(); await p.waitForTimeout(500);
  ok(Object.values((await cfgOf('mood')).log).includes(4), 'the mood is saved for today');
  await p.locator('.wgt-habit .hb-done').click(); await p.waitForTimeout(600);
  ok(await p.locator('.wgt-habit .hb-done.on').count() === 1, 'the habit is checked for today');
  await p.locator('.wgt-todo li input[type=checkbox]').first().check(); await p.waitForTimeout(700);
  const open = await sp.evaluate(async () => (await (await import('/src/shared/storage.js')).getCollection('tasks', [])).filter((x) => !x.done).length);
  ok(open === 1, 'ticking a task in the widget finishes it: ' + open);
  await p.locator('.wgt-todo .wt-add').fill('Buy milk 15:00'); await p.keyboard.press('Enter'); await p.waitForTimeout(700);
  ok((await sp.evaluate(async () => (await (await import('/src/shared/storage.js')).getCollection('tasks', [])).some((x) => x.text === 'Buy milk'))), 'a task typed into the widget is added and parsed');
  const c0 = await p.locator('.wgt-breath .br-count').textContent(); await p.waitForTimeout(1300);
  ok(/Breathe in|Hold|Breathe out/.test(await p.locator('.wgt-breath .br-word').textContent()), 'breathing shows its phase');
  void c0;
  await p.locator('.wgt-sound .sd-btn', { hasText: 'Rain' }).click(); await p.waitForTimeout(700);
  ok((await sp.evaluate(async () => (await (await import('/src/shared/storage.js')).getSettings()).focus.ambient)) === 'rain', 'the sound widget sets the focus sound');
  await p.locator('.wgt-sound .sd-btn', { hasText: 'Off' }).click(); await p.waitForTimeout(400);

  // 4. new kinds inside a stack
  await sp.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.newtab.canvas = { on: false, items: {} }; s.newtab.widgets = [{ id: 'wstk1', kind: 'stack', cfg: { items: [{ kind: 'month', when: 'any', cfg: {} }, { kind: 'breath', when: 'any', cfg: {} }, { kind: 'orb', when: 'any', cfg: {} }], pick: 'manual', i: 1 } }]; }); });
  await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(1000);
  ok(await p.locator('#wgt-wstk1 .wgt-breath').count() === 1, 'a new kind works inside a stack');
  await p.locator('#wgt-wstk1 .ws-dot').nth(2).click(); await p.waitForTimeout(500);
  ok(await p.locator('#wgt-wstk1 .wgt-orb').count() === 1, 'and the dots switch between new kinds');

  await app.close();
  if (bad.length) { console.log('FAIL\n' + [...new Set(bad)].slice(0, 40).join('\n')); process.exit(1); }
  console.log('catalogue: ok (' + kinds.length + ' kinds)');
})();
