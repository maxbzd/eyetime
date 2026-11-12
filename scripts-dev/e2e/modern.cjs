// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The parts of the platform the pages lean on instead of their own scripts, in a real browser: a click outside a dialog closes it (closedby) and a dialog leaves with a transition,
// a toast is in the top layer and can be pressed over an open modal, Enter that confirms a character in an input method does not submit, a long note grows by itself,
// and Trusted Types are on without a single violation on the pages.
//   node scripts-dev/e2e/modern.cjs
const { launch } = require('./lib.cjs');

(async () => {
  const app = await launch({ viewport: { width: 1280, height: 800 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [];
  const ok = (c, m) => { if (!c) bad.push(m); };
  const violations = [];
  app.ctx.on('page', (pg) => {
    pg.on('console', (m) => { if (/Trusted Type|trusted-types|TrustedScript|require-trusted/i.test(m.text())) violations.push(m.text().slice(0, 140)); });
    pg.on('pageerror', (e) => { bad.push('pageerror: ' + e); });
  });
  const sp = await app.ctx.newPage(); await sp.goto(ext('src/options/options.html')); await sp.waitForTimeout(800);
  await sp.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.onboarded = true; s.language = 'en'; }); await st.setRaw({ gsDismissed: true }); });
  const p = await app.ctx.newPage(); await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(1500);

  // 1. the palette: a click on the backdrop closes it, and it takes its time to leave
  await p.keyboard.press('Control+k'); await p.waitForSelector('dialog.palette[open]'); await p.waitForTimeout(350);
  ok(await p.evaluate(() => document.querySelector('dialog.palette').getAttribute('closedby') === 'any' || !('closedBy' in HTMLDialogElement.prototype)), 'the palette lets a click outside close it');
  await p.mouse.click(8, 8); await p.waitForTimeout(60);
  ok(await p.locator('dialog.palette').count() === 1, 'the closing transition keeps the dialog on the page for a moment');
  await p.waitForSelector('dialog.palette', { state: 'detached', timeout: 3000 }).catch(() => {});
  ok(await p.locator('dialog.palette').count() === 0, 'and then it is gone');

  // 2. a form dialog does not close on a click outside (something may be typed in it), but Esc closes it
  await p.evaluate(async () => { const d = await import('/src/ui/dom.js'); const dlg = d.h('dialog', { class: 'dialog', id: 'formdlg' }, d.h('div', { class: 'dialog-body' }, d.h('input', { id: 'typed', class: 'input' }))); document.body.append(dlg); d.openModal(dlg); dlg.addEventListener('close', () => d.retire(dlg)); });
  await p.waitForTimeout(350); await p.fill('#typed', 'half a thought');
  await p.mouse.click(8, 8); await p.waitForTimeout(500);
  ok(await p.locator('#formdlg[open]').count() === 1 && (await p.inputValue('#typed')) === 'half a thought', 'a click outside does not throw away what is typed in a form dialog');
  await p.keyboard.press('Escape'); await p.waitForSelector('#formdlg', { state: 'detached', timeout: 3000 }).catch(() => {});
  ok(await p.locator('#formdlg').count() === 0, 'Esc closes it');

  // 3. a toast is in the top layer; over an open modal it sits inside it, and its button works
  await p.evaluate(async () => { const d = await import('/src/ui/dom.js'); window.__d = d; d.toast('Saved', { action: 'Undo', onAction: () => { window.__undone = 1; } }); });
  await p.waitForTimeout(450);
  ok(await p.evaluate(() => { const h = document.querySelector('.toasts'); return !!h && h.matches(':popover-open'); }), 'a toast is in the top layer');
  await p.evaluate(async () => { const d = window.__d; const dlg = d.h('dialog', { class: 'dialog', id: 'm2' }, d.h('div', { class: 'dialog-body' }, d.h('h3', { text: 'A modal' }))); document.body.append(dlg); d.openModal(dlg); d.toast('Done', { action: 'Undo again', onAction: () => { window.__undone2 = 1; } }); });
  await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.querySelector('.toasts').parentElement.tagName === 'DIALOG'), 'over a modal the toasts sit inside it');
  await p.locator('.toast button', { hasText: 'Undo again' }).click({ timeout: 3000 }).catch(() => {});
  ok(await p.evaluate(() => window.__undone2 === 1), 'and the button of a toast can be pressed over a modal');
  await p.keyboard.press('Escape'); await p.waitForTimeout(700);

  // 4. Enter that confirms a character in an input method is not an Enter that adds a task
  await p.evaluate(() => { const t = document.querySelector('#tdPanelBtn'); if (t) t.click(); }); await p.waitForTimeout(500);
  const input = p.locator('#mod-tasks input[type="text"], #mod-tasks .add-input, #mod-tasks input').first();
  if (await input.count()) {
    await input.fill('にほんご');
    const before = await p.evaluate(async () => ((await chrome.storage.local.get('tasks')).tasks || []).length);
    await input.evaluate((el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, keyCode: 229, bubbles: true, cancelable: true })));
    await p.waitForTimeout(400);
    ok(await p.evaluate(async () => ((await chrome.storage.local.get('tasks')).tasks || []).length) === before, 'an Enter that confirms a character in an input method adds no task');
    await input.press('Enter'); await p.waitForTimeout(500);
    ok(await p.evaluate(async () => ((await chrome.storage.local.get('tasks')).tasks || []).length) === before + 1, 'a plain Enter adds it');
  } else bad.push('the task field was not found');

  // 5. every page loads without a Trusted Types violation
  for (const u of ['src/popup/popup.html', 'src/insights/insights.html', 'src/options/options.html', 'src/onboarding/onboarding.html', 'src/break/break.html', 'src/blocked/blocked.html?u=http%3A%2F%2Freddit.com%2F&r=friction&a=pause']) { const q = await app.ctx.newPage(); await q.goto(ext(u)).catch(() => {}); await q.waitForTimeout(900); await q.close(); }
  ok(!violations.length, 'Trusted Types violations: ' + violations.join(' | '));

  console.log(bad.length ? 'FAIL modern\n  ' + bad.join('\n  ') : 'PASS modern: click outside and Esc, the dialogs leave with a transition, toasts are in the top layer and work over a modal, an Enter that confirms a character in an input method adds nothing, no Trusted Types violation');
  await app.close(); process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
