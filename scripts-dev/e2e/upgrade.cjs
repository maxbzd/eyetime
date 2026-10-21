// Regression crawl: (1) a profile upgraded from v2.2.0 (old-shaped settings, old tasks without estimates, 20 days of data) and
// (2) a brand-new empty profile. Every extension page, every Insights tab × range and every Settings section is opened;
// any console/page error fails the run. Empty and legacy states are where "works on my data" bugs hide.
//   node scripts-dev/e2e/upgrade.cjs
const { launch } = require('./lib.cjs');
const fs = require('fs');
const path = require('path');

const fx = (v) => JSON.parse(fs.readFileSync(path.join(__dirname, `fixtures/settings-${v}.json`), 'utf8'));
const OLD = fx('2.2.0');
const PAGES = ['src/newtab/newtab.html', 'src/popup/popup.html?site=github.com', 'src/insights/insights.html', 'src/options/options.html', 'src/break/break.html', 'src/blocked/blocked.html?u=http%3A%2F%2Freddit.com%2F&r=friction&a=pause', 'src/blocked/blocked.html?u=http%3A%2F%2Freddit.com%2F&r=limit&a=block', 'src/blocked/blocked.html?u=http%3A%2F%2Freddit.com%2F&r=always&a=block', 'src/blocked/blocked.html'];
let failed = 0;

async function crawl(label, { seed, lang, from = OLD }) {
  const app = await launch({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  app.ctx.on('page', (p) => { p.on('pageerror', (e) => errs.push(`pageerror ${p.url().split('/').slice(-2).join('/')} ${e.message}`)); p.on('console', (m) => { if (m.type() === 'error') errs.push(`console ${p.url().split('/').slice(-2).join('/')} ${m.text()}`); }); });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const sp = await app.ctx.newPage(); await sp.goto(ext('src/options/options.html')); await sp.waitForTimeout(500); await sp.close();
  await app.sw.evaluate(async ([seed, old, lang]) => {
    const base = seed ? { ...old, onboarded: true, language: lang } : { onboarded: true, language: lang };
    const out = { settings: base };
    if (seed) {
      const d = new Date();
      for (let i = 0; i < 20; i++) { const x = new Date(d); x.setDate(d.getDate() - i); const k = `d:${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; out[k] = { d: { 'github.com': 3000, 'reddit.com': 900 }, h: { 10: { 'github.com': 3000 }, 14: { 'reddit.com': 900 } }, fs: 3000, fc: 2, b: 3, ss: [{ id: 's' + i, t: x.setHours(10, 0, 0, 0), m: 25, c: 1, r: 2, g: 'Old goal' }] }; }
      out.tasks = [{ id: 'a', text: 'Old task', done: false, starred: true, createdAt: 1, focusSec: 600 }, { id: 'b', text: 'Done old', done: true, createdAt: 2, focusSec: 400 }];
    }
    await chrome.storage.local.set(out);
  }, [seed, from, lang]);
  for (const pg of PAGES) { const p = await app.ctx.newPage(); await p.goto(ext(pg)); await p.waitForTimeout(900); await p.close(); }
  const ins = await app.ctx.newPage();
  for (const tab of ['overview', 'focus', 'sites', 'patterns']) for (const r of ['today', '7', '30']) {
    await ins.goto(ext('src/insights/insights.html?range=' + r)); await ins.evaluate((t) => localStorage.setItem('et-itab', t), tab); await ins.reload(); await ins.waitForTimeout(450);
    await ins.keyboard.press('Control+k'); await ins.waitForTimeout(250); await ins.keyboard.press('Escape');
  }
  const opt = await app.ctx.newPage();
  for (const sec of ['general', 'appearance', 'focus', 'blocking', 'eye', 'tracking', 'data', 'about']) { await opt.goto(ext('src/options/options.html#' + sec)); await opt.waitForTimeout(350); }
  const nt = await app.ctx.newPage(); await nt.goto(ext('src/newtab/newtab.html')); await nt.waitForTimeout(900);
  await nt.keyboard.press('Control+k'); await nt.waitForTimeout(300); await nt.keyboard.type('zzzz plan 25m'); await nt.waitForTimeout(250); await nt.keyboard.press('Escape');
  await nt.keyboard.press('?'); await nt.waitForTimeout(200);
  // feature checks that depend on the profile kind
  const logic = [];
  if (!seed) {
    await nt.reload(); await nt.waitForTimeout(900);
    if (!(await nt.locator('#gs').isVisible())) logic.push('Get-started card missing on a brand-new profile');
    else if ((await nt.locator('.gs-step').count()) !== 4) logic.push('Get-started card should list 4 steps');
    await nt.locator('#gs button[aria-label]').first().click(); await nt.waitForTimeout(300); await nt.reload(); await nt.waitForTimeout(700);
    if (await nt.locator('#gs').isVisible()) logic.push('Get-started card came back after being dismissed');
  } else {
    await opt.goto(ext('src/options/options.html#data')); await opt.waitForTimeout(500);
    const [dl] = await Promise.all([opt.waitForEvent('download', { timeout: 8000 }).catch(() => null), opt.locator('button', { hasText: /Export journal|Экспорт дневника/ }).click()]);
    await nt.goto(ext('src/newtab/newtab.html')); await nt.waitForTimeout(900);
    await nt.locator('#mod-tasks .plan-btn').click(); await nt.waitForSelector('dialog[open] .dialog-body');
    const planTxt = await nt.locator('dialog[open]').innerText();
    if (!/Plan my day|План на день/.test(planTxt) || !(/Old task/.test(planTxt) || /Nothing fits|До конца рабочего дня/.test(planTxt))) logic.push('Plan dialog content wrong: ' + planTxt.slice(0, 120));
    await nt.keyboard.press('Escape');
    // dates in words: "tomorrow" shows a preview chip, becomes a due chip, and the task stays out of today's plan
    const qa = nt.locator('#mod-tasks input.input').first(); await qa.fill('Pay the rent tomorrow'); await nt.waitForTimeout(250);
    if (!/Tomorrow|Завтра/.test(await nt.locator('#mod-tasks .qa-preview').innerText())) logic.push('Quick add: no preview chip for "tomorrow"');
    await qa.press('Enter'); await nt.waitForTimeout(500);
    const rentRow = nt.locator('#mod-tasks .item', { hasText: 'Pay the rent' });
    const rentTxt = (await rentRow.count()) ? await rentRow.first().innerText() : '';
    if (!/Tomorrow|Завтра/.test(rentTxt) || /rent +tomorrow/i.test(rentTxt)) logic.push('Quick add: due chip missing or the word stayed in the title: ' + rentTxt.slice(0, 80) + ' | ' + JSON.stringify((await nt.evaluate(() => chrome.storage.local.get('tasks'))).tasks.slice(0, 2)));
    // "What's new": the worker sets the key on a minor update; the card shows three lines and a click dismisses it for good
    await nt.evaluate(() => chrome.storage.local.set({ whatsNew: { version: '9.9.0', from: '9.8.0' } })); await nt.reload(); await nt.waitForTimeout(800);
    if (!(await nt.locator('#wn').isVisible()) || (await nt.locator('#wn li').count()) !== 3) logic.push("What's new card missing or wrong");
    else { await nt.locator('#wn .btn-ghost.btn-sm:not(.btn-icon)').click(); await nt.waitForTimeout(300); await nt.reload(); await nt.waitForTimeout(700); if (await nt.locator('#wn').isVisible()) logic.push("What's new card came back after dismissal"); }
    // "what pulls you": reddit.com is used at 14:00 every day → a window trigger with a one-tap limit
    const insp = await app.ctx.newPage(); await insp.goto(ext('src/insights/insights.html')); await insp.evaluate(() => localStorage.setItem('et-itab', 'sites')); await insp.reload(); await insp.waitForTimeout(900);
    if (!(await insp.locator('.trig').count())) logic.push('No trigger card for a daily distracting site');
    else {
      const txt = await insp.locator('.trig').first().innerText();
      if (!/reddit\.com/.test(txt) || !/100%/.test(txt) || !/(1:00|13:00)/.test(txt)) logic.push('Trigger card text wrong: ' + txt.slice(0, 100));
      await insp.locator('.trig button', { hasText: /Limit to|Лимит/ }).first().click(); await insp.waitForTimeout(600);
      const lim = await insp.evaluate(async () => (await chrome.storage.local.get('settings')).settings.blocking.limits);
      if (!lim['reddit.com']) logic.push('One-tap limit was not saved');
    }
    await insp.close();
    // calendar file → status in Settings, next-meeting line on Home
    const soon = new Date(Date.now() + 90 * 60000), p2 = (n) => String(n).padStart(2, '0'), stamp = (d) => `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}T${p2(d.getHours())}${p2(d.getMinutes())}00`;
    const endAt = new Date(soon.getTime() + 30 * 60000), sameDay = soon.getDate() === new Date().getDate();
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:t1', `DTSTART:${stamp(soon)}`, `DTEND:${stamp(endAt)}`, 'SUMMARY:Team sync', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    await opt.goto(ext('src/options/options.html#data')); await opt.waitForTimeout(500);
    await opt.setInputFiles('input[type=file][accept*=ics]', { name: 'cal.ics', mimeType: 'text/calendar', buffer: Buffer.from(ics) }); await opt.waitForTimeout(700);
    if (!/1 event|1 событие/.test(await opt.locator('.sync-status').first().innerText())) logic.push('Calendar status did not update');
    if (sameDay) { await nt.goto(ext('src/newtab/newtab.html')); await nt.waitForTimeout(1200); if (!(await nt.locator('.cal-line').count()) || !/Team sync/.test(await nt.locator('.cal-line').first().innerText())) logic.push('Home does not show the next meeting'); }
    await opt.goto(ext('src/options/options.html#about')); await opt.waitForTimeout(500);
    await opt.locator('button', { hasText: /Prepare report|Подготовить отчёт/ }).click(); await opt.waitForSelector('dialog[open] textarea');
    const rep = await opt.locator('dialog[open] textarea').inputValue();
    if (!/^EyeTime \d+\.\d+\.\d+/.test(rep) || !/Data: \d+ days/.test(rep)) logic.push('Diagnostic report malformed: ' + rep.slice(0, 80));
    if (/github\.com|reddit\.com|Old task|Old goal/.test(rep)) logic.push('Diagnostic report leaks site/task names');
    await opt.keyboard.press('Escape');
    if (!dl) logic.push('Journal export did not download');
    else { const body = fs.readFileSync(await dl.path(), 'utf8'); if (!/EyeTime|EyeTime/.test(body) || !/Old goal/.test(body) || /github\.com|reddit\.com/.test(body)) logic.push('Journal content wrong: ' + body.slice(0, 120)); }
  }
  for (const m of logic) errs.push('logic ' + m);
  console.log(errs.length ? `FAIL ${label}\n  ` + [...new Set(errs)].join('\n  ') : `PASS ${label}: no console errors on ${PAGES.length + 12 + 8 + 1} page loads`);
  if (errs.length) failed++;
  await app.close();
}


// (3) narrow + large text + very long hostnames/goals: no page may scroll sideways.
async function narrow(label, lang) {
  const app = await launch({ viewport: { width: 400, height: 900 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const LONG = 'extremely-long-subdomain-name.some-company-internal-tools.example.com';
  const sp = await app.ctx.newPage(); await sp.goto(ext('src/options/options.html')); await sp.waitForTimeout(500); await sp.close();
  await app.sw.evaluate(async ([old, lang, LONG]) => {
    const settings = { ...old, onboarded: true, language: lang, appearance: { ...old.appearance, scale: 125, look: 'terminal', mode: 'dark' }, blocking: { ...old.blocking, custom: ['example.org', LONG], allow: ['docs.google.com'], always: [LONG], plans: [{ id: 'p', when: LONG, then: 'Prepare the quarterly business review deck for the leadership team' }], limits: { [LONG]: 30 } } };
    const out = { settings, tasks: [{ id: 'a', text: 'Prepare the quarterly business review deck for the leadership team including revenue forecast and hiring plan', done: false, starred: true, createdAt: 1, est: 45, focusSec: 600, resume: 'Draft section two then the charts and the appendix with all numbers' }] };
    const d = new Date();
    for (let i = 0; i < 20; i++) { const x = new Date(d); x.setDate(d.getDate() - i); const k = `d:${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; out[k] = { d: { [LONG]: 3000, 'github.com': 900 }, h: { 10: { [LONG]: 3000 } }, fs: 3000, fc: 2, b: 3, ss: [{ id: 's' + i, t: x.setHours(10, 0, 0, 0), m: 25, c: 1, r: 2, g: 'Prepare the quarterly business review deck for the leadership team' }] }; }
    await chrome.storage.local.set(out);
  }, [OLD, lang, LONG]);
  const urls = ['src/newtab/newtab.html', 'src/popup/popup.html?site=' + LONG, 'src/break/break.html', 'src/onboarding/onboarding.html', 'src/blocked/blocked.html?u=' + encodeURIComponent('http://' + LONG + '/x') + '&r=limit&a=block'];
  for (const tab of ['overview', 'focus', 'sites', 'patterns']) urls.push('INS:' + tab);
  for (const sec of ['general', 'appearance', 'focus', 'blocking', 'eye', 'tracking', 'data', 'about']) urls.push('src/options/options.html#' + sec);
  const bad = [];
  const p = await app.ctx.newPage(); await p.setViewportSize({ width: 400, height: 900 });
  for (const u of urls) {
    if (u.startsWith('INS:')) { await p.goto(ext('src/insights/insights.html')); await p.evaluate((t) => localStorage.setItem('et-itab', t), u.slice(4)); await p.reload(); } else await p.goto(ext(u));
    await p.waitForTimeout(700);
    const w = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    const popup = u.includes('popup'); // the popup is wider than 400 px by design at 125 % (380 px × scale)
    if (!popup && w.sw > w.cw + 1) {
      const who = await p.evaluate(() => { const cw = document.documentElement.clientWidth; const clipped = (el) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true; } return false; }; const out = []; for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect(); if (r.width > 0 && r.right > cw + 1 && !clipped(el)) out.push(`${el.tagName.toLowerCase()}.${String(el.className.baseVal ?? el.className).split(' ').join('.')}→${Math.round(r.right)}[${(el.textContent || '').trim().slice(0, 24)}|${el.parentElement && el.parentElement.className}]`); } return out.slice(0, 5).join(' '); });
      bad.push(`${u}: scrollWidth ${w.sw} > ${w.cw}  [${who}]`);
    }
  }
  console.log(bad.length ? `FAIL ${label}\n  ` + bad.join('\n  ') : `PASS ${label}: no horizontal scroll on ${urls.length} narrow pages`);
  if (bad.length) failed++;
  await app.close();
}

(async () => {
  if (!process.env.ONLY || new RegExp(process.env.ONLY).test('narrow + 125% + long names (ru)')) await narrow('narrow + 125% + long names (ru)', 'ru');
  if (!process.env.ONLY || new RegExp(process.env.ONLY).test('narrow + 125% + long names (en)')) await narrow('narrow + 125% + long names (en)', 'en');
  for (const l of ['de', 'fr', 'es', 'pt']) if (!process.env.ONLY || new RegExp(process.env.ONLY).test('narrow + 125% + long names (' + l + ')')) await narrow(`narrow + 125% + long names (${l})`, l);
  if (!process.env.ONLY || new RegExp(process.env.ONLY).test('upgrade from v2.1.0 (en)')) await crawl('upgrade from v2.1.0 (en)', { seed: true, lang: 'en', from: fx('2.1.0') });
  if (!process.env.ONLY || new RegExp(process.env.ONLY).test('upgrade from v2.5.3 (en)')) await crawl('upgrade from v2.5.3 (en)', { seed: true, lang: 'en', from: fx('2.5.3') });
  if (!process.env.ONLY || new RegExp(process.env.ONLY).test('upgrade from v2.2.0 (en)')) await crawl('upgrade from v2.2.0 (en)', { seed: true, lang: 'en' });
  if (!process.env.ONLY || new RegExp(process.env.ONLY).test('upgrade from v2.2.0 (ru)')) await crawl('upgrade from v2.2.0 (ru)', { seed: true, lang: 'ru' });
  if (!process.env.ONLY || new RegExp(process.env.ONLY).test('empty profile (en)')) await crawl('empty profile (en)', { seed: false, lang: 'en' });
  if (!process.env.ONLY || new RegExp(process.env.ONLY).test('empty profile (ru)')) await crawl('empty profile (ru)', { seed: false, lang: 'ru' });
  process.exit(failed ? 1 : 0);
})();
