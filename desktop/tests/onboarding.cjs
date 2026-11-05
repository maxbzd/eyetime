// The first minute ("The Door"), walked through with a real mouse in the app against the real helper logic (the simulator),
// with pictures of every act. Needs eyetime-sim on 8131 (a fresh one: the helper must have no setup yet).
const { chromium } = require('playwright');
const os = require('os');
const path = require('path');
const BASE = process.env.SIM || 'http://127.0.0.1:8131';
const OUT = process.env.SHOTS || os.tmpdir();
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.log('FAIL', m); } else console.log('ok  ', m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = async (p, o) => (await fetch(BASE + p, { method: 'POST', body: JSON.stringify(o) })).json();

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { window.__TAURI__ = { core: { invoke: async (c, a) => { if (c === 'helper') { const r = await fetch('/req', { method: 'POST', body: JSON.stringify(a.req) }); return r.json(); } return null; } } }; });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + '/home.html');
  // a new person: the first minute opens by itself
  await page.waitForSelector('#onb.on', { timeout: 20000 });
  ok(true, 'the first minute opens by itself for a new person');
  await sleep(2500);
  await page.screenshot({ path: path.join(OUT, 'onb_0_wake.png') });

  // act 0: hold the stone
  const stone = await page.$('#onbStone'); const sb = await stone.boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2); await page.mouse.down(); await sleep(900);
  await page.screenshot({ path: path.join(OUT, 'onb_0b_holding.png') });
  await sleep(1000); await page.mouse.up(); await sleep(2600);
  ok(await page.evaluate(() => document.querySelector('#onbStone').classList.contains('lit')), 'holding wakes the stone');
  await page.screenshot({ path: path.join(OUT, 'onb_1_awake.png') });
  await page.click('#onbBegin'); await sleep(1800);

  // act 1: doors
  ok((await page.$$('.dtile')).length >= 9, 'the doors are shown as real app marks');
  await page.click('.chip2[data-i="0"]'); await page.click('.dtile[data-n="YouTube"]'); await page.click('.dtile[data-n="Steam"]');
  await page.fill('#onbAdd', 'news.ycombinator.com'); await page.press('#onbAdd', 'Enter'); await sleep(600);
  const n = await page.evaluate(() => document.querySelector('#onbCount').textContent);
  ok(/\d/.test(n), 'the count follows the choice: ' + n);
  await page.screenshot({ path: path.join(OUT, 'onb_2_doors.png') });
  await page.click('.act.on [data-next]'); await sleep(1600);

  // act 2: the dial. A real drag moves the light; the keyboard then sets it exactly (a slow machine can still be mid-animation when the drag is measured)
  await page.waitForFunction(() => { const a = document.querySelector('.act.on'); return a && getComputedStyle(a).transform === 'none'; }, null, { timeout: 15000 }).catch(() => {});
  const q0 = await page.evaluate(() => document.querySelector('#onbQ').textContent);
  const k2 = await (await page.$('#onbK2')).boundingBox();
  const dial = await (await page.$('#onbDial')).boundingBox();
  const cx = dial.x + dial.width / 2, cy = dial.y + dial.height / 2, rr = dial.width * (128 / 340);
  const at = (min) => { const f = ((min - 720) / 1440) * 2 * Math.PI; return [cx + rr * Math.sin(f), cy - rr * Math.cos(f)]; };
  await page.mouse.move(k2.x + k2.width / 2, k2.y + k2.height / 2); await page.mouse.down();
  const [tx, ty] = at(21 * 60); await page.mouse.move(tx, ty, { steps: 8 }); await page.mouse.up(); await sleep(400);
  const q1 = await page.evaluate(() => document.querySelector('#onbQ').textContent);
  ok(q1 !== q0, 'dragging a light changes the hours: ' + q0 + ' -> ' + q1);
  await page.click('.chip2[data-p="540,1020"]'); await sleep(300);
  await page.focus('#onbK2'); for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  const q = await page.evaluate(() => document.querySelector('#onbQ').textContent);
  ok(/09:00/.test(q) && /18:00/.test(q), 'the arrow keys set the hours exactly: ' + q);
  await page.click('#onbDays button[data-d="5"]');
  await page.screenshot({ path: path.join(OUT, 'onb_3_hours.png') });
  await page.click('.act.on [data-next]'); await sleep(1600);

  // act 3: how hard
  await page.screenshot({ path: path.join(OUT, 'onb_4_hard.png') });
  ok(await page.evaluate(() => document.querySelector('.lvl[data-l="3"]').disabled), 'Frozen is not offered on the first run');
  await page.click('.act.on [data-next]'); await sleep(1600);

  // act 4 (the app only): connect the browser
  ok(await page.evaluate(() => !!document.querySelector('.act.on .conn')), 'the browser step is shown in the app');
  await sleep(1800);
  await page.screenshot({ path: path.join(OUT, 'onb_5_link.png') });
  await page.click('.act.on [data-next]'); await sleep(1600);

  // act 5: why
  await page.click('.act.on .chip2'); await sleep(300);
  await page.screenshot({ path: path.join(OUT, 'onb_6_why.png') });
  await page.click('.act.on [data-next]'); await sleep(1800);

  // act 6: hold the door shut
  const seal = await (await page.$('#onbSeal')).boundingBox();
  await page.mouse.move(seal.x + seal.width / 2, seal.y + seal.height / 2); await page.mouse.down(); await sleep(1200);
  await page.screenshot({ path: path.join(OUT, 'onb_7_sealing.png') });
  await sleep(1500); await page.mouse.up(); await sleep(2500);
  await page.screenshot({ path: path.join(OUT, 'onb_8_done.png') });
  ok(await page.evaluate(() => !!document.querySelector('.act.final.on')), 'the door closes and the last act appears');

  // what it wrote, in the helper
  await sleep(1200);
  const st = (await post('/req', { op: 'get_state' })).data;
  const names = (st['et-items'] || []).map((i) => i.name);
  ok(names.includes('YouTube') && names.includes('Steam') && names.includes('Instagram') && names.includes('news.ycombinator.com'), 'the chosen doors are on the helper\'s list: ' + names.join(','));
  const rule = (st['et-rules'] || []).find((r) => r.id === 'onb-quiet');
  ok(rule && rule.from === '09:00' && rule.to === '18:00' && rule.days.includes(5) && rule.level === 1, 'the first rule has the hours, days and strictness that were chosen: ' + JSON.stringify(rule));
  ok(await page.evaluate(() => localStorage.getItem('et-onboarded') === '1'), 'it does not open again');
  ok(errs.length === 0, 'no script errors: ' + errs.slice(0, 3).join(' | '));
  await page.click('#onbLook');
  ok(await page.waitForSelector('#onb', { state: 'detached', timeout: 20000 }).then(() => true).catch(() => false), 'the first minute closes');
  await browser.close();
  console.log(failed ? `${failed} FAILED` : 'ALL OK');
  process.exit(failed ? 1 : 0);
})();
