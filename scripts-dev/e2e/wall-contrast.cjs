// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Contrast of white type on every wallpaper of Home · Today, measured on real screenshots (the page with its text hidden, the veil as it is).
// Prints the extra veil each wallpaper needs ([centre, top, bottom], 0..1) to reach the targets; `--check` exits 1 if a wallpaper is below them.
//   centre (the clock, the greeting, the line of intent: large type) ≥ 3.2:1, top / bottom (small type in the corners and under the clock) ≥ 4.5:1.
const { launch } = require('./lib.cjs');
const { PNG } = (() => { try { return require('pngjs'); } catch { return {}; } })();
const TARGET = { c: 3.2, t: 4.5, b: 4.5 }, P = 0.85;
const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const cr = (L) => 1.05 / (L + 0.05);

(async () => {
  const check = process.argv.includes('--check');
  const app = await launch({ viewport: { width: 1440, height: 900 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const sp = await app.ctx.newPage(); await sp.goto(ext('src/options/options.html')); await sp.waitForTimeout(800);
  const ids = await sp.evaluate(async () => { const f = await import('/src/shared/frames.js'); return f.WALL_IDS; });
  const out = {}; let bad = 0;
  for (const id of ids) {
    await sp.evaluate(async (id) => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.onboarded = true; s.newtab.layout = 'today'; s.newtab.background = 'photo'; s.newtab.frame = id; s.focus.dailyGoal = 120; }); await st.setRaw({ gsDismissed: true }); }, id);
    const p = await app.ctx.newPage(); await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(1500);
    const boxes = await p.evaluate(() => { const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return b.width ? [b.left, b.top, b.right, b.bottom] : null; };
      return { c: ['#clock', '#greeting', '#date', '.fl-row'].map(r).filter(Boolean), t: ['.gl-focus', '.gl-eye'].map(r).filter(Boolean), b: ['#tdCredit', '#quote'].map(r).filter(Boolean) }; });
    await p.addStyleTag({ content: '.hero, #focus, .td-glance, .td-credit, .quote, .nt-corners { visibility: hidden !important }' }); await p.waitForTimeout(200);
    const buf = await p.screenshot({ type: 'png' });
    const png = PNG.sync.read(buf);
    const worst = {};
    for (const k of ['c', 't', 'b']) {
      const L = [];
      for (const [x0, y0, x1, y1] of boxes[k]) for (let y = Math.max(0, Math.floor(y0)); y < Math.min(png.height, Math.ceil(y1)); y += 2) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(png.width, Math.ceil(x1)); x += 2) { const i = (y * png.width + x) * 4; L.push([png.data[i], png.data[i + 1], png.data[i + 2]]); }
      let need = 0;
      for (; need < 0.9; need += 0.02) { const ls = L.map(([r, g, b]) => lum(r * (1 - need), g * (1 - need), b * (1 - need))).sort((a, b) => a - b); if (cr(ls[Math.floor(ls.length * P)]) >= TARGET[k]) break; }
      worst[k] = Math.round(need * 100) / 100;
    }
    out[id] = [worst.c, worst.t, worst.b]; if (worst.c + worst.t + worst.b > 0) bad++;
    await p.close();
  }
  console.log(JSON.stringify(out)); console.log(bad ? `${bad} of ${ids.length} wallpapers need more veil` : 'all wallpapers reach the targets');
  await app.close(); if (check && bad) process.exit(1);
})();
