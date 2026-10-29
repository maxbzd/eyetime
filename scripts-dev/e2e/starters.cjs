// Ready themes in the customize drawer: eight pictures, one tap applies everything, the toast undoes it, Surprise me works, and the person's own data stays.
//   node scripts-dev/e2e/starters.cjs
const { launch } = require('./lib.cjs');

(async () => {
  const app = await launch({ viewport: { width: 1440, height: 900 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [];
  const ok = (cond, msg) => { if (!cond) bad.push(msg); };
  const sp = await app.ctx.newPage(); await sp.goto(ext('src/options/options.html')); await sp.waitForTimeout(600);
  await sp.evaluate(async () => {
    const st = await import('/src/shared/storage.js');
    await st.setRaw({ gsDismissed: true });
    await st.setCollection('tasks', [{ id: 'a', text: 'Keep me', done: false, starred: false, createdAt: 1 }]);
    await st.updateSettings((s) => { s.onboarded = true; s.language = 'en'; s.newtab.links = [{ title: 'Mine', url: 'https://example.com' }]; s.newtab.widgets = [{ id: 'wold001', kind: 'sticky', cfg: { text: 'old' } }]; });
  });
  const get = () => sp.evaluate(async () => { const st = await import('/src/shared/storage.js'); const s = await st.getSettings(); return { look: s.appearance.look, mode: s.appearance.mode, bg: s.newtab.background, kinds: s.newtab.widgets.map((w) => w.kind), dna: s.newtab.dna, links: s.newtab.links.length, canvas: s.newtab.canvas.on, tasks: (await st.getCollection('tasks', [])).length }; });
  const p = await app.ctx.newPage();
  p.on('pageerror', (e) => bad.push('pageerror: ' + e)); p.on('console', (m) => { if (m.type() === 'error') bad.push('console: ' + m.text()); });
  await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(1200);
  await p.click('#customize'); await p.waitForTimeout(400);
  ok(await p.locator('#drawerBody .st-tile').count() === 8, 'eight ready themes: ' + await p.locator('#drawerBody .st-tile').count());
  const broken = await p.evaluate(() => [...document.querySelectorAll('.st-tile img')].filter((i) => !i.complete || i.naturalWidth < 100).length);
  ok(broken === 0, 'every theme picture loads: ' + broken + ' did not');
  ok((await p.locator('#drawerBody h4').allTextContents()).includes('Ready themes'), 'the drawer has a Ready themes section');

  // the drawer is a short list of rows that open one at a time, with what is chosen shown on each
  const rows = p.locator('#drawerBody .hr-head');
  ok(await rows.count() === 6, 'six rows: ' + await rows.count());
  ok((await p.locator('#drawerBody .hr-body').count()) === 0, 'all rows start closed');
  const fits = await p.evaluate(() => { const b = document.querySelector('#drawerBody'); return b.scrollHeight <= b.clientHeight + 2; });
  ok(fits, 'the closed drawer fits on one screen');
  ok(/Calm/.test(await rows.nth(3).textContent()), 'the colour row shows the look: ' + await rows.nth(3).textContent());
  await rows.nth(0).click(); await p.waitForTimeout(300);
  ok(await p.locator('#drawerBody .hr-body').count() === 1 && await p.locator('#drawerBody .bg-tile').count() > 10, 'Background opens with its tiles');
  await rows.nth(1).click(); await p.waitForTimeout(300);
  ok(await p.locator('#drawerBody .hr-body').count() === 1 && await p.locator('#drawerBody .bg-tile').count() === 0 && await p.locator('#drawerBody button:has-text("Design the digits")').count() === 1, 'opening Clock closes Background');
  await p.locator('#drawerBody .hr-head', { hasText: 'Layout' }).click(); await p.waitForTimeout(300);
  ok(await p.locator('#drawerBody .mod-row').count() === 5 && await p.locator('#drawerBody .segmented button:has-text("Split")').count() === 1, 'Layout & blocks keeps the layout choice and the five blocks with their order');
  await p.locator('#drawerBody .hr-head', { hasText: 'Cards' }).click(); await p.waitForTimeout(300);
  await p.locator('#drawerBody .sk-tiles button, #drawerBody [class*=sk-] button').first().click().catch(() => {});
  await p.locator('#drawerBody .hr-head[aria-expanded=true]').click(); await p.waitForTimeout(300);
  ok(await p.locator('#drawerBody .hr-body').count() === 0, 'a row closes again');
  const before = await get();
  await p.locator('.st-tile', { hasText: 'Terminal' }).click(); await p.waitForTimeout(1200);
  let a = await get();
  ok(a.look === 'terminal' && a.mode === 'dark' && a.bg === 'grid' && a.dna.s === 'outline', 'the theme sets look, scheme, background and card style: ' + JSON.stringify(a));
  ok(a.kinds.includes('sessions') && !a.kinds.includes('sticky') && a.canvas, 'the widgets are the theme’s: ' + a.kinds);
  ok(a.links === 1 && a.tasks === 1, 'links and tasks are untouched');
  ok(await p.locator('.wgt-sessions').count() === 1 && await p.locator('.wgt-topsites').count() === 1, 'the widgets show on Home');
  const toast = p.locator('.toast', { hasText: 'Terminal' }); ok(await toast.count() >= 1, 'a toast says which theme is on');
  await toast.getByRole('button', { name: 'Undo' }).click(); await p.waitForTimeout(1200);
  a = await get();
  ok(a.look === before.look && a.bg === before.bg && a.kinds.join() === 'sticky', 'Undo brings the old Home back: ' + JSON.stringify(a));

  await p.click('#drawerBody button:has-text("Surprise me")'); await p.waitForTimeout(1200);
  a = await get();
  ok(a.kinds.length >= 2 && a.kinds.length <= 4 && !a.kinds.includes('sticky') && a.canvas, 'Surprise me puts a few widgets on Home: ' + a.kinds);
  ok(await p.locator('.wgt').count() === a.kinds.length, 'and they are all on the page');
  const overflow = await p.evaluate(() => [...document.querySelectorAll('.wgt')].filter((c) => c.scrollWidth - c.clientWidth > 2).length);
  ok(overflow === 0, 'none of them overflows');

  // what is placed never overlaps: the eight starters and a run of surprises, at a desktop and at a laptop-sized window
  const overlaps = async (label) => {
    const boxes = await p.evaluate(() => [...document.querySelectorAll('main.nt .wgt, #clock, #greeting')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => { const r = e.getBoundingClientRect(); return { id: e.id || e.className.split(' ').find((c) => c.startsWith('wgt-')), x: r.x, y: r.y, w: r.width, h: r.height }; }));
    for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
      const A = boxes[a], B = boxes[b], ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x), oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
      ok(!(ox > 6 && oy > 6), `${label}: ${A.id} and ${B.id} overlap (${Math.round(ox)}x${Math.round(oy)})`);
    }
  };
  for (const size of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
    await p.setViewportSize(size);
    for (const id of ['dawn', 'night', 'planner', 'terminal', 'zen', 'glass', 'sakura', 'mono']) {
      await sp.evaluate(async (id) => { const st = await import('/src/shared/storage.js'), S = await import('/src/shared/starters.js'); await st.updateSettings((s) => { S.applyStarter(s, s.newtab, S.starterData(S.STARTERS.find((x) => x.id === id))); }); }, id);
      await p.waitForTimeout(700); await overlaps(`${size.width}x${size.height} ${id}`);
    }
    for (let i = 0; i < 8; i++) {
      await sp.evaluate(async () => { const st = await import('/src/shared/storage.js'), S = await import('/src/shared/starters.js'); await st.updateSettings((s) => { S.applyStarter(s, s.newtab, S.starterData(S.surprise())); }); });
      await p.waitForTimeout(700); await overlaps(`${size.width}x${size.height} surprise ${i}`);
    }
  }
  await app.close();
  if (bad.length) { console.log('FAIL\n' + [...new Set(bad)].slice(0, 30).join('\n')); process.exit(1); }
  console.log('starters: ok');
})();
