// What the stores reject or complain about, checked before anyone uploads: the limits of the Chrome Web Store, Edge Add-ons and AMO that have bitten extensions before.
//   node scripts-dev/store-check.mjs          (also part of `npm run check`)
// Manifest: the description is at most 132 characters in every language (the Chrome Web Store refuses a longer one), the name at most 75, every __MSG_x__ exists in every language,
// the icons exist at the sizes the stores want, every permission and optional host is justified in store/LISTING.md, no remote code. Listing: summary at most 132 characters,
// every language has its file. Pictures: each language has the five screenshots (store/screenshots/<lang>/, made by e2e/store-shots.cjs), 1280×800 or 640×400 without transparency, with a caption each; the tiles have their sizes.
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const bad = [];
const ok = (c, m) => { if (!c) bad.push(m); };
const len = (s) => [...s].length;

const man = JSON.parse(read('manifest.json'));
const locales = fs.readdirSync(path.join(root, '_locales'));
const msgs = Object.fromEntries(locales.map((l) => [l, JSON.parse(read(`_locales/${l}/messages.json`))]));
ok(!!msgs[man.default_locale], 'default_locale has no folder');

// 1. manifest strings
for (const [l, m] of Object.entries(msgs)) {
  ok(len(m.extDescription.message) <= 132, `${l}: extDescription is ${len(m.extDescription.message)} characters (the Chrome Web Store allows 132)`);
  ok(len(m.extName.message) <= 75, `${l}: extName is ${len(m.extName.message)} characters (75)`);
}
const used = new Set([...JSON.stringify(man).matchAll(/__MSG_(\w+)__/g)].map((x) => x[1]));
for (const [l, m] of Object.entries(msgs)) for (const k of used) ok(!!m[k], `${l}: the manifest uses __MSG_${k}__ and the language lacks it`);

// 2. icons
for (const [size, file] of Object.entries(man.icons || {})) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) { bad.push(`icon ${file} is missing`); continue; }
  const b = fs.readFileSync(p);
  ok(b.readUInt32BE(16) === Number(size) && b.readUInt32BE(20) === Number(size), `icon ${file} is ${b.readUInt32BE(16)}×${b.readUInt32BE(20)}, not ${size}`);
}
ok(['16', '32', '48', '128'].every((s) => man.icons && man.icons[s]), 'the manifest needs icons of 16, 32, 48 and 128');

// 3. permissions are justified, and nothing remote is run
const listing = read('store/LISTING.md');
for (const p of [...man.permissions, ...(man.optional_permissions || [])]) ok(listing.includes('`' + p + '`'), `permission "${p}" has no justification in store/LISTING.md`);
ok((man.optional_host_permissions || []).every((h) => /^https?:\/\//.test(h)), 'optional hosts must be http(s) patterns');
ok(!man.host_permissions || man.host_permissions.length === 0, 'host permissions are asked for up front: they must be optional (the install warning is the first thing a reviewer reads)');
const csp = (man.content_security_policy || {}).extension_pages || '';
ok(!/(?<!wasm-)unsafe-eval|unsafe-inline/.test(csp) && /script-src 'self'/.test(csp), 'the CSP for extension pages must be script-src \'self\' (with wasm-unsafe-eval only)');
ok(!/https?:\/\/(?!127\.0\.0\.1|localhost)/.test(csp), 'the CSP names a remote host');
if (/wasm-unsafe-eval/.test(csp)) ok(listing.includes('wasm-unsafe-eval'), "the CSP has 'wasm-unsafe-eval' and store/LISTING.md does not explain it (a reviewer asks)");

// 4. listings
const langs = ['en', 'ru', 'es', 'de', 'fr', 'pt', 'it', 'pl', 'uk', 'zh', 'ja'];
for (const l of langs) {
  const f = `store/listing/${l}.md`;
  if (!fs.existsSync(path.join(root, f))) { bad.push(`${f} is missing`); continue; }
  const t = read(f);
  const sum = (t.match(/^## [^\n]*\n([^\n]+)\n/m) || [])[0];
  const summary = (t.split(/\n## /).find((x) => /^(Summary|Краткое|Resumen|Kurz|Résumé|Resumo|Riepilogo|Opis|Короткий|简介|概要)/i.test(x)) || '').split('\n')[1] || '';
  if (summary) ok(len(summary) <= 132, `${f}: the summary is ${len(summary)} characters (132)`); else if (!sum) bad.push(`${f}: no summary found`);
}

// 5. pictures
function imageInfo(file) {
  const b = fs.readFileSync(file);
  if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), alpha: b[25] === 4 || b[25] === 6, type: 'png' };
  if (b[0] === 0xff && b[1] === 0xd8) { // JPEG: find the frame header
    for (let i = 2; i < b.length - 9;) { if (b[i] !== 0xff) { i++; continue; } const m = b[i + 1]; if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7), alpha: false, type: 'jpg' }; i += 2 + b.readUInt16BE(i + 2); }
  }
  return null;
}
const SHOTS = ['1-home', '2-focus', '3-insights', '4-pause', '5-looks'];
for (const l of langs) {
  const dir = path.join(root, 'store/screenshots', l);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(png|jpe?g)$/.test(f)) : [];
  ok(files.length === SHOTS.length && SHOTS.every((n) => files.includes(n + '.jpg')), `store/screenshots/${l}/ must hold exactly ${SHOTS.map((n) => n + '.jpg').join(', ')} (the store takes five; has: ${files.join(', ') || 'nothing'})`);
  for (const f of files) {
    const i = imageInfo(path.join(dir, f));
    ok(i && ((i.w === 1280 && i.h === 800) || (i.w === 640 && i.h === 400)) && !i.alpha, `store/screenshots/${l}/${f} must be 1280×800 or 640×400 without transparency (is ${i ? i.w + '×' + i.h : 'unreadable'})`);
  }
  const t = read(`store/listing/${l}.md`);
  const captions = ((t.split(/\n## /).find((x) => /^(Screenshot captions|Подписи к скриншотам)/.test(x)) || '').match(/^\d+\. .+$/gm) || []).length;
  ok(captions === SHOTS.length, `store/listing/${l}.md has ${captions} screenshot captions, the set has ${SHOTS.length}`);
}
for (const [file, w, h] of [['store/promo/small-tile-440x280.png', 440, 280], ['store/promo/marquee-1400x560.png', 1400, 560]]) {
  const i = fs.existsSync(path.join(root, file)) ? imageInfo(path.join(root, file)) : null;
  ok(i && i.w === w && i.h === h, `${file} must be ${w}×${h}`);
  ok(i && !i.alpha, `${file} must have no transparency`);
}
if (bad.length) { console.error('✗ store check\n  ' + bad.join('\n  ')); process.exit(1); }
console.log(`✓ store check: ${locales.length} manifest languages, ${man.permissions.length} permissions justified, listings in ${langs.length} languages, pictures within the stores' limits`);
