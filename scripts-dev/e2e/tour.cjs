// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The guided set-up and the quiet tips (docs/ONBOARDING.md, "Finding the rest"): six steps with real controls that change the settings at once, back and forth, the ways in (Settings, the command
// palette, the address), the tips (none in the first week, one a week, "Show me" opens the tour at that step, "No more tips" is for good), and no request to anyone. Runs without a collector,
// as the first release does.
//   node scripts-dev/e2e/tour.cjs   (SHOTS=/dir saves screenshots)
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
  const settings = () => get('settings');
  const prime = (installedDaysAgo, extra = {}) => o.evaluate(async ([ago, extra]) => {
    const st = await import('/src/shared/storage.js');
    await st.updateSettings((s) => { s.onboarded = true; s.language = 'en'; s.newtab.layout = 'today'; });
    const { usage, meta } = await chrome.storage.local.get(['usage', 'meta']);
    usage.days = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    await chrome.storage.local.set({ usage, tasks: [], captures: [], meta: { ...meta, installedAt: Date.now() - ago * 86_400_000 }, ...extra }); // no open tasks: the day's own nudge (plan, goal, review) goes before a tip, by design
    await chrome.storage.local.remove(['tipState', 'obFirst', 'gsDismissed']);
  }, [installedDaysAgo, extra]);
  const open = async (url) => { const p = await app.ctx.newPage(); p.on('pageerror', (e) => bad.push('pageerror: ' + e)); p.on('console', (m) => { if (m.type() === 'error') bad.push('console: ' + m.text()); }); await p.goto(ext(url)); return p; };
  const step = (p) => p.locator('#tour .tour-count').innerText();
  const next = (p) => p.locator('#tour .dialog-actions .btn-primary').click();

  // 1. the tour from its address: six steps, every control changes the setting at once
  await prime(20);
  const perms0 = await o.evaluate(async () => JSON.stringify((await chrome.permissions.getAll()).origins));
  const nt = await open('src/newtab/newtab.html?tour');
  await nt.waitForSelector('#tour[open]'); await nt.waitForTimeout(400);
  ok(/Step 1 of 6/i.test(await step(nt)), 'the tour says where it is: ' + await step(nt));
  ok(await nt.locator('#tour .dialog-actions .btn:not(.btn-primary)').isHidden(), 'no "Back" on the first step');
  ok(await nt.evaluate(async () => { const { getUsage } = await import('/src/shared/usage-store.js'); const u = await getUsage(); return JSON.stringify(u).includes('"tour_open"'); }), 'opening the guided set-up is counted (a count only; sent only if the person shares anonymous numbers)');
  await shot(nt, 'tour-1-day');
  await nt.locator('#tour .segmented button', { hasText: 'Centered' }).click(); await nt.waitForTimeout(300);
  ok((await settings()).newtab.layout === 'center', 'a choice in the tour is the setting, at once: layout ' + (await settings()).newtab.layout);
  const ritual0 = (await settings()).ritual.on;
  await nt.locator('#tour .switch').first().click(); await nt.waitForTimeout(300);
  ok((await settings()).ritual.on === !ritual0, 'the morning and evening cards switch is the setting: ' + JSON.stringify((await settings()).ritual));
  await nt.locator('#tour .switch').first().click(); await nt.waitForTimeout(200);
  ok((await settings()).ritual.on === ritual0, 'and back again');
  await next(nt); await nt.waitForTimeout(300);
  ok(/Step 2 of 6/i.test(await step(nt)) && /Limits that hold/.test(await nt.locator('#tour .tour-title').innerText()), 'step 2: limits');
  ok(await nt.locator('#tour .segmented').count() === 0, 'the budget amounts appear only once the budget is on');
  await nt.locator('#tour .switch').first().click(); await nt.waitForSelector('#tour .segmented');
  await nt.locator('#tour .segmented button', { hasText: /1\s?h/ }).click(); await nt.waitForTimeout(300);
  const s2 = await settings();
  ok(s2.blocking.budget.enabled === true && s2.blocking.budget.minutes === 60, 'the budget is on, an hour a day: ' + JSON.stringify(s2.blocking.budget));
  const goLink = nt.locator('#tour a.tour-go');
  ok(await goLink.count() === 1 && /options\.html#blocking$/.test(await goLink.getAttribute('href')), 'what is not here is a link into Settings, not a dead end');
  await shot(nt, 'tour-2-limits');
  await next(nt); await nt.waitForTimeout(300);
  await nt.locator('#tour .opt', { hasText: 'Break after a session' }).locator('button', { hasText: '10' }).click();
  await nt.locator('#tour .opt', { hasText: 'Sound while you work' }).locator('button', { hasText: 'Rain' }).click(); await nt.waitForTimeout(300);
  const s3 = await settings();
  ok(s3.focus.breakMinutes === 10 && s3.focus.ambient === 'rain', 'the rhythm: ten-minute break and rain: ' + s3.focus.breakMinutes + ' ' + s3.focus.ambient);
  await next(nt); await nt.waitForTimeout(300);
  ok(/Step 4 of 6/i.test(await step(nt)) && await nt.locator('#tour .opt .btn').count() === 2, 'step 4 has two doors: widgets, and looks');
  await shot(nt, 'tour-4-home');
  await next(nt); await nt.waitForTimeout(300);
  ok(await nt.locator('#tour .segmented').count() === 0, 'the night clock options appear once it is on');
  await nt.locator('#tour .opt', { hasText: 'Night clock' }).locator('.switch').click(); await nt.waitForSelector('#tour .segmented');
  await nt.locator('#tour .segmented button', { hasText: '30' }).click();
  await nt.locator('#tour .opt', { hasText: 'Wind-down reminder' }).locator('.switch').click(); await nt.waitForTimeout(300);
  const s5 = await settings();
  ok(s5.standby.on === true && s5.standby.after === 30 && s5.eye.bedtime.enabled === true, 'evenings: the night clock after 30 minutes and the wind-down reminder');
  await shot(nt, 'tour-5-night');
  await next(nt); await nt.waitForTimeout(300);
  ok(/Step 6 of 6/i.test(await step(nt)) && await nt.locator('#tour a.tour-go').count() === 3, 'the last step: three places in Settings (the browser asks for access there), and the palette');
  const hrefs = await nt.locator('#tour a.tour-go').evaluateAll((a) => a.map((x) => x.getAttribute('href').split('#')[1]));
  ok(['data', 'general', 'blocking'].every((h) => hrefs.includes(h)), 'they lead to the sections that hold them: ' + hrefs);
  ok(perms0 === await o.evaluate(async () => JSON.stringify((await chrome.permissions.getAll()).origins)), 'the tour asked for no permission');
  ok(/Done/.test(await nt.locator('#tour .dialog-actions .btn-primary').innerText()), 'the last button says Done');
  await shot(nt, 'tour-6-tools');
  await nt.locator('#tour .dialog-actions .btn:not(.btn-primary)').click(); await nt.waitForTimeout(250);
  ok(/Step 5 of 6/i.test(await step(nt)) && await nt.locator('#tour .switch input:checked').count() >= 1, 'Back goes to the step before, with its choices still in place');
  await next(nt); await next(nt); await nt.waitForTimeout(300);
  ok(await nt.locator('#tour').count() === 0, 'Done closes it');

  // 2. the ways in: the command palette, Escape
  await nt.keyboard.press('Control+k'); await nt.waitForSelector('.pal-item'); await nt.keyboard.type('guided'); await nt.waitForTimeout(250); await nt.keyboard.press('Enter');
  await nt.waitForSelector('#tour[open]');
  ok(/Step 1 of 6/i.test(await step(nt)), 'the command palette has "Guided set-up"');
  await nt.keyboard.press('Escape'); await nt.waitForTimeout(250);
  ok(await nt.locator('#tour').count() === 0, 'Escape closes it, with everything so far kept');
  const row = await o.reload().then(() => o.waitForTimeout(600)).then(() => o.locator('#general .setting', { hasText: 'Guided set-up' }));
  ok(await row.count() === 1 && /newtab\.html\?tour/.test(await row.locator('a').getAttribute('href')), 'Settings → General has a row that starts it');
  await nt.close();

  // 3. the tips: none in the first week, then one, once a week, and the person decides
  await prime(3);
  let p = await open('src/newtab/newtab.html'); await p.waitForSelector('main.nt'); await p.waitForTimeout(2500);
  ok(await p.locator('.tip-card').count() === 0, 'no tip in the first week');
  // a note turned into a task right after it was written leaves nothing behind (it used to stay as a note too: the page held another copy of the list than the one it saved)
  await o.evaluate(async () => { await chrome.storage.local.set({ captures: [], tasks: [] }); });
  await p.reload(); await p.waitForSelector('.gs-step'); await p.waitForTimeout(800);
  await p.locator('#tdPanelBtn').click(); await p.waitForTimeout(400);
  const noteIn = p.locator('#mod-notes textarea');
  await noteIn.click(); await noteIn.fill('Call Anna 16:45 30m'); await noteIn.press('Enter');
  await p.locator('#mod-notes .note [data-tip], #mod-notes .note button').first().click(); // the first button of a note: "Make it a task"
  await p.waitForTimeout(1200);
  ok((await get('captures') || []).length === 0, 'the note is gone from the notes: ' + JSON.stringify(await get('captures')));
  ok(((await get('tasks')) || []).some((x) => /Call Anna/.test(x.text)), 'and it is a task');
  ok(await p.locator('#mod-notes .note').count() === 0, 'and from the screen');
  // "Start 5 min" on the first-days card is a try: it does not turn the usual length (and strictness) into five minutes
  await o.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.focus.minutes = 25; s.focus.strict = true; }); await chrome.storage.local.remove('focus'); });
  await p.reload(); await p.waitForSelector('.gs-step'); await p.waitForTimeout(800);
  await p.locator('.gs-step', { hasText: 'first focus session' }).getByRole('button').click(); await p.waitForTimeout(1200);
  const kept = await settings();
  ok(kept.focus.minutes === 25 && kept.focus.strict === true, 'a try of five minutes keeps the usual length and strictness: ' + kept.focus.minutes + ' ' + kept.focus.strict);
  await o.evaluate(async () => { await chrome.runtime.sendMessage({ type: 'focus:stop' }); const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.focus.strict = false; }); });
  // the "Add a task" button of the first days' card: on Today the field is in the side panel, which the button has to open
  await o.evaluate(async () => { await chrome.storage.local.set({ tasks: [] }); });
  await p.reload(); await p.waitForSelector('.gs-step'); await p.waitForTimeout(800);
  await p.locator('.gs-step', { hasText: 'Write down one task' }).getByRole('button').click(); await p.waitForTimeout(900);
  ok(await p.evaluate(() => { const i = document.querySelector('#mod-tasks input'); return !!i && i.offsetParent !== null && document.activeElement === i; }), 'the button shows the task field and puts the cursor in it');
  await p.keyboard.type('Buy milk'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  ok(((await get('tasks')) || []).some((x) => x.text === 'Buy milk'), 'and what is typed there becomes a task');
  await p.close();
  await prime(20);
  await o.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.blocking.budget.enabled = false; s.focus.ambient = 'off'; s.standby.on = false; s.newtab.layout = 'today'; }); });
  p = await open('src/newtab/newtab.html'); await p.waitForSelector('.tip-card', { timeout: 8000 }); await p.waitForTimeout(400);
  const tip = p.locator('.tip-card');
  ok(/Limits that hold/.test(await tip.innerText()) && /A tip/i.test(await tip.innerText()), 'after the first week, one tip: ' + (await tip.innerText()).replace(/\n/g, ' | '));
  ok(await tip.getByRole('button').count() === 3, 'three ways out of the same weight: show me, not now, no more tips');
  await shot(p, 'tip-1');
  const ts = await get('tipState');
  ok(ts && ts.last > 0 && ts.seen.limits && ts.seen.limits.n === 1, 'it is remembered as shown: ' + JSON.stringify(ts));
  await tip.getByRole('button', { name: 'Show me' }).click(); await p.waitForSelector('#tour[open]');
  ok(/Step 2 of 6/i.test(await step(p)), 'Show me opens the tour at the tip\'s own step');
  await p.keyboard.press('Escape'); await p.close();
  p = await open('src/newtab/newtab.html'); await p.waitForSelector('main.nt'); await p.waitForTimeout(2500);
  ok(await p.locator('.tip-card').count() === 0, 'one tip a week: not again the next time Home opens');
  await p.close();
  await o.evaluate(async () => { const { tipState } = await chrome.storage.local.get('tipState'); tipState.last = Date.now() - 8 * 86_400_000; await chrome.storage.local.set({ tipState }); });
  p = await open('src/newtab/newtab.html'); await p.waitForSelector('.tip-card', { timeout: 8000 });
  ok(/A rhythm for work/.test(await p.locator('.tip-card').innerText()), 'a week later the next tip, not the same one');
  await p.getByRole('button', { name: 'No more tips' }).click(); await p.waitForTimeout(500);
  ok(await p.locator('.tip-card').count() === 0 && (await get('settings')).tips.on === false, '"No more tips" ends them: it is the switch in Settings');
  await o.evaluate(async () => { const { tipState } = await chrome.storage.local.get('tipState'); tipState.last = Date.now() - 400 * 86_400_000; await chrome.storage.local.set({ tipState }); });
  await p.reload(); await p.waitForSelector('main.nt'); await p.waitForTimeout(2500);
  ok(await p.locator('.tip-card').count() === 0, 'and for good, however long ago the last one was');
  await p.close();
  // "No more tips" is the switch in Settings, and it can be turned back on there
  await o.reload(); await o.waitForTimeout(700);
  ok((await settings()).tips.on === false, '"No more tips" switches the tips off in Settings too');
  const tipsRow = o.locator('#general .setting', { hasText: 'Tips about features' });
  ok(await tipsRow.count() === 1 && await tipsRow.locator('input').isChecked() === false, 'Settings → General shows the tips switched off');
  await tipsRow.locator('.switch').click(); await o.waitForTimeout(600);
  ok((await settings()).tips.on === true, 'switching it on brings them back');

  ok(outside.length === 0, 'no request left the device: ' + outside.slice(0, 3).join(', '));
  console.log(bad.length ? 'FAIL tour\n  ' + bad.join('\n  ') : 'tour: all checks passed');
  await app.close();
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
