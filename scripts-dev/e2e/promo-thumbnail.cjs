// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The picture the promo video shows in a list (YouTube asks for 1280x720, under 2 MB): store/promo-thumbnail.jpg.
//   node scripts-dev/e2e/promo-thumbnail.cjs [--variant a|b|c] [--all dir]      needs Playwright + Chromium + ffmpeg
// It uses the same real-interface pictures as the videos (demo-shots.cjs). --all writes every variant to a folder, to compare them.
const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '../..');
const WORK = '/tmp/eyetime-thumbnail';
const arg = (name) => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };

(async () => {
  fs.rmSync(WORK, { recursive: true, force: true }); fs.mkdirSync(path.join(WORK, 'fonts'), { recursive: true });
  const assets = path.join(WORK, 'assets');
  if (fs.existsSync('/tmp/eyetime-demo-assets/home.png')) fs.cpSync('/tmp/eyetime-demo-assets', assets, { recursive: true }); else cp.execFileSync('node', [path.join(__dirname, 'demo-shots.cjs'), assets], { stdio: 'inherit' });
  for (const f of ['inter-latin-wght-normal.woff2', 'instrument-serif-latin-400-normal.woff2']) fs.copyFileSync(path.join(ROOT, 'src/ui/fonts', f), path.join(WORK, 'fonts', f));
  fs.copyFileSync(path.join(ROOT, 'icons/icon512.png'), path.join(WORK, 'icon512.png'));
  fs.copyFileSync(path.join(__dirname, 'promo-thumb.html'), path.join(WORK, 'index.html'));

  const browser = await chromium.launch();
  const shoot = async (variant, out) => {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    await page.goto('file://' + path.join(WORK, 'index.html') + '#' + variant); await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all([...document.images].map((im) => im.decode().catch(() => {}))));
    const png = path.join(WORK, `thumb-${variant}.png`); await page.screenshot({ path: png });
    cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-q:v', '2', '-pix_fmt', 'yuvj420p', out]);
    console.log(out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
  };
  if (arg('--all')) { fs.mkdirSync(arg('--all'), { recursive: true }); for (const v of ['a', 'b', 'c']) await shoot(v, path.join(arg('--all'), `thumb-${v}.jpg`)); }
  else await shoot(arg('--variant') || 'b', path.join(ROOT, 'store/promo-thumbnail.jpg'));
  await browser.close();
})();
