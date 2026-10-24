// Visual regression: the main screens in English, Russian, German and Polish, light and dark, with a frozen clock and the realistic demo data.
//   node scripts-dev/e2e/visual.cjs            compare with scripts-dev/e2e/visual-baseline/*.png
//   node scripts-dev/e2e/visual.cjs --update   rewrite the baseline (after a change you meant to make)
// The baseline is rendered by the CI machine (its fonts and anti-aliasing differ from other machines by ~0.5 % of the pixels): after an intended UI change,
// push, download the `visual-diff` artifact of the failed CI run and copy its `*-now.png` files over the baseline (dropping the `-now`).
// A screen fails when more than THRESHOLD of its pixels differ visibly; a red diff image goes to /tmp/eyetime-visual-diff/.
// Needs Playwright + Chromium like the other e2e runs. No other dependencies: the comparison runs in a browser canvas.
const { launch } = require('./lib.cjs');
const { seed } = require('./seed.cjs');
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, 'visual-baseline');
const DIFF = '/tmp/eyetime-visual-diff';
const THRESHOLD = Number(process.env.VISUAL_THRESHOLD || 0.002); // 0.2 % of the pixels
const LOOSE = { popup: 0.02 }; // the toolbar popup re-lays itself out by a pixel or two on some loads: only a real change (2 %) counts
const UPDATE = process.argv.includes('--update');
const LANGS = (process.env.VISUAL_LANGS || 'en,ru,de,pl').split(',');
const MODES = [['light', 'calm', 'dawn'], ['dark', 'midnight', 'stars']];
const FROZEN = '(() => { const F = new Date(2026, 9, 21, 10, 30, 0).getTime(); const R = Date; class D extends R { constructor(...a) { if (a.length) super(...a); else super(F); } static now() { return F; } } window.Date = D; })();';
// site icons arrive from the browser's cache at an unpredictable moment (a letter is swapped for the image): keep the letter so screenshots are stable
const NO_FAVICONS = '(() => { const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src"); Object.defineProperty(HTMLImageElement.prototype, "src", { get: d.get, set(v) { if (String(v).includes("_favicon")) return; d.set.call(this, v); }, configurable: true }); })();';
const PAGES = [
  ['home', 'src/newtab/newtab.html', { width: 1100, height: 1000 }],
  ['popup', 'src/popup/popup.html?site=github.com', { width: 380, height: 640 }],
  ['insights', 'src/insights/insights.html', { width: 1100, height: 900 }],
  ['settings', 'src/options/options.html#focus', { width: 1000, height: 900 }],
  ['pause', 'src/blocked/blocked.html?u=http%3A%2F%2Freddit.com%2F&r=friction&a=pause', { width: 900, height: 600 }],
  ['data', 'src/options/options.html#data', { width: 1000, height: 1000 }],
  ['onboarding', 'src/onboarding/onboarding.html', { width: 900, height: 700 }],
  ['dock', 'src/dock/dock.html#right/learn', { width: 392, height: 760 }],
];
const STILL = '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; } [data-tip]::after { display: none !important; }';

(async () => {
  fs.mkdirSync(BASE, { recursive: true }); fs.mkdirSync(DIFF, { recursive: true });
  const app = await launch({ viewport: { width: 1100, height: 900 } });
  await app.ctx.addInitScript(FROZEN); await app.ctx.addInitScript(NO_FAVICONS);
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
      const file = path.join(BASE, label + '.png');
      const shoot = async () => {
        const p = await app.ctx.newPage(); await p.setViewportSize(vp); await p.goto(ext(url));
        await p.addStyleTag({ content: STILL }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1800);
        await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        // wait until the layout has stopped moving (a late font or icon can shift a card by a pixel): the same layout twice, 300 ms apart
        const sig = () => p.evaluate(() => [...document.querySelectorAll('body *')].slice(0, 400).map((e) => Math.round(e.getBoundingClientRect().top)).join(','));
        let last = await sig();
        for (let i = 0; i < 12; i++) { await p.waitForTimeout(300); const now = await sig(); if (now === last) break; last = now; }
        const buf = await p.screenshot({ animations: 'disabled' }); await p.close(); return buf;
      };
      let buf = await shoot();
      if (UPDATE || !fs.existsSync(file)) { fs.writeFileSync(file, buf); if (!UPDATE) fs.writeFileSync(path.join(DIFF, label + '-now.png'), buf); /* a new screen: the CI artifact carries it, to become the baseline */ results.push({ label, status: UPDATE ? 'updated' : 'new' }); continue; }
      // a few screens settle into one of two layouts depending on which image or font arrives first: a screen passes if any of 5 loads matches
      const base = 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
      const limit = LOOSE[name] || THRESHOLD;
      let r = await compare(base, 'data:image/png;base64,' + buf.toString('base64'));
      for (let attempt = 1; attempt < 5 && r.pct > limit; attempt++) { const b2 = await shoot(); const r2 = await compare(base, 'data:image/png;base64,' + b2.toString('base64')); if (r2.pct < r.pct) { r = r2; buf = b2; } }
      if (r.pct > limit) { if (r.diffUrl) fs.writeFileSync(path.join(DIFF, label + '.png'), Buffer.from(r.diffUrl.split(',')[1], 'base64')); fs.writeFileSync(path.join(DIFF, label + '-now.png'), buf); results.push({ label, status: 'FAIL', pct: r.pct, size: r.size }); }
      else results.push({ label, status: 'ok', pct: r.pct });
    }
  }
  await app.close();
  const fails = results.filter((r) => r.status === 'FAIL'), fresh = results.filter((r) => r.status === 'new');
  for (const r of fails) console.log(`FAIL ${r.label}: ${r.size || (r.pct * 100).toFixed(2) + ' % of pixels differ'} → ${DIFF}/${r.label}.png`);
  console.log(`${results.length - fails.length - fresh.length} ok, ${fails.length} changed, ${fresh.length} new${UPDATE ? ' (baseline updated)' : ''}`);
  process.exit(fails.length || (fresh.length && !UPDATE) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
