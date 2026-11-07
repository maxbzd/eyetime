// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Load checks: a year of heavy data and a crowded browser. Prints the numbers and fails when one passes its budget.
//   node scripts-dev/e2e/perf.cjs
// Budgets leave room for slow CI machines (about 3× a developer machine). What a page loads at start is counted exactly, without a browser, in scripts-dev/tests/weight.test.mjs.
const { launch } = require('./lib.cjs');

const BUDGET = { homeMs: 1500, insightsMs: 2500, optionsMs: 1500, storageMB: 6, workerMs: 1000, tabsOpen: 60 }; // about three times what a developer machine measures (Nov 2026: home 560, insights 250, settings 240, worker 5): a new tab is the most opened page there is

(async () => {
  const app = await launch({ viewport: { width: 1280, height: 900 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const page = await app.ctx.newPage(); await page.goto(ext('src/options/options.html')); await page.waitForTimeout(600);
  const bad = [], out = {};

  // a year of dense data: 40 sites hour by hour, sessions every day, tasks, habits
  await page.evaluate(async () => {
    const st = await import('/src/shared/storage.js'); const { rangeKeys } = await import('/src/shared/time.js');
    await st.updateSettings((s) => { s.onboarded = true; s.focus.dailyGoal = 120; });
    const hosts = Array.from({ length: 40 }, (_, i) => `site${i}.example.com`);
    let n = 11; const rnd = () => (n = (n * 9301 + 49297) % 233280) / 233280;
    const all = {};
    for (const key of rangeKeys(365)) {
      const d = { d: {}, h: {}, a: {}, ss: [], fs: 0, fc: 0, b: 2, sw: 30, pr: { back: 1 }, pa: {}, fa: 1 };
      hosts.forEach((h) => { const sec = Math.round(rnd() * 2400); d.d[h] = sec; for (let hr = 8; hr < 22; hr++) (d.h[hr] ||= {})[h] = Math.round(sec / 14 * (0.5 + rnd())); });
      for (let k = 0; k < 4; k++) { d.ss.push({ id: key + k, t: Date.now(), m: 25, p: 25, g: 'Work', k: '', tg: ['work', 'study', 'admin'][k % 3], c: 1, r: 2 }); d.fs += 1500; }
      all['d:' + key] = d;
    }
    await chrome.storage.local.set(all);
    await st.setCollection('tasks', Array.from({ length: 200 }, (_, i) => ({ id: 't' + i, text: 'Task number ' + i, done: i % 3 === 0, starred: i < 3, createdAt: i, tags: ['work'] })));
  });
  out.storageMB = await page.evaluate(async () => (await chrome.storage.local.getBytesInUse(null)) / 1048576);
  if (out.storageMB > BUDGET.storageMB) bad.push(`a year of dense data takes ${out.storageMB.toFixed(1)} MB (budget ${BUDGET.storageMB})`);

  const timed = async (label, url, ready, budget, prep, runs = 1) => { // runs > 1: the median (a crowded machine swings one load by +-50 %, the same code gave 1.1-1.9 s)
    const times = [];
    for (let r = 0; r < runs; r++) {
      const p = await app.ctx.newPage(); const t0 = Date.now();
      await p.goto(ext(url)); if (prep) { await p.evaluate(prep); await p.reload(); }
      await p.waitForSelector(ready, { timeout: 20000 }).catch(() => bad.push(label + ': never became ready'));
      times.push(Date.now() - t0);
      await p.close();
    }
    out[label] = times.sort((x, y) => x - y)[Math.floor(times.length / 2)]; if (out[label] > budget) bad.push(`${label} took ${out[label]} ms (budget ${budget})`);
  };
  await timed('homeMs', 'src/newtab/newtab.html', '#goalToday', BUDGET.homeMs);
  await timed('insightsMs', 'src/insights/insights.html?range=30', '.kpi', BUDGET.insightsMs);
  await timed('insightsSitesMs', 'src/insights/insights.html?range=30', '.card table, .card .site-row, .card', BUDGET.insightsMs, () => localStorage.setItem('et-itab', 'sites'));
  await timed('optionsMs', 'src/options/options.html#data', '#data .setting', BUDGET.optionsMs);

  // a crowded browser: the worker keeps answering while many tabs are open
  const tabs = [];
  for (let i = 0; i < BUDGET.tabsOpen; i++) { const p = await app.ctx.newPage(); p.goto(`http://site${i % 40}.example.com/page${i}`).catch(() => {}); tabs.push(p); }
  await page.waitForTimeout(2500);
  const t0 = Date.now();
  const reply = await page.evaluate(async () => { const r = await chrome.runtime.sendMessage({ type: 'sync:now' }).catch((e) => ({ error: String(e) })); return r; });
  out.workerMs = Date.now() - t0;
  if (out.workerMs > BUDGET.workerMs) bad.push(`the worker took ${out.workerMs} ms to answer with ${BUDGET.tabsOpen} tabs open (budget ${BUDGET.workerMs})`);
  if (reply && reply.error) bad.push('the worker did not answer: ' + reply.error);
  await timed('homeBusyMs', 'src/newtab/newtab.html', '#goalToday', BUDGET.homeMs, undefined, 5);

  console.log(Object.entries(out).map(([k, v]) => `${k}=${typeof v === 'number' ? (k.endsWith('MB') ? v.toFixed(2) : Math.round(v)) : v}`).join('  '));
  console.log(bad.length ? 'FAIL perf\n  ' + bad.join('\n  ') : 'PASS perf: a year of data and ' + BUDGET.tabsOpen + ' tabs within budget');
  await app.close();
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
