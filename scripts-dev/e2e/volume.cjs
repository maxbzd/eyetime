// The 3D photo end to end: the depth model runs on this device (WebAssembly in a worker), the depth map is stored beside the photo, the page draws the photo with WebGL,
// near and far slide differently with the pointer, the clock can go behind the nearest part, a missing WebGL or a new photo falls back to the flat photo.
//   node scripts-dev/e2e/volume.cjs
const { launch } = require('./lib.cjs');

(async () => {
  const app = await launch({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [];
  process.on('unhandledRejection', (e) => { console.log('FAIL (crashed)\n' + bad.join('\n') + '\n' + e); process.exit(1); });
  const ok = (cond, msg) => { if (!cond) bad.push(msg); };
  const sp = await app.ctx.newPage(); await sp.goto(ext('src/options/options.html')); await sp.waitForTimeout(600);
  // a synthetic landscape with depth cues: a pale sky, hazy far hills, darker nearer hills, trees, and a big dark bush in front
  await sp.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 1280; c.height = 800; const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, 500); sky.addColorStop(0, '#9fc4e8'); sky.addColorStop(1, '#f3d9bf'); g.fillStyle = sky; g.fillRect(0, 0, 1280, 800);
    const hill = (y, amp, col, seed) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, 800); for (let x = 0; x <= 1280; x += 20) g.lineTo(x, y + Math.sin(x / 140 + seed) * amp + Math.sin(x / 55 + seed * 2) * amp / 3); g.lineTo(1280, 800); g.fill(); };
    hill(330, 40, '#b9c8d8', 1); hill(400, 45, '#8aa3b8', 2); hill(480, 40, '#4f6f66', 3);
    for (let i = 0; i < 40; i++) { const x = 40 + i * 31 + (i % 3) * 7, y = 500 + (i % 4) * 14; g.fillStyle = '#1f3d2f'; g.beginPath(); g.moveTo(x, y - 90); g.lineTo(x - 16, y); g.lineTo(x + 16, y); g.fill(); }
    g.fillStyle = '#16301c'; g.beginPath(); g.moveTo(0, 800); g.lineTo(0, 640); for (let x = 0; x <= 520; x += 20) g.lineTo(x, 640 - Math.sin(x / 30) * 26 - 60 * Math.sin(x / 520 * 3.14)); g.lineTo(520, 800); g.fill();
    g.fillStyle = '#0f2415'; g.beginPath(); g.ellipse(1050, 800, 330, 190, 0, Math.PI, 0); g.fill();
    const st = await import('/src/shared/storage.js');
    await st.setRaw({ newtabBg: c.toDataURL('image/jpeg', 0.88), gsDismissed: true });
    await st.updateSettings((s) => { s.onboarded = true; s.language = 'en'; s.newtab.background = 'photo'; });
  });
  const p = await app.ctx.newPage();
  p.on('pageerror', (e) => bad.push('pageerror: ' + e)); p.on('console', (m) => { if (m.type() === 'error' && !/GL Driver|GPU stall/.test(m.text())) bad.push('console: ' + m.text()); });
  await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(1200);
  const stored = () => p.evaluate(async () => (await chrome.storage.local.get('newtabDepth')).newtabDepth || null);
  const state = () => p.evaluate(() => ({ canvases: document.querySelectorAll('.bg .gl3d').length, front: document.querySelectorAll('#bgFront .dl-gl .gl3d-front').length, gl: document.body.classList.contains('bg-gl'), depth: document.body.classList.contains('has-depth'), bgImage: getComputedStyle(document.querySelector('.bg')).backgroundImage.slice(0, 12) }));
  const setDepth = (patch) => sp.evaluate(async (pt) => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.newtab.depth = { on: true, parallax: true, strength: 60, ...(s.newtab.depth || {}), ...pt }; }); }, patch);
  /** mean absolute difference of two screenshots, 0..255 */
  const diff = (a, b) => p.evaluate(async ([x, y]) => {
    const load = async (s) => { const bm = await createImageBitmap(await (await fetch('data:image/png;base64,' + s)).blob()); const c = new OffscreenCanvas(bm.width, bm.height); const g = c.getContext('2d'); g.drawImage(bm, 0, 0); return g.getImageData(0, 0, bm.width, bm.height).data; };
    const [A, B] = [await load(x), await load(y)]; let sum = 0, n = 0; for (let i = 0; i < A.length; i += 16) { sum += Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]); n += 3; } return sum / n;
  }, [a.toString('base64'), b.toString('base64')]);
  const shot = () => p.screenshot({ clip: { x: 0, y: 380, width: 1440, height: 520 } });

  let s0 = await state();
  ok(!s0.gl && s0.canvases === 0 && !(await stored()), 'a photo background has no 3D to begin with: ' + JSON.stringify(s0));

  // make it 3D from the drawer
  await p.click('#customize'); await p.waitForTimeout(300);
  ok(await p.locator('#drawerBody button', { hasText: 'Make the photo 3D' }).count() === 1, 'the drawer offers 3D for a photo background');
  const t0 = Date.now();
  await p.locator('#drawerBody button', { hasText: 'Make the photo 3D' }).click();
  await p.waitForSelector('#drawerBody button:has-text("Remove the 3D depth"), #drawerBody [role=status]:has-text("could not be worked out"), #drawerBody [role=status]:has-text("Something went wrong")', { timeout: 120000 });
  const took = Date.now() - t0, map = await stored();
  ok(map && map.png.startsWith('data:image/png') && typeof map.key === 'string', 'the depth map is stored as a PNG with the photo key: ' + (map ? map.png.slice(0, 24) : await p.locator('#drawerBody [role=status]').last().textContent()));
  ok(map && map.png.length < 600_000, 'the map is small: ' + (map ? Math.round(map.png.length / 1024) : 0) + ' KB');
  ok(took < 90000, 'the model answers in a reasonable time: ' + took + ' ms');
  await p.waitForTimeout(1200);
  s0 = await state();
  ok(s0.canvases === 1 && s0.gl && s0.front === 0 && s0.bgImage === 'none', 'the photo is drawn by WebGL, no front layer by default: ' + JSON.stringify(s0));
  await p.click('#drawerClose'); await p.waitForTimeout(400);

  // the pointer moves the picture; the near and the far slide differently (strength 0 does not move it)
  await setDepth({ sway: false }); await p.waitForTimeout(500);
  await p.mouse.move(60, 450); await p.waitForTimeout(900); const left = await shot();
  await p.mouse.move(1380, 450); await p.waitForTimeout(900); const right = await shot();
  const moved = await diff(left, right);
  ok(moved > 0.7, 'moving the pointer across changes the picture: ' + moved.toFixed(2));
  await setDepth({ strength: 0 }); await p.waitForTimeout(500);
  await p.mouse.move(60, 450); await p.waitForTimeout(900); const l0 = await shot();
  await p.mouse.move(1380, 450); await p.waitForTimeout(900); const r0 = await shot();
  ok(await diff(l0, r0) < 0.4, 'strength 0 keeps it still: ' + (await diff(l0, r0)).toFixed(2));
  await setDepth({ strength: 60 });

  // sway at arrival, and none for reduced motion
  await p.mouse.move(720, 450); await p.reload(); await p.waitForTimeout(1500);
  await setDepth({ sway: true }); await p.reload(); await p.waitForTimeout(1200);
  const w1 = await shot(); await p.waitForTimeout(2600); const w2 = await shot();
  ok(await diff(w1, w2) > 0.3, 'the picture sways gently when the page opens: ' + (await diff(w1, w2)).toFixed(2));
  await p.emulateMedia({ reducedMotion: 'reduce' }); await p.reload(); await p.waitForTimeout(1500);
  const q1 = await shot(); await p.waitForTimeout(2600); const q2 = await shot();
  ok(await diff(q1, q2) < 0.4 && (await state()).canvases === 1, 'with reduced motion it stays still: ' + (await diff(q1, q2)).toFixed(2));
  await p.emulateMedia({ reducedMotion: 'no-preference' });

  // the clock behind the nearest part: a second canvas in front, drawn only where it is near
  await setDepth({ behind: true, sway: false }); await p.reload(); await p.waitForTimeout(1500);
  const s1 = await state();
  ok(s1.front === 1 && s1.depth && s1.canvases === 1, 'a front layer appears when the clock goes behind: ' + JSON.stringify(s1));
  ok((await p.evaluate(() => getComputedStyle(document.getElementById('clock')).zIndex)) === '1', 'the clock sits between the two layers');
  await setDepth({ behind: false }); await p.waitForTimeout(800);
  ok((await state()).front === 0, 'and goes away again');

  // no WebGL: the flat photo, no errors
  const q = await app.ctx.newPage();
  q.on('pageerror', (e) => bad.push('pageerror (no webgl): ' + e));
  await q.addInitScript(() => { const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(String(t)) ? null : get.call(this, t, ...a); }; });
  await q.goto(ext('src/newtab/newtab.html')); await q.waitForTimeout(1500);
  const fb = await q.evaluate(() => ({ n: document.querySelectorAll('.gl3d').length, gl: document.body.classList.contains('bg-gl'), bg: getComputedStyle(document.querySelector('.bg')).backgroundImage.slice(0, 14) }));
  ok(fb.n === 0 && !fb.gl && fb.bg.startsWith('url('), 'without WebGL the flat photo is shown: ' + JSON.stringify(fb));
  await q.close();

  // a new photo does not keep the old depth map
  await sp.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 640; c.height = 400; const g = c.getContext('2d'); g.fillStyle = '#446'; g.fillRect(0, 0, 640, 400);
    await (await import('/src/shared/storage.js')).setRaw({ newtabBg: c.toDataURL('image/jpeg', 0.8) });
  });
  await p.waitForTimeout(1500);
  const s2 = await state(); ok(s2.canvases === 0 && !s2.gl, 'another photo: the old map is not used: ' + JSON.stringify(s2));

  // removing the depth
  await sp.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.setRaw({ newtabBg: (await chrome.storage.local.get('newtabBg')).newtabBg }); });
  await p.click('#customize'); await p.waitForTimeout(400);
  ok(await p.locator('#drawerBody button', { hasText: 'Make the photo 3D' }).count() === 1, 'the drawer offers to make it again');
  await p.click('#drawerClose');

  console.log(bad.length ? 'FAIL\n' + bad.join('\n') : 'volume: all checks passed');
  await app.close();
  process.exit(bad.length ? 1 : 0);
})();
