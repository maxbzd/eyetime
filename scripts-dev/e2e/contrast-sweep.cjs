// Rendered-contrast sweep: every visible text node vs. its effective background, on every page, for every look × scheme.
//   node scripts-dev/e2e/contrast-sweep.cjs [look,look…]      (needs Playwright + Chromium like the e2e run)
const { launch } = require('./lib.cjs');
const LOOKS = (process.argv[2] || 'calm,paper,midnight,terminal,sakura,forest,aurora,mono,sunset,nord,ocean').split(',');
const PAGES = [
  ['home', 'src/newtab/newtab.html', 1280, 900], ['popup', 'src/popup/popup.html?site=github.com', 380, 640],
  ['insights-overview', 'src/insights/insights.html', 1280, 900], ['insights-focus', 'src/insights/insights.html#focus', 1280, 900],
  ['settings', 'src/options/options.html', 1280, 900], ['blocked', 'src/blocked/blocked.html?u=http%3A%2F%2Freddit.com%2F&r=friction&a=pause', 1000, 700], ['onboarding', 'src/onboarding/onboarding.html', 1100, 800],
];

const measure = () => {
  const parse = (c) => {
    let m = c.match(/rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]]; }
    m = c.match(/color\(srgb ([^)]+)\)/);
    if (m) { const p = m[1].split(/[ /]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] === undefined ? 1 : p[3]]; }
    return null;
  };
  const over = (top, bot) => { const a = top[3] + bot[3] * (1 - top[3]); return a ? [0, 1, 2].map((i) => (top[i] * top[3] + bot[i] * bot[3] * (1 - top[3])) / a).concat(a) : [0, 0, 0, 0]; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const pageBg = parse(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() ? (() => { const d = document.createElement('i'); d.style.color = getComputedStyle(document.documentElement).getPropertyValue('--bg'); document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; })() : 'rgb(255,255,255)') || [255, 255, 255, 1];
  const bgOf = (el) => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; } }
    let bg = [pageBg[0], pageBg[1], pageBg[2], 1];
    for (const l of layers.reverse()) bg = over(l, bg);
    return bg;
  };
  const out = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const txt = n.textContent.trim(); const el = n.parentElement;
    if (!txt || !el || seen.has(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0 || ['SCRIPT', 'STYLE', 'OPTION'].includes(el.tagName)) continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    if (el.closest('[hidden], .sr-only, dialog:not([open])')) continue;
    let fg = parse(cs.color); if (!fg) continue;
    const bg = bgOf(el);
    let eff = fg; if (fg[3] < 1) eff = over(fg, bg);
    const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    const cr = ratio(eff, bg);
    seen.add(el); window.__cnt = (window.__cnt || 0) + 1; window.__min = Math.min(window.__min || 99, cr / (need / 4.5));
    if (cr < need - 0.01) out.push({ text: txt.slice(0, 40), cr: Math.round(cr * 100) / 100, need, size, sel: (el.className && String(el.className).split(' ')[0]) || el.tagName.toLowerCase(), fg: eff.slice(0, 3).map(Math.round).join(','), bg: bg.slice(0, 3).map(Math.round).join(',') });
  }
  out.cnt = window.__cnt; out.min = window.__min;
  return out;
};

(async () => {
  const app = await launch({ viewport: { width: 1280, height: 900 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const sp = await app.ctx.newPage(); await sp.goto(ext('src/options/options.html')); await sp.waitForTimeout(500);
  await sp.evaluate(async () => {
    const st = await import('/src/shared/storage.js'); const { rangeKeys } = await import('/src/shared/time.js');
    await st.updateSettings((s) => { s.onboarded = true; s.language = 'en'; s.blocking.plans = [{ id: 'p', when: '', then: 'stand up and drink water' }]; });
    let n = 7; const rnd = () => (n = (n * 9301 + 49297) % 233280) / 233280;
    for (const k of rangeKeys(21)) await st.updateDay(k, (d) => { d.d = { 'github.com': 3000 + Math.round(rnd() * 3000), 'youtube.com': Math.round(rnd() * 3000), 'reddit.com': Math.round(rnd() * 2400) }; d.h = { 10: { 'github.com': 1500 }, 14: { 'youtube.com': 900 } }; d.fs = 7500; d.fc = 3; d.sw = 30; d.pa = { 'reddit.com': 3 }; d.pr = { back: 2, work: 1 }; d.w = 'Shipped it'; d.ss = [{ id: k + 'a', t: Date.parse(k + 'T09:05:00'), m: 25, p: 25, g: 'Deep work', k: '', c: 1, r: 1 + Math.floor(rnd() * 3) }, { id: k + 'b', t: Date.parse(k + 'T10:05:00'), m: 50, p: 50, g: 'Plan', k: '', c: 1, r: 3 }]; });
    await st.setCollection('tasks', [{ id: 'a', text: 'Write the quarterly report', done: false, starred: true, createdAt: 1, focusSec: 4500, resume: 'Draft section 2', at: '23:30', atDay: new Date().toISOString().slice(0, 10) }, { id: 'b', text: 'Review pull requests', done: false, starred: false, createdAt: 2 }, { id: 'c', text: 'Done thing', done: true, starred: false, createdAt: 3 }]);
    await st.setCollection('captures', [{ id: 'n', text: 'A parked thought', at: Date.now() }]);
    await st.setCollection('habits', { items: [{ id: 'h', name: 'Move 20 minutes' }], log: {} });
  });
  await sp.close();
  let total = 0; const summary = {};
  for (const look of LOOKS) for (const mode of ['light', 'dark']) {
    const s2 = await app.ctx.newPage(); await s2.goto(ext('src/options/options.html')); await s2.waitForTimeout(200);
    await s2.evaluate(async ([look, mode]) => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.appearance.look = look; s.appearance.mode = mode; }); }, [look, mode]); await s2.close();
    for (const [name, url, w, h] of PAGES) {
      const p = await app.ctx.newPage(); await p.setViewportSize({ width: w, height: h }); await p.goto(ext(url));
      await p.waitForTimeout(700);
      if (name === 'insights-focus') { await p.evaluate(() => localStorage.setItem('et-itab', 'focus')); await p.reload(); await p.waitForTimeout(700); }
      if (name === 'insights-overview') { await p.evaluate(() => localStorage.setItem('et-itab', 'overview')); await p.reload(); await p.waitForTimeout(700); }
      const bad = await p.evaluate(measure); const meta = await p.evaluate(() => ({ cnt: window.__cnt, min: window.__min })); (global.__stats ||= []).push(`${look}/${mode} ${name}: ${meta.cnt} nodes, min ${Math.round(meta.min * 100) / 100}`);
      for (const b of bad) { total++; const key = `${name} | ${b.sel} | "${b.text}"`; (summary[key] ||= []).push(`${look}/${mode} ${b.cr}<${b.need} fg=${b.fg} bg=${b.bg}`); }
      await p.close();
    }
  }
  const keys = Object.keys(summary);
  if (process.env.VERBOSE) console.log(global.__stats.join('\n'));
  console.log(`contrast problems: ${total} (${keys.length} distinct elements)`);
  for (const k of keys.slice(0, 60)) console.log(' ', k, '→', summary[k].slice(0, 3).join(' ; '), summary[k].length > 3 ? `(+${summary[k].length - 3})` : '');
  await app.close();
})();
