// Automated accessibility audit (axe-core, WCAG 2.1 A/AA + best practices) over every surface, in a light and a dark look, EN and RU.
//   npm i --no-save axe-core playwright && node scripts-dev/e2e/a11y.cjs [--strict]
// Prints violations grouped by rule; exits 1 with --strict when any "serious" or "critical" one remains.
const { launch } = require('./lib.cjs');
const fs = require('fs');
const path = require('path');
const AXE = fs.readFileSync(path.join(require.resolve('axe-core'), '../axe.min.js'), 'utf8');
const strict = process.argv.includes('--strict');

const SCENES = [
  ['home', 'src/newtab/newtab.html'], ['popup', 'src/popup/popup.html?site=github.com'], ['insights-overview', 'src/insights/insights.html', 'overview'], ['insights-focus', 'src/insights/insights.html', 'focus'],
  ['insights-sites', 'src/insights/insights.html', 'sites'], ['insights-patterns', 'src/insights/insights.html', 'patterns'], ['settings', 'src/options/options.html'], ['break', 'src/break/break.html'],
  ['home-running', 'src/newtab/newtab.html', null, 'running'], ['popup-running', 'src/popup/popup.html?site=github.com', null, 'running'], ['home-review', 'src/newtab/newtab.html', null, 'review'], ['popup-review', 'src/popup/popup.html', null, 'review'], ['home-rest', 'src/newtab/newtab.html', null, 'rest'],
  ['blocked-friction', 'src/blocked/blocked.html?u=http%3A%2F%2Freddit.com%2F&r=friction&a=pause'], ['blocked-always', 'src/blocked/blocked.html?u=http%3A%2F%2Freddit.com%2F&r=always&a=block'], ['onboarding', 'src/onboarding/onboarding.html'], ['dock-now', 'src/dock/dock.html#right/now'], ['dock-learn', 'src/dock/dock.html#right/learn'], ['dock-thoughts', 'src/dock/dock.html#right/thoughts'],
];

(async () => {
  const found = new Map(); let serious = 0;
  for (const [look, mode, lang] of [['calm', 'light', 'en'], ['midnight', 'dark', 'ru'], ['paper', 'light', 'pl'], ['calm', 'dark', 'ja']]) {
    const app = await launch({ viewport: { width: 1280, height: 900 }, colorScheme: mode });
    const ext = (p) => `chrome-extension://${app.id}/${p}`;
    const sp = await app.ctx.newPage(); await sp.goto(ext('src/options/options.html')); await sp.waitForTimeout(500);
    await sp.evaluate(async ([look, mode, lang]) => {
      const st = await import('/src/shared/storage.js');
      await st.updateSettings((s) => { s.onboarded = true; s.language = lang; s.appearance.look = look; s.appearance.mode = mode; s.blocking.always = ['reddit.com']; });
      const d = new Date();
      for (let i = 0; i < 14; i++) { const x = new Date(d); x.setDate(d.getDate() - i); const k = `d:${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; await chrome.storage.local.set({ [k]: { d: { 'github.com': 3000, 'reddit.com': 900, 'news.ycombinator.com': 600 }, h: { 10: { 'github.com': 3000 }, 14: { 'reddit.com': 900 } }, fs: 3000, fc: 2, b: 3, ss: [{ id: 's' + i, t: x.setHours(10, 0, 0, 0), m: 25, c: 1, r: 2, g: 'Goal' }] } }); }
      await st.setCollection('tasks', [{ id: 'a', text: 'Write the report', done: false, starred: true, createdAt: 1, est: 45 }]);
    }, [look, mode, lang]);
    await sp.close();
    for (const [name, url, tab, pre] of SCENES) {
      await app.sw.evaluate(async (pre) => {
        const now = Date.now();
        await chrome.storage.local.set({ focus: pre === 'running' ? { id: 'x', startedAt: now - 9 * 60000, endsAt: now + 16 * 60000, minutes: 25, goal: 'Write the report', strict: false, scope: 'distractions' } : null, rest: pre === 'rest' ? { startedAt: now, endsAt: now + 240000, minutes: 4, long: true } : null, review: pre === 'review' ? { id: 'r', day: new Date().toISOString().slice(0, 10), goal: 'Write the report', taskId: 'a', minutes: 25, completed: true } : null });
      }, pre || '');
      const p = await app.ctx.newPage();
      await p.goto(ext(url)); if (tab) { await p.evaluate((t) => localStorage.setItem('et-itab', t), tab); await p.reload(); }
      await p.waitForTimeout(1100);
      const extra = name === 'home' ? ['palette', 'shortcuts'] : name.startsWith('dock') ? ['void', 'noir'] : []; // the panel has three looks: the default (Glass) and these two
      for (const state of ['', ...extra]) {
        if (state === 'palette') { await p.keyboard.press('Control+k'); await p.waitForSelector('dialog.palette[open]'); await p.waitForTimeout(300); }
        if (state === 'shortcuts') { await p.keyboard.press('Escape'); await p.keyboard.press('?'); await p.waitForTimeout(300); }
        if (state === 'void' || state === 'noir') { await p.evaluate((d) => { document.documentElement.dataset.design = d; }, state === 'void' ? '1' : '3'); await p.waitForTimeout(250); }
        await p.evaluate(AXE);
        const res = await p.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })).violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n').slice(1, 2).join('').trim().slice(0, 110)), count: v.nodes.length })));
        for (const v of res) { const key = v.id; const e = found.get(key) || { ...v, where: new Set(), count: 0, sample: v.nodes[0] }; e.where.add(`${name}${state ? ':' + state : ''}[${look}/${lang}]`); e.count += v.count; found.set(key, e); if (v.impact === 'serious' || v.impact === 'critical') serious++; }
      }
      await p.close();
    }
    await app.close();
  }
  const rows = [...found.values()].sort((a, b) => ['critical', 'serious', 'moderate', 'minor'].indexOf(a.impact) - ['critical', 'serious', 'moderate', 'minor'].indexOf(b.impact));
  if (!rows.length) console.log('PASS axe: no violations');
  for (const r of rows) console.log(`[${r.impact}] ${r.id} ×${r.count} — ${r.help}\n    e.g. ${r.sample}\n    in: ${[...r.where].slice(0, 6).join(', ')}${r.where.size > 6 ? ' …' : ''}`);
  process.exit(strict && serious ? 1 : 0);
})();
