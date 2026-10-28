// The photo cut-out end to end: the model runs on this device (WebAssembly in a worker), the mask is stored beside the photo,
// the page puts a masked copy of the photo in front of the clock, the cut-out can be removed, and a new photo drops the old mask.
//   node scripts-dev/e2e/cutout.cjs
const { launch } = require('./lib.cjs');

(async () => {
  const app = await launch({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [];
  const ok = (cond, msg) => { if (!cond) bad.push(msg); };
  const sp = await app.ctx.newPage(); await sp.goto(ext('src/options/options.html')); await sp.waitForTimeout(600);
  // a synthetic "photo": a leafy background and one large, clearly separate subject
  await sp.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 1280; c.height = 800; const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 1280, 800); bg.addColorStop(0, '#2d5a2d'); bg.addColorStop(1, '#16301c'); g.fillStyle = bg; g.fillRect(0, 0, 1280, 800);
    for (let i = 0; i < 1800; i++) { g.fillStyle = `hsla(${90 + Math.random() * 50},45%,${18 + Math.random() * 22}%,.55)`; g.beginPath(); g.ellipse(Math.random() * 1280, Math.random() * 800, 4 + Math.random() * 16, 2 + Math.random() * 6, Math.random() * 3, 0, 7); g.fill(); }
    const body = g.createRadialGradient(640, 420, 20, 640, 440, 300); body.addColorStop(0, '#fff2d0'); body.addColorStop(1, '#d49a52'); g.fillStyle = body;
    g.beginPath(); g.ellipse(640, 480, 250, 330, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(640, 210, 130, 140, 0, 0, 7); g.fill();
    g.fillStyle = '#2b1a10'; g.beginPath(); g.ellipse(595, 195, 16, 20, 0, 0, 7); g.ellipse(685, 195, 16, 20, 0, 0, 7); g.fill();
    const st = await import('/src/shared/storage.js');
    await st.setRaw({ newtabBg: c.toDataURL('image/jpeg', 0.85), gsDismissed: true });
    await st.updateSettings((s) => { s.onboarded = true; s.language = 'en'; s.newtab.background = 'photo'; });
  });
  const p = await app.ctx.newPage();
  p.on('pageerror', (e) => bad.push('pageerror: ' + e)); p.on('console', (m) => { if (m.type() === 'error') bad.push('console: ' + m.text()); });
  await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(1200);
  const fg = () => p.evaluate(async () => (await chrome.storage.local.get('newtabFg')).newtabFg || null);
  const layers = () => p.evaluate(() => [...document.querySelectorAll('#bgFront .dl')].map((e) => e.className.replace('dl ', '')));
  ok(!(await fg()) && (await layers()).length === 0, 'no cut-out and no front layer to begin with');

  await p.click('#customize'); await p.waitForTimeout(300);
  ok(await p.locator('#drawerBody button', { hasText: 'Cut out the subject' }).count() === 1, 'the drawer offers the cut-out for a photo background');
  const t0 = Date.now();
  await p.locator('#drawerBody button', { hasText: 'Cut out the subject' }).click();
  await p.waitForSelector('#drawerBody button:has-text("Remove the cut-out"), #drawerBody [role=status]:has-text("No clear subject"), #drawerBody [role=status]:has-text("Could not")', { timeout: 60000 });
  const took = Date.now() - t0;
  const mask = await fg();
  ok(mask && mask.startsWith('data:image/png'), 'the mask is stored as a PNG: ' + (mask ? mask.slice(0, 30) : 'none') + ' / ' + await p.locator('#drawerBody [role=status]').textContent());
  ok(mask && mask.length < 400_000, 'the mask is small: ' + (mask ? Math.round(mask.length / 1024) : 0) + ' KB');
  ok(took < 30000, 'the model answers in a reasonable time: ' + took + ' ms');
  await p.waitForTimeout(500);
  ok((await layers()).join() === 'dl-photo', 'a masked copy of the photo is in front of the clock: ' + (await layers()).join());
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('#bgFront .dl-photo')).maskImage.includes('data:image/png') || getComputedStyle(document.querySelector('#bgFront .dl-photo')).webkitMaskImage.includes('data:image/png')), 'the front layer uses the mask');

  // switching depth off removes the layer but keeps the mask; removing the cut-out clears it
  await p.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.newtab.depth = { on: false, parallax: true, strength: 60 }; }); });
  await p.waitForTimeout(500);
  ok((await layers()).length === 0 && !!(await fg()), 'depth off hides the layer, the mask stays');
  await p.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.newtab.depth = { on: true, parallax: true, strength: 60 }; }); });
  await p.waitForTimeout(400);
  await p.locator('#drawerBody button', { hasText: 'Remove the cut-out' }).click(); await p.waitForTimeout(600);
  ok(!(await fg()) && (await layers()).length === 0, 'removing the cut-out clears the mask and the layer');

  // a new photo must not keep an old mask: put one back, then choose a file
  await p.evaluate(async () => { await chrome.storage.local.set({ newtabFg: 'data:image/png;base64,iVBORw0KGgo=' }); });
  await p.waitForTimeout(300);
  ok(!!(await fg()), 'precondition: a mask exists');
  await p.setInputFiles('#drawerBody input[accept="image/*"]', { name: 'p.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64') });
  await p.waitForTimeout(1200);
  ok(!(await fg()), 'choosing a new photo drops the old mask');

  console.log(bad.length ? 'FAIL\n' + bad.join('\n') : 'cutout: all checks passed');
  await app.close();
  process.exit(bad.length ? 1 : 0);
})();
