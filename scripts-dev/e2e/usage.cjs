// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Anonymous usage end to end, in a copy of the build that has a collector address (https://collector.test, answered by the test): counting on the device, the settings
// group and its preview, the one-time question on Home, switching on and off, the report itself, and the request that makes the collector forget.
//   node scripts-dev/e2e/usage.cjs
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const SRC = path.join(__dirname, '../..');
const EXT_COPY = '/tmp/eyetime-ext-usage';
fs.rmSync(EXT_COPY, { recursive: true, force: true });
fs.mkdirSync(EXT_COPY, { recursive: true });
for (const item of ['src', '_locales', 'icons', 'manifest.json']) cp.execFileSync('cp', ['-r', path.join(SRC, item), EXT_COPY]);
const cfg = path.join(EXT_COPY, 'src/shared/usage-config.js');
fs.writeFileSync(cfg, fs.readFileSync(cfg, 'utf8').replace("USAGE_ENDPOINT = ''", "USAGE_ENDPOINT = 'https://collector.test/v1/usage'"));
process.env.EXT = EXT_COPY;
const { launch } = require('./lib.cjs');

(async () => {
  const app = await launch({ viewport: { width: 1280, height: 900 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [];
  const ok = (c, m) => { if (!c) bad.push(m); };
  const hits = []; // what reached the collector
  await app.ctx.route('https://collector.test/**', async (route) => {
    const req = route.request(), cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    hits.push({ method: req.method(), url: req.url(), headers: req.headers(), body: req.postData() });
    return route.fulfill({ status: 204, headers: cors });
  });

  const o = await app.ctx.newPage();
  o.on('pageerror', (e) => bad.push('pageerror: ' + e)); o.on('console', (m) => { if (m.type() === 'error') bad.push('console: ' + m.text()); });
  await o.goto(ext('src/options/options.html')); await o.waitForTimeout(800);
  const get = (k) => o.evaluate(async (k) => (await chrome.storage.local.get(k))[k], k);
  await o.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.onboarded = true; s.language = 'en'; }); await st.setRaw({ gsDismissed: true }); await st.setCollection('tasks', [{ id: 'a', text: 'Secret plan for bank.com', done: false, starred: true, createdAt: 1 }]); });

  // 1. counting happens on the device, with nothing shared
  const home = await app.ctx.newPage(); await home.goto(ext('src/newtab/newtab.html')); await home.waitForTimeout(1500);
  await o.evaluate(() => chrome.runtime.sendMessage({ type: 'focus:start', minutes: 5, goal: 'my private goal' })); await o.waitForTimeout(700);
  await o.evaluate(() => chrome.runtime.sendMessage({ type: 'focus:stop' })); await o.waitForTimeout(700);
  const u = await get('usage');
  ok(u && u.total.newtab_view >= 1, 'opening Home is counted: ' + JSON.stringify(u && u.total));
  ok(u && u.total.focus_start === 1 && u.total.focus_stop === 1, 'a session started and stopped is counted: ' + JSON.stringify(u && u.total));
  ok(u && u.total.fl_early_stop === 1, 'a session stopped in the first minutes is counted as an early stop: ' + JSON.stringify(u && u.total));
  ok(u && Object.keys(u.total).some((k) => /^nt_/.test(k)), 'how fast Home was ready is counted in a bucket: ' + JSON.stringify(u && u.total));
  const site = await app.ctx.newPage(); await site.goto('http://www.youtube.com:8099/').catch(() => {}); await site.waitForTimeout(1500); await site.close();
  const u2 = await get('usage'); ok(u2 && u2.total.block_page >= 1 && u2.total.bp_friction >= 1, 'a page stopped by the pause is counted with its reason: ' + JSON.stringify(u2 && u2.total));
  ok(u && u.days.includes(0), 'today is an active day');
  ok(!(await get('usageShare')) || (await get('usageShare')).on !== true, 'sharing is off by default');
  ok(!JSON.stringify(u).match(/private|Secret|bank/i), 'no text of the person is in the counters');

  // 2. the settings group, the preview
  await o.goto(ext('src/options/options.html#data')); await o.waitForTimeout(1200);
  const group = o.locator('h3.group-title', { hasText: 'Anonymous usage' });
  ok(await group.count() === 1, 'the Anonymous usage group is in Data & privacy');
  const sw = o.locator('.setting', { hasText: 'Share anonymous usage numbers' }).locator('input[type=checkbox]');
  ok(!(await sw.isChecked()) && !(await sw.isDisabled()), 'off, and available (there is a collector in this build)');
  await o.getByRole('button', { name: 'Show what would be sent' }).click(); await o.waitForTimeout(200);
  const text = await o.locator('.usage-preview').innerText();
  let rep = null; try { rep = JSON.parse(text); } catch { /* reported below */ }
  ok(rep && rep.v === 1 && /^0{32}$/.test(rep.id), 'the preview is the report, with a placeholder id while off: ' + text.slice(0, 80));
  ok(rep && rep.ft.focus_start === 1 && rep.first.focus_start === 0, 'and holds the real counters');
  ok(rep && Array.isArray(rep.fl) && rep.fl.includes('friction') && rep.fl.filter((f) => /^tasks_/.test(f)).length === 1 && !JSON.stringify(rep).match(/private|youtube/i), 'and says what is switched on, from the fixed list: ' + JSON.stringify(rep && rep.fl));
  ok(rep && (await o.evaluate(async (r) => (await import('/src/shared/usage-schema.js')).validateReport(r).ok, rep)), 'and the schema accepts it');
  ok(!/private|Secret|bank/i.test(text), 'and nothing of what the person wrote');
  ok(hits.length === 0, 'nothing has been sent');

  // 3. switching on
  await sw.click(); await o.waitForTimeout(800);
  const share = await get('usageShare');
  ok(share && share.on === true && /^[0-9a-f]{32}$/.test(share.id), 'on: a random id is made');
  ok(await o.locator('.setting-desc', { hasText: 'Nothing has been sent yet.' }).count() === 1, 'and the screen says nothing was sent yet');
  ok(await o.getByRole('button', { name: 'New anonymous ID' }).count() === 1, 'and offers a new id');
  ok(hits.length === 0, 'switching on sends nothing: the first report goes the day after');

  // 4. the report, as the worker sends it (a week later in the test's time)
  const sent = await o.evaluate(async () => (await import('/src/shared/usage-store.js')).sendReport({ now: Date.now() + 2 * 86_400_000 }));
  ok(sent.sent === true, 'the report is sent when it is due: ' + JSON.stringify(sent));
  ok(hits.length === 1 && hits[0].method === 'POST' && /application\/json/.test(hits[0].headers['content-type'] || ''), 'one POST of JSON');
  ok(!hits[0].headers.cookie && !hits[0].headers.referer, 'without cookies or a referrer: ' + Object.keys(hits[0].headers).join(','));
  const sentBody = JSON.parse(hits[0].body);
  ok(sentBody.id === share.id && sentBody.lang === 'en' && sentBody.layout === 'today', 'the id, the language and the layout: ' + hits[0].body.slice(0, 120));
  ok(!/private|Secret|bank|http|\.com/i.test(hits[0].body), 'nothing personal in the request');
  ok((await get('usage')).period.focus_start === undefined, 'and the period starts again');
  const again = await o.evaluate(async () => (await import('/src/shared/usage-store.js')).sendReport({ now: Date.now() + 3 * 86_400_000 }));
  ok(again.sent === false && hits.length === 1, 'not twice in a week');

  // 5. switching off asks the collector to forget
  await o.reload(); await o.waitForTimeout(1200);
  await o.locator('.setting', { hasText: 'Share anonymous usage numbers' }).locator('input[type=checkbox]').click(); await o.waitForTimeout(1000);
  ok(hits.length === 2 && JSON.parse(hits[1].body).op === 'forget' && JSON.parse(hits[1].body).id === share.id, 'off: the collector is asked to forget the id: ' + (hits[1] && hits[1].body));
  const after = await get('usageShare');
  ok(after && after.on === false && after.id === null && after.askedAt, 'and it is gone here; the question will not come back');

  // 6. the one-time question on Home (it only speaks when the day-loop nudge has nothing to say: no open tasks here)
  await o.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.setCollection('tasks', []); await chrome.storage.local.remove('usageShare'); const { usage } = await chrome.storage.local.get('usage'); usage.total.focus_done = 1; usage.days = [0, 1]; await chrome.storage.local.set({ usage }); });
  await home.reload(); await home.waitForTimeout(2200);
  const ask = home.locator('#nudge:not([hidden])');
  ok(await ask.count() === 1 && /anonymous usage numbers/.test(await ask.innerText()), 'the question is on Home after a finished session and a second day: ' + (await home.locator('#nudge').innerText()));
  ok(await ask.getByRole('link', { name: 'What is sent' }).count() === 1, 'with a way to read what is sent');
  await ask.getByRole('button', { name: 'No thanks' }).click(); await home.waitForTimeout(500);
  await home.reload(); await home.waitForTimeout(2200);
  ok(await home.locator('#nudge:not([hidden])').count() === 0 || !/anonymous usage/.test(await home.locator('#nudge').innerText()), 'after "No thanks" it does not come back');
  ok((await get('usageShare')).askedAt > 0 && (await get('usageShare')).on === false, 'and nothing is on');
  await o.evaluate(async () => { await chrome.storage.local.remove('usageShare'); });
  await home.reload(); await home.waitForTimeout(2200);
  await home.locator('#nudge').getByRole('button', { name: 'Share' }).click(); await home.waitForTimeout(800);
  ok((await get('usageShare')).on === true, '"Share" switches it on');

  // 7. delete-all ends it, with a request to forget
  const before = hits.length;
  await o.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.resetAll(); }); await o.waitForTimeout(800);
  ok(hits.length === before + 1 && JSON.parse(hits[hits.length - 1].body).op === 'forget', 'delete-all asks the collector to forget');
  ok(!(await get('usageShare')) || (await get('usageShare')).on !== true, 'and sharing is off');

  await app.close();
  if (bad.length) { console.log('FAIL\n' + [...new Set(bad)].join('\n')); process.exit(1); }
  console.log('usage: all checks passed');
})();
