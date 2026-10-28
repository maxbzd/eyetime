// Widget stacks on Home: the card that is on top follows the hour, the dots switch it by hand, the editor panel reorders and adds cards.
//   node scripts-dev/e2e/stack.cjs
const { launch } = require('./lib.cjs');

(async () => {
  const app = await launch({ viewport: { width: 1440, height: 900 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [];
  const ok = (cond, msg) => { if (!cond) bad.push(msg); };
  const sp = await app.ctx.newPage(); await sp.goto(ext('src/options/options.html')); await sp.waitForTimeout(600);
  const hour = new Date().getHours();
  const part = hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'day' : hour >= 18 && hour < 23 ? 'evening' : 'night';
  const other = part === 'morning' ? 'evening' : 'morning';
  await sp.evaluate(async ({ part, other }) => {
    const st = await import('/src/shared/storage.js');
    await st.updateSettings((s) => {
      s.onboarded = true; s.language = 'en';
      s.newtab.widgets = [{ id: 'wstk1', kind: 'stack', cfg: { items: [{ kind: 'recap', when: other, cfg: {} }, { kind: 'sticky', when: part, cfg: { text: 'on top now' } }, { kind: 'plan', when: 'any', cfg: {} }], pick: 'auto', i: 0 } }];
    });
    await st.setRaw({ gsDismissed: true });
  }, { part, other });
  const p = await app.ctx.newPage();
  p.on('pageerror', (e) => bad.push('pageerror: ' + e)); p.on('console', (m) => { if (m.type() === 'error') bad.push('console: ' + m.text()); });
  await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(1500);
  const kindOnTop = () => p.evaluate(() => { const b = document.querySelector('#wgt-wstk1 .ws-body > *'); return b ? b.className : null; });
  ok(/wgt-sticky/.test(await kindOnTop()), 'in auto mode the card for this time of day is on top: ' + await kindOnTop());
  ok(/on top now/.test(await p.locator('#wgt-wstk1 textarea').inputValue()), 'the card keeps its own content');
  ok(await p.locator('#wgt-wstk1 .ws-dot').count() === 3, 'one dot per card');
  ok(await p.locator('#wgt-wstk1 .ws-dot.on').count() === 1, 'one dot is lit');

  // a dot picks a card by hand and the choice sticks across a reload
  await p.locator('#wgt-wstk1 .ws-dot').nth(2).click(); await p.waitForTimeout(700);
  ok(/wgt-plan/.test(await kindOnTop()), 'a dot shows its card: ' + await kindOnTop());
  const saved = await sp.evaluate(async () => (await (await import('/src/shared/storage.js')).getSettings()).newtab.widgets[0].cfg);
  ok(saved.pick === 'manual' && saved.i === 2, 'the choice is saved: ' + JSON.stringify({ pick: saved.pick, i: saved.i }));
  await p.reload(); await p.waitForTimeout(1200);
  ok(/wgt-plan/.test(await kindOnTop()), 'the choice survives a reload');
  ok(/Plan/i.test(await p.locator('#wgt-wstk1').textContent()), 'the plan card is shown');

  // a hand-made damaged stack is repaired, not crashed
  await sp.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.newtab.widgets = [{ id: 'wstk1', kind: 'stack', cfg: { items: [{ kind: 'stack', when: 'x' }, { kind: 'nope' }, null, { kind: 'recap', when: 'zzz', cfg: 5 }], pick: 7, i: 99 } }]; }); });
  await p.waitForTimeout(1200);
  ok(/wgt-recap/.test(await kindOnTop()) && await p.locator('#wgt-wstk1 .ws-dot').count() === 1 && await p.locator('#wgt-wstk1 .ws-dots').isHidden(), 'a damaged stack keeps only its valid cards: ' + await kindOnTop());

  // the editor: add a stack from the gallery, then reorder, change the hour, add a card, remove
  await sp.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.newtab.widgets = []; }); });
  await p.reload(); await p.waitForTimeout(1200);
  await p.click('#customize'); await p.waitForTimeout(250); await p.click('#drawerBody .btn-primary'); await p.waitForTimeout(900);
  await p.click('.cv-bar button:has-text("Widgets")'); await p.waitForTimeout(500);
  await p.locator('.cv-panel .wg-tile', { hasText: 'Smart stack' }).click(); await p.waitForTimeout(900);
  const sid = await sp.evaluate(async () => (await (await import('/src/shared/storage.js')).getSettings()).newtab.widgets[0].id);
  ok(await p.locator('.cv-panel .ws-member').count() === 3, 'a new stack starts with the plan, the main focus and the recap');
  ok(await p.locator('.cv-panel .ws-member').nth(0).textContent().then((x) => /Plan of the day/.test(x)), 'the plan comes first');
  await p.locator('.cv-panel .ws-member').nth(1).locator('button[aria-label^="Move up"]').click(); await p.waitForTimeout(500);
  let cfg = await sp.evaluate(async () => (await (await import('/src/shared/storage.js')).getSettings()).newtab.widgets[0].cfg);
  ok(cfg.items[0].kind === 'mainfocus' && cfg.items[1].kind === 'plan', 'cards can be reordered: ' + cfg.items.map((x) => x.kind));
  await p.locator('.cv-panel .ws-member').first().locator('button[aria-label^="Remove"]').click(); await p.waitForTimeout(500);
  cfg = await sp.evaluate(async () => (await (await import('/src/shared/storage.js')).getSettings()).newtab.widgets[0].cfg);
  ok(cfg.items.length === 2, 'a card can be removed');
  await p.locator('.cv-panel .dd').last().click(); await p.waitForTimeout(250);
  await p.locator('.dd-opt', { hasText: 'Sticky note' }).click(); await p.waitForTimeout(600);
  cfg = await sp.evaluate(async () => (await (await import('/src/shared/storage.js')).getSettings()).newtab.widgets[0].cfg);
  ok(cfg.items.length === 3 && cfg.items[2].kind === 'sticky', 'a card can be added: ' + cfg.items.map((x) => x.kind));
  ok(!!sid && await p.locator('#wgt-' + sid + ' .ws-dot').count() === 3, 'the dots follow the panel');

  console.log(bad.length ? 'FAIL\n' + bad.join('\n') : 'stack: all checks passed');
  await app.close();
  process.exit(bad.length ? 1 : 0);
})();
