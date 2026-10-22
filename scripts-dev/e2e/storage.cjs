// Storage meter and "Free up space": old days lose their hour-by-hour detail, recent days and totals stay; Settings shows the numbers.
//   node scripts-dev/e2e/storage.cjs
const { launch } = require('./lib.cjs');

(async () => {
  const app = await launch({ viewport: { width: 1100, height: 900 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const page = await app.ctx.newPage(); await page.goto(ext('src/options/options.html#data')); await page.waitForTimeout(800);
  const bad = [];
  await page.evaluate(async () => {
    const st = await import('/src/shared/storage.js'); const { rangeKeys } = await import('/src/shared/time.js');
    await st.updateSettings((s) => { s.onboarded = true; });
    const all = {};
    for (const key of rangeKeys(100)) all['d:' + key] = { d: { 'a.com': 600, 'b.com': 300 }, h: { 9: { 'a.com': 300, 'b.com': 100 }, 10: { 'a.com': 300, 'b.com': 200 } }, a: {}, ss: [], fs: 0, fc: 0, b: 0, sw: 0, pr: {}, pa: {}, fa: 0 };
    await chrome.storage.local.set(all);
  });
  const before = await page.evaluate(async () => { const st = await import('/src/shared/storage.js'); return st.storageUsage(); });
  if (!(before.total > 0) || before.days < 100) bad.push('storageUsage did not count the days: ' + JSON.stringify(before));
  const n = await page.evaluate(async () => { const st = await import('/src/shared/storage.js'); return st.slimNow(30); });
  const after = await page.evaluate(async () => {
    const st = await import('/src/shared/storage.js'); const { dayKey, addDays } = await import('/src/shared/time.js');
    const all = await chrome.storage.local.get(null); const old = all['d:' + dayKey(addDays(new Date(), -60))], recent = all['d:' + dayKey(addDays(new Date(), -5))];
    return { old, recent, usage: await st.storageUsage() };
  });
  if (n < 60 || n > 75) bad.push('expected ~70 days slimmed, got ' + n);
  if (after.old.h && Object.keys(after.old.h).length) bad.push('an old day kept its hourly detail');
  if (!after.old.d || after.old.d['a.com'] !== 600) bad.push('an old day lost its daily totals');
  if (!after.recent.h || !after.recent.h[9]) bad.push('a recent day lost its hourly detail');
  if (!(after.usage.total < before.total)) bad.push('nothing was freed');
  await page.reload(); await page.waitForTimeout(1200);
  const txt = await page.locator('#data').innerText();
  if (!/MB/.test(txt)) bad.push('Settings does not show the storage numbers');
  await page.locator('button', { hasText: /Free up space|Освободить место/ }).first().click(); await page.waitForTimeout(400);
  const dlg = page.locator('dialog[open]');
  if (!(await dlg.count())) bad.push('Free up space did not ask for confirmation');
  else await dlg.locator('button[value="yes"]').click();
  await page.waitForSelector('.toast', { timeout: 8000 }).catch(() => {});
  if (!(await page.locator('.toast').count())) bad.push('no confirmation after Free up space');
  console.log(bad.length ? 'FAIL storage\n  ' + bad.join('\n  ') : `PASS storage (slimmed ${n} days, totals and recent days kept, ${(before.total / 1e6).toFixed(2)} → ${(after.usage.total / 1e6).toFixed(2)} MB)`);
  await app.close(); process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
