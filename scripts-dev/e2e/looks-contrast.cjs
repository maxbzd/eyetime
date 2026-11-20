// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Every look, light and dark, on Home in the Centre arrangement (the one with the focus card, its mode chips and its start button): axe's colour-contrast rule must find nothing.
// The sweep of the other pages (contrast-sweep.cjs) opens Home as Today, where this card is not drawn: a selected chip painted light-on-light in a look went unseen for that reason.
//   node scripts-dev/e2e/looks-contrast.cjs
const fs = require('fs');
const path = require('path');
const { launch } = require('./lib.cjs');
const { seed } = require('./seed.cjs');
const AXE = fs.readFileSync(path.join(require.resolve('axe-core'), '../axe.min.js'), 'utf8');

(async () => {
  const app = await launch({ viewport: { width: 1280, height: 900 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const sp = await app.ctx.newPage(); await sp.goto(ext('src/options/options.html'));
  const ids = await sp.evaluate(async () => (await import('/src/shared/looks.js')).LOOK_IDS);
  const bad = [];
  for (const look of ids) for (const mode of ['light', 'dark']) {
    await seed(sp, { look, mode, background: 'look', clockStyle: 'thin', layout: 'center' });
    const p = await app.ctx.newPage(); await p.emulateMedia({ colorScheme: mode });
    await p.goto(ext('src/newtab/newtab.html')); await p.waitForTimeout(1100);
    await p.evaluate(AXE);
    const r = await p.evaluate(async () => (await axe.run(document, { runOnly: ['color-contrast'] })).violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ').slice(0, 60) + ' ' + ((n.any[0] && n.any[0].message) || '').replace(/Element has insufficient color contrast of /, '').slice(0, 50))));
    for (const m of r) bad.push(`${look}/${mode}: ${m}`);
    await p.close();
  }
  await app.close();
  console.log(bad.length ? 'FAIL looks-contrast\n  ' + bad.slice(0, 20).join('\n  ') : `PASS looks-contrast: ${ids.length} looks × 2 schemes, no colour-contrast violation on Home`);
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.log('FAIL (crashed)\n' + e); process.exit(1); });
