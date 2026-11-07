// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Messages to the maker end to end, in a copy of the build that has a collector address (https://collector.test, answered by the test): writing a message with an answer ticket, the request that
// leaves (no usage id, the ticket, the context only as attached), the author's answer coming back to the new tab and the history, deleting a message, the small question appearing only at a good
// moment and then keeping quiet, and the build without a collector (a draft on GitHub, nothing asked).   node scripts-dev/e2e/feedback.cjs   (SHOTS=/dir saves screenshots)
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const SRC = path.join(__dirname, '../..');
const EXT_COPY = '/tmp/eyetime-ext-feedback';
fs.rmSync(EXT_COPY, { recursive: true, force: true });
fs.mkdirSync(EXT_COPY, { recursive: true });
for (const item of ['src', '_locales', 'icons', 'manifest.json']) cp.execFileSync('cp', ['-r', path.join(SRC, item), EXT_COPY]);
const cfg = path.join(EXT_COPY, 'src/shared/usage-config.js');
const NOENDPOINT = process.env.NOENDPOINT === '1';
if (!NOENDPOINT) fs.writeFileSync(cfg, fs.readFileSync(cfg, 'utf8').replace("USAGE_ENDPOINT = ''", "USAGE_ENDPOINT = 'https://collector.test/v1/usage'"));
process.env.EXT = EXT_COPY;
const { launch } = require('./lib.cjs');

(async () => {
  const app = await launch({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: process.env.SHOTS ? 2 : 1 });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [], hits = [];
  const ok = (c, m) => { if (!c) bad.push(m); };
  const shot = async (page, name) => { if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, name + '.png') }); };
  let answer = null; // what the "author" has written back, as the collector would hand it out
  await app.ctx.route('https://collector.test/**', async (route) => {
    const req = route.request(), cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    hits.push({ url: new URL(req.url()).pathname, body, headers: req.headers() });
    if (new URL(req.url()).pathname === '/v1/feedback/replies') return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ r: answer ? body.t.map((t) => ({ t, ...answer })) : [] }) });
    return route.fulfill({ status: 204, headers: cors });
  });

  const o = await app.ctx.newPage();
  o.on('pageerror', (e) => bad.push('pageerror: ' + e)); o.on('console', (m) => { if (m.type() === 'error') bad.push('console: ' + m.text()); });
  await o.goto(ext('src/options/options.html')); await o.waitForTimeout(800);
  const get = (k) => o.evaluate(async (k) => (await chrome.storage.local.get(k))[k], k);
  await o.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.onboarded = true; s.language = 'en'; }); await st.setRaw({ gsDismissed: true }); await st.setCollection('tasks', []); });

  const page = await app.ctx.newPage();
  page.on('pageerror', (e) => bad.push('pageerror: ' + e)); page.on('console', (m) => { if (m.type() === 'error') bad.push('console: ' + m.text()); });

  if (NOENDPOINT) {
    // a build with no collector: writing opens a draft on GitHub (public, and says so), and no small question ever appears
    await page.goto(ext('src/feedback/feedback.html')); await page.waitForTimeout(900);
    const txt = await page.locator('#card').innerText();
    ok(/public/.test(txt) && /GitHub/.test(txt), 'it says that without a message server the draft is public on GitHub: ' + txt.slice(0, 200));
    ok(await page.getByRole('checkbox', { name: /answer here|answer/i }).count() === 0, 'no answer ticket is offered without a server');
    await page.locator('textarea').fill('Dark pause page, please'); await page.waitForTimeout(100);
    const [popup] = await Promise.all([app.ctx.waitForEvent('page'), page.getByRole('button', { name: 'Open a draft on GitHub' }).click()]);
    ok(/github\.com\/maxbzd\/eyetime\/issues\/new/.test(popup.url()) && /Dark\+pause|Dark%20pause/.test(popup.url()), 'the draft carries the words: ' + popup.url().slice(0, 120));
    ok(hits.length === 0, 'nothing is sent to anyone');
    await app.close();
    if (bad.length) { console.log('FAIL\n' + [...new Set(bad)].join('\n')); process.exit(1); }
    console.log('feedback (no collector): all checks passed'); return;
  }

  // 1. write an idea and ask for the answer here
  await page.goto(ext('src/feedback/feedback.html#idea')); await page.waitForTimeout(900);
  ok(await page.getByRole('button', { name: 'Send', exact: true }).isDisabled(), 'Send waits for a few words');
  await page.locator('textarea').fill('A dark pause page, please. The white one is blinding at night.');
  await page.getByRole('button', { name: 'Blocking' }).click();
  ok(!(await page.getByRole('checkbox', { name: /answer here/ }).isChecked()), 'asking for an answer is not ticked for the person');
  await page.getByRole('checkbox', { name: /answer here/ }).check({ force: true });
  ok(/EyeTime 3\./.test(await page.locator('.ctx-line').innerText()), 'the page shows exactly what is attached');
  await shot(page, 'fb-page-form');
  await page.getByRole('button', { name: 'Send', exact: true }).click(); await page.waitForTimeout(900);
  ok(hits.length === 1 && hits[0].url === '/v1/feedback', 'one message left: ' + JSON.stringify(hits.map((x) => x.url)));
  const msg = hits[0] && hits[0].body;
  ok(msg && msg.kind === 'idea' && msg.via === 'door' && msg.tags.join() === 'blocking' && /dark pause/.test(msg.text), 'with the words, the kind and the chip: ' + JSON.stringify(msg));
  ok(msg && /^[A-Za-z0-9_-]{22}$/.test(msg.ticket) && !('id' in msg) && !JSON.stringify(msg).includes('usageShare'), 'a random ticket and no usage id: ' + JSON.stringify(msg));
  ok(msg && msg.ctx.app && msg.ctx.days && !msg.ctx.url, 'the context is coarse: ' + JSON.stringify(msg && msg.ctx));
  ok(hits[0] && !hits[0].headers.cookie && !hits[0].headers.authorization, 'no cookie, no credentials');
  ok(/Thank you/.test(await page.locator('#card').innerText()) && /on your new tab/.test(await page.locator('#card').innerText()), 'a thank-you that says where the answer will appear');
  ok(await page.locator('#history .msg').count() === 1 && /No answer yet/.test(await page.locator('#history').innerText()), 'the message is in the list, waiting');
  await shot(page, 'fb-page-thanks');
  const fbState = await get('fbState'); ok(fbState && fbState.outbox.length === 1 && fbState.outbox[0].t === msg.ticket, 'the ticket is kept on this device only');
  ok((await get('usage')).total.fb_written === 1, 'writing is counted (a number, no words)');

  // 2. the author answers: the new tab says so, once; the page shows it in the history
  answer = { id: 7, ts: Date.now(), text: 'Thank you! A dark pause page is coming in 3.9.' };
  await o.evaluate(async () => { const { fbState } = await chrome.storage.local.get('fbState'); fbState.polledAt = 0; await chrome.storage.local.set({ fbState }); });
  const home = await app.ctx.newPage(); home.on('pageerror', (e) => bad.push('pageerror: ' + e)); await home.goto(ext('src/newtab/newtab.html')); await home.waitForTimeout(2600);
  ok(await home.locator('.fbc.reply').count() === 1 && /dark pause page is coming/.test(await home.locator('.fbc.reply').innerText()), 'the author\'s answer is on the new tab: ' + (await home.locator('.fbc.reply').count()));
  await shot(home, 'fb-reply-card');
  ok(hits.some((x) => x.url === '/v1/feedback/replies' && JSON.stringify(Object.keys(x.body).sort()) === '["t","v"]'), 'the question for answers carries the tickets and nothing else');
  await home.locator('.fbc.reply').getByRole('button', { name: 'Got it' }).click(); await home.waitForTimeout(500);
  ok(await home.locator('.fbc.reply').count() === 0, 'it can be dismissed');
  await home.reload(); await home.waitForTimeout(2200); ok(await home.locator('.fbc.reply').count() === 0, 'and does not come back');
  await page.reload(); await page.waitForTimeout(900);
  ok(/Answer from the author/.test(await page.locator('#history').innerText()) && /3\.9/.test(await page.locator('#history').innerText()), 'the answer stays in the history');
  await shot(page, 'fb-page-answer');

  // 3. the small question: only at a good moment, then quiet
  const prime = (extra) => o.evaluate(async (extra) => {
    const { usage } = await chrome.storage.local.get('usage'); usage.days = [0, 1, 2, 3, 4, 5, 6, 7, 8]; await chrome.storage.local.set({ usage });
    const k = new Date(); const key = 'd:' + k.getFullYear() + '-' + String(k.getMonth() + 1).padStart(2, '0') + '-' + String(k.getDate()).padStart(2, '0');
    const d = (await chrome.storage.local.get(key))[key] || {}; d.ss = [{ id: 's1', t: Date.now() - 12 * 60_000, m: 10, p: 10, g: '', k: 'focus', c: true, r: 3 }]; await chrome.storage.local.set({ [key]: d });
    await chrome.storage.local.set({ usageShare: { on: false, id: null, askedAt: Date.now() - 120 * 86_400_000, consentV: 1 }, ...extra });
  }, extra);
  await prime({ fbState: { outbox: [], lastAt: null } }); await home.reload(); await home.waitForTimeout(2600);
  const card = home.locator('.fbc.float');
  ok(await card.count() === 1 && /How would you feel if EyeTime were gone/.test(await card.innerText()), 'after a good session and a week of use, the question of fit appears: ' + (await card.count()));
  ok(await card.getByRole('button', { name: 'Not now' }).count() === 1 && await card.getByRole('button', { name: /Don.t ask for ratings/ }).count() === 1, 'both ways of closing it are real buttons in plain sight');
  await shot(home, 'fb-card-pmf');
  await card.getByRole('button', { name: 'Very disappointed' }).click(); await home.waitForTimeout(300);
  await card.getByRole('button', { name: 'Blocking' }).click();
  await shot(home, 'fb-card-pmf-2');
  await card.getByRole('button', { name: 'Send', exact: true }).click(); await home.waitForTimeout(900);
  const last = hits[hits.length - 1].body;
  ok(last.kind === 'pmf' && last.via === 'pmf' && last.rating === 2 && last.tags.join() === 'blocking' && !last.ticket, 'the answer left, anonymous, without a ticket: ' + JSON.stringify(last));
  ok(/Thank you/.test(await card.innerText()), 'and was thanked'); await home.waitForTimeout(3000);
  const st = await get('fbState'); ok(st.pmfAt > 0 && st.lastAt > 0, 'it is written down, so the next question waits: ' + JSON.stringify({ pmfAt: st.pmfAt, lastAt: st.lastAt }));
  await home.reload(); await home.waitForTimeout(2400); ok(await home.locator('.fbc.float').count() === 0, 'a second question does not come for a month');
  const c = await get('usage'); ok(c.total.fb_shown >= 1 && c.total.fb_answered === 1, 'shown and answered are counted: ' + JSON.stringify(c.total));
  // "Not now" is quiet for sixty days
  await prime({ fbState: { outbox: [], lastAt: Date.now() - 40 * 86_400_000, pmfAt: Date.now() - 40 * 86_400_000 } }); await home.reload(); await home.waitForTimeout(2600);
  ok(await home.locator('.fbc.float').count() === 1 && /How was that session/.test(await home.locator('.fbc.float').innerText()), 'a month later, a rating after a session');
  await home.locator('.fbc.float').getByRole('button', { name: 'Not now' }).click(); await home.waitForTimeout(600);
  const snooze = (await get('fbState')); ok(snooze.snoozeUntil > Date.now() + 55 * 86_400_000 && !snooze.never, '"Not now" is quiet for sixty days: ' + JSON.stringify(snooze.snoozeUntil));
  await prime({ fbState: { outbox: [], lastAt: Date.now() - 100 * 86_400_000, pmfAt: Date.now() - 100 * 86_400_000, never: false } }); await home.reload(); await home.waitForTimeout(2600);
  await home.locator('.fbc.float').getByRole('button', { name: /Don.t ask for ratings/ }).click(); await home.waitForTimeout(600);
  ok((await get('fbState')).never === true, '"Don\'t ask for ratings" is for good');
  await prime({}); await home.reload(); await home.waitForTimeout(2400); ok(await home.locator('.fbc.float').count() === 0, 'and the door to write stays open while no question comes');
  // never mid-session
  await prime({ fbState: { outbox: [], never: false } });
  await o.evaluate(() => chrome.runtime.sendMessage({ type: 'focus:start', minutes: 25, goal: '' })); await o.waitForTimeout(600);
  await home.reload(); await home.waitForTimeout(2400); ok(await home.locator('.fbc.float').count() === 0, 'no question during a focus session');
  await o.evaluate(() => chrome.runtime.sendMessage({ type: 'focus:stop' })); await o.waitForTimeout(500);

  // the pause page: "Did this pause help?", one tap, only when the rules allow
  await home.close(); // (an open new tab repaints and may ask a question of its own)
  await prime({ fbState: { outbox: [] } });
  await o.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((x) => { x.blocking.always = []; x.blocking.custom = ['reddit.com']; x.blocking.friction.enabled = true; x.blocking.friction.seconds = 5; }); });
  const pause = await app.ctx.newPage(); pause.on('pageerror', (e) => bad.push('pageerror: ' + e));
  await pause.goto(ext('src/blocked/blocked.html?u=http%3A%2F%2Freddit.com%2F&r=friction&a=pause')); await pause.waitForTimeout(1800);
  ok(await pause.locator('.fb-pause').count() === 1 && /Did this pause help/.test(await pause.locator('.fb-pause').innerText()), 'the pause page asks whether it helped, quietly');
  await shot(pause, 'fb-pause');
  await pause.locator('.fb-pause').getByRole('button', { name: 'Yes' }).click(); await pause.waitForTimeout(700);
  const pl = hits[hits.length - 1].body; ok(pl.kind === 'pause' && pl.via === 'pause_page' && pl.rating === 1, 'the answer left: ' + JSON.stringify(pl));
  await pause.reload(); await pause.waitForTimeout(1800); ok(await pause.locator('.fb-pause').count() === 0, 'and the next pause is quiet');
  await pause.close();

  // 4. delete a message: on the collector, and from the list
  await o.evaluate(async (m) => { await chrome.storage.local.set({ fbState: { outbox: [{ t: m.ticket, ts: Date.now(), kind: 'idea', text: m.text, answers: [] }] } }); }, msg);
  await page.reload(); await page.waitForTimeout(900);
  await page.locator('#history').getByRole('button', { name: 'Delete this message' }).click(); await page.waitForTimeout(800);
  const del = hits.find((x) => x.url === '/v1/feedback/forget'); ok(del && del.body.t[0] === msg.ticket, 'deleting asks the collector to forget the message, with the ticket: ' + JSON.stringify(del && del.body));
  ok(await page.locator('#history .msg').count() === 0, 'and it leaves the list');

  await app.close();
  if (bad.length) { console.log('FAIL\n' + [...new Set(bad)].join('\n')); process.exit(1); }
  console.log('feedback: all checks passed');
})();
