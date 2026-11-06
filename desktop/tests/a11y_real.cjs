// The window's screens through axe (WCAG 2.1 A and AA, best practices), in the real mode (the pretend computer behind it), each screen in both languages. With no flag a serious or
// critical finding fails; `--report` only lists. (Driving the window with the keyboard alone and with a screen reader is not covered by this test: axe cannot say whether a screen is pleasant to use that way.)
//   cargo build -p eyetime-helper --bin eyetime-sim && ./target/debug/eyetime-sim prototype 8131 &  then:  node desktop/tests/a11y_real.cjs   (needs playwright and axe-core)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const AXE = fs.readFileSync(path.join(require.resolve('axe-core'), '../axe.min.js'), 'utf8');
const BASE = process.env.SIM || 'http://127.0.0.1:8131';
const strict = !process.argv.includes('--report');
let failed = 0;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { window.__TAURI__ = { core: { invoke: async (cmd, a) => { if (cmd === 'helper') { const r = await fetch('/req', { method: 'POST', body: JSON.stringify(a.req) }); return r.json(); } return null; } } }; });
  const page = await ctx.newPage();
  await page.goto(BASE + '/home.html'); await page.waitForTimeout(5500);
  const seen = new Map();
  for (const lang of ['en', 'ru']) {
    for (const screen of ['home', 'insights', 'profile', 'rules', 'settings']) {
      await page.evaluate(([l, s]) => { try { localStorage.setItem('et-lang', l); } catch {} if (window.ET) { if (window.ET.setLang) window.ET.setLang(l); window.ET.go(s); } }, [lang, screen]);
      await page.waitForTimeout(1300);
      await page.evaluate(AXE);
      const res = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }, rules: { 'color-contrast': { enabled: true } } })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, sample: v.nodes.slice(0, 2).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n')[1]) })));
      for (const v of res) { const k = v.id + '|' + v.impact; const e = seen.get(k) || { ...v, where: [], n: 0 }; e.n += v.n; e.where.push(`${lang}/${screen}`); seen.set(k, e); }
    }
  }
  const all = [...seen.values()].sort((a, b) => (a.impact === 'critical' ? 0 : a.impact === 'serious' ? 1 : 2) - (b.impact === 'critical' ? 0 : b.impact === 'serious' ? 1 : 2));
  for (const v of all) console.log(`${v.impact.toUpperCase().padEnd(8)} ${v.id} x${v.n} (${[...new Set(v.where)].join(', ')}): ${v.help}\n           ${v.sample.join('\n           ')}`);
  const blocking = all.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  if (strict && blocking.length) failed += blocking.length;
  console.log(`\n${all.length} kinds of finding, ${blocking.length} serious or critical`);
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
