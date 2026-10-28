// The editor's helpers: the first-run guide, the strip for the selected block (exact numbers, alignment, layers, duplicate), shortcuts and the help panel.
//   node scripts-dev/e2e/inspector.cjs
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
  await sp.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.onboarded = true; s.language = 'en'; }); await st.setRaw({ gsDismissed: true }); });
  const p = await app.ctx.newPage();
  p.on('pageerror', (e) => bad.push('pageerror: ' + e)); p.on('console', (m) => { if (m.type() === 'error') bad.push('console: ' + m.text()); });
  const items = () => sp.evaluate(async () => (await (await import('/src/shared/storage.js')).getSettings()).newtab.canvas.items);
  const val = (label) => p.locator(`.cv-insp input[aria-label="${label}"]`);
  await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(1200);
  await p.click('#customize'); await p.waitForTimeout(200); await p.click('#drawerBody .btn-primary'); await p.waitForTimeout(1000);

  // the first-run guide shows once
  ok(await p.locator('.cv-coach').count() === 1 && await p.locator('.cv-hint').count() === 0, 'the first time, the guide is shown');
  const gb = await p.locator('.cv-coach').boundingBox(), cb = await p.locator('.cv-frame[data-block="clock"]').boundingBox();
  ok(gb.x + gb.width < cb.x || gb.y + gb.height < cb.y || gb.x > cb.x + cb.width, 'the guide does not sit on the clock');
  await p.click('.cv-coach .btn'); await p.waitForTimeout(200);
  ok(await p.locator('.cv-coach').count() === 0, 'it can be dismissed');

  // selecting a block shows the strip with its numbers
  await p.locator('.cv-frame[data-block="tasks"]').focus(); await p.waitForTimeout(400);
  ok(await p.locator('.cv-insp').count() === 1, 'a selected block shows the inspector');
  const t0 = (await items()).tasks;
  ok(Math.abs(Number(await val('X').inputValue()) - t0.x) < 0.6 && Math.abs(Number(await val('Y').inputValue()) - t0.y) < 0.6 && Number(await val('Width').inputValue()) === t0.w, 'it shows the real position and width');
  await p.evaluate(AXE);
  const axe = await p.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })).violations.map((v) => v.id + ': ' + v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')));
  ok(!axe.length, 'axe with the inspector open: ' + axe.join(' ; '));

  // exact numbers move and resize the block, and can be undone
  await val('X').fill('40'); await val('X').blur(); await p.waitForTimeout(500);
  let it = (await items()).tasks;
  ok(Math.abs(it.x - 40) < 0.5 || it.x > 38, 'typing X moves the block: ' + JSON.stringify(it));
  await val('Width').fill('600'); await val('Width').blur(); await p.waitForTimeout(500);
  ok((await items()).tasks.w === 600, 'typing the width resizes it');
  await val('Width').fill('99999'); await val('Width').blur(); await p.waitForTimeout(500);
  ok((await items()).tasks.w <= 900, 'an out-of-range number is clamped');
  await p.click('.cv-bar button[aria-label="Undo"]'); await p.waitForTimeout(300);
  ok((await items()).tasks.w === 600, 'a typed change is one undo step');

  // alignment: flush left keeps a margin and the block stays on screen
  await p.locator('.cv-frame[data-block="tasks"]').focus();
  await p.click('.cv-insp button[aria-label="Align left"]'); await p.waitForTimeout(400);
  const rl = await p.evaluate(() => document.getElementById('mod-tasks').getBoundingClientRect().left);
  ok(rl >= 8 && rl <= 40, 'align left puts the card at the left edge with a margin: ' + rl);
  await p.click('.cv-insp button[aria-label="Center horizontally"]'); await p.waitForTimeout(300);
  ok((await items()).tasks.x === 50, 'center horizontally');

  // layers: bring the card to the front of the clock, send it back
  await p.click('.cv-insp button[aria-label="Bring to front"]'); await p.waitForTimeout(300);
  let its = await items();
  ok(its.tasks.z > its.clock.z && its.tasks.z > its.focus.z, 'bring to front: ' + JSON.stringify([its.tasks.z, its.clock.z, its.focus.z]));
  ok(Number(await p.evaluate(() => getComputedStyle(document.getElementById('mod-tasks')).zIndex)) >= its.tasks.z, 'the page stacks it accordingly');
  await p.click('.cv-insp button[aria-label="Send to back"]'); await p.waitForTimeout(300);
  its = await items();
  ok(its.tasks.z < its.clock.z && its.tasks.z < its.focus.z, 'send to back');

  // the clock has the same strip, with a percent size
  await p.locator('.cv-frame[data-block="clock"]').focus(); await p.waitForTimeout(400);
  ok(await val('Size').count() === 1 && await val('Width').count() === 0, 'a text block shows a size, not a width');
  await val('Size').fill('150'); await val('Size').blur(); await p.waitForTimeout(400);
  ok((await items()).clock.s === 1.5, 'the size of the clock is typed in percent');
  ok(await p.locator('.cv-insp button[aria-label="Duplicate"]').count() === 0, 'only widgets can be duplicated');

  // keyboard: Ctrl+Z, and "?" opens the shortcut list
  await p.locator('.cv-frame[data-block="clock"]').focus(); await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
  ok((await items()).clock.s !== 1.5, 'Ctrl+Z undoes');
  await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(300);
  ok((await items()).clock.s === 1.5, 'Ctrl+Shift+Z redoes');
  await p.keyboard.press('?'); await p.waitForTimeout(500);
  ok(await p.locator('.cv-panel .cv-krow').count() === 8, 'the shortcut list opens with ?');
  await p.click('.cv-bar button[aria-label="Keyboard shortcuts"]'); await p.waitForTimeout(300);

  // a widget: add, duplicate, delete the copy
  await p.click('.cv-bar button:has-text("Add widget")'); await p.waitForTimeout(400);
  await p.locator('.cv-panel .wg-tile', { hasText: 'Sticky note' }).click(); await p.waitForTimeout(900);
  const sticky = async () => sp.evaluate(async () => (await (await import('/src/shared/storage.js')).getSettings()).newtab.widgets);
  let ws = await sticky(); ok(ws.length === 1, 'one widget added');
  await p.locator('.cv-insp button[aria-label="Duplicate"]').click(); await p.waitForTimeout(1200);
  ws = await sticky(); ok(ws.length === 2 && ws[0].kind === ws[1].kind && ws[0].id !== ws[1].id, 'duplicate makes a second widget: ' + ws.length);
  ok(await p.locator('.cv-frame').count() >= 8, 'and it has its own frame');
  await p.locator('.cv-insp button[aria-label^="Remove"]').click(); await p.waitForTimeout(800);
  ok((await sticky()).length === 1 && await p.locator('.cv-insp').count() === 0, 'removing the copy clears the inspector');

  // clicking the empty page deselects
  await p.locator('.cv-frame[data-block="tasks"]').focus(); await p.waitForTimeout(300);
  await p.mouse.click(30, 450); await p.waitForTimeout(300);
  ok(await p.locator('.cv-insp').count() === 0 && await p.locator('.cv-frame.is-sel').count() === 0, 'a click on the empty page deselects');

  // the "More" menu
  await p.click('.cv-bar .dd:has-text("More")'); await p.waitForTimeout(200);
  ok(await p.locator('.dd-opt').count() === 4, 'More lists reset, the look layout and shortcuts');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);

  // a second time there is no guide, only the short hint
  await p.click('.cv-bar button:has-text("Done")'); await p.waitForTimeout(500);
  await p.click('#customize'); await p.waitForTimeout(200); await p.click('#drawerBody .btn-primary'); await p.waitForTimeout(900);
  ok(await p.locator('.cv-coach').count() === 0 && await p.locator('.cv-hint').count() === 1, 'the next time only the short hint shows');

  console.log(bad.length ? 'FAIL\n' + bad.join('\n') : 'inspector: all checks passed');
  await app.close();
  process.exit(bad.length ? 1 : 0);
})();
