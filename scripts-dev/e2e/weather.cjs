// Optional weather end to end: nothing is requested while it is off; with a city it shows the temperature, rain or snow is drawn over the background, errors are told plainly,
// the settings find a city. The extension runs from a copy whose manifest already holds the host permission (a real user grants it in the browser's prompt).
//   node scripts-dev/e2e/weather.cjs
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const SRC = path.join(__dirname, '../..');
const EXT_COPY = '/tmp/eyetime-ext-weather';
fs.rmSync(EXT_COPY, { recursive: true, force: true });
fs.mkdirSync(EXT_COPY, { recursive: true });
for (const item of ['src', '_locales', 'icons']) cp.execFileSync('cp', ['-r', path.join(SRC, item), EXT_COPY]);
const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
manifest.host_permissions = ['https://api.open-meteo.com/*', 'https://geocoding-api.open-meteo.com/*'];
fs.writeFileSync(path.join(EXT_COPY, 'manifest.json'), JSON.stringify(manifest));
process.env.EXT = EXT_COPY;
const { launch } = require('./lib.cjs');

(async () => {
  const app = await launch({ viewport: { width: 1440, height: 900 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [];
  process.on('unhandledRejection', (e) => { console.log('FAIL (crashed)\n' + bad.join('\n') + '\n' + e); process.exit(1); });
  const ok = (cond, msg) => { if (!cond) bad.push(msg); };
  const hits = []; let code = 61, status = 200;
  await app.ctx.route(/open-meteo\.com/, (route) => {
    const req = route.request(), u = new URL(req.url()); hits.push({ url: req.url(), headers: req.headers() });
    if (status !== 200) return route.fulfill({ status, body: '{}' });
    if (u.hostname.startsWith('geocoding')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [{ name: 'Kyiv', latitude: 50.4501, longitude: 30.5234, admin1: 'Kyiv City', country: 'Ukraine' }, { name: 'Kyivske', latitude: 49.1, longitude: 33.2, admin1: 'Cherkasy', country: 'Ukraine' }] }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ current: { temperature_2m: 7.6, apparent_temperature: 4.2, weather_code: code, is_day: 1 }, daily: { temperature_2m_max: [9.4], temperature_2m_min: [3.1], precipitation_probability_max: [80] } }) });
  });
  const sp = await app.ctx.newPage(); await sp.goto(ext('src/options/options.html')); await sp.waitForTimeout(600);
  const set = (fn, arg) => sp.evaluate(async ([src, a]) => { const st = await import('/src/shared/storage.js'); await st.updateSettings(new Function('s', 'a', src)); }, [`(${fn})(s, a)`, arg]).catch(() => {});
  await sp.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.onboarded = true; s.language = 'en'; s.newtab.widgets = [{ id: 'wwx01', kind: 'weather', cfg: {} }]; }); await st.setRaw({ gsDismissed: true }); });
  const cfg = (patch) => sp.evaluate(async (pt) => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { Object.assign(s.weather, pt); }); }, patch);
  const clearCache = () => sp.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.setRaw({ weatherCache: null }); });
  const p = await app.ctx.newPage();
  p.on('pageerror', (e) => bad.push('pageerror: ' + e)); p.on('console', (m) => { if (m.type() === 'error' && !/status of 500/.test(m.text())) bad.push('console: ' + m.text()); });
  const open = async (hash = '') => { await p.goto(ext('src/newtab/newtab.html') + hash); await p.waitForTimeout(1600); };
  const painted = () => p.evaluate(() => { const c = document.querySelector('.wx-fx'); if (!c) return -1; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4 * 7) if (d[i] > 20) n++; return n; });

  // off by default: not a single request, no effect, the widget invites to turn it on
  await open();
  ok(hits.length === 0, 'nothing is requested while the weather is off: ' + hits.length);
  ok(await p.locator('.wx-fx').count() === 0, 'no effect canvas while it is off');
  ok(/Weather is off/.test(await p.locator('#wgt-wwx01').textContent()) && await p.locator('#wgt-wwx01 a[href*="options.html#general"]').count() === 1, 'the widget says it is off and links to Settings');

  // on with a city: temperature, words, range, rain chance; one request that carries only the coordinates
  await cfg({ on: true, place: { name: 'Kyiv', lat: 50.4501, lon: 30.5234 }, unit: 'c', effect: true });
  await open();
  const w = await p.locator('#wgt-wwx01').textContent();
  ok(/Kyiv/.test(w) && /8°/.test(w) && /Rain/.test(w) && /Feels like 4°/.test(w) && /High 9° · Low 3°/.test(w) && /80% chance of rain/.test(w), 'the widget shows the forecast: ' + w);
  ok(hits.length === 1 && /latitude=50\.45&longitude=30\.52/.test(hits[0].url) && !/Kyiv/.test(hits[0].url), 'one request, only rounded coordinates: ' + (hits[0] && hits[0].url));
  ok(!hits[0].headers.cookie && !hits[0].headers.referer, 'no cookies, no referrer');
  ok(await p.locator('.wx-fx').count() === 1 && (await painted()) > 30, 'rain is drawn over the background: ' + await painted());
  const z = await p.evaluate(() => getComputedStyle(document.querySelector('.wx-fx')).zIndex + '|' + getComputedStyle(document.querySelector('.wx-fx')).pointerEvents);
  ok(z === '-1|none', 'the effect sits behind the page and takes no clicks: ' + z);
  const before = hits.length; await open(); ok(hits.length === before, 'a second open within half an hour uses the saved answer');

  // snow, and the effect switch
  code = 73; await clearCache(); await open();
  ok(/Snow/.test(await p.locator('#wgt-wwx01').textContent()) && (await painted()) > 30, 'snow is drawn and named');
  await cfg({ effect: false }); await p.waitForTimeout(800);
  ok(await p.locator('.wx-fx').count() === 0, 'the effect switch removes the canvas');
  await cfg({ effect: true }); code = 0; await clearCache(); await open();
  ok(/Clear/.test(await p.locator('#wgt-wwx01').textContent()) && await p.locator('.wx-fx').count() === 0, 'clear weather draws nothing');

  // reduced motion: one still picture
  await p.emulateMedia({ reducedMotion: 'reduce' });
  code = 61; await clearCache(); await open();
  await p.waitForSelector('.wx-fx', { timeout: 4000 }); await p.waitForTimeout(400);
  const a = await p.evaluate(() => document.querySelector('.wx-fx').toDataURL()); await p.waitForTimeout(500);
  const b = await p.evaluate(() => document.querySelector('.wx-fx').toDataURL());
  ok((await painted()) > 30 && a === b, 'with reduced motion the drops stay still: ' + (await painted()) + ' ' + (a === b));
  await p.emulateMedia({ reducedMotion: 'no-preference' });

  // a photo: drops show it (no errors), and the hash preview works without the weather
  await sp.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 640; c.height = 400; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 640, 400); gr.addColorStop(0, '#254a6b'); gr.addColorStop(1, '#d9a35b'); g.fillStyle = gr; g.fillRect(0, 0, 640, 400);
    const st = await import('/src/shared/storage.js'); await st.setRaw({ newtabBg: c.toDataURL('image/jpeg', .8) }); await st.updateSettings((s) => { s.newtab.background = 'photo'; });
  });
  await open(); ok((await painted()) > 30, 'rain over a photo draws');
  await cfg({ on: false }); await open('#fx=snow'); ok((await painted()) > 30, '#fx=snow previews snow without the weather');
  await open(); ok(await p.locator('.wx-fx').count() === 0, 'and without the hash nothing is drawn');

  // errors: the last good answer stays on screen, otherwise a plain message
  await cfg({ on: true }); code = 61; await clearCache(); await open();
  status = 500;
  await sp.evaluate(async () => { const st = await import('/src/shared/storage.js'); const c = (await st.getRaw('weatherCache')).weatherCache; c.at = Date.now() - 3 * 3600_000; await st.setRaw({ weatherCache: c }); });
  await open();
  ok(/8°/.test(await p.locator('#wgt-wwx01').textContent()), 'when the network fails the last forecast stays');
  await clearCache(); await open();
  ok(/Could not get the weather/.test(await p.locator('#wgt-wwx01').textContent()), 'with nothing saved the widget says it could not get the weather');
  status = 200;

  // Settings: turn on, find a city, pick it, unit, effect
  await cfg({ on: false, place: null });
  await sp.goto(ext('src/options/options.html#general')); await sp.waitForTimeout(900);
  await sp.locator('.setting', { hasText: 'Show the weather' }).locator('input[type="checkbox"]').check({ force: true }); await sp.waitForTimeout(900);
  const st1 = await sp.evaluate(async () => (await (await import('/src/shared/storage.js')).getSettings()).weather);
  ok(st1.on === true, 'the switch turns the weather on');
  const q = sp.locator('input[aria-label="Search for a city"]'); await q.fill('Kyiv'); await q.press('Enter'); await sp.waitForTimeout(800);
  ok(await sp.locator('.wx-pick').count() === 2 && /Kyiv City, Ukraine/.test(await sp.locator('.wx-pick').first().textContent()), 'the search lists cities with their region');
  await sp.locator('.wx-pick').first().click(); await sp.waitForTimeout(700);
  const st2 = await sp.evaluate(async () => (await (await import('/src/shared/storage.js')).getSettings()).weather);
  ok(st2.place && st2.place.name === 'Kyiv' && st2.place.lat === 50.45, 'a chosen city is saved: ' + JSON.stringify(st2.place));
  ok(/Showing the weather for Kyiv/.test(await sp.locator('.setting:has(.setting-title:text-is("City"))').textContent()), 'the page says which city is shown');
  await sp.locator('.segmented button', { hasText: '°F' }).click(); await sp.waitForTimeout(500);
  ok((await sp.evaluate(async () => (await (await import('/src/shared/storage.js')).getSettings()).weather.unit)) === 'f', 'the unit is saved');
  await sp.locator('.setting', { hasText: 'Show the weather' }).locator('input[type="checkbox"]').uncheck({ force: true }); await sp.waitForTimeout(700);
  ok(await sp.locator('.wx-pick').count() === 0 && !(await sp.evaluate(async () => (await (await import('/src/shared/storage.js')).getSettings()).weather.on)), 'turning it off hides the rest');

  console.log(bad.length ? 'FAIL\n' + bad.join('\n') : 'weather: all checks passed');
  await app.close();
  process.exit(bad.length ? 1 : 0);
})();
