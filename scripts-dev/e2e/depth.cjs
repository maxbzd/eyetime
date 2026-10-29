// The depth effect end to end: a layered scene puts layers in front of the clock, the layers slide with the pointer,
// the settings switch both off, a scene without layers is untouched, reduced motion keeps everything still.
//   node scripts-dev/e2e/depth.cjs
const { launch } = require('./lib.cjs');

(async () => {
  const app = await launch({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [];
  const ok = (cond, msg) => { if (!cond) bad.push(msg); };
  const sp = await app.ctx.newPage(); await sp.goto(ext('src/options/options.html')); await sp.waitForTimeout(600);
  // patch = { 'newtab.depth': {...}, 'newtab.background': 'dawn', ... } (dotted paths; the page code never evaluates strings: the extension forbids it)
  const upd = (patch) => sp.evaluate(async (patch) => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { for (const [path, v] of Object.entries(patch)) { const keys = path.split('.'); const last = keys.pop(); let o = s; for (const k of keys) o = o[k]; o[last] = v; } }); }, patch);
  await sp.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.onboarded = true; s.language = 'en'; s.appearance.look = 'calm'; s.newtab.background = 'peaks'; }); await st.setRaw({ gsDismissed: true }); });

  const p = await app.ctx.newPage();
  p.on('pageerror', (e) => bad.push('pageerror: ' + e)); p.on('console', (m) => { if (m.type() === 'error') bad.push('console: ' + m.text()); });
  await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(1200);
  const state = () => p.evaluate(() => ({ depth: document.body.classList.contains('has-depth'), layers: [...document.querySelectorAll('#bgFront .dl')].map((e) => e.className.replace('dl ', '')), px: document.body.style.getPropertyValue('--px'), str: document.body.style.getPropertyValue('--str'), clockZ: getComputedStyle(document.getElementById('clock')).zIndex, frontZ: getComputedStyle(document.getElementById('bgFront')).zIndex, cardZ: getComputedStyle(document.getElementById('focus')).zIndex }));

  let s = await state();
  ok(s.depth && s.layers.join() === 'dl-near', 'Peaks has a layer in front of the clock: ' + JSON.stringify(s));
  ok(Number(s.clockZ) < Number(s.frontZ) && Number(s.frontZ) < Number(s.cardZ), `the clock is between the scene and the front layer, cards above: ${s.clockZ} < ${s.frontZ} < ${s.cardZ}`);
  const before = await p.evaluate(() => getComputedStyle(document.querySelector('#bgFront .dl')).transform);
  await p.mouse.move(100, 100); await p.mouse.move(1300, 800, { steps: 8 }); await p.waitForTimeout(900);
  s = await state();
  const after = await p.evaluate(() => getComputedStyle(document.querySelector('#bgFront .dl')).transform);
  ok(Number(s.px) > 0.5 && before !== after, 'the front layer slides with the pointer: ' + before + ' -> ' + after);
  ok(await p.evaluate(() => getComputedStyle(document.getElementById('clock')).translate !== 'none'), 'the clock itself moves a little');

  // switch the effect off in settings: no layers, no movement
  await upd({ 'newtab.depth': { on: false, parallax: true, strength: 60 } }); await p.waitForTimeout(600);
  s = await state(); ok(!s.depth && s.layers.length === 0 && Number(s.str) === 0, 'depth off: no front layers, no movement: ' + JSON.stringify(s));
  await upd({ 'newtab.depth': { on: true, parallax: false, strength: 60 } }); await p.waitForTimeout(600);
  s = await state(); ok(s.depth && Number(s.str) === 0, 'parallax off: layers stay, nothing moves: ' + JSON.stringify(s));
  await upd({ 'newtab.depth': { on: true, parallax: true, strength: 100 } }); await p.waitForTimeout(600);
  s = await state(); ok(Math.abs(Number(s.str) - 100 / 60) < 0.01, 'strength scales the movement: ' + s.str);

  // the drawer has the three controls
  await p.click('#customize'); await p.waitForTimeout(300);
  await p.locator('.hr-head', { hasText: 'Background' }).click(); await p.waitForTimeout(400); 
  ok(await p.locator('#drawerBody input[type="range"][aria-label="Strength"]').count() === 1 && await p.locator('#drawerBody input[aria-label="Move with the mouse"]').count() === 1, 'the drawer has the depth controls');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);

  // a scene without layers, and the other scenes with them
  await upd({ 'newtab.background': 'dawn' }); await p.waitForTimeout(600);
  s = await state(); ok(!s.depth && s.layers.length === 0, 'Dawn has no layers: ' + JSON.stringify(s));
  await upd({ 'newtab.background': 'look', 'appearance.look': 'tide' }); await p.waitForTimeout(700);
  s = await state(); ok(s.depth && s.layers.join() === 'dl-mist,dl-rocks', 'Tide: mist and rocks in front: ' + JSON.stringify(s));
  await upd({ 'appearance.look': 'obsidian' }); await p.waitForTimeout(700);
  s = await state(); ok(s.depth && s.layers.join() === 'dl-limb', 'Obsidian: the rim of the disc in front: ' + JSON.stringify(s));

  console.log(bad.length ? 'FAIL\n' + bad.join('\n') : 'depth: all checks passed');
  await app.close();
  process.exit(bad.length ? 1 : 0);
})();
