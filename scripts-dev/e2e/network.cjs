// "Nothing leaves the device unless the person switches it on": the claim of the README and of PRIVACY.md, made checkable.
//   node scripts-dev/e2e/network.cjs
// Every request that EyeTime's own pages and its service worker make is recorded while a whole session is played: the pages are opened, a task is added, a focus
// session is started and stopped, a distracting site is met (the pause page), the break and Insights are opened, every background job the worker has is asked to run.
// With the optional things off (as they are for a new person) the list of requests to anywhere but the extension itself must be EMPTY.
// A control makes sure the monitor works: a request that the worker makes on purpose must show up in it, so that an empty list means "nothing", not "not looking".
//
// Not counted: the navigations to the sites the scenario visits (that is the person's own browsing, not the extension's network use).
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1'; // Playwright reports the requests of service workers in the context (older versions ignore it)
const { launch } = require('./lib.cjs');

const local = (url) => /^(chrome-extension|data|blob|about|chrome):/i.test(url);

(async () => {
  const app = await launch({ viewport: { width: 1200, height: 850 }, ritual: false });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const seen = [];
  const note = (req) => {
    const url = req.url();
    if (local(url)) return;
    let from = 'unknown';
    try { from = req.serviceWorker() ? 'worker' : (req.frame() && req.frame().url()) || 'unknown'; } catch { /* a frame that is gone */ }
    seen.push({ url, from, type: req.resourceType(), nav: req.isNavigationRequest() });
  };
  app.ctx.on('request', note);
  const bad = [];

  // 0. the control: the worker asks for something on purpose and the monitor must see it
  await app.sw.evaluate(() => fetch('http://control.example/ping').catch(() => {}));
  await new Promise((r) => setTimeout(r, 400));
  const control = seen.filter((s) => s.url.startsWith('http://control.example'));
  if (!control.length) bad.push('the monitor does not see the requests of the service worker: an empty list below would prove nothing');
  seen.length = 0;

  // 1. a whole session
  const page = await app.ctx.newPage();
  for (const p of ['src/onboarding/onboarding.html', 'src/newtab/newtab.html', 'src/popup/popup.html', 'src/insights/insights.html', 'src/options/options.html', 'src/break/break.html']) {
    await page.goto(ext(p)); await page.waitForTimeout(500);
  }
  await page.goto(ext('src/options/options.html'));
  await page.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.onboarded = true; }); });
  await page.goto(ext('src/newtab/newtab.html')); await page.waitForTimeout(500);
  await page.evaluate(async () => {
    const st = await import('/src/shared/storage.js');
    await st.updateCollection('tasks', [], (list) => [...list, { id: 't1', text: 'Write the report', done: false, createdAt: Date.now() }]);
    await chrome.runtime.sendMessage({ type: 'focus:start', minutes: 5 });
  });
  await page.waitForTimeout(600);
  const site = await app.ctx.newPage(); await site.goto(app.url('youtube.com')).catch(() => {}); await site.waitForTimeout(1500); // the pause or block page takes over
  await site.close();
  await page.evaluate(async () => { await chrome.runtime.sendMessage({ type: 'focus:stop' }); });
  await page.waitForTimeout(500);
  // every background job the worker has, asked to run now
  await page.evaluate(async () => {
    for (const type of ['sync:now', 'calendar:sync', 'conn:sync', 'conn:arm', 'tracker:sync', 'settings:changed']) await chrome.runtime.sendMessage({ type }).catch(() => {});
  });
  await page.waitForTimeout(1500);

  // 2. what was seen
  const mine = seen.filter((s) => !s.nav);
  if (mine.length) bad.push(`${mine.length} request(s) left the extension with everything optional off:\n  ` + mine.map((s) => `${s.type} ${s.url} (from ${s.from})`).join('\n  '));
  console.log(`requests outside the extension while a whole session was played: ${mine.length} (navigations to visited sites, not counted: ${seen.length - mine.length})`);
  console.log(bad.length ? 'FAIL network\n  ' + bad.join('\n  ') : 'PASS network: nothing left the device');
  await app.close();
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
