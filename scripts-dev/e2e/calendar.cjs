// Calendar subscription end to end: a local HTTP server plays the calendar host; the extension runs from a copy whose manifest already holds
// the host permission (a real user grants it in the browser's prompt, which automation cannot click).   node scripts-dev/e2e/calendar.cjs
const fs = require('fs');
const path = require('path');
const http = require('http');
const cp = require('child_process');

const SRC = path.join(__dirname, '../..');
const EXT_COPY = '/tmp/eyetime-ext-calendar';
fs.rmSync(EXT_COPY, { recursive: true, force: true });
fs.mkdirSync(EXT_COPY, { recursive: true });
for (const item of ['src', '_locales', 'icons']) cp.execFileSync('cp', ['-r', path.join(SRC, item), EXT_COPY]);
const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
manifest.host_permissions = ['http://127.0.0.1/*'];
fs.writeFileSync(path.join(EXT_COPY, 'manifest.json'), JSON.stringify(manifest));
process.env.EXT = EXT_COPY;
const { launch } = require('./lib.cjs');

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const soon = new Date(); soon.setDate(soon.getDate() + 2); soon.setHours(10, 0, 0, 0);
const end = new Date(soon.getTime() + 30 * 60000);
const ICS = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:sub1', `DTSTART:${stamp(soon)}`, `DTEND:${stamp(end)}`, 'SUMMARY:Subscribed meeting', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');

let mode = 'ok', hits = 0;
const server = http.createServer((req, res) => {
  hits++;
  if (req.headers.cookie || req.headers.authorization) { res.writeHead(400); res.end('credentials were sent'); return; }
  if (mode === 'ok') { res.writeHead(200, { 'content-type': 'text/calendar' }); res.end(ICS); }
  else if (mode === '404') { res.writeHead(404); res.end('nope'); }
  else if (mode === 'redirect') { res.writeHead(302, { location: 'http://127.0.0.1:1/elsewhere.ics' }); res.end(); }
  else if (mode === 'slow') { setTimeout(() => { res.writeHead(200, { 'content-type': 'text/calendar' }); res.end(ICS); }, 1500); }
  else { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<html>not a calendar</html>'); }
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const URL = `http://127.0.0.1:${server.address().port}/private/basic.ics`;
  const app = await launch();
  // newer Playwright versions also route the service worker's requests; the calendar server must answer for itself (later routes win)
  await app.ctx.route(`http://127.0.0.1:${server.address().port}/**`, (route) => route.continue());
  const page = await app.ctx.newPage(); await page.goto(`chrome-extension://${app.id}/src/options/options.html#data`); await page.waitForTimeout(700);
  const bad = [];
  const sync = () => page.evaluate(async () => { const r = await chrome.runtime.sendMessage({ type: 'calendar:sync' }); const s = await chrome.storage.local.get(['calendar', 'calendarSub']); return { r, ...s }; });

  await page.evaluate((url) => chrome.storage.local.set({ calendarSub: { url, since: Date.now() } }), URL);
  let st = await sync();
  if (!st.calendarSub || !st.calendarSub.ok || !(st.calendar || []).some((e) => e.title === 'Subscribed meeting')) bad.push('first sync did not store the event: ' + JSON.stringify(st).slice(0, 300));
  if (st.calendarSub && st.calendarSub.host !== '127.0.0.1') bad.push('host not recorded');

  mode = '404'; st = await sync();
  if (!st.calendarSub || st.calendarSub.error !== 'http' || st.calendarSub.status !== 404) bad.push('404 not reported: ' + JSON.stringify(st.calendarSub));
  if (!(st.calendar || []).some((e) => e.title === 'Subscribed meeting')) bad.push('events were lost on a failed refresh');

  mode = 'html'; st = await sync();
  if (!st.calendarSub || st.calendarSub.error !== 'format') bad.push('non-calendar answer not reported: ' + JSON.stringify(st.calendarSub));

  mode = 'redirect'; st = await sync();
  if (!st.calendarSub || st.calendarSub.error !== 'redirect') bad.push('a redirect was not refused: ' + JSON.stringify(st.calendarSub));

  mode = 'ok'; st = await sync();
  if (!st.calendarSub || !st.calendarSub.ok || st.calendarSub.error) bad.push('did not recover after errors');

  // unsubscribing while a download is still running must not bring the secret address (or the events) back
  mode = 'slow';
  const racing = page.evaluate(() => chrome.runtime.sendMessage({ type: 'calendar:sync' }));
  await page.waitForTimeout(300);
  await page.evaluate(() => chrome.storage.local.remove(['calendarSub', 'calendar', 'calendarMeta']));
  await racing; await page.waitForTimeout(300);
  const raced = await page.evaluate(() => chrome.storage.local.get(['calendarSub', 'calendar']));
  if (raced.calendarSub || raced.calendar) bad.push('a download that finished after Unsubscribe wrote the data back');
  mode = 'ok';
  await page.evaluate((url) => chrome.storage.local.set({ calendarSub: { url, since: Date.now() } }), URL); await sync();
  // two wake-ups at once start one download, not two
  const before = hits; await Promise.all([sync(), sync(), sync()]);
  if (hits - before > 1) bad.push('simultaneous syncs made ' + (hits - before) + ' requests');

  // the settings screen shows the host (never the secret path) and an unsubscribe button
  await page.reload(); await page.waitForTimeout(900);
  const txt = await page.locator('#data').innerText().catch(() => page.locator('body').innerText());
  if (!/127\.0\.0\.1/.test(txt)) bad.push('Settings does not show the subscribed host: ' + txt.replace(/\s+/g, ' ').slice(0, 1600));
  if (/private\/basic\.ics/.test(txt)) bad.push('Settings shows the secret address');
  await page.locator('button', { hasText: /Unsubscribe|Отписаться/ }).first().click(); await page.waitForTimeout(700);
  const after = await page.evaluate(() => chrome.storage.local.get(['calendarSub', 'calendar', 'calendarMeta']));
  if (after.calendarSub || after.calendar || after.calendarMeta) bad.push('unsubscribe left data behind: ' + Object.keys(after).join(','));
  // a backup file never carries the secret address
  await page.evaluate((url) => chrome.storage.local.set({ calendarSub: { url } }), URL);
  const exported = await page.evaluate(async () => { const m = await import('/src/shared/storage.js'); return JSON.stringify(await m.exportAll()); });
  if (exported.includes('private/basic.ics')) bad.push('the calendar address leaked into the backup export');

  console.log(bad.length ? 'FAIL calendar subscription\n  ' + bad.join('\n  ') : `PASS calendar subscription (${hits} requests, no cookies, errors keep old events, unsubscribe cleans up)`);
  await app.close(); server.close();
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
