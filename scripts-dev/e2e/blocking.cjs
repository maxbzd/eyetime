// Blocking scenarios that real browsing produces but a simple test misses: a second window, same-page (SPA) navigation,
// the service worker being stopped and woken by the browser, a session that ended while the browser was closed.
//   node scripts-dev/e2e/blocking.cjs
const { launch } = require('./lib.cjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m, d) => { console.log(`  ${c ? 'PASS' : 'FAIL'} ${m}${c || !d ? '' : ' — ' + d}`); c ? pass++ : fail++; };

(async () => {
  const app = await launch({ viewport: { width: 1100, height: 800 } });
  const { ctx } = app;
  // Playwright cannot evaluate inside a restarted worker, so all storage access goes through an extension page (same chrome.storage)
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const get = async (k) => (await setup.evaluate((k) => chrome.storage.local.get(k), k))[k];
  const setup = await ctx.newPage(); await setup.goto(ext('src/options/options.html')); await sleep(500);
  await setup.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.onboarded = true; s.language = 'en'; s.blocking.friction.enabled = true; s.blocking.friction.seconds = 5; }); });
  const stopWorker = async (page) => { const cdp = await ctx.newCDPSession(page); await cdp.send('ServiceWorker.enable'); await cdp.send('ServiceWorker.stopAllWorkers'); await sleep(800); };
  const wake = () => setup.evaluate(() => chrome.runtime.sendMessage({ type: 'break:state' }));

  console.log('1. a focus session blocks distracting sites in a second window too');
  await setup.evaluate(() => chrome.runtime.sendMessage({ type: 'focus:start', minutes: 10, goal: '', strict: false }));
  const w2 = await ctx.newPage();
  await w2.goto('http://reddit.com/r/test').catch(() => {}); await sleep(1200);
  ok(w2.url().includes('blocked.html') && w2.url().includes('r=focus'), 'reddit blocked during focus in another tab', w2.url().slice(0, 90));

  console.log('2. same-page (SPA) navigation inside an allowed site is not blocked, and a pass survives it');
  await w2.goto('http://github.com/').catch(() => {}); await sleep(600);
  await w2.evaluate(() => history.pushState({}, '', '/pulls')); await sleep(600);
  ok(/github\.com\/pulls$/.test(w2.url()), 'pushState on a productive site stays put', w2.url());

  console.log('3. the browser stops the service worker; blocking still works after it wakes up');
  await stopWorker(w2);
  await w2.goto('http://reddit.com/r/after-sleep').catch(() => {}); await sleep(2000);
  ok(w2.url().includes('blocked.html'), 'reddit still blocked after the worker was stopped', w2.url().slice(0, 90));
  await setup.evaluate(() => chrome.runtime.sendMessage({ type: 'focus:stop' })); await sleep(300);

  console.log('4. a session that ended while the browser was closed is finished on the next start');
  await setup.evaluate(async () => { const now = Date.now(); await chrome.alarms.clear('focus-end'); await chrome.storage.local.set({ focus: { id: 'old', startedAt: now - 40 * 60000, endsAt: now - 10 * 60000, minutes: 30, goal: 'Slept through', strict: false, scope: 'distractions' }, review: null, rest: null }); });
  await stopWorker(w2); await wake(); await sleep(2500);
  const focusAfter = await get('focus'), review = await get('review');
  ok(!focusAfter, 'the expired session is cleared on wake-up');
  ok(review && review.goal === 'Slept through' && review.completed === true, 'a review is queued for it', JSON.stringify(review));

  console.log('5. a pass is per browser, not per tab: a second tab on the same site is not paused again');
  await setup.evaluate(() => chrome.storage.local.set({ passes: {}, review: null, rest: null }));
  const a = await ctx.newPage(); await a.goto('http://reddit.com/one').catch(() => {}); await sleep(1000);
  ok(a.url().includes('r=friction'), 'first tab is paused');
  await a.waitForSelector('#cont:not([disabled])', { timeout: 15000 }); await a.click('#cont'); await sleep(1800);
  const b = await ctx.newPage(); await b.goto('http://reddit.com/two').catch(() => {}); await sleep(1500);
  ok(/reddit\.com\/two/.test(b.url()), 'second tab opens straight away while the pass is valid', b.url().slice(0, 90));

  console.log('6. one "continue" does not open a window for every other site');
  const c = await ctx.newPage(); await c.goto('http://www.instagram.com/x').catch(() => {}); await sleep(1500);
  ok(c.url().includes('blocked.html'), 'another distracting site opened right after a "continue" is still paused', c.url().slice(0, 90));

  console.log('7. two starts at once: the first session wins and is not overwritten');
  await setup.evaluate(() => chrome.storage.local.set({ passes: {}, focus: null }));
  const res = await setup.evaluate(() => Promise.all([chrome.runtime.sendMessage({ type: 'focus:start', minutes: 25, goal: 'first', strict: false }), chrome.runtime.sendMessage({ type: 'focus:start', minutes: 50, goal: 'second', strict: false })]));
  const stored = await get('focus');
  ok(res.filter((r) => r && r.ok === false && r.error === 'active').length === 1, 'exactly one of two simultaneous starts is refused', JSON.stringify(res).slice(0, 160));
  ok(stored && stored.goal === 'first' && stored.minutes === 25, 'the first session is the one running', JSON.stringify(stored).slice(0, 120));
  await setup.evaluate(() => chrome.runtime.sendMessage({ type: 'focus:stop' })); await sleep(300);

  console.log('8. pausing a session lifts the blocks and stops the clock; resuming brings them back');
  await setup.evaluate(() => chrome.storage.local.set({ passes: {}, focus: null, rest: null }));
  await setup.evaluate(() => chrome.runtime.sendMessage({ type: 'focus:start', minutes: 30, goal: 'Pause test', strict: false }));
  await sleep(500);
  const pr = await setup.evaluate(() => chrome.runtime.sendMessage({ type: 'focus:pause' }));
  const pausedSession = await get('focus');
  ok(pr && pr.ok === true && pausedSession && pausedSession.pausedAt > 0, 'the session is paused', JSON.stringify(pr));
  const pg = await ctx.newPage(); await pg.goto('http://reddit.com/while-paused').catch(() => {}); await sleep(1500);
  ok(!pg.url().includes('r=focus'), 'the focus block is lifted while the session is paused (only the ordinary pause page may show)', pg.url().slice(0, 110));
  const rem1 = await setup.evaluate(async () => { const m = await import('/src/shared/focus.js'); const { focus } = await chrome.storage.local.get('focus'); return m.remainingMs(focus); });
  await sleep(1500);
  const rem2 = await setup.evaluate(async () => { const m = await import('/src/shared/focus.js'); const { focus } = await chrome.storage.local.get('focus'); return m.remainingMs(focus); });
  ok(rem1 === rem2 && rem1 > 29 * 60000, 'the remaining time stands still while paused', rem1 + ' vs ' + rem2);
  const again = await setup.evaluate(() => chrome.runtime.sendMessage({ type: 'focus:start', minutes: 5, goal: 'x', strict: false }));
  ok(again && again.ok === false && again.error === 'active', 'a paused session still counts as running: no second start');
  const rr = await setup.evaluate(() => chrome.runtime.sendMessage({ type: 'focus:resume' }));
  const resumed = await get('focus');
  ok(rr && rr.ok === true && !resumed.pausedAt && resumed.pausedMs > 0 && resumed.endsAt > pausedSession.endsAt, 'resuming moves the end by the pause', JSON.stringify(resumed).slice(0, 160));
  const pg2 = await ctx.newPage(); await pg2.goto('http://reddit.com/after-resume').catch(() => {}); await sleep(1500);
  ok(pg2.url().includes('r=focus'), 'the focus block is back after resume', pg2.url().slice(0, 90));
  await setup.evaluate(() => chrome.runtime.sendMessage({ type: 'focus:stop' })); await sleep(300);
  await setup.evaluate(() => chrome.runtime.sendMessage({ type: 'focus:start', minutes: 30, goal: 'Strict', strict: true })); await sleep(400);
  const sp = await setup.evaluate(() => chrome.runtime.sendMessage({ type: 'focus:pause' }));
  ok(sp && sp.ok === false, 'a strict session cannot be paused', JSON.stringify(sp));
  await setup.evaluate(() => chrome.storage.local.set({ focus: null }));

  console.log('9. a pause that was forgotten: soon after, the browser start resumes it quietly; left for hours, the session ends and counts what was done');
  const startPaused = (agoMin) => setup.evaluate(async (agoMin) => {
    const now = Date.now(); await chrome.alarms.clear('focus-end'); await chrome.alarms.clear('focus-resume');
    await chrome.storage.local.set({ rest: null, review: null, focus: { id: 'fp' + agoMin, startedAt: now - (agoMin + 30) * 60000, endsAt: now - agoMin * 60000 + 20 * 60000, minutes: 50, goal: 'Forgotten pause', strict: false, taskId: '', scope: 'distractions', mode: '', allow: [], pausedAt: now - agoMin * 60000 } });
  }, agoMin);
  await startPaused(30); await stopWorker(w2); await wake(); await sleep(2500);
  const soon = await get('focus');
  ok(soon && !soon.pausedAt && soon.pausedMs > 0, 'a pause that ran out half an hour ago is resumed on start', JSON.stringify(soon));
  await setup.evaluate(() => chrome.storage.local.set({ focus: null }));
  await startPaused(240); await stopWorker(w2); await wake(); await sleep(2500);
  const longAgo = await get('focus'), rev = await get('review');
  ok(!longAgo, 'a pause left for hours ends the session on start', JSON.stringify(longAgo));
  ok(rev && rev.goal === 'Forgotten pause' && rev.completed === false, 'and what was worked is offered for review', JSON.stringify(rev));
  await setup.evaluate(() => chrome.storage.local.set({ review: null }));

  console.log('10. the command palette on a paused session offers Resume (not +5 min); the menu and the shortcut agree');
  await startPaused(2);
  const pal = await ctx.newPage(); await pal.goto(ext('src/newtab/newtab.html')); await sleep(1200);
  await pal.keyboard.press('Control+k'); await sleep(500);
  const items = await pal.locator('.pal-item, [role=option]').allInnerTexts();
  ok(items.some((x) => /Resume/i.test(x)) && !items.some((x) => /\+5|5 more|Extend/i.test(x)), 'the palette lists Resume and no +5 min while paused', items.slice(0, 6).join(' | '));
  await setup.evaluate(() => chrome.storage.local.set({ focus: null }));

  console.log(`\n${pass} passed, ${fail} failed`);
  await app.close();
  process.exit(fail ? 1 : 0);
})();
