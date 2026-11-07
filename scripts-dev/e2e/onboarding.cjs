// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The first minutes end to end (docs/ONBOARDING.md): three light screens, a live preview of the pause, the first session started on the real new tab, the coach while it runs, the dialog
// when it ends (real number of held-back pages, look and settings applied live), a session stopped early celebrated with nothing, skipping, keyboard only, and no request to anyone.
//   node scripts-dev/e2e/onboarding.cjs   (SHOTS=/dir saves screenshots)
const path = require('path');
const { launch } = require('./lib.cjs');

(async () => {
  const app = await launch({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: process.env.SHOTS ? 2 : 1 });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [], ok = (c, m) => { if (!c) bad.push(m); };
  const shot = async (page, name) => { if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, name + '.png') }); };
  const outside = [];
  app.ctx.on('request', (r) => { const u = r.url(); if (/^https?:/.test(u) && !/^https?:\/\/(127\.0\.0\.1|localhost)/.test(u)) outside.push(u); });
  const o = await app.ctx.newPage();
  o.on('pageerror', (e) => bad.push('pageerror: ' + e)); o.on('console', (m) => { if (m.type() === 'error') bad.push('console: ' + m.text()); });
  await o.goto(ext('src/options/options.html')); await o.waitForTimeout(600);
  const get = (k) => o.evaluate(async (k) => (await chrome.storage.local.get(k))[k], k);
  const fresh = () => o.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.onboarded = false; s.language = 'en'; }); await chrome.storage.local.remove(['obFirst', 'focus']); const k = new Date(); const key = 'd:' + k.getFullYear() + '-' + String(k.getMonth() + 1).padStart(2, '0') + '-' + String(k.getDate()).padStart(2, '0'); const dd = (await chrome.storage.local.get(key))[key]; if (dd) { dd.ss = []; await chrome.storage.local.set({ [key]: dd }); } await st.setRaw({ gsDismissed: true }); });
  await fresh();

  // 1. three screens, no more
  const ob = await app.ctx.newPage(); ob.on('pageerror', (e) => bad.push('pageerror: ' + e)); ob.on('console', (m) => { if (m.type() === 'error') bad.push('console: ' + m.text()); });
  await ob.goto(ext('src/onboarding/onboarding.html')); await ob.waitForSelector('.step-hello'); await ob.waitForTimeout(500);
  ok(/Step 1 of 3/i.test(await ob.locator('#stepLabel').innerText()), 'the page says where it is: step 1 of 3');
  const hello = await ob.locator('#card').innerText();
  ok(/About a minute/.test(hello) && /new tab/.test(hello) && /Settings/.test(hello), 'the first screen promises how long it takes and says that EyeTime is the new tab, and where the way back is');
  ok(await ob.locator('#skip').isVisible(), '"Skip setup" is in plain sight');
  await shot(ob, 'ob-1-hello');
  await ob.getByRole('button', { name: /Get started/ }).click(); await ob.waitForSelector('.chips .chip');
  ok(await ob.locator('.chips .chip[aria-pressed="true"]').count() === 0, 'nothing is pre-selected');
  ok(/pick|choose|kind/i.test(await ob.locator('.prev-none').innerText()), 'before a choice the slot says what choosing will show');
  await shot(ob, 'ob-2-empty');
  await ob.getByRole('button', { name: 'Forums & feeds' }).click(); await ob.waitForSelector('.prev .prev-card');
  const pv = await ob.locator('.prev').innerText();
  ok(/reddit\.com/.test(pv) && /Take a breath/.test(pv) && /Back to work/.test(pv), 'a live preview of the pause, in the words of the real page, for the first site chosen: ' + pv.slice(0, 80));
  ok(/simply closed/.test(await ob.locator('.prev-note').innerText()), 'and it says that during focus the site is simply closed');
  await ob.locator('input[placeholder*="example.com"]').fill('news.ycombinator.com'); await ob.keyboard.press('Enter');
  ok(/news\.ycombinator\.com/.test(await ob.locator('.prev').innerText()), 'a site of their own comes first in the preview');
  await shot(ob, 'ob-2-chosen');
  await ob.getByRole('button', { name: 'Next' }).click(); await ob.waitForSelector('#goalIn');
  ok(/Step 3 of 3/i.test(await ob.locator('#stepLabel').innerText()), 'step 3 of 3');
  ok(await ob.locator('#card .segmented button[aria-pressed="true"]').innerText() === '5m', 'the first session is five minutes by default');
  ok(await ob.locator('#skip').isHidden(), 'on the last screen there is no skip (the second button is the quiet way out)');
  await ob.getByRole('button', { name: 'Write', exact: true }).click();
  ok(await ob.locator('#goalIn').inputValue() === 'Write', 'a suggestion fills the field');
  await ob.locator('#goalIn').fill('Write the first paragraph');
  await shot(ob, 'ob-3-first');
  await ob.keyboard.press('Enter'); await ob.waitForTimeout(1800); // Enter in the field starts it
  const st = await get('settings'), focus = await get('focus'), first = await get('obFirst');
  ok(st.onboarded && st.blocking.presets.forums === true && st.blocking.presets.social === false && st.blocking.custom.includes('news.ycombinator.com'), 'exactly the choice is saved: ' + JSON.stringify(st.blocking.presets));
  ok(focus && focus.minutes === 5 && focus.goal === 'Write the first paragraph', 'the first session runs on the new tab with its goal: ' + JSON.stringify(focus));
  ok(first && first.stage === 'run' && first.host && first.sites >= 1, 'the first session is remembered: ' + JSON.stringify(first));
  ok(ob.url().includes('newtab.html'), 'the page after the third screen is the real new tab');
  await ob.waitForTimeout(1200);

  // 2. the coach while it runs
  const coach = ob.locator('#fsCoach');
  ok(await coach.count() === 1 && /You’re in focus/.test(await coach.innerText()) && /Closed until the timer ends/.test(await coach.innerText()), 'a small card on the new tab says what is closed');
  const closedN = Number((/(\d+)/.exec(await coach.innerText()) || [])[1]);
  ok(closedN > 5, 'the card counts the sites that are closed, not the kinds chosen (two kinds and one of their own would say 3): ' + closedN);
  await shot(ob, 'ob-4-coach');
  ok(outside.length === 0, 'until now no request left this computer: ' + [...new Set(outside)].join(' '));
  const [site] = await Promise.all([app.ctx.waitForEvent('page'), coach.getByRole('link', { name: /closed site/ }).click()]);
  await site.waitForTimeout(1500);
  ok(/blocked\.html/.test(site.url()) || /Fake site/.test(await site.title().catch(() => '')) === false, 'opening a chosen site during the session shows the closed page: ' + site.url().slice(0, 70));
  await site.close();
  ok(await ob.locator('#fsCoach').count() === 0 && (await get('obFirst')).coachSeen === true, 'the coach goes once it has been used, and does not come back');

  // 3. the session ends WITH THE TAB OPEN: the worker clears `focus` first and writes the finished session a moment later (the audit of 3.9.0 found the dialog lost in exactly this order)
  await o.evaluate(async () => { const { focus } = await chrome.storage.local.get('focus'); await chrome.storage.local.set({ focus: { ...focus, endsAt: Date.now() + 1500 } }); }); // the end is near; the page notes it while it runs
  await ob.waitForTimeout(900);
  await o.evaluate(async () => { await new Promise((r) => setTimeout(r, 1000)); await chrome.storage.local.remove('focus'); }); // the session ends: nothing is running, and the record is not there yet
  await ob.waitForTimeout(3000);
  ok(await ob.locator('#fsDone').count() === 0 && (await get('obFirst')).stage === 'run', 'the matter is not closed in the moment before the finished session is written: ' + JSON.stringify((await get('obFirst')).stage));
  await o.evaluate(async () => {
    const { obFirst } = await chrome.storage.local.get('obFirst');
    const k = new Date(); const key = 'd:' + k.getFullYear() + '-' + String(k.getMonth() + 1).padStart(2, '0') + '-' + String(k.getDate()).padStart(2, '0');
    const d = (await chrome.storage.local.get(key))[key] || {}; d.ss = [...(d.ss || []), { id: 'first', t: obFirst.at + 1000, m: 5, p: 5, g: 'x', k: 'focus', c: true, r: 3 }];
    await chrome.storage.local.set({ [key]: d });
  });
  await ob.waitForSelector('#fsDone[open]', { timeout: 8000 });
  const dlg = await ob.locator('#fsDone').innerText();
  ok(/First focus done/.test(dlg) && /5m without distractions/.test(dlg), 'the dialog says the first focus is done, with the real length: ' + dlg.slice(0, 90));
  if (process.env.DEBUGOB) console.log('DLG', JSON.stringify(dlg));
  ok(/make it yours/i.test(dlg) && /Daily focus goal/.test(dlg) && /Eye-break/i.test(dlg) && /Work hours/.test(dlg), 'and then asks what is better asked now');
  await shot(ob, 'ob-5-done');
  await ob.locator('#fsDone .look-card', { hasText: 'Midnight' }).click(); await ob.waitForTimeout(500);
  ok((await get('settings')).appearance.look === 'midnight', 'a look chosen in the dialog is applied live and saved');
  await ob.locator('#fsDone .segmented').nth(1).getByRole('button', { name: '1h' }).click(); await ob.waitForTimeout(300);
  ok((await get('settings')).focus.dailyGoal === 60, 'the daily goal is saved');
  await ob.keyboard.press('Escape'); await ob.waitForTimeout(500);
  ok(await ob.locator('#fsDone').count() === 0 && (await get('obFirst')).stage === 'closed', 'Escape closes it, once and for all');
  await ob.reload(); await ob.waitForTimeout(1800); ok(await ob.locator('#fsDone').count() === 0, 'it does not come back');

  // 4. a session stopped early gets no celebration
  await fresh(); const ob2 = await app.ctx.newPage(); await ob2.goto(ext('src/onboarding/onboarding.html')); await ob2.waitForSelector('.step-hello');
  await ob2.getByRole('button', { name: /Get started/ }).click(); await ob2.getByRole('button', { name: 'Social networks' }).click();
  await ob2.getByRole('button', { name: 'Next' }).click(); await ob2.waitForSelector('#goalIn'); await ob2.locator('.go').click(); await ob2.waitForTimeout(1500);
  await o.evaluate(() => chrome.runtime.sendMessage({ type: 'focus:stop' })); await ob2.waitForTimeout(800);
  await ob2.evaluate(async () => { const { obFirst } = await chrome.storage.local.get('obFirst'); obFirst.at -= 120_000; await chrome.storage.local.set({ obFirst }); });
  await ob2.waitForTimeout(1500);
  if (process.env.DEBUGOB) console.log('OBF', JSON.stringify(await get('obFirst')), Date.now());
  ok(await ob2.locator('#fsDone').count() === 0 && (await get('obFirst')).stage === 'closed', 'a first session that was stopped early closes the matter without a word');

  // 5. skipping, and "I'll choose later", and the second way out of the last screen
  await fresh(); const ob3 = await app.ctx.newPage(); await ob3.goto(ext('src/onboarding/onboarding.html')); await ob3.waitForSelector('.step-hello');
  await ob3.locator('#skip').click(); await ob3.waitForTimeout(1200);
  ok((await get('settings')).onboarded === true && !(await get('focus')) && !(await get('obFirst')), 'skipping at once: set up, nothing started, nothing to celebrate');
  await fresh(); const ob4 = await app.ctx.newPage(); await ob4.goto(ext('src/onboarding/onboarding.html')); await ob4.waitForSelector('.step-hello');
  await ob4.getByRole('button', { name: /Get started/ }).click(); await ob4.getByRole('button', { name: "I’ll choose later" }).click(); await ob4.waitForSelector('#goalIn');
  await ob4.getByRole('button', { name: 'Look around first' }).click(); await ob4.waitForTimeout(1200);
  const st4 = await get('settings'); ok(st4.onboarded && Object.values(st4.blocking.presets).every((v) => v === false) && !(await get('focus')), '"I\'ll choose later" and "Look around first": no sites, no session');

  // 6. keyboard only, from the first screen to a running session
  await fresh(); const ob5 = await app.ctx.newPage(); await ob5.goto(ext('src/onboarding/onboarding.html')); await ob5.waitForSelector('.step-hello');
  for (let i = 0; i < 6 && !(await ob5.locator('#goalIn').count()); i++) {
    const label = (await ob5.locator('#card h1').innerText()).trim();
    if (/Focus better/.test(label)) { await ob5.locator('.nav-hello .btn-primary').focus(); await ob5.keyboard.press('Enter'); } else { await ob5.getByRole('button', { name: 'Social networks' }).focus(); await ob5.keyboard.press('Space'); await ob5.locator('#card .btn-primary').focus(); await ob5.keyboard.press('Enter'); }
    await ob5.waitForTimeout(400);
  }
  ok(await ob5.locator('#goalIn').count() === 1, 'every screen can be done with the keyboard alone');

  await app.close();
  if (bad.length) { console.log('FAIL\n' + [...new Set(bad)].join('\n')); process.exit(1); }
  console.log('onboarding: all checks passed');
})();
