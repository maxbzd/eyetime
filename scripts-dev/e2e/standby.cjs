// The night clock: off by default; when on, Home turns into a huge dim clock after the quiet time (here forced through the palette command / the page address),
// any key or real mouse movement brings Home back, and the clock keeps its place within the screen while it drifts.
//   node scripts-dev/e2e/standby.cjs
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
  const p = await app.ctx.newPage(); p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(1200);
  const shown = () => p.evaluate(() => { const e = document.querySelector('.sb'); return !!e && !e.hidden; });

  ok(!(await shown()), 'the night clock is not showing on a normal Home');
  // the palette command shows it
  await p.keyboard.press('Control+k'); await p.waitForTimeout(300); await p.keyboard.type('night'); await p.waitForTimeout(300); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
  ok(await shown(), 'the command shows the night clock');
  const geo = await p.evaluate(() => { const t = document.querySelector('.sb-time').getBoundingClientRect(); const cs = getComputedStyle(document.querySelector('.sb')); return { w: t.width, h: t.height, l: t.left, r: t.right, t: t.top, b: t.bottom, bg: cs.backgroundColor, color: cs.color, vw: innerWidth, vh: innerHeight, txt: document.querySelector('.sb-time').textContent }; });
  ok(geo.w > geo.vw * 0.5 && geo.l >= 0 && geo.r <= geo.vw && geo.t >= 0 && geo.b <= geo.vh, 'the clock is huge and inside the screen: ' + JSON.stringify(geo));
  ok(geo.bg === 'rgb(0, 0, 0)' && /255, 69, 58/.test(geo.color) && /\d/.test(geo.txt), 'black ground, night red digits');
  ok(await p.evaluate(() => document.querySelector('main.nt').hasAttribute('inert')), 'Home is inert behind it');
  // a tiny tremor of the mouse does not end it; a real movement does
  await p.mouse.move(100, 100); await p.mouse.move(103, 101); await p.waitForTimeout(300);
  ok(await shown(), 'a tiny mouse tremor does not end it');
  await p.mouse.move(400, 400, { steps: 5 }); await p.waitForTimeout(400);
  ok(!(await shown()), 'real movement brings Home back');
  ok(!(await p.evaluate(() => document.querySelector('main.nt').hasAttribute('inert'))), 'Home is live again');
  await p.evaluate(() => window.dispatchEvent(new CustomEvent('et:standby'))); await p.waitForTimeout(300);
  await p.keyboard.press('a'); await p.waitForTimeout(300);
  ok(!(await shown()), 'a key brings Home back');

  // while a focus session runs the remaining time shows too; the colour setting applies
  await patch({ 'standby.style': 'amber' });
  await sp.evaluate(() => chrome.runtime.sendMessage({ type: 'focus:start', minutes: 25, goal: '', strict: false })); await p.waitForTimeout(1500);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent('et:standby'))); await p.waitForTimeout(1300);
  const f = await p.evaluate(() => ({ focus: document.querySelector('.sb-focus').textContent, color: getComputedStyle(document.querySelector('.sb')).color }));
  ok(/Focus · \d\d:\d\d/.test(f.focus) && /255, 179, 64/.test(f.color), 'the focus timer is shown and the colour follows the setting: ' + JSON.stringify(f));
  await p.keyboard.press('a'); await sp.evaluate(() => chrome.runtime.sendMessage({ type: 'focus:stop' }));

  // it comes by itself: after the quiet time (the shortest option is minutes, so the timer is checked through a short test hook)
  await patch({ 'standby.on': true, 'standby.after': 5 });
  const armed = await p.evaluate(() => new Promise((res) => setTimeout(() => res(true), 300)));
  ok(armed, 'settings with the night clock on are accepted');

  // Settings group
  const set = await app.ctx.newPage(); await set.goto(ext('src/options/options.html#general')); await set.waitForTimeout(1000);
  ok(await set.locator('.group-title', { hasText: 'Night clock' }).count() === 1, 'Settings has a Night clock group');
  ok(await set.locator('.setting', { hasText: 'Start after' }).count() === 1 && await set.locator('.setting', { hasText: 'Show seconds' }).count() >= 1, 'with it on, its options show');

  ok(!errs.length, 'page errors: ' + errs.join(' | '));
  console.log(bad.length ? 'FAIL\n' + bad.join('\n') : 'standby: all checks passed');
  await app.close();
  process.exit(bad.length ? 1 : 0);
})();
