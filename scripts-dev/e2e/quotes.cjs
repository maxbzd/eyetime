// Quotes: on Home under the greeting, on the pause page and the break screen, before a session starts (when switched on) — each in the language of the interface,
// each switchable in Settings, and the Home quote is a block the editor can move.
//   node scripts-dev/e2e/quotes.cjs
const { launch } = require('./lib.cjs');

(async () => {
  const app = await launch({ viewport: { width: 1440, height: 900 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [];
  const ok = (c, m) => { if (!c) bad.push(m); };
  const sp = await app.ctx.newPage(); await sp.goto(ext('src/options/options.html')); await sp.waitForTimeout(600);
  const patch = (b) => sp.evaluate(async (b) => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { for (const [k, v] of Object.entries(b)) { const parts = k.split('.'); let o = s; for (const q of parts.slice(0, -1)) o = o[q]; o[parts.at(-1)] = v; } }); }, b);
  await patch({ onboarded: true, language: 'en' });
  await sp.evaluate(async () => (await import('/src/shared/storage.js')).setRaw({ gsDismissed: true }));
  const errs = [];
  const open = async (page) => { const p = await app.ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e))); await p.goto(ext(page)); await p.waitForTimeout(1200); return p; };
  const quote = (p) => p.evaluate(() => { const f = document.getElementById('quote') || document.querySelector('.focus-quote'); return f && !f.hidden ? { text: f.querySelector('.q-text').textContent, by: f.querySelector('.q-by').textContent } : null; });

  // Home: shown by default, with an author, in English
  let home = await open('src/newtab/newtab.html');
  let q = await quote(home);
  ok(q && /^“.+”$/.test(q.text) && /^— .+/.test(q.by), 'Home shows a quote with its author: ' + JSON.stringify(q));
  // it is the same all day (a new one each day), and a different language gives that language's own text
  const again = await quote(await open('src/newtab/newtab.html'));
  ok(again && again.text === q.text, 'the daily quote does not change between openings');
  await patch({ language: 'ja' });
  home = await open('src/newtab/newtab.html'); q = await quote(home);
  ok(q && /^「.+」$/.test(q.text) && /[ぁ-んァ-ン一-龥]/.test(q.text), 'in Japanese the quote is a Japanese text in Japanese marks: ' + JSON.stringify(q));
  await patch({ language: 'de' });
  q = await quote(await open('src/newtab/newtab.html'));
  ok(q && /^„.+“$/.test(q.text), 'German marks: ' + JSON.stringify(q));
  await patch({ language: 'en' });

  // switched off in Settings: gone
  await patch({ 'quotes.home': false });
  ok(!(await quote(await open('src/newtab/newtab.html'))), 'Home shows no quote when the Home switch is off');
  await patch({ 'quotes.home': true, 'quotes.on': false });
  ok(!(await quote(await open('src/newtab/newtab.html'))), 'nothing is shown when quotes are off altogether');
  await patch({ 'quotes.on': true });

  // the pause page (a distracting site, friction on): a quote in the pause-page set; the break screen: a rest quote
  await patch({ 'blocking.friction.enabled': true });
  const pause = await app.ctx.newPage(); await pause.goto('http://reddit.com/x').catch(() => {}); await pause.waitForTimeout(1800);
  q = await quote(pause);
  ok(pause.url().includes('r=friction') && q && q.text.length > 10, 'the pause page shows a quote: ' + pause.url().slice(0, 80) + ' ' + JSON.stringify(q));
  const brk = await open('src/break/break.html'); q = await quote(brk);
  ok(q && q.text.length > 10, 'the break screen shows a quote: ' + JSON.stringify(q));
  await patch({ 'quotes.rest': false });
  ok(!(await quote(await open('src/break/break.html'))), 'the break screen follows its own switch');
  await patch({ 'quotes.rest': true });

  // before a session: off by default, on when asked
  home = await open('src/newtab/newtab.html');
  ok(!(await home.evaluate(() => !!document.querySelector('.focus-quote'))), 'no quote before a session by default');
  await patch({ 'quotes.start': true });
  home = await open('src/newtab/newtab.html');
  ok(await home.evaluate(() => !!document.querySelector('.focus-quote .q-text')?.textContent), 'a quote before a session when switched on');
  await patch({ 'quotes.start': false });

  // Settings: the group is there and its switches write the settings
  const set = await open('src/options/options.html#home');
  ok(await set.locator('.group-title', { hasText: 'Quotes' }).count() === 1, 'Settings has a Quotes group');
  await set.locator('.setting', { hasText: 'On the break screen' }).locator('.switch').click(); await set.waitForTimeout(500);
  ok(await sp.evaluate(async () => (await (await import('/src/shared/storage.js')).getSettings()).quotes.rest) === false, 'a switch in Settings changes the setting');

  // the editor: the quote is a block that can be moved
  await patch({ 'quotes.rest': true });
  home = await open('src/newtab/newtab.html');
  await home.click('#customize'); await home.waitForTimeout(300); await home.click('#drawerBody .btn-primary'); await home.waitForTimeout(1000);
  ok(await home.locator('.cv-frame[data-block="quote"]:not([hidden])').count() === 1, 'the quote has a frame in the editor');
  const fb = await home.locator('.cv-frame[data-block="quote"]').boundingBox();
  await home.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2); await home.mouse.down(); await home.mouse.move(fb.x + fb.width / 2 + 120, fb.y + fb.height / 2 + 60, { steps: 8 }); await home.mouse.up(); await home.waitForTimeout(400);
  const moved = await sp.evaluate(async () => (await (await import('/src/shared/storage.js')).getSettings()).newtab.canvas.items.quote);
  ok(moved && moved.x > 0, 'the quote can be dragged: ' + JSON.stringify(moved));

  ok(!errs.length, 'page errors: ' + errs.join(' | '));
  console.log(bad.length ? 'FAIL\n' + bad.join('\n') : 'quotes: all checks passed');
  await app.close();
  process.exit(bad.length ? 1 : 0);
})();
