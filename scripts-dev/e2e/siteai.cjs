// Unknown sites sorted by the browser's on-device model, end to end — with a FAKE model (this automation cannot run Chrome's real Gemini Nano):
// off by default and never asked; asked only about busy unknown sites with address + title; verdicts shape reports and are marked; garbage answers are dropped;
// a download is never started on its own; states of the model are told in Settings.   node scripts-dev/e2e/siteai.cjs
const { launch } = require('./lib.cjs');

(async () => {
  const app = await launch({ viewport: { width: 1440, height: 900 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [];
  process.on('unhandledRejection', (e) => { console.log('FAIL (crashed)\n' + bad.join('\n') + '\n' + e); process.exit(1); });
  const ok = (cond, msg) => { if (!cond) bad.push(msg); };
  // a fake Prompt API on every extension page: its state and its log live in localStorage of the page's origin
  await app.ctx.addInitScript(() => {
    if (!location.protocol.startsWith('chrome-extension')) return;
    const log = (x) => { const a = JSON.parse(localStorage.getItem('fakeLog') || '[]'); a.push(x); localStorage.setItem('fakeLog', JSON.stringify(a)); };
    const mk = () => ({
      clone: async () => mk(), destroy() {},
      prompt: async (text, opts) => { log({ text, enum: opts && opts.responseConstraint && opts.responseConstraint.enum }); return /meme/.test(text) ? 'Distracting.' : /docs/.test(text) ? 'productive' : /weird/.test(text) ? 'Well, it depends on many things' : 'neutral'; },
    });
    window.LanguageModel = {
      availability: async () => localStorage.getItem('fakeState') || 'available',
      create: async (o) => { log({ create: true, sys: !!(o && o.initialPrompts) }); if (o && o.monitor) { const l = {}; o.monitor({ addEventListener: (n, f) => { l[n] = f; } }); l.downloadprogress && l.downloadprogress({ loaded: 1 }); } localStorage.setItem('fakeState', 'available'); return mk(); },
    };
  });
  const sp = await app.ctx.newPage(); await sp.goto(ext('src/options/options.html')); await sp.waitForTimeout(600);
  const today = new Date().toISOString().slice(0, 10);
  await sp.evaluate(async () => {
    const st = await import('/src/shared/storage.js'), tm = await import('/src/shared/time.js');
    await st.updateSettings((s) => { s.onboarded = true; s.language = 'en'; });
    await st.setRaw({ gsDismissed: true });
    await st.updateDay(tm.dayKey(), (d) => { d.d = { 'memes.example.com': 900, 'docs.foo.dev': 600, 'weird.io': 300, 'tiny.com': 5, 'github.com': 800, 'localhost': 700, 'seen.org': 400 }; d.fs = 0; });
    await st.setRaw({ siteGuess: { 'seen.org': { c: 'n', at: Date.now() } } });
  });
  const fake = (f) => sp.evaluate(f);
  const guess = () => sp.evaluate(async () => (await chrome.storage.local.get('siteGuess')).siteGuess || {});
  const log = () => sp.evaluate(() => JSON.parse(localStorage.getItem('fakeLog') || '[]'));
  const p = await app.ctx.newPage();
  p.on('pageerror', (e) => bad.push('pageerror: ' + e)); p.on('console', (m) => { if (m.type() === 'error') bad.push('console: ' + m.text()); });
  const home = async () => { await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(6800); };

  // off by default: the model is never touched
  await home();
  ok(Object.keys(await guess()).length === 1 && (await log()).length === 0, 'off by default: nothing asked');

  // on: asked about the busy unknown sites only, with the address (and a title if a tab has one)
  await sp.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.smartSites = { on: true }; }); });
  await p.close(); const p2 = await app.ctx.newPage(); p2.on('pageerror', (e) => bad.push('pageerror: ' + e));
  await p2.goto(ext('src/newtab/newtab.html')); await p2.waitForTimeout(7500);
  const g = await guess(), l = await log();
  ok(g['memes.example.com'] && g['memes.example.com'].c === 'd', 'a meme site is guessed distracting: ' + JSON.stringify(g));
  ok(g['docs.foo.dev'] && g['docs.foo.dev'].c === 'p', 'a docs site is guessed productive');
  ok(!g['weird.io'], 'a rambling answer is dropped, not saved');
  ok(!g['tiny.com'] && !g['github.com'] && !g.localhost, 'little-used, listed and local sites are never asked about');
  const prompts = l.filter((x) => x.text).map((x) => x.text);
  ok(prompts.length === 3 && prompts.every((x) => /^Website: [a-z.]+(\nPage title: .+)?$/.test(x)), 'only the address (and title) is sent: ' + JSON.stringify(prompts));
  ok(l.every((x) => !x.enum || x.enum.join() === 'distracting,productive,neutral'), 'the answer is constrained to three words');
  ok(l.filter((x) => x.create).length === 1, 'one session for the run');

  // reports use the guess and mark it; a personal choice wins
  await p2.close();
  const ins = await app.ctx.newPage(); ins.on('pageerror', (e) => bad.push('pageerror (insights): ' + e));
  await ins.goto(ext('src/insights/insights.html?range=today')); await ins.waitForTimeout(1200);
  await ins.click('button[role="tab"]:has-text("Sites"), [role="tab"]:has-text("Sites")').catch(() => {});
  await ins.waitForTimeout(600);
  const row = ins.locator('tr', { hasText: 'memes.example.com' });
  ok(await row.count() === 1 && await row.locator('.guess-mark').count() === 1, 'a guessed site is marked in Insights');
  ok(/Distracting/i.test(await row.locator('.tag-wrap').textContent()), 'and shown with the guessed class');
  ok(await ins.locator('tr', { hasText: 'github.com' }).locator('.guess-mark').count() === 0, 'listed sites carry no mark');
  await ins.close();

  // Settings: states of the model, a download only on a click
  await sp.goto(ext('src/options/options.html#general')); await sp.waitForTimeout(900);
  ok(/Ready/.test(await sp.locator('.setting', { hasText: 'Unknown sites' }).first().locator('xpath=following-sibling::*').first().textContent().catch(() => '')) || (await sp.locator('text=Ready. Each time Home opens').count()) === 1, 'Settings says the model is ready');
  ok(await sp.locator('text=guessed so far').count() === 1, 'and how many sites were guessed');
  await sp.locator('button', { hasText: 'Forget the guesses' }).click(); await sp.waitForTimeout(500);
  ok(Object.keys(await guess()).length === 0, 'guesses can be forgotten');
  for (const [state, text] of [['unavailable', 'cannot run'], ['downloadable', 'not on this computer yet'], ['downloading', 'is downloading']]) {
    await fake(`localStorage.setItem('fakeState', '${state}')`); await sp.reload(); await sp.waitForTimeout(900);
    ok(await sp.locator('.sec', { hasText: text }).count() >= 1, state + ': ' + text);
  }
  await fake(`localStorage.setItem('fakeState', 'downloadable')`); await fake(`localStorage.setItem('fakeLog', '[]')`); await sp.reload(); await sp.waitForTimeout(900);
  const before = (await log()).length;
  const q = await app.ctx.newPage(); await q.goto(ext('src/newtab/newtab.html')); await q.waitForTimeout(7000); await q.close();
  ok((await log()).length === before, 'a model that still has to be downloaded is never started by itself');
  await sp.locator('button', { hasText: 'Download the model' }).click(); await sp.waitForTimeout(900);
  ok((await log()).some((x) => x.create) && /Ready/.test(await sp.locator('#general').textContent()), 'the download starts on the click and the page goes to "ready"');
  await fake(`delete window.LanguageModel`); await sp.evaluate(() => { localStorage.setItem('fakeState', 'none'); });
  const r = await app.ctx.newPage();
  await r.addInitScript(() => { Object.defineProperty(window, 'LanguageModel', { get: () => undefined, set: () => {}, configurable: true }); });
  await r.goto(ext('src/options/options.html#general')); await r.waitForTimeout(900);
  ok(await r.locator('text=This browser has no built-in model').count() === 1, 'without the API: a plain explanation');

  console.log(bad.length ? 'FAIL\n' + bad.join('\n') : 'siteai: all checks passed');
  await app.close();
  process.exit(bad.length ? 1 : 0);
})();
