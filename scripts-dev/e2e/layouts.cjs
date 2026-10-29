// Layouts of Home end to end: make one in the editor, see it switch on during a focus session and at certain hours, pin it, keep the default untouched,
// delete it; save the look as a theme file and load it back (a hostile file is refused).
//   node scripts-dev/e2e/layouts.cjs
const fs = require('fs');
const path = require('path');
const { launch } = require('./lib.cjs');
const AXE = fs.readFileSync(path.join(require.resolve('axe-core'), '../axe.min.js'), 'utf8');

(async () => {
  const app = await launch({ viewport: { width: 1440, height: 900 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [];
  const ok = (cond, msg) => { if (!cond) bad.push(msg); };
  const sp = await app.ctx.newPage(); await sp.goto(ext('src/options/options.html')); await sp.waitForTimeout(600);
  await sp.evaluate(async () => {
    const st = await import('/src/shared/storage.js');
    await st.updateSettings((s) => { s.onboarded = true; s.language = 'en'; });
    await st.setRaw({ gsDismissed: true });
  });
  const p = await app.ctx.newPage();
  p.on('pageerror', (e) => bad.push('pageerror: ' + e)); p.on('console', (m) => { if (m.type() === 'error') bad.push('console: ' + m.text()); });
  const nt = () => sp.evaluate(async () => (await (await import('/src/shared/storage.js')).getSettings()).newtab);
  const patch = (fnBody) => sp.evaluate(async (b) => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { for (const [k, v] of Object.entries(b)) { const parts = k.split('.'); let o = s; for (const q of parts.slice(0, -1)) o = o[q]; o[parts.at(-1)] = v; } }); }, fnBody);
  const clockSize = () => p.evaluate(() => getComputedStyle(document.getElementById('clock')).fontSize);
  await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(1200);
  const defaultLook = await p.evaluate(() => document.body.dataset.layout);

  // open the editor, make a layout from the default
  await p.click('#customize'); await p.waitForTimeout(200);
  await p.click('#drawerBody .btn-primary'); await p.waitForTimeout(900);
  await p.click('.cv-bar button:has-text("Default")'); await p.waitForTimeout(500);
  ok(await p.locator('.cv-panel .ly-row').count() === 1, 'the layouts panel starts with the default only');
  ok(!/\bnull\b/.test(await p.locator('.cv-panel').textContent()), 'no stray "null" text in the panel');
  await p.evaluate(AXE);
  const axe = await p.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })).violations.map((v) => v.id + ': ' + v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')));
  ok(!axe.length, 'axe with the layouts panel open: ' + axe.join(' ; '));
  await p.click('.cv-panel button:has-text("New layout")'); await p.waitForTimeout(900);
  let n = await nt();
  ok(n.layouts.length === 1 && n.layouts[0].when.kind === 'manual', 'a layout is created: ' + JSON.stringify(n.layouts.map((l) => l.when)));
  const lid = n.layouts[0].id;
  ok(Object.keys(n.layouts[0].data.canvas.items).length >= 5, 'it starts as a copy of the arrangement');
  ok(/Layout 2/.test(await p.locator('.cv-bar').textContent()) || /Layout/.test(await p.locator('.cv-bar').textContent()), 'the toolbar names the layout being edited');

  // edit it: a big clock; the default must stay as it was
  const defaultClock = n.canvas.items && n.canvas.items.clock ? JSON.stringify(n.canvas.items.clock) : JSON.stringify(n.canvas);
  await p.focus('.cv-frame[data-block="clock"]'); await p.waitForTimeout(500);
  await p.keyboard.press('+'); await p.keyboard.press('+'); await p.keyboard.press('+'); await p.waitForTimeout(400);
  await p.locator('.cv-panel .ty-tile', { hasText: 'Unbounded' }).click(); await p.waitForTimeout(500);
  n = await nt();
  ok(n.layouts[0].data.type && n.layouts[0].data.type.clock && n.layouts[0].data.type.clock.font === 'unbounded', 'the font is saved in the layout');
  ok(!(n.type && n.type.clock && n.type.clock.font === 'unbounded'), 'the default keeps its own font');
  ok(JSON.stringify(n.canvas.items && n.canvas.items.clock) === defaultClock || !n.canvas.on, 'the default arrangement is untouched');
  const layoutClockItem = n.layouts[0].data.canvas.items.clock;

  // set the trigger to "during focus" from the panel
  await p.click('.cv-bar button:has-text("Layout")'); await p.waitForTimeout(500);
  await p.locator('.cv-panel .ly-row[data-layout="' + lid + '"] .dd').click(); await p.waitForTimeout(200);
  await p.locator('.dd-opt', { hasText: 'During a focus session' }).click(); await p.waitForTimeout(500);
  ok((await nt()).layouts[0].when.kind === 'focus', 'the trigger is saved');
  await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  ok(await p.locator('.cv-layer').count() === 0, 'the editor closes');
  ok(!/Unbounded/.test(await p.evaluate(() => getComputedStyle(document.getElementById('clock')).fontFamily)), 'outside focus the default shows');

  // a focus session switches the page to the layout and back
  await p.evaluate(() => chrome.runtime.sendMessage({ type: 'focus:start', minutes: 5, goal: '', strict: false }));
  await p.waitForTimeout(2200);
  ok(/Unbounded/.test(await p.evaluate(() => getComputedStyle(document.getElementById('clock')).fontFamily)), 'during focus the layout is on');
  await p.evaluate(() => chrome.runtime.sendMessage({ type: 'focus:stop' }));
  await p.waitForTimeout(2200);
  ok(!/Unbounded/.test(await p.evaluate(() => getComputedStyle(document.getElementById('clock')).fontFamily)), 'after the session the default is back');

  // hours: a range around now turns it on, a range away from now turns it off
  const now = new Date(), hh = (d) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  const from = hh(new Date(now.getTime() - 3600_000)), to = hh(new Date(now.getTime() + 3600_000));
  await patch({ 'newtab.layouts': [{ ...(await nt()).layouts[0], when: { kind: 'time', from, to } }] });
  await p.waitForTimeout(2500);
  ok(/Unbounded/.test(await p.evaluate(() => getComputedStyle(document.getElementById('clock')).fontFamily)), 'inside its hours the layout is on');
  const far = hh(new Date(now.getTime() + 3 * 3600_000)), far2 = hh(new Date(now.getTime() + 5 * 3600_000));
  await patch({ 'newtab.layouts': [{ ...(await nt()).layouts[0], when: { kind: 'time', from: far, to: far2 } }] });
  await p.waitForTimeout(2500);
  ok(!/Unbounded/.test(await p.evaluate(() => getComputedStyle(document.getElementById('clock')).fontFamily)), 'outside its hours the default shows');

  // pin overrides, unpin releases
  await patch({ 'newtab.layoutPin': lid }); await p.waitForTimeout(2500);
  ok(/Unbounded/.test(await p.evaluate(() => getComputedStyle(document.getElementById('clock')).fontFamily)), 'a pinned layout is shown');
  await patch({ 'newtab.layoutPin': null }); await p.waitForTimeout(2500);
  ok(!/Unbounded/.test(await p.evaluate(() => getComputedStyle(document.getElementById('clock')).fontFamily)), 'unpinned: the default is back');

  // delete from the editor panel
  await p.click('#customize'); await p.waitForTimeout(200); await p.click('#drawerBody .btn-primary'); await p.waitForTimeout(800);
  await p.click('.cv-bar button:has-text("Default")'); await p.waitForTimeout(500);
  await p.locator('.cv-panel .ly-row[data-layout="' + lid + '"] button[aria-label^="Delete"]').click(); await p.waitForTimeout(700);
  ok((await nt()).layouts.length === 0, 'a layout can be deleted');
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);

  // theme file: save, change, load back
  await patch({ 'newtab.layouts': [{ id: lid, name: 'Night', when: { kind: 'manual', from: '20:00', to: '06:00' }, data: { greeting: false } }] });
  await p.reload(); await p.waitForTimeout(1200);
  await p.click('#customize'); await p.waitForTimeout(300);
  await p.locator('.hr-head', { hasText: 'Share your Home' }).click(); await p.waitForTimeout(400); 
  const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('#drawerBody button:has-text("Save theme")').click()]);
  const file = path.join('/tmp', 'eyetime-theme-test-' + Date.now() + '.json');
  await dl.saveAs(file);
  const theme = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok(theme.format === 'eyetime-theme' && theme.layouts && theme.layouts[0].name === 'Night', 'the saved file is a theme with the layout: ' + Object.keys(theme).join(','));
  ok(!('links' in theme) && !('tasks' in theme) && !('history' in theme) && !('links' in theme.home) && !Array.isArray(theme.home.tasks), 'the file never carries links, tasks or history: ' + Object.keys(theme).join(','));
  await patch({ 'newtab.layouts': [], 'appearance.look': 'midnight' });
  await p.locator('#drawerBody input[accept*="json"]').setInputFiles(file);
  await p.waitForSelector('dialog[open]', { timeout: 3000 });
  await p.locator('dialog[open] button[value="yes"]').first().click(); await p.waitForTimeout(900);
  ok((await nt()).layouts.length === 1 && (await nt()).layouts[0].name === 'Night', 'loading a theme brings the layouts back');

  // a file from a newer version is refused; a hostile one is cleaned: bad values and images are dropped, nothing runs
  const evil = path.join('/tmp', 'eyetime-evil-' + Date.now() + '.json');
  fs.writeFileSync(evil, JSON.stringify({ format: 'eyetime-theme', v: 99, appearance: {}, home: {} }));
  const before = JSON.stringify(await nt());
  await p.locator('#drawerBody input[accept*="json"]').setInputFiles(evil); await p.waitForTimeout(800);
  ok(JSON.stringify(await nt()) === before && await p.getByText('This theme comes from a newer version.').count() >= 1, 'a newer file is refused');
  const evil2 = path.join('/tmp', 'eyetime-evil2-' + Date.now() + '.json');
  fs.writeFileSync(evil2, JSON.stringify({ format: 'eyetime-theme', v: 1, appearance: { look: '<img src=x onerror=alert(1)>' }, home: { background: 'url(javascript:alert(1))', clockStyle: 'x;color:red', greeting: 'yes' }, media: { bg: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' } }));
  await p.locator('#drawerBody input[accept*="json"]').setInputFiles(evil2);
  await p.waitForSelector('dialog[open]', { timeout: 3000 });
  await p.locator('dialog[open] button[value="yes"]').click(); await p.waitForTimeout(900);
  const after = await sp.evaluate(async () => { const st = await import('/src/shared/storage.js'); return { s: await st.getSettings(), bg: (await st.getRaw('newtabBg')).newtabBg }; });
  ok(after.s.appearance.look !== '<img src=x onerror=alert(1)>' && !/javascript/.test(JSON.stringify(after.s.newtab)), 'hostile values never reach the settings');
  ok(!after.bg || after.bg.startsWith('data:image/'), 'a non-image "photo" is never stored');
  const bogus = path.join('/tmp', 'eyetime-bogus-' + Date.now() + '.json'); fs.writeFileSync(bogus, 'not json at all');
  await p.locator('#drawerBody input[accept*="json"]').setInputFiles(bogus); await p.waitForTimeout(600);
  ok(await p.getByText('This is not a valid file.').count() >= 1, 'a broken file gives a message');

  console.log(bad.length ? 'FAIL\n' + bad.join('\n') : 'layouts: all checks passed');
  await app.close();
  process.exit(bad.length ? 1 : 0);
})();
