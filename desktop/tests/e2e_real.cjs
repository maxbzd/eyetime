// The screens against the real helper logic on a pretend computer (target/debug/eyetime-sim prototype 8131 must be running).
// Run: node desktop/tests/e2e_real.cjs   (needs playwright)
const { chromium } = require('playwright');
const SP = process.env.SHOTS || require('os').tmpdir();
const BASE = process.env.SIM || 'http://127.0.0.1:8131';
const log = (...a) => console.log(...a);
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.log('FAIL', m); } else console.log('ok  ', m); };
const post = async (p, o) => (await fetch(BASE + p, { method: 'POST', body: JSON.stringify(o) })).json();
const world = async () => (await fetch(BASE + '/world')).json();
const status = async () => (await post('/req', { op: 'status' })).data;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => {
    window.__TAURI__ = { core: { invoke: async (cmd, a) => { if (cmd === 'helper') { const r = await fetch('/req', { method: 'POST', body: JSON.stringify(a.req) }); return r.json(); } return null; } } };
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const missing = []; page.on('response', (r) => { if (r.status() >= 400) missing.push(r.status() + ' ' + r.url()); });
  await page.goto(BASE + '/home.html');
  await page.waitForTimeout(5200);
  ok(await page.evaluate(() => document.documentElement.classList.contains('real')), 'real mode is on');
  ok(!(await page.evaluate(() => getComputedStyle(document.querySelector('.demo-chip')).display !== 'none')), 'demo chip hidden');

  // the setup goes to the helper
  await page.evaluate(() => { ET.store.set('et-items', JSON.stringify([{ name: 'YouTube', type: 'site', g: 'dis', color: '#f00', domain: '', exe: '' }, { name: 'Steam', type: 'app', g: 'dis', color: '#00f', domain: '', exe: '' }])); });
  let st = { data: null };
  for (let i = 0; i < 40 && !(st.data && st.data['et-items'] && st.data['et-items'].length === 2); i++) { await page.waitForTimeout(250); st = await post('/req', { op: 'get_state' }); } // a slow machine needs longer
  ok(st.data && st.data['et-items'] && st.data['et-items'].length === 2, 'items reached the helper');
  await post('/sim', { procs: [['steam.exe', 10], ['notepad.exe', 11]], fg: 'notepad.exe' });

  // 1. a locked session is explained first
  await page.evaluate(() => { ET.S.diff = 2; ET.S.min = 25; ET.S.name = 'Deep'; ET.S.blocks = new Set(['YouTube', 'Steam']); ET.startSession(); });
  await page.waitForSelector('.etb-card', { timeout: 3000 });
  const lines = await page.$$eval('.etb-card li', (l) => l.map((x) => x.textContent));
  log(lines.join('\n   '));
  ok(lines.length >= 3 && /emergency key/i.test(lines.join(' ')), 'warning mentions the emergency key');
  ok(/15 seconds/.test(lines.join(' ')), 'warning mentions the unsaved work');
  await page.waitForTimeout(600); await page.screenshot({ path: SP + '/real_warn.png' });
  ok(await page.$eval('.etb-row .go', (b) => b.disabled), 'start is disabled until agreed');
  let s0 = await status(); ok(!s0.session, 'nothing started before the agreement');
  await page.click('.etb-card input[type=checkbox]');
  await page.click('.etb-row .go');
  await page.waitForTimeout(4600);
  s0 = await status();
  ok(s0.session && s0.session.level === 2, 'locked session is running in the helper');
  ok(await page.evaluate(() => ET.run.on), 'the lake screen is up');
  let w = await world(); ok(w.hosts.includes('0.0.0.0 youtube.com'), 'youtube is in the hosts file');
  await page.waitForTimeout(3000);
  w = await world(); ok(w.killed.includes(10) && !w.killed.includes(11), 'steam was closed after the grace time, notepad left alone');
  ok(await page.isVisible('#etbEmerg'), 'the emergency key button is shown');
  await page.screenshot({ path: SP + '/real_session.png' });

  // 2. loosening is refused and rolled back
  await page.evaluate(() => ET.store.set('et-items', '[]'));
  await page.waitForTimeout(600);
  const toast = await page.textContent('#toastText');
  ok(/locked|заблок|нельзя|Not allowed/i.test(toast), 'the loosening edit was refused: ' + toast);
  await page.waitForTimeout(1500);
  st = await post('/req', { op: 'get_state' });
  ok(st.data['et-items'].length === 2, 'the helper kept the list');

  // 3. the way out: emergency key (default friction is hold)
  await page.waitForSelector('#etbEmerg', { timeout: 5000 });
  ok(await page.evaluate(() => ET.run.on), 'session still on after the reload');
  await page.click('#etbEmerg');
  await page.waitForSelector('.etb-card');
  const hb = await page.$('.etb-row .go');
  const box = await hb.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.waitForTimeout(3000); await page.mouse.up();
  await page.waitForTimeout(2500);
  s0 = await status();
  ok(!s0.session && s0.emergencyTotal === 1 && s0.emergencyLeft === 0, 'emergency key ended the session and was counted');
  w = await world(); ok(!w.hosts.includes('EYETIME BEGIN'), 'hosts file is clean again');
  ok(!(await page.evaluate(() => ET.run.on)), 'the lake screen closed');

  // 4. a second locked session with no key left is warned about it
  await page.evaluate(() => { ET.S.diff = 2; ET.startSession(); });
  await page.waitForSelector('.etb-card');
  const t2 = await page.$$eval('.etb-card li', (l) => l.map((x) => x.textContent).join(' '));
  ok(/NO emergency keys/.test(t2), 'warning says there are no keys left');
  await page.click('.etb-row button:not(.go)'); // go back
  await page.waitForTimeout(500);

  // 5. a normal session needs no ceremony to leave
  await page.evaluate(() => { ET.S.diff = 0; ET.S.min = 10; ET.startSession(); });
  await page.waitForTimeout(4600);
  ok((await status()).session?.level === 0, 'normal session running');
  await page.screenshot({ path: SP + '/real_normal.png' });
  await page.evaluate(() => document.querySelector('#leaveBtn').click());
  await page.waitForTimeout(1500);
  ok(!(await status()).session, 'left without ceremony');

  // 6. a locked rule is explained before it is kept
  await page.evaluate(() => ET.store.set('et-rules', JSON.stringify([{ id: 'r1', name: 'Work', kind: 'schedule', from: '09:00', to: '17:00', days: [0, 1, 2, 3, 4], block: 'dis', breaks: false, on: true, glyph: 'cal', level: 2, dur: 25 }])));
  await page.waitForSelector('.etb-card', { timeout: 3000 });
  ok(/Locked rule|Строгое/.test(await page.textContent('.etb-card h3')), 'locked rule is explained');
  await page.waitForTimeout(600); await page.screenshot({ path: SP + '/real_rule.png' });
  await page.click('.etb-row button:not(.go)'); // go back = not kept
  await page.waitForTimeout(1800);
  st = await post('/req', { op: 'get_state' });
  ok(!st.data['et-rules'] || st.data['et-rules'].length === 0, 'declined rule never reached the helper');

  // 7. a rule that would trap (no keys) is refused by the helper itself
  const page2 = page;
  await page2.waitForTimeout(500);
  const r = await post('/req', { op: 'set_state', keys: { 'et-protect': { emerg: 0, emergWeek: 0 }, 'et-rules': [{ id: 'x', name: 'Trap', level: 2, from: '00:00', to: '00:00', days: [0, 1, 2, 3, 4, 5, 6] }] } });
  ok(r.code === 'no_escape', 'a trap is refused by the helper');

  // 8. what is in front is counted and shows on Home
  await post('/sim', { fg: 'code.exe', procs: [] });
  await page.waitForTimeout(3500);
  s0 = await status(); ok((s0.today.secs['exe:code.exe'] || 0) > 0, 'time in front of code.exe is counted');
  // 9. settings: engine state, and "allow uninstalling" goes through the helper's challenge
  await page.evaluate(() => ET.go('settings'));
  await page.waitForSelector('#engTxt', { timeout: 5000 });
  await page.waitForTimeout(2500);
  ok(/running|работает/i.test(await page.textContent('#engTxt')), 'settings show the engine running: ' + await page.textContent('#engTxt'));
  ok((await post('/req', { op: 'uninstall' })).code === 'challenge', 'uninstall is refused before permission');
  await page.waitForSelector('#etbUninst button');
  await page.click('#etbUninst button');
  await page.waitForSelector('.etb-card .go');
  const hb2 = await page.$('.etb-row .go'); const bx = await hb2.boundingBox();
  await page.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2); await page.mouse.down(); await page.waitForTimeout(3000); await page.mouse.up();
  await page.waitForTimeout(1500);
  ok((await post('/req', { op: 'uninstall' })).ok, 'uninstall is allowed after the challenge');
  // 10. the app PIN card in the protection tab
  await page.evaluate(() => ET.go('rules'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => ET.rulesTab('protect'));
  await page.waitForSelector('#etbPinCard', { timeout: 5000 });
  await page.click('#etbPinCard button');
  await page.waitForSelector('.etb-card input');
  await page.fill('.etb-card input', '4821');
  await page.click('.etb-row .go');
  await page.waitForTimeout(1200);
  ok((await status()).pinSet === true, 'the PIN was set in the helper');
  ok(!(await page.evaluate(() => JSON.stringify(Object.entries(localStorage)).includes('4821'))), 'the PIN is nowhere in the saved settings');
  // 11. updates: the chip, the sheet, a locked block that makes it wait, then the install when it is quiet
  ok((await post('/req', { op: 'start_session', name: 'Deep', minutes: 3, level: 2, blocks: ['youtube.com'], scene: 'cave', allow_breaks: false, dnd: false, mute: false, close_now: false })).ok, 'a locked session is running for the update test');
  await post('/sim', { update: { phase: 'ready', version: '0.2.0', notes: ['Updates by themselves', 'Calmer charts'], size: 6815744, ago: 60000 } });
  await page.waitForSelector('#updChip.on', { timeout: 6000 });
  ok(/0\.2\.0|ready|Update/i.test(await page.textContent('#updChip')), 'the update chip shows up');
  await page.evaluate(() => document.getElementById('updChip').click());
  await page.waitForSelector('.upd-card', { timeout: 3000 });
  ok((await page.$$eval('.upd-notes li', (l) => l.length)) === 2, 'the sheet lists what is new');
  ok((await page.textContent('.upd-card')).includes('0.2.0'), 'the sheet names the new version');
  await page.evaluate(() => document.querySelector('.upd-card .go').click());
  await page.waitForTimeout(2500);
  ok((await status()).update.waitingForLock === true && (await world()).launched === 0, 'a locked block makes the update wait, nothing is started');
  ok(/locked block/i.test(await page.textContent('.upd-msg')), 'the sheet says why it waits');
  await page.waitForTimeout(12000);
  ok((await world()).launched === 1 && (await status()).update.state === 'installing', 'when the block is over the installer is started once');
  await page.waitForTimeout(800); await page.screenshot({ path: SP + '/real_update.png' });
  await post('/sim', { updated: { from: '0.1.0', to: '0.2.0', notes: ['Updates by themselves'] } });
  await page.keyboard.press('Escape');
  await page.waitForSelector('.upd-done', { timeout: 8000 });
  ok(/0\.2\.0/.test(await page.textContent('.upd-done')), 'after the update the window says what is new');
  await page.evaluate(() => document.querySelector('.upd-done .go').click()); await page.waitForTimeout(1200);
  ok((await status()).update.updated === null, 'the what-is-new is shown once');
  ok(errs.length === 0, 'no page errors: ' + errs.slice(0, 3).join(' | ') + (missing.length ? ' [' + missing.slice(0, 4).join(' ; ') + ']' : ''));
  await browser.close();
  log(failed ? `${failed} FAILED` : 'ALL OK');
  process.exit(failed ? 1 : 0);
})();
