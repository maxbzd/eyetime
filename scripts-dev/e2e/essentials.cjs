// Settings show the essentials first: advanced groups and rows are hidden (and listed in a note), "All settings" and search show everything, what the person already uses
// stays visible, and "Make it calm again" brings back the designed look with an Undo.
//   node scripts-dev/e2e/essentials.cjs
const { launch } = require('./lib.cjs');

(async () => {
  const app = await launch({ viewport: { width: 1280, height: 900 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [];
  const ok = (c, m) => { if (!c) bad.push(m); };
  const o = await app.ctx.newPage();
  o.on('pageerror', (e) => bad.push('pageerror: ' + e)); o.on('console', (m) => { if (m.type() === 'error') bad.push('console: ' + m.text()); });
  await o.goto(ext('src/options/options.html')); await o.waitForTimeout(800);
  await o.evaluate(async () => { localStorage.setItem('et-settings-mode', 'essentials'); const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.onboarded = true; s.language = 'en'; }); await st.setRaw({ gsDismissed: true }); });
  const get = (k) => o.evaluate(async (k) => (await chrome.storage.local.get(k))[k], k);
  const visibleRows = () => o.evaluate(() => [...document.querySelectorAll('section.sec:not([hidden]) .setting')].filter((r) => r.offsetParent !== null).length);
  const sections = ['general', 'home', 'appearance', 'focus', 'blocking', 'eye', 'tracking', 'data', 'about'];
  const count = async () => { let n = 0; for (const id of sections) { await o.goto(ext('src/options/options.html#' + id)); await o.waitForTimeout(350); n += await visibleRows(); } return n; };

  // 1. the essentials are the default
  await o.goto(ext('src/options/options.html#general')); await o.reload(); await o.waitForTimeout(900);
  ok(await o.locator('#content.simple').count() === 1, 'the essentials are shown');
  ok(await o.locator('#mode button[aria-pressed="true"]', { hasText: 'Essentials' }).count() === 1, 'and the switch says so');
  ok(await o.locator('.setting-title', { hasText: 'Language' }).isVisible(), 'the language is there');
  ok(!(await o.locator('.setting-title', { hasText: 'Show the dock on websites' }).isVisible()), 'the dock is not');
  const note = o.locator('.simple-note:visible');
  ok(await note.isVisible() && /essentials/i.test(await note.innerText()) && /\(\+\d+\)/.test(await note.innerText()), 'a note says something is hidden and how many: ' + (await note.innerText()));
  await o.goto(ext('src/options/options.html#appearance')); await o.waitForTimeout(500);
  const subs = await o.locator('#side .side-sub a').allInnerTexts();
  ok(subs.length >= 2 && !subs.includes('Advanced') && !subs.includes('Type & shape'), 'the side list leaves out what is hidden: ' + subs.join(' | '));
  ok(await o.locator('.setting-title', { hasText: 'Make it calm again' }).count() + await o.getByRole('button', { name: 'Make it calm again' }).count() >= 1, 'Appearance offers the calm default');

  // 2. how much is hidden
  const few = await count();
  await o.evaluate(() => localStorage.setItem('et-settings-mode', 'all')); await o.reload(); await o.waitForTimeout(600);
  const many = await count();
  console.log(`rows shown: ${few} in the essentials, ${many} in all`);
  ok(many - few >= 30 && few <= many * 0.7, `the essentials are clearly fewer: ${few} of ${many}`);

  // 3. all settings, from the note and from the switch; remembered
  await o.evaluate(() => localStorage.setItem('et-settings-mode', 'essentials')); await o.goto(ext('src/options/options.html#general')); await o.reload(); await o.waitForTimeout(800);
  await o.locator('.simple-note:visible button').click(); await o.waitForTimeout(400);
  ok(await o.locator('#content.simple').count() === 0 && await o.locator('.setting-title', { hasText: 'Show the dock on websites' }).isVisible(), 'the note shows everything');
  ok((await o.evaluate(() => localStorage.getItem('et-settings-mode'))) === 'all', 'and it is remembered');
  await o.reload(); await o.waitForTimeout(700);
  ok(await o.locator('#mode button[aria-pressed="true"]', { hasText: 'All settings' }).count() === 1, 'after a reload too');
  await o.locator('#mode button', { hasText: 'Essentials' }).click(); await o.waitForTimeout(300);
  ok(await o.locator('#content.simple').count() === 1, 'the switch goes back');

  // 4. search looks through everything
  await o.locator('#q').fill('dock'); await o.waitForTimeout(400);
  ok(await o.locator('.setting-title', { hasText: 'Show the dock on websites' }).isVisible(), 'a search finds a hidden setting');
  ok(await o.locator('#content.simple').count() === 0, 'and the page is not in the essentials while searching');
  await o.locator('#q').fill(''); await o.waitForTimeout(300);

  // 5. what is in use stays: a dock, a changed reminder, a calendar subscription
  await o.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.dock.enabled = true; s.focus.reminders = [{ id: 'a', time: '09:00', days: [1, 2], minutes: 25 }]; }); await st.setRaw({ calendarSubs: [{ id: 'x', title: 'Work' }] }); });
  await o.goto(ext('src/options/options.html#general')); await o.reload(); await o.waitForTimeout(900);
  ok(await o.locator('#content.simple').count() === 1 && await o.locator('.setting-title', { hasText: 'Show the dock on websites' }).isVisible(), 'a dock that is on stays visible');
  await o.goto(ext('src/options/options.html#focus')); await o.waitForTimeout(500);
  ok(await o.locator('.setting-title', { hasText: 'Focus reminders' }).isVisible() && !(await o.locator('.setting-title', { hasText: 'Focus modes' }).isVisible()), 'a changed setting stays, an untouched one does not');
  await o.goto(ext('src/options/options.html#data')); await o.waitForTimeout(500);
  ok(await o.locator('h3.group-title', { hasText: 'Calendar' }).isVisible() && !(await o.locator('h3.group-title', { hasText: 'Sync' }).isVisible()), 'a calendar in use stays');
  ok(await o.locator('h3.group-title', { hasText: 'Anonymous usage' }).isVisible() && await o.locator('h3.group-title', { hasText: 'Danger zone' }).isVisible(), 'privacy and the danger zone are always there');

  // 6. "Make it calm again": the designed look back, tasks, widgets and light/dark kept, Undo takes it back
  await o.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { Object.assign(s.appearance, { look: 'noir', mode: 'dark', density: 'compact', font: 'mono' }); s.newtab.layout = 'center'; s.newtab.background = 'dusk'; s.newtab.widgets = [{ id: 'w1', kind: 'clock', cfg: {} }]; }); });
  await o.goto(ext('src/options/options.html#appearance')); await o.reload(); await o.waitForTimeout(900);
  await o.getByRole('button', { name: 'Make it calm again' }).click(); await o.waitForTimeout(900);
  let st = await o.evaluate(async () => (await chrome.storage.local.get('settings')).settings);
  ok(st.appearance.look === 'calm' && st.appearance.density === 'comfortable' && st.appearance.font === 'look' && st.newtab.layout === 'today' && st.newtab.background === 'look', 'the designed look is back: ' + JSON.stringify([st.appearance.look, st.appearance.density, st.newtab.layout, st.newtab.background]));
  ok(st.appearance.mode === 'dark' && st.newtab.widgets.length === 1, 'dark mode and the widgets stay');
  await o.locator('.toast').getByRole('button', { name: 'Undo' }).dispatchEvent('click'); await o.waitForTimeout(900);
  st = await o.evaluate(async () => (await chrome.storage.local.get('settings')).settings);
  ok(st.appearance.look === 'noir' && st.appearance.font === 'mono' && st.newtab.layout === 'center' && st.newtab.background === 'dusk', 'Undo brings it all back');

  // 7. the same button in the Home drawer
  const home = await app.ctx.newPage(); await home.goto(ext('src/newtab/newtab.html')); await home.waitForTimeout(1800);
  await home.locator('#customize').dispatchEvent('click'); await home.waitForTimeout(600);
  await home.locator('#drawerBody').getByRole('button', { name: 'Make it calm again' }).dispatchEvent('click'); await home.waitForTimeout(1500);
  st = await o.evaluate(async () => (await chrome.storage.local.get('settings')).settings);
  ok(st.appearance.look === 'calm' && st.newtab.layout === 'today', 'the drawer button does the same');
  ok(await home.locator('.toast').getByRole('button', { name: 'Undo' }).count() === 1, 'with an Undo');

  await app.close();
  if (bad.length) { console.log('FAIL\n' + [...new Set(bad)].join('\n')); process.exit(1); }
  console.log('essentials: all checks passed');
})();
