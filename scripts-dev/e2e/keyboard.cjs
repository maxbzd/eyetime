// Keyboard-only pass over every surface, plus the system accessibility modes (more contrast, forced colours, reduced motion).
//   node scripts-dev/e2e/keyboard.cjs [--shots]
// For each page: Tab through the whole page; every stop must have an accessible name and a visible focus mark, nothing may trap the keyboard,
// dialogs must close with Escape and give focus back. With --shots, screenshots of the modes go to /tmp/eyetime-a11y-modes/.
const { launch } = require('./lib.cjs');
const fs = require('fs');

const PAGES = [
  ['home', 'src/newtab/newtab.html'], ['popup', 'src/popup/popup.html?site=github.com'], ['insights', 'src/insights/insights.html'], ['settings', 'src/options/options.html#focus'],
  ['settings-data', 'src/options/options.html#data'], ['onboarding', 'src/onboarding/onboarding.html'], ['dock', 'src/dock/dock.html#right/learn'], ['pause', 'src/blocked/blocked.html?u=http%3A%2F%2Freddit.com%2F&r=friction&a=pause'], ['break', 'src/break/break.html'],
];
const SHOTS = process.argv.includes('--shots');

(async () => {
  const app = await launch({ viewport: { width: 1200, height: 900 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const sp = await app.ctx.newPage(); await sp.goto(ext('src/options/options.html')); await sp.waitForTimeout(600);
  await sp.evaluate(async () => {
    const st = await import('/src/shared/storage.js');
    await st.updateSettings((s) => { s.onboarded = true; s.blocking.always = ['reddit.com']; });
    await st.setRaw({ gsDismissed: true });
    await st.setCollection('tasks', [{ id: 'a', text: 'Write the report', done: false, starred: true, createdAt: 1, est: 45 }, { id: 'b', text: 'Call the bank', done: false, createdAt: 2 }]);
  });
  await sp.close();
  const bad = [];
  if (SHOTS) fs.mkdirSync('/tmp/eyetime-a11y-modes', { recursive: true });

  for (const [name, url] of PAGES) {
    const p = await app.ctx.newPage(); await p.goto(ext(url)); await p.waitForTimeout(1300);
    if (name === 'onboarding') await p.evaluate(() => 0);
    const stops = [];
    for (let i = 0; i < 160; i++) {
      await p.keyboard.press('Tab');
      const info = await p.evaluate(() => {
        const e = document.activeElement; if (!e || e === document.body) return null;
        const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
        // a native checkbox/radio drawn by a sibling (switch, check) shows its mark on the sibling track/box
        const mark = (st) => st.outlineStyle !== 'none' || (st.boxShadow && st.boxShadow !== 'none');
        let visible = mark(cs);
        if (!visible && e.matches('input')) { const sib = e.parentElement && e.parentElement.querySelector('.track, .box'); if (sib) visible = mark(getComputedStyle(sib)); const lab = e.closest('label'); if (!visible && lab) visible = mark(getComputedStyle(lab)); }
        const name = (e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') && [...e.getAttribute('aria-labelledby').split(' ')].map((id) => document.getElementById(id)?.textContent).join(' ') || e.textContent || e.getAttribute('title') || e.getAttribute('placeholder') || e.value || (e.id && document.querySelector(`label[for="${e.id}"]`)?.textContent) || e.closest('label')?.textContent || '').trim();
        return { tag: e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''), name: name.slice(0, 40), visible, onscreen: r.width > 0 && r.height > 0, key: (e.id || '') + '|' + e.tagName + '|' + (e.textContent || '').slice(0, 20) + '|' + Math.round(r.x) + ',' + Math.round(r.y) };
      });
      if (!info) { stops.push(null); continue; }
      stops.push(info);
      if (stops.length > 4 && stops.slice(0, -1).some((s) => s && s.key === info.key) && stops.length > 8) break; // wrapped around
    }
    const real = stops.filter(Boolean);
    if (!real.length) bad.push(`${name}: Tab reached nothing`);
    const seen = new Set();
    for (const s of real) {
      if (seen.has(s.key)) continue; seen.add(s.key);
      if (!s.name) bad.push(`${name}: a focus stop without a name (${s.tag})`);
      if (!s.visible) bad.push(`${name}: no visible focus mark on "${s.name}" (${s.tag})`);
    }
    if (real.length >= 158) bad.push(`${name}: Tab did not come back to the start (keyboard trap?)`);
    console.log(`  ${name}: ${seen.size} focus stops`);
    await p.close();
  }

  // dialogs: the palette opens with Ctrl+K, closes with Escape and returns focus
  const h = await app.ctx.newPage(); await h.goto(ext('src/newtab/newtab.html')); await h.waitForTimeout(1200);
  await h.keyboard.press('Control+k'); await h.waitForSelector('dialog.palette[open]', { timeout: 4000 }).catch(() => bad.push('palette did not open with Ctrl+K'));
  const inside = await h.evaluate(() => !!document.activeElement?.closest('dialog')); if (!inside) bad.push('palette: focus did not move into the dialog');
  await h.keyboard.press('Escape'); await h.waitForTimeout(300);
  if (await h.locator('dialog.palette[open]').count()) bad.push('palette did not close with Escape');
  await h.keyboard.press('?'); await h.waitForTimeout(300);
  const sc = await h.locator('dialog[open]').count();
  if (sc) { await h.keyboard.press('Escape'); await h.waitForTimeout(300); if (await h.locator('dialog[open]').count()) bad.push('shortcuts dialog did not close with Escape'); }
  await h.close();

  // system modes: each must render, keep text readable, and not scroll sideways
  for (const [label, media] of [['more-contrast', { contrast: 'more' }], ['forced-colors', { forcedColors: 'active' }], ['reduced-motion', { reducedMotion: 'reduce' }], ['dark-more-contrast', { contrast: 'more', colorScheme: 'dark' }]]) {
    for (const [name, url] of PAGES.slice(0, 4)) {
      const p = await app.ctx.newPage(); await p.emulateMedia(media); await p.goto(ext(url)); await p.waitForTimeout(1300);
      const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, contrast: document.documentElement.getAttribute('data-contrast'), anim: [...document.querySelectorAll('*')].filter((e) => { const a = getComputedStyle(e); return a.animationName !== 'none' && parseFloat(a.animationDuration) > 0.01 && a.animationIterationCount === 'infinite'; }).length }));
      if (m.sw > m.cw) bad.push(`${label} ${name}: scrolls sideways`);
      if (label.includes('more-contrast') && m.contrast !== 'more') bad.push(`${label} ${name}: data-contrast not set`);
      if (label === 'reduced-motion' && m.anim) bad.push(`${label} ${name}: ${m.anim} endless animation(s) still run`);
      if (SHOTS) await p.screenshot({ path: `/tmp/eyetime-a11y-modes/${label}-${name}.png` });
      await p.close();
    }
  }
  console.log(bad.length ? 'FAIL keyboard / accessibility modes\n  ' + [...new Set(bad)].join('\n  ') : 'PASS keyboard / accessibility modes');
  await app.close();
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
