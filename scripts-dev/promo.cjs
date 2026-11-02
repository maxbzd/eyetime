// Store promo tiles (store/promo/marquee-1400x560.png, small-tile-440x280.png) from the logo, the new tab screenshot and the Insights screenshot:  node scripts-dev/promo.cjs
// Needs Playwright + Chromium; run scripts-dev/e2e/screenshots.cjs first so the screenshots are current.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const root = path.join(__dirname, '..');
const f = (p) => 'file://' + path.join(root, p);
const FONT = '"Inter", system-ui, sans-serif';
const css = `@font-face{font-family:Inter;src:url("${f('src/ui/fonts/inter-latin-wght-normal.woff2')}");font-weight:100 900}@font-face{font-family:"Instrument Serif";src:url("${f('src/ui/fonts/instrument-serif-latin-400-normal.woff2')}")}
*{box-sizing:border-box;margin:0}body{font-family:${FONT};color:#171612;-webkit-font-smoothing:antialiased}`;
const marquee = `<style>${css}body{width:1400px;height:560px;background:#efeee9;position:relative;overflow:hidden}
.brand{position:absolute;left:90px;top:128px;display:flex;align-items:center;gap:16px;font-weight:650;font-size:30px;letter-spacing:-.03em}.brand img{width:56px;height:56px;border-radius:16px}
h1{position:absolute;left:90px;top:206px;font-family:"Instrument Serif";font-weight:400;font-size:112px;line-height:.95;letter-spacing:-.02em}
p{position:absolute;left:92px;top:420px;width:470px;font-size:21px;line-height:1.5;color:#454541}
.a{position:absolute;left:640px;top:70px;width:660px;border-radius:30px;overflow:hidden;box-shadow:0 40px 80px -30px rgba(23,22,18,.45),0 0 0 1px rgba(23,22,18,.06)}.a img{width:100%;display:block}
.b{position:absolute;left:760px;top:250px;width:600px;border-radius:30px;overflow:hidden;box-shadow:0 40px 80px -30px rgba(23,22,18,.55),0 0 0 1px rgba(23,22,18,.06)}.b img{width:100%;display:block}
.dot{position:absolute;left:660px;top:98px;width:12px;height:12px;border-radius:50%;background:#cdf05c;box-shadow:0 0 0 6px rgba(205,240,92,.35)}</style>
<div class="brand"><img src="${f('icons/logo.svg')}">EyeTime</div><h1>One line.<br>One focus.</h1><p>A calm new tab, distractions paused, your time laid out honestly, eyes looked after. 100% local.</p>
<div class="a"><img src="${f('store/screenshots/3-insights.png')}"></div><div class="b"><img src="${f('store/screenshots/1-home.png')}"></div>`;
const tile = `<style>${css}body{width:440px;height:280px;position:relative;overflow:hidden;background:url("${f('src/newtab/frames/blush.webp')}") center/cover}
body::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.18),rgba(0,0,0,.34))}
.c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-shadow:0 2px 24px rgba(0,0,0,.25)}
.t{font-weight:200;font-size:96px;letter-spacing:-.045em;line-height:1}.s{font-family:"Instrument Serif";font-size:28px;margin-top:6px}.l{position:absolute;left:18px;top:16px;display:flex;align-items:center;gap:8px;color:#fff;font-weight:650;font-size:15px;letter-spacing:-.02em;z-index:2}.l img{width:26px;height:26px;border-radius:8px}
.line{width:230px;border-bottom:1.5px solid rgba(255,255,255,.7);margin-top:20px}</style>
<div class="l"><img src="${f('icons/logo.svg')}">EyeTime</div><div class="c"><div class="t">7:36</div><div class="s">What's your focus?</div><div class="line"></div></div>`;
(async () => {
  const b = await chromium.launch();
  for (const [html, w, h, out] of [[marquee, 1400, 560, 'store/promo/marquee-1400x560.png'], [tile, 440, 280, 'store/promo/small-tile-440x280.png']]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'eyetime-promo-')), 'p.html'); fs.writeFileSync(file, '<!doctype html><meta charset="utf-8">' + html); await p.goto('file://' + file); await p.waitForTimeout(900); // a page, not setContent: local images and fonts need a file origin
     await p.screenshot({ path: path.join(root, out) }); await p.close(); console.log(out);
  }
  await b.close();
})();
