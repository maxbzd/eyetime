// The day as one story on Home (Today): the morning card, the quiet line while working, a session never interrupted by a card, the evening card, the closed day, "not today", "in an hour".
// Time is fixed with the browser's clock so the parts of the day are the same on every run.
//   node scripts-dev/e2e/ritual.cjs
const { launch } = require('./lib.cjs');

(async () => {
  const app = await launch({ viewport: { width: 1280, height: 900 }, ritual: true });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [];
  const ok = (c, m) => { if (!c) bad.push(m); };
  const at = (h, m = 0) => app.ctx.clock.setFixedTime(new Date(2026, 10, 4, h, m));
  await at(9, 30);
  const o = await app.ctx.newPage();
  o.on('pageerror', (e) => bad.push('pageerror: ' + e)); o.on('console', (m) => { if (m.type() === 'error') bad.push('console: ' + m.text()); });
  await o.goto(ext('src/options/options.html')); await o.waitForTimeout(800);
  const today = '2026-11-04';
  await o.evaluate(async (today) => {
    const st = await import('/src/shared/storage.js');
    await st.updateSettings((s) => { s.onboarded = true; s.language = 'en'; }); await st.setRaw({ gsDismissed: true });
    await st.setCollection('tasks', [
      { id: 'a', text: 'Write the quarterly report', done: false, starred: true, createdAt: 5, est: 45 },
      { id: 'b', text: 'Review the pull requests', done: false, starred: false, createdAt: 4, due: today, est: 25 },
      { id: 'c', text: 'Call the dentist', done: false, starred: false, createdAt: 3, due: '2026-11-01' },
      { id: 'd', text: 'Plan the team offsite', done: false, starred: false, createdAt: 2 },
      { id: 'e', text: 'Book flights', done: false, starred: false, createdAt: 1 }]);
  }, today);
  const get = (k) => o.evaluate(async (k) => (await chrome.storage.local.get(k))[k], k);
  const tasks = () => get('tasks');
  const rt = async () => ((await get('d:' + today)) || {}).rt || {};
  const home = await app.ctx.newPage(); home.on('pageerror', (e) => bad.push('home pageerror: ' + e));
  await home.goto(ext('src/newtab/newtab.html')); await home.waitForTimeout(2200);
  const card = home.locator('#tdRitual');

  // 1. morning
  ok(await card.getAttribute('data-phase') === 'morning' && await card.isVisible(), 'in the morning the card is there');
  ok(/What matters today/.test(await card.innerText()), 'it asks what matters');
  const rows = card.locator('.rt-row');
  ok(await rows.count() === 5, 'five tasks to choose from: ' + await rows.count());
  ok(await card.locator('.rt-row.on').count() === 3, 'three are chosen already (a priority, an overdue, one due today)');
  ok((await card.locator('.rt-row.on .rt-slot').count()) === 3, 'each chosen one has a time that fits the day: ' + (await card.locator('.rt-row.on .rt-slot').allInnerTexts()).join(' | '));
  ok(await card.locator('.rt-remind').isVisible(), 'and a switch to be reminded at those times');
  ok(await home.locator('body.td-card').count() === 1, 'the page makes room (a smaller clock)');
  // a fourth is not accepted; dropping one makes room
  await card.locator('.rt-row', { hasText: 'Book flights' }).dispatchEvent('click'); await home.waitForTimeout(300);
  ok(/Three is plenty/.test(await card.locator('.rt-hint').innerText()) && await card.locator('.rt-row.on').count() === 3, 'a fourth is refused, kindly');
  await card.locator('.rt-row', { hasText: 'Call the dentist' }).dispatchEvent('click'); await home.waitForTimeout(300);
  await card.locator('.rt-row', { hasText: 'Book flights' }).dispatchEvent('click'); await home.waitForTimeout(300);
  ok(await card.locator('.rt-row.on').count() === 3 && await card.locator('.rt-row.on', { hasText: 'Book flights' }).count() === 1, 'dropping one lets another in');
  // adding something new
  await card.locator('.rt-row', { hasText: 'Book flights' }).dispatchEvent('click'); await home.waitForTimeout(250);
  await card.locator('.rt-add').fill('Pay the invoice 15m'); await card.locator('.rt-add').press('Enter'); await home.waitForTimeout(900);
  ok(await card.locator('.rt-row', { hasText: 'Pay the invoice' }).count() === 1 && await card.locator('.rt-row.on', { hasText: 'Pay the invoice' }).count() === 1, 'a new task is added and chosen: ' + (await card.innerText()).slice(0, 200));
  ok((await tasks()).some((x) => x.text === 'Pay the invoice' && x.est === 15 && !x.starred), 'and kept, with the length it was written with');

  // 2. start the day
  const chosen = await card.locator('.rt-row.on .rt-t').allInnerTexts();
  await card.getByRole('button', { name: 'Start the day' }).dispatchEvent('click'); await home.waitForTimeout(1500);
  const list = await tasks(), starred = list.filter((x) => x.starred).map((x) => x.text).sort();
  ok(JSON.stringify(starred) === JSON.stringify([...chosen].sort()), 'exactly the chosen three are the priorities: ' + starred.join(', '));
  ok(list.filter((x) => starred.includes(x.text)).every((x) => x.at && x.atDay === today), 'and they have today\'s times (reminders)');
  const r1 = await rt();
  ok(r1.p > 0 && r1.top.length === 3 && !r1.c, 'the morning is recorded with the order of the three');
  ok(await card.getAttribute('data-phase') === 'work' && await card.locator('.rt-pill').isVisible() && /0\/3/.test(await card.innerText()) && /Next:/.test(await card.innerText()), 'the card gives way to one quiet line: ' + (await card.innerText()).replace(/\n/g, ' '));
  ok(await home.locator('body.td-card').count() === 0, 'and the page is as it was');

  // 3. work: finishing one moves the line; a session is never interrupted by a card
  await o.evaluate(async (id) => { const st = await import('/src/shared/storage.js'); const l = await st.getCollection('tasks', []); const x = l.find((y) => y.id === id); x.done = true; x.doneAt = Date.now(); await st.setCollection('tasks', l); }, list.find((x) => x.text === chosen[0])?.id || 'a');
  await home.waitForTimeout(1200);
  ok(/1\/3/.test(await card.innerText()), 'one done: 1/3');
  await at(18, 30);
  // (the worker has the real clock, the pages the test's: the session is made in the page, with the test's time)
  await home.evaluate(async () => { const f = await import('/src/shared/focus.js'); await chrome.storage.local.set({ focus: f.createSession({ minutes: 25, goal: 'deep work' }) }); }); await home.waitForTimeout(1500);
  await home.reload(); await home.waitForTimeout(2200);
  ok(await card.getAttribute('data-phase') === 'work' && await home.locator('body.td-card').count() === 0, 'at 18:30 with a session running: no card, the session is not interrupted');
  await home.evaluate(async () => { await chrome.storage.local.set({ focus: null }); }); await home.waitForTimeout(2000);

  // 4. evening
  ok(await card.getAttribute('data-phase') === 'evening' && /Close the day/.test(await card.innerText()), 'when the session ends the evening card comes: ' + await card.getAttribute('data-phase'));
  ok(await home.locator('body.td-evening').count() === 1 && !(await home.locator('#focus').isVisible()), 'the line of intent steps aside');
  await card.getByRole('button', { name: 'In an hour' }).dispatchEvent('click'); await home.waitForTimeout(900);
  ok(await card.getAttribute('data-phase') === 'work', '"in an hour" puts it away');
  await home.reload(); await home.waitForTimeout(2200);
  ok(await card.getAttribute('data-phase') === 'work', 'and it stays away after a reload');
  await o.evaluate(() => { try { localStorage.clear(); } catch { /* none */ } });
  await home.evaluate(() => localStorage.removeItem('et-ritual-later')); await home.reload(); await home.waitForTimeout(2200);
  ok(await card.getAttribute('data-phase') === 'evening', 'the evening is back when asked for again');
  await card.locator('input[aria-label="What went well today?"], .sd-form input.input').first().fill('Shipped the report');
  await card.getByRole('button', { name: 'Close the day' }).last().dispatchEvent('click'); await home.waitForTimeout(1500);
  const r2 = await rt(), d = await get('d:' + today);
  ok(r2.c > 0 && Array.isArray(r2.next) && d.w === 'Shipped the report', 'the day is closed with its win: ' + JSON.stringify(r2));
  ok(await card.getAttribute('data-phase') === 'closed' && /Day closed/.test(await card.innerText()) && /Tomorrow:/.test(await card.innerText()), 'one quiet line says so, with tomorrow: ' + (await card.innerText()).replace(/\n/g, ' '));
  await card.getByRole('button', { name: 'Reopen' }).dispatchEvent('click'); await home.waitForTimeout(1500);
  ok(!(await rt()).c && await card.getAttribute('data-phase') === 'evening', 'reopening brings the evening back');

  // 5. a new morning: "not today" is respected
  await at(9, 0);
  await o.evaluate(async (today) => { await chrome.storage.local.remove('d:' + today); }, today);
  await home.reload(); await home.waitForTimeout(2200);
  ok(await card.getAttribute('data-phase') === 'morning', 'a fresh morning');
  await card.getByRole('button', { name: 'Not today' }).dispatchEvent('click'); await home.waitForTimeout(1200);
  ok((await rt()).s > 0 && await card.getAttribute('data-phase') === 'work', '"not today" is recorded and the card is gone');
  await home.reload(); await home.waitForTimeout(2200);
  ok(await card.getAttribute('data-phase') === 'work', 'and it does not come back');

  // 6. after a session the break leads to what matters next
  await o.evaluate(async () => { const st = await import('/src/shared/storage.js'); const f = await import('/src/shared/focus.js'); await st.setRaw({ rest: f.createRest({ minutes: 5 }) }); });
  await home.waitForTimeout(1500);
  ok(/Next:/.test(await home.locator('#focus').innerText()), 'the break says what is next: ' + (await home.locator('#focus').innerText()).replace(/\n/g, ' '));

  // 7. off: the ritual can be switched off
  await o.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.setRaw({ rest: null }); await st.updateSettings((s) => { s.ritual.on = false; }); });
  await home.waitForTimeout(1200);
  ok(await card.isHidden(), 'switched off: nothing');

  await app.close();
  if (bad.length) { console.log('FAIL\n' + [...new Set(bad)].join('\n')); process.exit(1); }
  console.log('ritual: all checks passed');
})();
