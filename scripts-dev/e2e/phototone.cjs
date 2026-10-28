// The text colour on a photo background: Auto reads the picture and picks white or black, and the person can force either.
//   node scripts-dev/e2e/phototone.cjs
const { launch } = require('./lib.cjs');

(async () => {
  const app = await launch({ viewport: { width: 1440, height: 900 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [];
  const ok = (c, m) => { if (!c) bad.push(m); };
  const sp = await app.ctx.newPage(); await sp.goto(ext('src/options/options.html')); await sp.waitForTimeout(600);
  await sp.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.onboarded = true; s.language = 'en'; }); await st.setRaw({ gsDismissed: true }); });
  const photo = (kind) => sp.evaluate(async (kind) => {
    const c = document.createElement('canvas'); c.width = 320; c.height = 180; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 180);
    if (kind === 'bright') { g.addColorStop(0, '#f4f1ea'); g.addColorStop(1, '#d9d2c3'); } else if (kind === 'dark') { g.addColorStop(0, '#0b1020'); g.addColorStop(1, '#1b2233'); } else { g.addColorStop(0, '#f4f1ea'); g.addColorStop(0.5, '#f4f1ea'); g.addColorStop(0.5, '#10131c'); g.addColorStop(1, '#10131c'); }
    x.fillStyle = g; x.fillRect(0, 0, 320, 180);
    const st = await import('/src/shared/storage.js');
    await chrome.storage.local.remove('newtabFg');
    await st.setRaw({ newtabBg: c.toDataURL('image/jpeg', 0.9) });
    await st.updateSettings((s) => { s.newtab.background = 'photo'; });
  }, kind);
  const setMode = (m) => sp.evaluate(async (m) => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.newtab.photoText = m; }); }, m);
  const p = await app.ctx.newPage();
  p.on('pageerror', (e) => bad.push('pageerror: ' + e));
  const tone = async () => { await p.waitForTimeout(700); return p.evaluate(() => ({ tone: document.body.dataset.tone, fg: getComputedStyle(document.querySelector('.hero')).color })); };
  await photo('dark');
  await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(1200);
  let t = await tone(); ok(t.tone === 'dark' && /255, 255, 255/.test(t.fg), 'a dark photo gets white text on Auto: ' + JSON.stringify(t));
  await photo('bright'); t = await tone();
  ok(t.tone === 'light' && !/255, 255, 255/.test(t.fg), 'a bright photo gets dark text on Auto: ' + JSON.stringify(t));
  await setMode('light'); t = await tone(); ok(t.tone === 'dark', 'White can be forced on a bright photo');
  await setMode('dark'); await photo('dark'); t = await tone(); ok(t.tone === 'light', 'Black can be forced on a dark photo');
  await setMode('auto'); await photo('mixed'); t = await tone(); ok(t.tone === 'dark' || t.tone === 'light', 'a mixed photo still gets a tone');

  // the controls: the drawer lists Auto / White / Black for a photo and saves the choice
  await photo('bright'); await p.reload(); await p.waitForTimeout(1200);
  await p.click('#customize'); await p.waitForTimeout(300);
  ok(await p.locator('#drawerBody .segmented[aria-label="Text colour on the photo"] button').count() === 3, 'the drawer offers Auto / White / Black for a photo');
  await p.locator('#drawerBody .segmented[aria-label="Text colour on the photo"] button', { hasText: 'Black' }).click(); await p.waitForTimeout(700);
  ok(await sp.evaluate(async () => (await (await import('/src/shared/storage.js')).getSettings()).newtab.photoText) === 'dark', 'the choice is saved');
  ok(await p.evaluate(() => document.body.dataset.tone) === 'light', 'and applied at once');

  // the clock can be filled with the photo: Glass (a soft copy through the digits) and Photo (cut out of the photo itself), placed where the page's photo is
  await photo('dark');
  for (const fill of ['glass', 'photo']) {
    await sp.evaluate(async (fill) => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.newtab.type = { clock: { fill } }; }); }, fill);
    await p.waitForTimeout(900);
    const c = await p.evaluate(() => { const e = document.getElementById('clock'), cs = getComputedStyle(e); return { clip: cs.webkitBackgroundClip || cs.backgroundClip, img: cs.backgroundImage.slice(0, 60), bgs: e.style.getPropertyValue('--clk-bgs'), bgp: e.style.getPropertyValue('--clk-bgp') }; });
    ok(/text/.test(c.clip) && /url\(|gradient/.test(c.img), fill + ' fill uses the photo through the digits: ' + JSON.stringify(c));
    ok(/px/.test(c.bgs) && /px/.test(c.bgp), fill + ' fill is placed with the page photo: ' + JSON.stringify(c));
  }
  await sp.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.newtab.background = 'dawn'; }); }); await p.waitForTimeout(900);
  ok(await p.evaluate(() => { const e = document.getElementById('clock'); return !e.style.getPropertyValue('--clk-bgs') && getComputedStyle(e).webkitTextFillColor !== ''; }), 'without a photo the clock falls back to a plain fill');

  console.log(bad.length ? 'FAIL\n' + bad.join('\n') : 'phototone: all checks passed');
  await app.close();
  process.exit(bad.length ? 1 : 0);
})();
