// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Renders the product demo: store/demo.mp4 (1920x1080, 30 fps, no sound) and store/demo-poster.jpg.
//   node scripts-dev/e2e/demo-video.cjs [--keep] [--reuse] [--frames a-b] [--at t,t,...]        needs Playwright + Chromium + ffmpeg
// The pictures are taken first (demo-shots.cjs, the real interface at twice the size); the motion is demo-video.html, a function of time, so every frame is drawn exactly and the
// result does not depend on how fast the machine is. --frames limits the render to a range (a quick look); --keep leaves the frames in /tmp/eyetime-demo-video.
const path = require('path');
const fs = require('fs');
const os = require('os');
const cp = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '../..');
const WORK = '/tmp/eyetime-demo-video';
const FPS = 30;
const arg = (name) => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };

(async () => {
  const frames = path.join(WORK, 'frames');
  fs.rmSync(WORK, { recursive: true, force: true }); fs.mkdirSync(frames, { recursive: true });
  const assets = path.join(WORK, 'assets');
  const reuse = process.argv.includes('--reuse') && fs.existsSync('/tmp/eyetime-demo-assets');
  if (reuse) fs.cpSync('/tmp/eyetime-demo-assets', assets, { recursive: true }); else cp.execFileSync('node', [path.join(__dirname, 'demo-shots.cjs'), assets], { stdio: 'inherit' });
  fs.mkdirSync(path.join(WORK, 'fonts'));
  for (const f of ['inter-latin-wght-normal.woff2', 'instrument-serif-latin-400-normal.woff2']) fs.copyFileSync(path.join(ROOT, 'src/ui/fonts', f), path.join(WORK, 'fonts', f));
  fs.copyFileSync(path.join(ROOT, 'icons/icon512.png'), path.join(WORK, 'icon512.png'));
  fs.copyFileSync(path.join(__dirname, 'demo-video.html'), path.join(WORK, 'index.html'));

  const browser = await chromium.launch();
  const probe = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  await probe.goto('file://' + path.join(WORK, 'index.html')); await probe.evaluate(() => document.fonts.ready);
  const total = await probe.evaluate(() => window.TOTAL);
  const count = Math.round(total * FPS);
  if (arg('--at')) { // single frames, to look at: --at 1.5,6,12
    const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage(); await page.goto('file://' + path.join(WORK, 'index.html')); await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all([...document.images].map((im) => im.decode().catch(() => {}))));
    for (const t of arg('--at').split(',')) { await page.evaluate((x) => window.render(x), Number(t)); await page.screenshot({ path: path.join(WORK, `at-${t}.png`) }); }
    await browser.close(); return;
  }
  let [from, to] = (arg('--frames') || `0-${count - 1}`).split('-').map(Number);
  to = Math.min(to, count - 1);
  const todo = []; for (let i = from; i <= to; i++) todo.push(i);

  const workers = Math.max(1, Math.min(4, os.cpus().length));
  const started = Date.now(); let done = 0;
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
    await page.goto('file://' + path.join(WORK, 'index.html')); await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all([...document.images].map((im) => im.decode().catch(() => {}))));
    for (let k = w; k < todo.length; k += workers) {
      const i = todo[k];
      await page.evaluate((t) => window.render(t), i / FPS);
      await page.screenshot({ path: path.join(frames, `f${String(i).padStart(5, '0')}.png`) });
      if (++done % 60 === 0) console.log(`${done}/${todo.length} frames, ${Math.round((Date.now() - started) / 1000)} s`);
    }
  }));
  await browser.close();

  const mp4 = path.join(WORK, 'demo.mp4');
  cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-start_number', String(from), '-i', path.join(frames, 'f%05d.png'),
    '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '22', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', '-an', mp4], { stdio: 'inherit' });
  const poster = Math.min(to, Math.round(6.2 * FPS));
  cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(frames, `f${String(poster).padStart(5, '0')}.png`), '-vf', 'scale=1600:-2', '-q:v', '3', path.join(WORK, 'demo-poster.jpg')]);
  if (!arg('--frames')) {
    fs.copyFileSync(mp4, path.join(ROOT, 'store/demo.mp4')); fs.copyFileSync(path.join(WORK, 'demo-poster.jpg'), path.join(ROOT, 'store/demo-poster.jpg'));
    const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).version; // store-check compares this with the product's version
    fs.writeFileSync(path.join(ROOT, 'store/demo.json'), JSON.stringify({ _: 'Written by scripts-dev/e2e/demo-video.cjs: the version of the product the demo was rendered from. store-check fails when the minor version moves on, so the demo is made again with each minor release.', version, renderedAt: new Date().toISOString().slice(0, 10) }, null, 2) + '\n');
  }
  console.log('video:', mp4, (fs.statSync(mp4).size / 1e6).toFixed(1) + ' MB');
  if (!process.argv.includes('--keep')) fs.rmSync(frames, { recursive: true, force: true });
})();
