// The dock end to end: turn it on (the test build declares the website permission a real user grants in the browser's prompt), see the tab on a page,
// open the panel, save the page into a topic, work with topics / links / thoughts, move the tab, hide the dock on a site, turn it off.
//   node scripts-dev/e2e/dock.cjs
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const SRC = path.join(__dirname, '../..');
const EXT_COPY = '/tmp/eyetime-ext-dock';
fs.rmSync(EXT_COPY, { recursive: true, force: true });
fs.mkdirSync(EXT_COPY, { recursive: true });
for (const item of ['src', '_locales', 'icons']) cp.execFileSync('cp', ['-r', path.join(SRC, item), EXT_COPY]);
const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
manifest.host_permissions = ['http://127.0.0.1/*'];
fs.writeFileSync(path.join(EXT_COPY, 'manifest.json'), JSON.stringify(manifest));
process.env.EXT = EXT_COPY;
const { launch } = require('./lib.cjs');

(async () => {
  const app = await launch({ viewport: { width: 1280, height: 800 } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const bad = [];
  const opts = await app.ctx.newPage(); await opts.goto(ext('src/options/options.html')); await opts.waitForTimeout(800);
  const get = (k) => opts.evaluate(async (k) => (await chrome.storage.local.get(k))[k], k);
  await opts.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.onboarded = true; s.dock.enabled = true; }); await chrome.runtime.sendMessage({ type: 'settings:changed' }); await st.setRaw({ gsDismissed: true }); });
  await opts.waitForTimeout(600);

  const page = await app.ctx.newPage();
  await page.goto('http://127.0.0.1/articles/python-tutorial?utm_source=test'); await page.waitForTimeout(1200);
  const tab = page.locator('#eyetime-dock .notch');
  if (!(await tab.count())) { bad.push('no dock notch on the page'); console.log('FAIL dock\n  ' + bad.join('\n  ')); await app.close(); process.exit(1); }
  if (!(await tab.getAttribute('aria-label'))) bad.push('the notch has no accessible name');
  const box = await tab.boundingBox();
  if (!box || box.width > 20 || box.height > 140) bad.push('the idle notch is not small and minimal: ' + JSON.stringify(box));
  if (Math.round(box.x + box.width) < 1279) bad.push('the notch is not attached to the window edge: ' + JSON.stringify(box));

  // hover: it grows and shows three rings with numbers
  await tab.hover(); await page.waitForTimeout(700);
  const grown = await tab.boundingBox();
  if (!grown || grown.width < 40) bad.push('the notch did not grow on hover: ' + JSON.stringify(grown));
  const labels = await page.locator('#eyetime-dock .item').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  if (labels.length !== 3 || !labels.every((l) => /\d|\+/.test(l || ''))) bad.push('the rings do not carry numbers: ' + JSON.stringify(labels));

  // open on the Learn ring: the panel loads straight on that tab
  await page.locator('#eyetime-dock .item').nth(2).click(); await page.waitForTimeout(900);
  const frame = page.frames().find((f) => f.url().startsWith('chrome-extension://') && f.url().includes('dock.html'));
  if (!frame) { bad.push('the panel iframe did not load'); console.log('FAIL dock\n  ' + bad.join('\n  ')); await app.close(); process.exit(1); }
  if ((await tab.getAttribute('aria-expanded')) !== 'true') bad.push('aria-expanded not set after opening');
  await frame.waitForSelector('#tabs button', { timeout: 8000 });
  if ((await frame.locator('#tab-learn').getAttribute('aria-selected')) !== 'true') bad.push('the Learn ring did not open the Learn tab');

  // a page cannot talk the panel into another address: a forged message is ignored, the address comes from the browser's own record of the tab
  await page.evaluate(() => { const f = document.querySelector('#eyetime-dock').shadowRoot.querySelector('iframe'); f.contentWindow.postMessage({ type: 'eyetime:page', url: 'https://evil.example/phish', title: 'Evil' }, '*'); });
  await page.waitForTimeout(500);
  // a page cannot click the dock for the person: a scripted click does nothing
  await page.evaluate(() => { document.querySelector('#eyetime-dock').shadowRoot.querySelector('.notch').setAttribute('data-probe', '1'); });

  // Learn: the page bar shows this page; Save puts it into the Inbox (without tracking parameters)
  await frame.waitForSelector('.pagebar', { timeout: 8000 }).catch(() => bad.push('the page bar did not appear (the page address never reached the panel)'));
  const barText = await frame.locator('.pagebar').innerText().catch(() => '');
  if (!/127\.0\.0\.1/.test(barText)) bad.push('the page bar does not show the host: ' + barText.replace(/\s+/g, ' '));
  if (/evil/i.test(barText)) bad.push('the panel believed an address forged by the page: ' + barText.replace(/\s+/g, ' '));
  await frame.locator('.pagebar .pill').click(); await page.waitForTimeout(600);
  let topics = await get('topics');
  const inbox = (topics || []).find((x) => x.id === 'inbox');
  if (!inbox || inbox.links.length !== 1) bad.push('Save did not add the page to the Inbox: ' + JSON.stringify(topics));
  else if (/utm_source/.test(inbox.links[0].url)) bad.push('a tracking parameter was kept in the saved address');
  await frame.locator('.pagebar .pill').click(); await page.waitForTimeout(500);
  topics = await get('topics'); if (topics.find((x) => x.id === 'inbox').links.length !== 1) bad.push('the same page was saved twice');

  // a new topic, a pasted link, status cycling, removing
  await frame.locator('input[aria-label="New topic"]').fill('Python'); await frame.locator('input[aria-label="New topic"]').press('Enter'); await page.waitForTimeout(600);
  topics = await get('topics'); const py = topics.find((x) => x.title === 'Python');
  if (!py) bad.push('a new topic was not created');
  else {
    await frame.locator('input[aria-label="Paste a link and press Enter"]').fill('docs.python.org/3/tutorial/'); await frame.locator('input[aria-label="Paste a link and press Enter"]').press('Enter'); await page.waitForTimeout(600);
    topics = await get('topics'); const link = topics.find((x) => x.id === py.id).links[0];
    if (!link || link.url !== 'https://docs.python.org/3/tutorial') bad.push('a pasted link was not saved cleanly: ' + JSON.stringify(link));
    if (link) {
      await frame.locator('.check-btn').first().click(); await page.waitForTimeout(400);
      topics = await get('topics'); if (topics.find((x) => x.id === py.id).links[0].status !== 'doing') bad.push('the status did not move to "doing"');
      await frame.locator('.link-row .x').first().click({ force: true }); await page.waitForTimeout(400);
      topics = await get('topics'); if (topics.find((x) => x.id === py.id).links.length) bad.push('a link was not removed');
    }
  }

  // Now: a task from here; Thoughts: park one
  await frame.locator('#tab-now').click(); await frame.waitForSelector('#d-tasks input.field', { timeout: 8000 });
  await frame.locator('#d-tasks input.field').fill('Read chapter 3 25m'); await frame.locator('#d-tasks input.field').press('Enter'); await page.waitForTimeout(600);
  const tasks = await get('tasks'); if (!(tasks || []).some((x) => x.text === 'Read chapter 3' && x.est === 25)) bad.push('quick add in the dock did not create the task: ' + JSON.stringify(tasks));
  await frame.locator('#tab-thoughts').click(); await frame.waitForSelector('input.field', { timeout: 8000 });
  await frame.locator('input.field').fill('Look up how closures work'); await frame.locator('input.field').press('Enter'); await page.waitForTimeout(600);
  const caps = await get('captures'); if (!(caps || []).some((x) => x.text === 'Look up how closures work')) bad.push('a parked thought was not saved');

  // keyboard: Escape closes the panel
  await frame.locator('#tab-now').focus(); await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  if ((await tab.getAttribute('aria-expanded')) !== 'false') bad.push('Escape did not close the panel');
  const after = await page.evaluate(() => { const sr = document.querySelector('#eyetime-dock').shadowRoot; const a = sr.activeElement; return { inert: sr.querySelector('.panel').inert, focus: a ? a.className : '' }; });
  if (!after.inert) bad.push('a closed panel is still reachable (not inert)');
  if (!/item|notch/.test(after.focus)) bad.push('focus did not return to the notch after closing: ' + after.focus);
  // scripted clicks from the page are ignored
  await page.evaluate(() => document.querySelector('#eyetime-dock').shadowRoot.querySelector('.item').click()); await page.waitForTimeout(400);
  if ((await tab.getAttribute('aria-expanded')) !== 'false') bad.push('a click made by the page opened the panel');

  // drag the tab along the edge: its place is remembered
  const b = await tab.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + 6); await page.mouse.down(); await page.mouse.move(b.x + b.width / 2, b.y + 126, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(700);
  const dock = (await get('settings')).dock; if (!(dock.y > 0.5)) bad.push('the new place of the notch was not saved: y = ' + dock.y);
  if ((await tab.getAttribute('aria-expanded')) !== 'false') bad.push('dragging the notch opened the panel');

  // hide on this site: the notch goes away at once and stays away after a reload
  await tab.hover(); await page.locator('#eyetime-dock .item').first().click(); await page.waitForTimeout(700);
  await frame.locator('#hideHere').click(); await page.waitForTimeout(1200);
  if (await page.locator('#eyetime-dock').count()) bad.push('the dock stayed on a site it was hidden on');
  if (!(await get('settings')).dock.hidden.includes('127.0.0.1')) bad.push('the site was not added to the hidden list');
  await page.reload(); await page.waitForTimeout(1000);
  if (await page.locator('#eyetime-dock').count()) bad.push('the dock came back after reloading a hidden site');

  // turn the dock off: no tab on any page
  await opts.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.dock.enabled = false; s.dock.hidden = []; }); await chrome.runtime.sendMessage({ type: 'settings:changed' }); });
  await page.waitForTimeout(600); await page.goto('http://127.0.0.1/other'); await page.waitForTimeout(1000);
  if (await page.locator('#eyetime-dock').count()) bad.push('the dock appeared although it is off');
  const reg = await app.sw.evaluate(async () => (await chrome.scripting.getRegisteredContentScripts()).filter((x) => x.id === 'eyetime-dock').length);
  if (reg) bad.push('the page script stayed registered after turning the dock off');

  // a backup carries topics
  const exported = await opts.evaluate(async () => JSON.stringify(await (await import('/src/shared/storage.js')).exportAll()));
  if (!/"topics"/.test(exported)) bad.push('topics are missing from the backup');

  console.log(bad.length ? 'FAIL dock\n  ' + bad.join('\n  ') : 'PASS dock (tab, panel, save page, topics, links, tasks, thoughts, drag, hide on a site, off)');
  await app.close(); process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
