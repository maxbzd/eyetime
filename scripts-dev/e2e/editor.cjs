// The Home arrangement editor end to end: open it from the drawer, drag, resize, move with the keyboard, remove and add a block, undo, reset,
// see it survive a reload, fall back to the stacked layout on a narrow window, switch back to the look's own layout.
//   node scripts-dev/e2e/editor.cjs
const fs = require('fs');
const path = require('path');
const { launch } = require('./lib.cjs');
const AXE = fs.readFileSync(path.join(require.resolve('axe-core'), '../axe.min.js'), 'utf8');

(async () => {
  const app = await launch({ viewport: { width: 1440, height: 900 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [];
  process.on('unhandledRejection', (e) => { console.log('FAIL (crashed)\n' + bad.join('\n') + '\n' + e); process.exit(1); });
  const ok = (cond, msg) => { if (!cond) bad.push(msg); };
  const sp = await app.ctx.newPage(); await sp.goto(ext('src/options/options.html')); await sp.waitForTimeout(600);
  await sp.evaluate(async () => {
    const st = await import('/src/shared/storage.js');
    await st.updateSettings((s) => { s.onboarded = true; s.language = 'en'; });
    await st.setRaw({ gsDismissed: true });
  });
  const p = await app.ctx.newPage();
  p.on('pageerror', (e) => bad.push('pageerror: ' + e)); p.on('console', (m) => { if (m.type() === 'error') bad.push('console: ' + m.text()); });
  const canvas = () => p.evaluate(async () => (await (await import('/src/shared/storage.js')).getSettings()).newtab.canvas);
  const more = async (name) => { await p.click('.cv-bar .dd:has-text("More")'); await p.waitForTimeout(150); await p.locator('.dd-opt', { hasText: name }).click(); };
  const box = async (sel) => (await p.locator(sel).boundingBox());
  await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(1200);
  ok(await p.evaluate(() => document.body.dataset.layout) === 'center', 'starts in the look layout');

  // the time and the greeting are not selectable with the mouse
  await p.locator('#clock').click({ clickCount: 3 }); await p.mouse.move(100, 100); await p.mouse.down(); await p.mouse.move(900, 400, { steps: 6 }); await p.mouse.up();
  ok(await p.evaluate(() => !String(window.getSelection()).includes(document.getElementById('clock').textContent.trim())) && await p.evaluate(() => getComputedStyle(document.getElementById('clock')).userSelect) === 'none', 'dragging the mouse does not select the time');
  await p.mouse.click(5, 5);

  // open from the drawer
  const look0 = await p.evaluate(() => Object.fromEntries(['clock', 'greetBlock', 'focus'].map((id) => { const el = document.getElementById(id); let r = el.getBoundingClientRect(); if (id !== 'focus') { const rs = []; const w = document.createTreeWalker(el, 4); for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue.trim()) { const g = document.createRange(); g.selectNodeContents(n); rs.push(...g.getClientRects()); } const l = Math.min(...rs.map((x) => x.left)), rt = Math.max(...rs.map((x) => x.right)); const tp = Math.min(...rs.map((x) => x.top)), bt = Math.max(...rs.map((x) => x.bottom)); r = { left: l, width: rt - l, top: tp, height: bt - tp }; } return [id, [r.left + r.width / 2, r.top + r.height / 2, r.width]]; })));
  await p.click('#customize'); await p.waitForTimeout(200);
  await p.click('#drawerBody .btn-primary'); await p.waitForTimeout(900);
  const look1 = await p.evaluate(() => Object.fromEntries(['clock', 'greetBlock', 'focus'].map((id) => { const el = document.getElementById(id); let r = el.getBoundingClientRect(); if (id !== 'focus') { const rs = []; const w = document.createTreeWalker(el, 4); for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue.trim()) { const g = document.createRange(); g.selectNodeContents(n); rs.push(...g.getClientRects()); } const l = Math.min(...rs.map((x) => x.left)), rt = Math.max(...rs.map((x) => x.right)); const tp = Math.min(...rs.map((x) => x.top)), bt = Math.max(...rs.map((x) => x.bottom)); r = { left: l, width: rt - l, top: tp, height: bt - tp }; } return [id, [r.left + r.width / 2, r.top + r.height / 2, r.width]]; })));
  ok(Object.keys(look0).every((id) => Math.abs(look0[id][0] - look1[id][0]) < 14 && Math.abs(look0[id][1] - look1[id][1]) < 14 && Math.abs(look0[id][2] - look1[id][2]) < look0[id][2] * 0.08), 'the editor opens on the positions and sizes the page already had (the words, not their container): ' + JSON.stringify([look0, look1]));
  ok(await p.locator('.cv-frame:not([hidden])').count() === 6, 'six blocks on the screen (clock, greeting, quote, focus, today, tasks): ' + await p.locator('.cv-frame:not([hidden])').count());
  ok(await p.evaluate(() => document.body.dataset.layout) === 'canvas', 'free layout on while editing');
  let c = await canvas();
  ok(c.on && Object.keys(c.items).length === 6, 'the layout is saved: ' + Object.keys(c.items));

  // the type designer opens for the clock; a face, a fill and seconds are applied at once and saved
  await p.waitForSelector('.cv-panel .ty-tile', { timeout: 3000 });
  const typeOf = () => p.evaluate(async () => (await (await import('/src/shared/storage.js')).getSettings()).newtab.type);
  ok(await p.locator('.cv-panel .ty-tile').count() >= 16, 'the clock panel lists the faces');
  await p.locator('.cv-panel .ty-tile', { hasText: 'Unbounded' }).click(); await p.waitForTimeout(400);
  ok(/Unbounded/.test(await p.evaluate(() => getComputedStyle(document.getElementById('clock')).fontFamily)), 'the chosen face is on the clock');
  await p.locator('.cv-panel .segmented button', { hasText: 'Gradient' }).click(); await p.waitForTimeout(200);
  ok(await p.evaluate(() => getComputedStyle(document.getElementById('clock')).backgroundImage.includes('linear-gradient')), 'a gradient fill is applied');
  await p.locator('.cv-panel label.ty-row', { hasText: 'Show seconds' }).locator('.switch').click(); await p.waitForTimeout(1500);
  ok((await p.evaluate(() => document.getElementById('clock').textContent)).split(':').length === 3, 'seconds are shown');
  await p.waitForTimeout(500);
  const ty = await typeOf();
  ok(ty.clock && ty.clock.font === 'unbounded' && ty.clock.fill === 'gradient' && ty.clock.seconds === true, 'the type design is saved: ' + JSON.stringify(ty));
  await p.focus('.cv-frame[data-block="greeting"]'); await p.waitForTimeout(600);
  ok(await p.locator('.cv-panel .ty-tile').count() >= 5 && await p.locator('.cv-panel .segmented').count() === 0, 'the greeting has its own, shorter panel');
  await p.focus('.cv-frame[data-block="clock"]'); await p.waitForTimeout(600);
  await p.click('.cv-panel .ty-head button:has-text("Reset")'); await p.waitForTimeout(500);
  ok(!/Unbounded/.test(await p.evaluate(() => getComputedStyle(document.getElementById('clock')).fontFamily)), 'reset gives the look its typography back');

  // the editor itself passes axe (frames, toolbar, hint, panel)
  await p.evaluate(AXE);
  const axe = await p.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })).violations.map((v) => v.id + ': ' + v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')));
  ok(!axe.length, 'axe in the editor: ' + axe.join(' ; '));

  // drag the clock
  const before = c.items.clock;
  const cb = await box('.cv-frame[data-block="clock"]');
  await p.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2); await p.mouse.down();
  await p.mouse.move(cb.x + cb.width / 2 - 260, cb.y + cb.height / 2 + 90, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(300);
  c = await canvas();
  ok(c.items.clock.x < before.x - 10 && c.items.clock.y > before.y + 5, 'dragging moves the clock: ' + JSON.stringify([before, c.items.clock]));

  // the time can be stretched from any side or corner: the opposite edge stays, the proportions are free
  {
    const r0 = await box('.cv-frame[data-block="clock"]'); const el0 = await box('#clock');
    const hb = await box('.cv-frame[data-block="clock"] .cv-handle[data-h="e"]');
    await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await p.mouse.down();
    await p.mouse.move(hb.x + hb.width / 2 + 120, hb.y + hb.height / 2, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(300);
    const it = (await canvas()).items.clock, el1 = await box('#clock');
    ok(it.sx && it.sx > it.s + 0.05 && Math.abs(el1.y - el0.y) < 3 && Math.abs(el1.height - el0.height) < 3, 'the right side stretches the time wider only: ' + JSON.stringify(it));
    ok(Math.abs(el1.x - el0.x) < 3 && el1.width > el0.width + 60, 'the left edge stays where it was');
    const hs = await box('.cv-frame[data-block="clock"] .cv-handle[data-h="s"]');
    await p.mouse.move(hs.x + hs.width / 2, hs.y + hs.height / 2); await p.mouse.down();
    await p.mouse.move(hs.x + hs.width / 2, hs.y + hs.height / 2 + 60, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(300);
    const it2 = (await canvas()).items.clock;
    ok(it2.s > it.s + 0.05 && Math.abs(it2.sx - it.sx) < 0.01, 'the bottom side stretches it taller only: ' + JSON.stringify(it2));
    await p.keyboard.press('Alt+ArrowRight'); await p.waitForTimeout(250);
    ok((await canvas()).items.clock.sx > it2.sx, 'Alt+arrow stretches from the keyboard');
    await p.click('.cv-panel button:has-text("Reset stretch")'); await p.waitForTimeout(300);
    ok((await canvas()).items.clock.sx === undefined, 'Reset stretch gives the proportions back');
    await p.click('.cv-bar button[aria-label="Undo"]'); await p.waitForTimeout(200);
    ok((await canvas()).items.clock.sx !== undefined, 'the reset can be undone');
    await p.click('.cv-bar button[aria-label="Undo"]'); await p.click('.cv-bar button[aria-label="Undo"]'); await p.click('.cv-bar button[aria-label="Undo"]'); await p.waitForTimeout(200);
  }

  // resize the focus card with its corner (nothing overlaps its corner in the seed layout)
  await p.focus('.cv-frame[data-block="focus"]'); await p.waitForTimeout(200);
  const fw = (await canvas()).items.focus.w;
  const hb = await box('.cv-frame[data-block="focus"] .cv-handle');
  await p.mouse.move(hb.x + 9, hb.y + 9); await p.mouse.down(); await p.mouse.move(hb.x + 9 + 70, hb.y + 9 + 10, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(300);
  ok((await canvas()).items.focus.w > fw + 20, 'the corner resizes the focus card');

  // keyboard: arrows move, + resizes, Delete removes
  await p.focus('.cv-frame[data-block="tasks"]');
  const t0 = (await canvas()).items.tasks;
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('Shift+ArrowUp'); await p.waitForTimeout(250);
  const t1 = (await canvas()).items.tasks;
  ok(Math.abs((t0.x - t1.x) - 1) < 0.05 && Math.abs((t0.y - t1.y) - 5) < 0.05, 'arrows move by 1% and Shift+arrow by 5%: ' + JSON.stringify([t0, t1]));
  await p.keyboard.press('+'); await p.waitForTimeout(200);
  ok((await canvas()).items.tasks.w === t1.w + 20, 'plus widens the card by a step');
  await p.keyboard.press('Delete'); await p.waitForTimeout(300);
  ok(!(await canvas()).items.tasks, 'Delete takes the block off the screen');
  ok(await p.evaluate(() => getComputedStyle(document.getElementById('mod-tasks')).display) === 'none', 'the removed block is not shown');

  // add it back from the tray
  await p.click('.cv-bar .dd'); await p.waitForTimeout(200);
  await p.locator('.dd-opt', { hasText: 'Tasks' }).click(); await p.waitForTimeout(300);
  ok(!!(await canvas()).items.tasks, 'a block can be added back from the tray');

  // undo twice goes back through the add and the delete
  await p.click('.cv-bar button[aria-label="Undo"]'); await p.waitForTimeout(150);
  ok(!(await canvas()).items.tasks, 'undo of the add');
  await p.click('.cv-bar button[aria-label="Undo"]'); await p.waitForTimeout(150);
  ok(!!(await canvas()).items.tasks, 'undo of the delete brings the block back');

  // the widget gallery: add a countdown, set it up, move it, then delete it
  const widgets = () => p.evaluate(async () => (await (await import('/src/shared/storage.js')).getSettings()).newtab.widgets);
  await p.click('.cv-bar button:has-text("Add widget")'); await p.waitForTimeout(500);
  ok(await p.locator('.cv-panel .wg-tile').count() === 14, 'the gallery lists 14 widgets: ' + await p.locator('.cv-panel .wg-tile').count());
  await p.locator('.cv-panel .wg-tile', { hasText: 'Countdown' }).click(); await p.waitForTimeout(900);
  let ws = await widgets();
  ok(ws.length === 1 && ws[0].kind === 'countdown', 'adding a widget saves it: ' + JSON.stringify(ws));
  const wid = ws[0] && ws[0].id;
  ok(!!(await canvas()).items[wid], 'the new widget has a place on Home');
  ok(await p.locator(`.cv-frame[data-block="${wid}"]`).count() === 1, 'the new widget has a frame');
  await p.waitForSelector('.cv-panel input[type="date"]', { timeout: 3000 }).catch(() => {});
  ok(await p.locator('.cv-panel input[type="date"]').count() === 1, 'the widget settings panel opens for the new widget');
  await p.fill('.cv-panel input[maxlength="60"]', 'Launch'); await p.waitForTimeout(700);
  ok(/Launch/i.test(await p.evaluate((id) => document.getElementById('wgt-' + id).textContent, wid)), 'the title is shown on the widget at once');
  ok((await widgets())[0].cfg.title === 'Launch', 'the widget setting is saved');
  const wb = await box(`.cv-frame[data-block="${wid}"]`);
  await p.mouse.move(wb.x + wb.width / 2, wb.y + wb.height / 2); await p.mouse.down(); await p.mouse.move(wb.x + wb.width / 2 + 120, wb.y + wb.height / 2 - 150, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(300);
  ok((await canvas()).items[wid].x > 52, 'a widget can be dragged like any block');
  await p.click('.cv-panel .wg-del'); await p.waitForTimeout(600);
  ok((await widgets()).length === 0 && !(await canvas()).items[wid] && await p.locator('.wgt').count() === 0, 'a widget can be deleted for good');
  // one more stays for the reload check below
  await p.click('.cv-bar button:has-text("Add widget")'); await p.waitForTimeout(400);
  await p.locator('.cv-panel .wg-tile', { hasText: 'Sticky note' }).click(); await p.waitForTimeout(900);

  // Escape finishes; the arrangement survives a reload
  const saved = JSON.stringify((await canvas()).items);
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  ok(await p.locator('.cv-layer').count() === 0, 'Escape closes the editor');
  await p.reload(); await p.waitForTimeout(1200);
  ok(await p.evaluate(() => document.body.dataset.layout) === 'canvas', 'free layout after a reload');
  ok(JSON.stringify((await canvas()).items) === saved, 'the arrangement is kept');
  ok(await p.locator('.wgt-sticky').count() === 1 && await p.evaluate(() => { const r = document.querySelector('.wgt-sticky').getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1; }), 'the widget is back, on screen, after a reload');
  const onScreen = await p.evaluate(() => ['clock', 'greetBlock', 'focus', 'mod-today', 'mod-tasks'].every((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; }));
  ok(onScreen, 'every block is inside the window');

  // a narrow window uses the stacked layout, a wide one the arrangement again
  await p.setViewportSize({ width: 900, height: 800 }); await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.body.dataset.layout) !== 'canvas', 'narrow window: stacked layout');
  await p.setViewportSize({ width: 1700, height: 900 }); await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.body.dataset.layout) === 'canvas', 'wide window: arrangement back');

  // reset, then back to the look's own layout
  await p.click('#customize'); await p.waitForTimeout(200); await p.click('#drawerBody .btn-primary'); await p.waitForTimeout(700);
  await more('Reset the arrangement'); await p.waitForTimeout(300);
  const seeded = (await canvas()).items;
  ok(seeded.clock.x === 50 && seeded.focus.w === 640, 'reset restores the seed layout');
  // the background and the look are set right in the editor, and the panel stays while blocks are moved
  await p.click('.cv-bar button:has-text("Background")'); await p.waitForTimeout(500);
  ok(await p.locator('.cv-panel .bg-tile').count() >= 18, 'the Background panel lists the scenes');
  await p.locator('.cv-panel .bg-tile', { hasText: 'Aurora' }).click(); await p.waitForTimeout(700);
  ok(await p.evaluate(async () => (await (await import('/src/shared/storage.js')).getSettings()).newtab.background) === 'aurora' && await p.evaluate(() => document.body.dataset.bg) === 'aurora', 'a scene is picked inside the editor');
  await p.focus('.cv-frame[data-block="focus"]'); await p.waitForTimeout(300);
  ok(await p.locator('.cv-panel .bg-tile').count() >= 18, 'the Background panel stays while a block is selected');
  await p.click('.cv-bar button:has-text("Look")'); await p.waitForTimeout(600);
  ok(await p.locator('.cv-panel .look-card, .cv-panel [data-look]').count() >= 3, 'the Look panel lists the looks');
  await more('Use the look'); await p.waitForTimeout(500);
  ok(!(await canvas()).on && await p.evaluate(() => document.body.dataset.layout) === 'center', 'the look layout can be switched back on');
  ok(await p.evaluate(() => document.querySelectorAll('.nt-c').length === 3 && !document.querySelector('.nt-brand')), 'three corner buttons, no logo');

  console.log(bad.length ? 'FAIL\n' + bad.join('\n') : 'editor: all checks passed');
  await app.close();
  process.exit(bad.length ? 1 : 0);
})();
