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
  const box = async (sel) => (await p.locator(sel).boundingBox());
  await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(1200);
  ok(await p.evaluate(() => document.body.dataset.layout) === 'center', 'starts in the look layout');

  // open from the drawer
  await p.click('#customize'); await p.waitForTimeout(200);
  await p.click('#drawerBody .btn-primary'); await p.waitForTimeout(900);
  ok(await p.locator('.cv-frame:not([hidden])').count() === 5, 'five blocks on the screen: ' + await p.locator('.cv-frame:not([hidden])').count());
  ok(await p.evaluate(() => document.body.dataset.layout) === 'canvas', 'free layout on while editing');
  let c = await canvas();
  ok(c.on && Object.keys(c.items).length === 5, 'the seed layout is saved');

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

  // resize the focus card with its corner (nothing overlaps its corner in the seed layout)
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

  // Escape finishes; the arrangement survives a reload
  const saved = JSON.stringify((await canvas()).items);
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  ok(await p.locator('.cv-layer').count() === 0, 'Escape closes the editor');
  await p.reload(); await p.waitForTimeout(1200);
  ok(await p.evaluate(() => document.body.dataset.layout) === 'canvas', 'free layout after a reload');
  ok(JSON.stringify((await canvas()).items) === saved, 'the arrangement is kept');
  const onScreen = await p.evaluate(() => ['clock', 'greetBlock', 'focus', 'mod-today', 'mod-tasks'].every((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; }));
  ok(onScreen, 'every block is inside the window');

  // a narrow window uses the stacked layout, a wide one the arrangement again
  await p.setViewportSize({ width: 900, height: 800 }); await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.body.dataset.layout) !== 'canvas', 'narrow window: stacked layout');
  await p.setViewportSize({ width: 1700, height: 900 }); await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.body.dataset.layout) === 'canvas', 'wide window: arrangement back');

  // reset, then back to the look's own layout
  await p.click('#customize'); await p.waitForTimeout(200); await p.click('#drawerBody .btn-primary'); await p.waitForTimeout(700);
  await p.click('.cv-bar button:has-text("Reset")'); await p.waitForTimeout(300);
  const seeded = (await canvas()).items;
  ok(seeded.clock.x === 50 && seeded.focus.w === 640, 'reset restores the seed layout');
  await p.click('.cv-bar button:has-text("look")'); await p.waitForTimeout(500);
  ok(!(await canvas()).on && await p.evaluate(() => document.body.dataset.layout) === 'center', 'the look layout can be switched back on');
  ok(Object.keys((await canvas()).items).length === 5, 'the arrangement is remembered for next time');

  console.log(bad.length ? 'FAIL\n' + bad.join('\n') : 'editor: all checks passed');
  await app.close();
  process.exit(bad.length ? 1 : 0);
})();
