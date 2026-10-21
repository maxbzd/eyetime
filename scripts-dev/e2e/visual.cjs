// Visual regression: the main screens in English, Russian and German, light and dark, with a frozen clock and the realistic demo data.
//   node scripts-dev/e2e/visual.cjs            compare with scripts-dev/e2e/visual-baseline/*.png
//   node scripts-dev/e2e/visual.cjs --update   rewrite the baseline (after a change you meant to make)
// A screen fails when more than THRESHOLD of its pixels differ visibly; a red diff image goes to /tmp/eyetime-visual-diff/.
// Needs Playwright + Chromium like the other e2e runs. No other dependencies: the comparison runs in a browser canvas.
const { launch } = require('./lib.cjs');
const { seed } = require('./seed.cjs');
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, 'visual-baseline');
const DIFF = '/tmp/eyetime-visual-diff';
const THRESHOLD = Number(process.env.VISUAL_THRESHOLD || 0.002); // 0.2 % of the pixels
const UPDATE = process.argv.includes('--update');
const LANGS = (process.env.VISUAL_LANGS || 'en,ru,de').split(',');
const MODES = [['light', 'calm', 'dawn'], ['dark', 'midnight', 'stars']];
const FROZEN = '(() => { const F = new Date(2026, 9, 21, 10, 30, 0).getTime(); const R = Date; class D extends R { constructor(...a) { if (a.length) super(...a); else super(F); } static now() { return F; } } window.Date = D; })();';
const PAGES = [
  ['home', 'src/newtab/newtab.html', { width: 1100, height: 1000 }],
  ['popup', 'src/popup/popup.html?site=github.com', { width: 380, height: 640 }],
  ['insights', 'src/insights/insights.html', { width: 1100, height: 900 }],
  ['settings', 'src/options/options.html#focus', { width: 1000, height: 900 }],
  ['pause', 'src/blocked/blocked.html?u=http%3A%2F%2Freddit.com%2F&r=friction&a=pause', { width: 900, height: 600 }],
];
const STILL = '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; } [data-tip]::after { display: none !important; }';

(async () => {
  fs.mkdirSync(BASE, { recursive: true }); fs.mkdirSync(DIFF, { recursive: true });
  const app = await launch({ viewport: { width: 1100, height: 900 } });
  await app.ctx.addInitScript(FROZEN);
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const seedPage = await app.ctx.newPage(); await seedPage.goto(ext('src/options/options.html')); await seedPage.waitForTimeout(800);
  const cmp = await app.ctx.newPage(); await cmp.goto('about:blank');
  const results = [];

  async function compare(a, b) { // → { pct, diffUrl }
    return cmp.evaluate(async ([a, b]) => {
      const load = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return { pct: 1, diffUrl: null, size: `${ia.width}x${ia.height} vs ${ib.width}x${ib.height}` };
      const mk = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height); };
      const da = mk(ia), db = mk(ib); const out = new ImageData(ia.width, ia.height); let bad = 0;
      for (let i = 0; i < da.data.length; i += 4) {
        const d = Math.max(Math.abs(da.data[i] - db.data[i]), Math.abs(da.data[i + 1] - db.data[i + 1]), Math.abs(da.data[i + 2] - db.data[i + 2]));
        if (d > 24) { bad++; out.data[i] = 255; out.data[i + 1] = 0; out.data[i + 2] = 60; out.data[i + 3] = 255; } else { out.data[i] = out.data[i + 1] = out.data[i + 2] = 255 - (255 - da.data[i]) * 0.25; out.data[i + 3] = 255; }
      }
      const c = document.createElement('canvas'); c.width = ia.width; c.height = ia.height; c.getContext('2d').putImageData(out, 0, 0);
      return { pct: bad / (ia.width * ia.height), diffUrl: c.toDataURL('image/png') };
    }, [a, b]);
  }

  for (const lang of LANGS) for (const [mode, look, bg] of MODES) {
    await seed(seedPage, { look, mode, background: bg, clockStyle: 'thin', lang });
    await seedPage.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.setRaw({ gsDismissed: true }); await st.updateSettings((s) => { s.newtab.clock24 = false; }); });
    for (const [name, url, vp] of PAGES) {
      const label = `${name}-${lang}-${mode}`;
      const p = await app.ctx.newPage(); await p.setViewportSize(vp); await p.goto(ext(url));
      await p.addStyleTag({ content: STILL }); await p.waitForTimeout(1200);
      const buf = await p.screenshot({ animations: 'disabled' }); await p.close();
      const file = path.join(BASE, label + '.png');
      if (UPDATE || !fs.existsSync(file)) { fs.writeFileSync(file, buf); results.push({ label, status: UPDATE ? 'updated' : 'new' }); continue; }
      const r = await compare('data:image/png;base64,' + fs.readFileSync(file).toString('base64'), 'data:image/png;base64,' + buf.toString('base64'));
      if (r.pct > THRESHOLD) { if (r.diffUrl) fs.writeFileSync(path.join(DIFF, label + '.png'), Buffer.from(r.diffUrl.split(',')[1], 'base64')); fs.writeFileSync(path.join(DIFF, label + '-now.png'), buf); results.push({ label, status: 'FAIL', pct: r.pct, size: r.size }); }
      else results.push({ label, status: 'ok', pct: r.pct });
    }
  }
  await app.close();
  const fails = results.filter((r) => r.status === 'FAIL'), fresh = results.filter((r) => r.status === 'new');
  for (const r of fails) console.log(`FAIL ${r.label}: ${r.size || (r.pct * 100).toFixed(2) + ' % of pixels differ'} → ${DIFF}/${r.label}.png`);
  console.log(`${results.length - fails.length - fresh.length} ok, ${fails.length} changed, ${fresh.length} new${UPDATE ? ' (baseline updated)' : ''}`);
  process.exit(fails.length || (fresh.length && !UPDATE) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
