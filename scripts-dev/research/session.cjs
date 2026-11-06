// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// A clean browser for one research session: a fresh profile with EyeTime installed and nothing configured, so every participant is a first-time user.
//   node scripts-dev/research/session.cjs --id P07 [--lang en] [--ext dist/chrome] [--record] [--width 1440 --height 900] [--dark]
// The build under test is the folder with manifest.json (repo root by default, or the unpacked package: `npm run build`, then unzip dist/eyetime-chrome.zip).
// With --record the browser window is recorded to research-out/<id>/ (a .webm per page). Close the window or press Ctrl+C to end.
// Needs Playwright and Chromium (npm i --no-save playwright; npx playwright install chromium).

const path = require('path');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright')); }

function parse(argv) {
  const o = { id: '', lang: 'en', ext: path.join(__dirname, '../..'), record: false, width: 1440, height: 900, dark: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => argv[++i];
    if (a === '--id') o.id = next(); else if (a === '--lang') o.lang = next(); else if (a === '--ext') o.ext = path.resolve(next());
    else if (a === '--record') o.record = true; else if (a === '--dark') o.dark = true;
    else if (a === '--width') o.width = Number(next()); else if (a === '--height') o.height = Number(next());
    else throw new Error('unknown argument ' + a);
  }
  if (!/^P\d{2,3}$/.test(o.id)) throw new Error('--id P07 (a participant id: P and two or three digits; never a name)');
  if (!fs.existsSync(path.join(o.ext, 'manifest.json'))) throw new Error('no manifest.json in ' + o.ext);
  return o;
}

(async () => {
  const o = parse(process.argv.slice(2));
  const out = path.join(process.cwd(), 'research-out', o.id);
  fs.mkdirSync(out, { recursive: true });
  const profile = fs.mkdtempSync(path.join(require('os').tmpdir(), 'eyetime-research-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: false,
    args: [`--disable-extensions-except=${o.ext}`, `--load-extension=${o.ext}`, `--lang=${o.lang}`, '--no-first-run', '--no-default-browser-check'],
    viewport: { width: o.width, height: o.height }, colorScheme: o.dark ? 'dark' : 'light', locale: o.lang,
    ...(o.record ? { recordVideo: { dir: out, size: { width: o.width, height: o.height } } } : {}),
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 20000 });
  const id = sw.url().split('/')[2];
  for (let i = 0; i < 40 && !(await sw.evaluate(() => typeof chrome.storage !== 'undefined').catch(() => false)); i++) await new Promise((r) => setTimeout(r, 250));
  // the language of the interface follows the browser; set it the way a person would in Settings, and skip nothing else: onboarding is part of what is tested
  await sw.evaluate(async (lang) => { const { settings } = await chrome.storage.local.get('settings'); await chrome.storage.local.set({ settings: { ...(settings || {}), language: lang } }); }, o.lang);
  const pages = ctx.pages();
  const first = pages[0] || (await ctx.newPage());
  await first.goto('chrome://newtab').catch(() => first.goto(`chrome-extension://${id}/src/newtab/newtab.html`));
  console.log(`session ${o.id}: clean profile, language ${o.lang}, ${o.record ? 'recording to ' + out : 'not recording'}. Close the window to finish.`);
  await new Promise((resolve) => { ctx.on('close', resolve); process.on('SIGINT', () => ctx.close().then(resolve)); });
  fs.rmSync(profile, { recursive: true, force: true }); // nothing of the participant stays in a profile
  console.log(o.record ? `recording saved in ${out}` : 'done');
})().catch((e) => { console.error(e.message || e); process.exit(1); });
