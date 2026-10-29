// The scene engine: a scene is the world behind Home and follows the clock, a custom widget is drawn from nodes and data, clicks run only whitelisted actions,
// a hostile scene file becomes a harmless one, and nothing throws.
//   node scripts-dev/e2e/scene.cjs
const { launch } = require('./lib.cjs');

const SCENE = { name: 'Test sky', tone: 'dark', states: { calm: { ease: 0.2 } }, layers: [
  { t: 'rect', id: 'sky', x: 0, y: 0, w: '=W', h: '=H', fill: { g: 'linear', a: 180, stops: [[0, "=mixc('#000000', '#ffffff', daylight)"], [1, '#102030']] } },
  { t: 'particles', x: 0, y: 0, w: '=W', h: 300, n: 40, op: '=night', twinkle: true },
  { t: 'rect', x: 10, y: 10, w: 80, h: 80, fill: '#ff0000', op: '=1 - state.calm', on: { click: { do: 'state.set', name: 'calm' } } },
  { t: 'text', x: 500, y: 400, size: 60, align: 'middle', text: '{pad(hour, 2)}:{pad(minute, 2)}' },
] };
const WIDGET = { size: [300, 200], root: [
  { t: 'text', x: 0, y: 40, size: 30, text: '{tasksOpen} open · {sum(week)} min' },
  { t: 'spark', x: 0, y: 60, w: 300, h: 60, of: 'week', kind: 'bars' },
  { t: 'list', x: 0, y: 130, w: 300, of: 'tasks', max: 2, rowh: 30, item: { t: 'text', x: 0, y: 20, size: 18, text: '{item.text}' } },
] };
const HOSTILE = { name: '<img src=x onerror=alert(1)>', layers: [
  { t: 'rect', fill: 'url(https://evil.example/x.png)', w: '=eval("1")', h: '=constructor.constructor("alert(1)")()', onclick: 'alert(1)' },
  { t: 'script', text: 'alert(1)' }, { t: 'text', text: '{window.location}', x: '=document.cookie' },
  { t: 'path', d: 'M0 0 <script>alert(1)</script>' }, { t: 'rect', on: { click: { do: 'fetch', url: 'https://evil.example' } } },
  ...Array.from({ length: 2000 }, () => ({ t: 'rect', w: 5, h: 5 })),
] };

(async () => {
  const app = await launch({ viewport: { width: 1440, height: 900 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [];
  const ok = (cond, msg) => { if (!cond) bad.push(msg); };
  const sp = await app.ctx.newPage(); await sp.goto(ext('src/options/options.html')); await sp.waitForTimeout(600);
  await sp.evaluate(async () => {
    const st = await import('/src/shared/storage.js');
    await st.setRaw({ gsDismissed: true });
    await st.setCollection('tasks', [{ id: 'a', text: 'Alpha task', done: false, starred: false, createdAt: 1 }, { id: 'b', text: 'Beta task', done: false, starred: false, createdAt: 2 }]);
  });
  const put = (scene, widget) => sp.evaluate(async ([scene, widget]) => {
    const st = await import('/src/shared/storage.js'), Sc = await import('/src/shared/scene/schema.js'), T = await import('/src/shared/themefile.js');
    const theme = JSON.stringify({ format: 'eyetime-theme', v: 1, appearance: {}, home: { scene, background: 'scene', ...(widget ? { widgets: [{ id: 'wcus001', kind: 'custom', cfg: { ui: widget } }], canvas: { on: true, items: { wcus001: { x: 70, y: 50, w: 360 } } } } : {}) }, layouts: [] });
    const r = T.parseTheme(theme); if (!r.ok) return { ok: false, error: r.error };
    await st.updateSettings((s) => { s.onboarded = true; s.language = 'en'; s.appearance.mode = 'dark'; T.applyTheme(s, r.theme); s.newtab.modules = { focus: false, today: false, tasks: false, habits: false, notes: false, links: false }; });
    return { ok: true, layers: r.theme.home.scene ? r.theme.home.scene.layers.length : 0, widgets: r.theme.home.widgets ? r.theme.home.widgets.length : 0, fn: typeof Sc.sanitizeScene };
  }, [scene, widget]);
  const p = await app.ctx.newPage();
  p.on('pageerror', (e) => bad.push('pageerror: ' + e)); p.on('console', (m) => { if (m.type() === 'error') bad.push('console: ' + m.text()); });
  const colour = () => p.evaluate(() => document.querySelector('.bg .sc-svg stop')?.getAttribute('stop-color'));

  // 1. a scene follows the clock
  ok((await put(SCENE, WIDGET)).ok, 'the theme with a scene is accepted');
  await p.clock.install({ time: new Date(2026, 9, 29, 3, 0, 0) });
  await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(1500);
  const night = await colour();
  ok(await p.locator('.bg .sc-svg').count() === 1, 'the scene is drawn behind Home');
  ok(/03:00/.test(await p.locator('.bg .sc-svg text').first().textContent()), 'a text formula shows the hour: ' + await p.locator('.bg .sc-svg text').first().textContent());
  ok(await p.locator('.bg .sc-svg foreignObject canvas').count() === 1, 'particles are drawn');
  await p.clock.install({ time: new Date(2026, 9, 29, 13, 0, 0) });
  await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(1500);
  const day = await colour();
  ok(night !== day && /rgba/.test(day), `the sky changes between night and day: ${night} → ${day}`);
  ok(await p.evaluate(() => document.body.dataset.tone) === 'dark', 'the scene sets the text tone');

  // 2. a custom widget is drawn from data
  const w = p.locator('#wgt-wcus001');
  ok(await w.count() === 1 && /open/.test(await w.textContent()), 'the custom widget shows data: ' + (await w.textContent()).slice(0, 80));
  ok(/Alpha task/.test(await w.textContent()) && /Beta task/.test(await w.textContent()), 'a list repeats its row for each task');
  ok(await w.locator('path').count() >= 1, 'a spark draws its bars');
  const box = await w.boundingBox(); ok(box && box.width > 250 && box.height > 120, 'the widget has a sensible size: ' + JSON.stringify(box));

  // 3. a click runs a whitelisted action: state.set eases the red square away
  const op0 = await p.evaluate(() => getComputedStyle(document.querySelectorAll('.bg .sc-svg rect')[1]).opacity);
  await p.evaluate(() => document.querySelectorAll('.bg .sc-svg rect')[1].dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await p.waitForTimeout(900);
  const op1 = await p.evaluate(() => getComputedStyle(document.querySelectorAll('.bg .sc-svg rect')[1]).opacity);
  ok(Number(op0) > 0.9 && Number(op1) < 0.2, `the state moved: ${op0} → ${op1}`);

  // 4. a hostile file becomes a harmless scene
  const r = await put(HOSTILE, null);
  ok(r.ok, 'a hostile theme still parses');
  const stored = await sp.evaluate(async () => (await (await import('/src/shared/storage.js')).getSettings()).newtab.scene);
  const text = JSON.stringify(stored.layers); ok(!/[<>]/.test(stored.name || ''), 'the name carries no markup');
  ok(!/evil|alert|eval|constructor|cookie|window|script|onclick/.test(text), 'nothing hostile survives: ' + text.slice(0, 200));
  ok(stored.layers.length <= 300, 'the node count is capped: ' + stored.layers.length);
  await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(1200);
  ok(await p.locator('main.nt').count() === 1, 'Home still opens with it');

  // 5. no scene: no engine cost
  await sp.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.newtab.background = 'look'; s.newtab.scene = null; }); });
  await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(900);
  ok(await p.locator('.bg .sc-root').count() === 0, 'without a scene nothing is mounted');

  await app.close();
  if (bad.length) { console.log('FAIL\n' + [...new Set(bad)].slice(0, 30).join('\n')); process.exit(1); }
  console.log('scene: ok');
})();
