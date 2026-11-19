// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Draws every raster of the brand from the SVGs in brand/: the extension's icons, the icons of the Windows program, the .ico.
//
//   node scripts-dev/build-brand.cjs
//
// The mark is drawn at four levels of detail, because a mark of sixty dots is a grey blot at 16 px: brand/icon.svg (the whole mark, 64 px and up),
// icon48.svg, icon32.svg and icon16.svg (fewer, bigger dots). Needs Playwright's Chromium (already there for the end-to-end suites).

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const svgFor = (size) => fs.readFileSync(path.join(root, 'brand', size <= 20 ? 'icon16.svg' : size <= 40 ? 'icon32.svg' : size <= 72 ? 'icon48.svg' : 'icon.svg'), 'utf8');

/** PNG bytes of the icon at `size` px, with a transparent corner. */
async function png(page, size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0;background:transparent">${svgFor(size).replace('<svg ', `<svg width="${size}" height="${size}" `)}`);
  return page.screenshot({ omitBackground: true });
}

/** An .ico that holds PNG images (every Windows since Vista reads them). */
function ico(images) {
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach(({ size, data }, i) => {
    const at = 6 + 16 * i;
    head[at] = size >= 256 ? 0 : size; head[at + 1] = size >= 256 ? 0 : size; head[at + 2] = 0; head[at + 3] = 0;
    head.writeUInt16LE(1, at + 4); head.writeUInt16LE(32, at + 6); head.writeUInt32LE(data.length, at + 8); head.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...images.map((i) => i.data)]);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const out = (rel, data) => { fs.writeFileSync(path.join(root, rel), data); console.log('wrote', rel, data.length); };
  const cache = new Map();
  const get = async (s) => { if (!cache.has(s)) cache.set(s, await png(page, s)); return cache.get(s); };

  for (const s of [16, 32, 48, 128, 512]) out(`icons/icon${s}.png`, await get(s));
  out('desktop/extension/icon128.png', await get(128));
  const tauri = 'desktop/app/src-tauri/icons';
  out(`${tauri}/32x32.png`, await get(32)); out(`${tauri}/128x128.png`, await get(128)); out(`${tauri}/128x128@2x.png`, await get(256)); out(`${tauri}/icon.png`, await get(512));
  out(`${tauri}/icon.ico`, ico(await Promise.all([16, 24, 32, 48, 64, 128, 256].map(async (size) => ({ size, data: await get(size) })))));
  fs.copyFileSync(path.join(root, 'brand/icon.svg'), path.join(root, 'icons/logo.svg')); console.log('wrote icons/logo.svg');
  fs.copyFileSync(path.join(root, 'brand/icon.svg'), path.join(root, 'site/assets/logo.svg')); console.log('wrote site/assets/logo.svg');
  await browser.close();
})();
