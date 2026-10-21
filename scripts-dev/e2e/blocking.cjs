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

  console.log(`\n${pass} passed, ${fail} failed`);
  await app.close();
  process.exit(fail ? 1 : 0);
})();
