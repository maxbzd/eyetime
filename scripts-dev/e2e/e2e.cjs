// Full end-to-end run:  node scripts-dev/e2e/e2e.cjs     (EXT=dist/chrome to test the packaged build)
const { launch } = require('./lib.cjs');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m, extra = '') => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, extra); } };
const day = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

(async () => {
  const { ctx, sw, id, close, url } = await launch();
  const errors = [];
  ctx.on('page', p => { p.on('pageerror', e => errors.push(p.url().split('/').slice(-1)[0] + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_|favicon|net::/.test(m.text())) errors.push(p.url().split('/').slice(-1)[0] + ': ' + m.text()); }); });
  const ext = (p) => `chrome-extension://${id}/${p}`;
  const get = (k) => sw.evaluate((k) => chrome.storage.local.get(k).then(r => r[k]), k);
  const send = async (page, msg) => page.evaluate((m) => chrome.runtime.sendMessage(m), msg);

  console.log('1. install');
  await sleep(2500);
  const pages = ctx.pages().map(p => p.url());
  ok(pages.some(u => u.includes('onboarding.html')), 'onboarding tab opened on install', JSON.stringify(pages));
  const meta = await get('meta'); ok(meta && meta.schemaVersion === 3, 'schema v3 written');
  const st0 = await get('settings'); ok(st0 && st0.onboarded === false, 'settings default, not onboarded');

  console.log('2. onboarding flow');
  const ob = ctx.pages().find(p => p.url().includes('onboarding.html'));
  await ob.waitForSelector('.step');
  await ob.click('text=Get started'); await ob.waitForSelector('.chips .chip');
  await ob.click('.chips .chip >> nth=3'); // news on
  await ob.click('text=Next'); await ob.waitForSelector('.opt');
  await ob.click('#card .segmented button >> nth=2'); // 50m
  await ob.click('text=Next'); await ob.waitForSelector('.ob-looks');   // new step: pick a look (applies instantly)
  await ob.locator('.ob-looks .look-card').nth(2).click(); await sleep(500);
  ok((await get('settings')).appearance.look === 'midnight', 'look picked during onboarding is applied and saved');
  await ob.click('text=Next'); await ob.waitForSelector('text=You’re all set');
  await ob.click('text=Start my first');
  await sleep(1500);
  const st1 = await get('settings'); const focus = await get('focus');
  ok(st1.onboarded === true, 'onboarded flag saved');
  ok(st1.blocking.presets.news === true, 'distraction choice saved (news on)');
  ok(st1.focus.minutes === 50, 'focus length saved');
  ok(focus && focus.minutes === 50, 'first focus session started from onboarding');
  ok(ob.url().includes('newtab.html'), 'landed on new tab after onboarding');
  await send(ob, { type: 'focus:stop' });
  ok(!(await get('focus')), 'focus stopped');

  console.log('3. tracking');
  await sw.evaluate(() => chrome.storage.local.set({ settings: null }));
  await sw.evaluate(async () => { const { settings } = await chrome.storage.local.get('settings'); });
  const helper = await ctx.newPage();
  await helper.goto(ext('src/popup/popup.html'));
  await helper.evaluate(async () => { const m = await import('/src/shared/storage.js'); await m.updateSettings((s) => { s.onboarded = true; s.tracking.excluded = []; s.blocking.friction.enabled = true; }); });
  const tab = await ctx.newPage();
  await tab.goto(url('github.com', '/a')); await tab.bringToFront(); await sleep(6000);
  await tab.goto(url('docs.google.com', '/b')); await sleep(3000);
  await tab.goto(url('example.org', '/c')); await sleep(1500);
  const rec = await get('d:' + day());
  ok(rec && rec.d && rec.d['github.com'] >= 4, 'github.com time recorded', JSON.stringify(rec && rec.d));
  ok(rec && rec.d && rec.d['docs.google.com'] >= 2, 'docs.google.com time recorded');
  ok(rec && Object.keys(rec.h || {}).length >= 1, 'hourly slot recorded');
  const badge = await sw.evaluate(() => chrome.action.getBadgeText({}));
  ok(typeof badge === 'string', 'badge text readable: "' + badge + '"');

  console.log('4. friction pause -> continue (pass)');
  await tab.goto(url('reddit.com', '/r/x')).catch(() => {});
  await sleep(1200);
  ok(tab.url().includes('blocked.html') && tab.url().includes('r=friction'), 'reddit paused with friction', tab.url().slice(0, 100));
  await tab.waitForSelector('#cont:not([disabled])', { timeout: 14000 });
  await tab.click('#cont'); await sleep(1500);
  ok(/^https?:\/\/reddit.com/.test(tab.url()), 'continue releases the site', tab.url());
  await tab.goto(url('reddit.com', '/r/y')); await sleep(800);
  ok(/^https?:\/\/reddit.com/.test(tab.url()), 'pass still valid for subsequent navigation');

  console.log('5. focus & strict');
  const r = await send(helper, { type: 'focus:start', minutes: 5, goal: 'Test goal', strict: true });
  ok(r && r.strict === true, 'strict focus started');
  await tab.goto(url('reddit.com', '/z')).catch(() => {}); await sleep(1200);
  ok(tab.url().includes('r=focus'), 'reddit blocked during strict focus even with a pass', tab.url().slice(0, 100));
  const cont = await tab.$('#cont'); ok(!cont || await cont.isHidden(), 'no continue button in strict mode');
  const stop = await send(helper, { type: 'focus:stop' }); ok(stop && stop.ok === false, 'strict session cannot be stopped from UI');
  await tab.goto(url('github.com', '/ok')); await sleep(500); ok(/^https?:\/\/github.com/.test(tab.url()), 'productive site unaffected during focus');
  // end the session by rewriting its end time, then the block page must auto-release
  await tab.goto(url('reddit.com', '/z')).catch(() => {}); await sleep(1000);
  await sw.evaluate(async () => { const { focus } = await chrome.storage.local.get('focus'); focus.endsAt = Date.now() + 1500; await chrome.storage.local.set({ focus }); await chrome.alarms.create('focus-end', { when: focus.endsAt }); });
  await tab.waitForURL(/^http:\/\/reddit\.com/, { timeout: 15000 }).catch(() => {});
  ok(/^https?:\/\/reddit.com/.test(tab.url()) || tab.url().includes('r=friction'), 'block page auto-released after session end', tab.url().slice(0, 100));
  const rec2 = await get('d:' + day()); ok(rec2 && rec2.fc >= 1 && rec2.fs >= 300, 'completed session counted (fc/fs)', JSON.stringify({ fc: rec2 && rec2.fc, fs: rec2 && rec2.fs }));

  console.log('5b. rest after a session');
  await helper.evaluate(async () => { const m = await import('/src/shared/storage.js'); await m.updateSettings((s) => { s.focus.breakMinutes = 5; }); });
  await send(helper, { type: 'focus:start', minutes: 5, goal: '', strict: false });
  await sw.evaluate(async () => { const { focus } = await chrome.storage.local.get('focus'); focus.endsAt = Date.now() + 800; await chrome.storage.local.set({ focus }); await chrome.alarms.create('focus-end', { when: focus.endsAt }); });
  await sleep(4500);
  const rest = await get('rest'); ok(rest && rest.minutes === 5 && rest.endsAt > Date.now(), 'rest timer started after the session', JSON.stringify(rest));
  await tab.goto(url('reddit.com', '/rest')).catch(() => {}); await sleep(800);
  ok(!tab.url().includes('r=focus') && !tab.url().includes('r=schedule'), 'no focus block during the break', tab.url().slice(0, 90));
  const pg5 = await ctx.newPage(); await pg5.goto(ext('src/popup/popup.html')); await sleep(1200);
  ok(await pg5.locator('.focus-run.rest').count() === 1, 'popup shows the break card');
  await pg5.click('text=Skip break'); await sleep(800); ok(!(await get('rest')), 'skipping clears the rest timer'); await pg5.close();

  console.log('5c. productivity loop: task-linked session, review, only-my-sites, pause reasons');
  await helper.evaluate(async () => { const m = await import('/src/shared/storage.js'); await m.setCollection('tasks', [{ id: 't1', text: 'Write report', done: false, starred: true, createdAt: Date.now() }]); await m.updateSettings((s) => { s.focus.breakMinutes = 0; s.focus.review = true; }); });
  await send(helper, { type: 'focus:start', minutes: 5, strict: false, taskId: 't1' });
  const f1 = await get('focus'); ok(f1 && f1.taskId === 't1' && f1.goal === 'Write report', 'session linked to a task takes its text as the goal', JSON.stringify(f1));
  await sw.evaluate(async () => { const { focus } = await chrome.storage.local.get('focus'); focus.endsAt = Date.now() + 800; await chrome.storage.local.set({ focus }); await chrome.alarms.create('focus-end', { when: focus.endsAt }); });
  await sleep(4500);
  const rev = await get('review'); ok(rev && rev.taskId === 't1' && rev.completed, 'review queued after the session', JSON.stringify(rev));
  const dr = await get('d:' + day()); ok(dr && dr.ss && dr.ss.some((x) => x.k === 't1' && x.c === 1), 'session written to the day log');
  const tk = await get('tasks'); ok(tk[0].focusSec >= 300, 'focus time credited to the task', String(tk[0].focusSec));
  const pg6 = await ctx.newPage(); await pg6.goto(ext('src/newtab/newtab.html')); await sleep(1200);
  ok(await pg6.locator('.review-card').count() === 1, 'Home shows the "how did it go?" card');
  await pg6.locator('.review-task input').check(); await pg6.locator('.review-rate .chip >> nth=2').click(); await sleep(800);
  const dr2 = await get('d:' + day()); const tk2 = await get('tasks');
  ok(dr2.ss.find((x) => x.k === 't1').r === 3 && tk2[0].done === true && !(await get('review')), 'rating saved, task marked done, review cleared');
  await pg6.close();
  await send(helper, { type: 'focus:start', minutes: 25, strict: false, scope: 'only-mine' });
  await tab.goto(url('example.org', '/only')).catch(() => {}); await sleep(900);
  ok(tab.url().includes('r=focus'), '"only my sites" closes a neutral site', tab.url().slice(0, 100));
  await tab.goto(url('github.com', '/mine')).catch(() => {}); await sleep(900);
  ok(/^https?:\/\/github.com/.test(tab.url()), '"only my sites" leaves productive sites open', tab.url().slice(0, 100));
  await send(helper, { type: 'focus:stop' });
  await send(helper, { type: 'pause:reason', reason: 'bored' }); await send(helper, { type: 'pause:reason', reason: 'nonsense' });
  const dr3 = await get('d:' + day()); ok(dr3.pr && dr3.pr.bored === 1 && Object.keys(dr3.pr).length === 1, 'pause reason logged (unknown reasons ignored)', JSON.stringify(dr3.pr));
  await helper.evaluate(async () => { const m = await import('/src/shared/storage.js'); await m.updateSettings((s) => { s.focus.breakMinutes = 5; }); });

  console.log('5d. research-based features: switches, temptations, if-then plans, resume notes, close the day');
  const dsw = await get('d:' + day()); ok(dsw && dsw.sw >= 1, 'site switches counted (context switching)', String(dsw && dsw.sw));
  ok(dsw.pa && dsw.pa['reddit.com'] >= 1, 'temptations logged when a pause/block page steps in', JSON.stringify(dsw.pa));
  const r2 = await send(helper, { type: 'ambient:set', kind: 'rain' }); const stA = await get('settings'); ok(r2.ok && stA.focus.ambient === 'rain', 'ambient sound choice saved');
  await send(helper, { type: 'ambient:set', kind: 'off' }); ok((await send(helper, { type: 'ambient:set', kind: 'bogus' })).ok === false, 'unknown ambient sound rejected');
  await helper.evaluate(async () => { const m = await import('/src/shared/storage.js'); await m.setCollection('tasks', [{ id: 't2', text: 'Draft the proposal', done: false, starred: false, createdAt: Date.now() }, { id: 't3', text: 'Reply to Sam', done: false, starred: false, createdAt: Date.now() }]); await m.updateSettings((s) => { s.focus.breakMinutes = 0; s.focus.review = true; s.blocking.plans = [{ id: 'p1', when: 'reddit.com', then: 'stand up and drink water' }]; }); });
  await send(helper, { type: 'focus:start', minutes: 5, strict: false, taskId: 't2' });
  await sw.evaluate(async () => { const { focus } = await chrome.storage.local.get('focus'); focus.endsAt = Date.now() + 800; await chrome.storage.local.set({ focus }); await chrome.alarms.create('focus-end', { when: focus.endsAt }); });
  await sleep(4500);
  const rv = await get('review'); const rr = await send(helper, { type: 'session:review', id: rv.id, rating: 2, done: false, resume: 'Write section 2, then budget' });
  ok(rr.ok && (await get('tasks')).find((x) => x.id === 't2').resume === 'Write section 2, then budget', '"where did you leave off" saved on the task');
  await tab.goto(url('reddit.com', '/plan')).catch(() => {}); await sleep(1200);
  await helper.evaluate(async () => { const m = await import('/src/shared/storage.js'); const { focus } = await chrome.storage.local.get('focus'); await m.updateSettings((s) => { s.blocking.friction.enabled = true; }); await chrome.storage.local.set({ passes: {} }); });
  await tab.goto(url('reddit.com', '/plan2')).catch(() => {}); await sleep(1500);
  const planTxt = tab.url().includes('blocked.html') ? await tab.locator('#planText').textContent() : '';
  ok(/stand up and drink water/.test(planTxt), 'pause page shows the user’s own if-then plan', planTxt);
  await tab.locator('#park').click(); await sleep(900);
  const caps = await get('captures'); ok(Array.isArray(caps) && caps.some((c) => /reddit\.com/.test(c.text)), '"Park it for later" saves the urge to the parked list');
  const pg7 = await ctx.newPage(); await pg7.goto(ext('src/newtab/newtab.html')); await sleep(1300);
  ok((await pg7.locator('.item-meta .resume').count()) >= 1, 'Home shows the resume note under the task');
  await pg7.keyboard.press('n'); ok(await pg7.evaluate(() => document.activeElement?.closest('#mod-tasks') !== null && document.activeElement.tagName === 'INPUT'), 'shortcut "n" focuses the task input');
  await pg7.keyboard.press('Escape'); await pg7.locator('body').click({ position: { x: 5, y: 300 } });
  await pg7.keyboard.press('?'); ok(await pg7.locator('dialog[open] .sc-row').count() >= 5, 'shortcut "?" lists the keyboard shortcuts'); await pg7.keyboard.press('Escape');
  await pg7.locator('.plan-link').click(); await pg7.waitForSelector('dialog[open] .sd-stats'); 
  await pg7.locator('dialog[open] input[type=text], dialog[open] .input').first().fill('Shipped the draft');
  await pg7.locator('dialog[open] .items .check input').first().check();
  await pg7.locator('dialog[open] .btn-primary').click(); await sleep(900);
  const tomorrow = await helper.evaluate(async () => { const t = await import('/src/shared/time.js'); return t.dayKey(t.addDays(new Date(), 1)); });
  const tk3 = await get('tasks'); const d4 = await get('d:' + day());
  ok(tk3.some((x) => x.planFor === tomorrow) && d4.w === 'Shipped the draft', 'closing the day saves the win and plans tomorrow', JSON.stringify({ plans: tk3.map((x) => x.planFor), w: d4.w }));
  await sw.evaluate(async (today) => { const { tasks } = await chrome.storage.local.get('tasks'); tasks.forEach((x) => { if (x.planFor) x.planFor = today; }); await chrome.storage.local.set({ tasks }); }, day());
  await pg7.reload(); await sleep(1300);
  const tk4 = await get('tasks'); ok(tk4.some((x) => x.starred) && tk4.every((x) => !x.planFor), 'yesterday’s plan becomes today’s priorities');
  await pg7.close();
  await helper.evaluate(async () => { const m = await import('/src/shared/storage.js'); await m.updateSettings((s) => { s.focus.breakMinutes = 5; s.blocking.plans = []; }); });

  console.log('6. eye break + pause tracking');
  await send(helper, { type: 'break:complete' }); const rec3 = await get('d:' + day()); ok(rec3.b >= 1, 'break counted');
  await send(helper, { type: 'tracking:pause', minutes: 30 }); ok((await get('pausedUntil')) > Date.now(), 'tracking paused');
  await send(helper, { type: 'tracking:pause', minutes: 0 }); ok((await get('pausedUntil')) === 0, 'tracking resumed');

  console.log('7. always-blocked + limits');
  await helper.evaluate(async () => { const m = await import('/src/shared/storage.js'); await m.updateSettings((s) => { s.blocking.always = ['example.net']; s.blocking.limits = { 'github.com': 0.05 }; }); });
  await send(helper, { type: 'settings:changed' });
  await tab.goto(url('example.net')).catch(() => {}); await sleep(800); ok(tab.url().includes('r=always'), 'always-blocked site blocked');
  await tab.goto(url('github.com', '/lim')).catch(() => {}); await sleep(800); ok(tab.url().includes('r=limit'), 'daily limit enforced (github.com)', tab.url().slice(0, 100));

  console.log('8. migration from 1.x');
  await sw.evaluate(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set({ settings: { language: 'ru', eyeRestIntervalMinutes: 30, interceptor: { bedtime: '23:00' }, blocking: { presets: { social: true }, customDistractions: ['example.com'] }, hardBlockedDomains: ['example.net'] }, stats: { '2026-10-01': { totalSeconds: 90, domains: { 'github.com': 90 }, breaksCompleted: 1 } }, dailyGoals: [{ text: 'Old task', done: false }] });
  });
  await helper.evaluate(async () => { const m = await import('/src/shared/storage.js'); await m.ensureSchema(); });
  const sw2 = sw;
  const mig = await sw2.evaluate(async () => chrome.storage.local.get(null));
  ok(mig.meta && mig.meta.schemaVersion === 3 && mig.meta.migratedFrom === '1.x', 'migrated marker set', JSON.stringify(mig.meta));
  ok(mig.settings.language === 'ru' && mig.settings.eye.intervalMin === 30 && mig.settings.blocking.custom[0] === 'example.com' && mig.settings.blocking.always[0] === 'example.net', 'settings migrated');
  ok(mig['d:2026-10-01'] && mig['d:2026-10-01'].d['github.com'] === 90, 'old stats migrated to per-day key');
  ok(Array.isArray(mig.tasks) && mig.tasks[0].text === 'Old task', 'tasks migrated');
  ok(!('stats' in mig) && !('dailyGoals' in mig), 'legacy keys removed');

  console.log('9. every page renders without errors');
  const pageList = ['src/popup/popup.html', 'src/newtab/newtab.html', 'src/insights/insights.html', 'src/options/options.html', 'src/onboarding/onboarding.html', 'src/break/break.html', 'src/blocked/blocked.html?u=' + encodeURIComponent('http://example.org/') + '&r=friction&a=pause'];
  for (const p of pageList) { const pg = await ctx.newPage(); await pg.goto(ext(p)); await sleep(1200); const body = await pg.evaluate(() => document.body.innerText.length); ok(body > 20, p + ' has content (' + body + ' chars)'); await pg.close(); }

  console.log('10. feed guard (short-video limit)');
  await helper.evaluate(async () => { const m = await import('/src/shared/storage.js'); await m.updateSettings((s) => { s.blocking.friction.enabled = false; s.blocking.always = []; s.blocking.limits = {}; s.blocking.feed.shortLimit = true; s.blocking.feed.shortMinutes = 0.05; s.blocking.feed.hideComments = true; }); });
  const yt = await ctx.newPage();
  await yt.goto(url('youtube.com', '/shorts/abc')); await sleep(6000);
  const locked = await yt.evaluate(() => ({ filter: document.documentElement.style.filter, overlay: [...document.documentElement.children].some(e => e.shadowRoot) , css: !!document.getElementById('eyetime-feed-css') }));
  ok(locked.filter.includes('grayscale') && locked.overlay, 'shorts guard locked the page after the limit', JSON.stringify(locked));
  ok(locked.css, 'feed CSS injected (hide comments)');

  console.log('\nconsole/page errors:', errors.length ? errors : 'none');
  console.log(`\n${pass} passed, ${fail} failed`);
  await close();
  process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
