// Records the product demo (store/demo.mp4 + store/demo.gif):  node scripts-dev/e2e/demo.cjs
// One scripted walkthrough with the realistic demo data: add a task by typing, start a focus session, the pause page,
// the insights, another photo of the day. Needs Playwright + Chromium + ffmpeg.
const { launch } = require('./lib.cjs');
const { seed } = require('./seed.cjs');
const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const OUT = path.join(__dirname, '../../store');
const TMP = '/tmp/eyetime-demo-video';

// Playwright videos have no mouse pointer; draw one so the viewer can follow the clicks.
const CURSOR = `(() => { const c = document.createElement('div'); c.style.cssText = 'position:fixed;z-index:2147483647;left:0;top:0;width:22px;height:22px;margin:-4px 0 0 -4px;pointer-events:none;background:url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2222%22 height=%2222%22 viewBox=%220 0 22 22%22><path d=%22M4 2l14 8-6 2-3 6z%22 fill=%22black%22 stroke=%22white%22 stroke-width=%221.5%22 stroke-linejoin=%22round%22/></svg>") no-repeat;transition:transform .04s linear;'; const add = () => document.documentElement.appendChild(c); (document.documentElement ? add() : addEventListener('DOMContentLoaded', add)); addEventListener('mousemove', (e) => { c.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; }, true); })();`;

(async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const app = await launch({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: TMP, size: { width: 1280, height: 720 } } });
  const ext = (p) => `chrome-extension://${app.id}/${p}`;
  const seedPage = await app.ctx.newPage(); await seedPage.goto(ext('src/options/options.html')); await seedPage.waitForTimeout(800);
  await seed(seedPage, { look: 'calm', mode: 'light', background: 'photo', clockStyle: 'thin', layout: 'today', frame: 'daily' });
  await seedPage.evaluate(async () => { const st = await import('/src/shared/storage.js'); await st.updateSettings((s) => { s.focus.dailyGoal = 120; }); await st.setRaw({ gsDismissed: true }); });
  await seedPage.close();
  await app.ctx.addInitScript(CURSOR);

  const p = await app.ctx.newPage();
  // headless Chromium paints only the window minus its ~196 px of browser chrome, so make the window tall enough for a 720 px page
  const cdp = await app.ctx.newCDPSession(p); const { windowId } = await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { width: 1280, height: 720 + 196, windowState: 'normal' } });
  let mx = 640, my = 760;
  const go = async (loc) => { const b = await loc.boundingBox(); const x = b.x + b.width / 2, y = b.y + b.height / 2; await p.mouse.move(x, y, { steps: 28 }); mx = x; my = y; };
  const click = async (loc) => { await go(loc); await p.waitForTimeout(250); await loc.click(); };
  await p.goto(ext('src/newtab/newtab.html'));
  await p.mouse.move(mx, my);
  await p.waitForTimeout(2200);

  // 1. one line: say what you focus on, press Enter — the clock becomes the countdown
  const goal = p.locator('#goalToday');
  await click(goal);
  await goal.pressSequentially('Write the quarterly report', { delay: 70 });
  await p.waitForTimeout(900);
  await goal.press('Enter');
  await p.waitForTimeout(3000);

  // 2. tasks wait in a glass panel: add one in plain words
  await click(p.locator('#tdPanelBtn'));
  await p.waitForTimeout(900);
  const input = p.locator('#mod-tasks input').first();
  await click(input);
  await input.pressSequentially('Prepare the slides tomorrow 10:00 45m !', { delay: 70 });
  await p.waitForTimeout(1500);
  await input.press('Enter');
  await p.waitForTimeout(1800);
  await click(p.locator('#tdPanelBtn'));
  await p.waitForTimeout(900);

  // 3. a distracting site gets a calm pause
  await p.goto(ext('src/blocked/blocked.html?u=http%3A%2F%2Freddit.com%2F&r=friction&a=pause'));
  await p.mouse.move(mx, my);
  await p.waitForTimeout(4200);

  // 4. the insights
  await app.sw.evaluate(() => chrome.storage.local.set({ focus: null }));
  await p.goto(ext('src/insights/insights.html'));
  await p.mouse.move(mx, my);
  await p.waitForTimeout(2600);
  await p.mouse.wheel(0, 520); await p.waitForTimeout(1800);
  await p.mouse.wheel(0, 520); await p.waitForTimeout(1800);

  // 5. a new photo every day — and another one on request
  await app.sw.evaluate(() => chrome.storage.local.set({ focus: null }));
  await p.goto(ext('src/newtab/newtab.html'));
  await p.mouse.move(mx, my);
  await p.waitForTimeout(1800);
  for (let i = 0; i < 3; i++) { await click(p.locator('.cr-next')); await p.waitForTimeout(1900); }
  await p.waitForTimeout(800);

  const video = await p.video().path();
  await app.close();

  fs.mkdirSync(OUT, { recursive: true });
  const run = (args) => cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  run(['-ss', '0.6', '-i', video, '-vf', 'fps=25,scale=1280:-2', '-c:v', 'libx264', '-crf', '27', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', path.join(OUT, 'demo.mp4')]);
  run(['-ss', '0.6', '-i', video, '-vf', 'fps=8,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b]paletteuse=dither=none', path.join(OUT, 'demo.gif')]);
  for (const f of ['demo.mp4', 'demo.gif']) console.log(f, (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + ' KB');
})().catch((e) => { console.error(e); process.exit(1); });
