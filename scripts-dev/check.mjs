// Dependency-free sanity checks:  JS syntax · JSON validity · manifest references · icons · i18n completeness
//   node scripts-dev/check.mjs
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ACCENTS, LOOK_IDS, RADII, DENSITY, CARD_STYLES } from '../src/shared/looks.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const skip = new Set(['.git', 'node_modules', 'scripts-dev', '.github', 'dist', 'store', 'companion', 'docs']);
cp.execFileSync(process.execPath, [path.join(root, 'scripts-dev/build-site.mjs')], { stdio: 'ignore' }); // site/assets is generated, not committed
let errors = 0;
const fail = (m) => { console.error('✗ ' + m); errors++; };
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    if (skip.has(f)) continue;
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p); else files.push(p);
  }
})(root);
const rel = (p) => path.relative(root, p);

// 1) syntax + JSON
for (const p of files) {
  if (p.endsWith('.js') || p.endsWith('.mjs')) { try { cp.execFileSync('node', ['--check', p], { stdio: 'pipe' }); } catch { fail('syntax: ' + rel(p)); } }
  else if (p.endsWith('.json')) { try { JSON.parse(fs.readFileSync(p, 'utf8')); } catch { fail('json: ' + rel(p)); } }
}

// 2) manifest references
const m = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const refs = [m.background?.service_worker, m.chrome_url_overrides?.newtab, m.action?.default_popup, m.options_page,
  ...(m.content_scripts || []).flatMap((c) => [...(c.js || []), ...(c.css || [])]), ...Object.values(m.icons || {}), ...Object.values(m.action?.default_icon || {})].filter(Boolean);
refs.forEach((r) => { if (!fs.existsSync(path.join(root, r))) fail('manifest references missing file: ' + r); });
if (!fs.existsSync(path.join(root, '_locales', m.default_locale, 'messages.json'))) fail('missing default locale');
const msgKeys = (l) => Object.keys(JSON.parse(fs.readFileSync(path.join(root, '_locales', l, 'messages.json'), 'utf8')));
for (const l of fs.readdirSync(path.join(root, '_locales'))) {
  const base = new Set(msgKeys('en'));
  for (const k of msgKeys(l)) base.delete(k);
  if (base.size) fail(`_locales/${l} is missing: ${[...base].join(', ')}`);
}
for (const k of JSON.stringify(m).matchAll(/__MSG_(\w+)__/g)) if (!msgKeys('en').includes(k[1])) fail('manifest uses undefined message ' + k[1]);

// 3) relative references inside HTML (scripts, styles, images)
for (const p of files.filter((f) => f.endsWith('.html'))) {
  const html = fs.readFileSync(p, 'utf8');
  for (const r of html.matchAll(/(?:src|href)="(?!https?:|#|mailto:|chrome)([^"]+)"/g)) {
    const target = path.resolve(path.dirname(p), r[1].split('?')[0].split('#')[0]);
    if (!fs.existsSync(target)) fail(`${rel(p)} references missing ${r[1]}`);
  }
}

// 4) i18n: every key used exists in en; ru has exactly the same keys; placeholders match
const { LOCALES } = await import(pathToFileURL(path.join(root, 'src/shared/locales/index.js')));
const { PRESET_IDS } = await import(pathToFileURL(path.join(root, 'src/shared/catalog.js')));
const en = LOCALES.en;
const used = new Set();
const dyn = { 'sb.': ['red', 'amber', 'white'], 'qt.': ['home', 'pause', 'rest', 'start'], 'dock.tab.': ['now', 'learn', 'thoughts'], 'dock.status.': ['todo', 'doing', 'done'], 'opt.calErr.': ['permission', 'http', 'network', 'format', 'size', 'invalid', 'redirect'], 'wn.i': ['1', '2', '3'], 'trig.tip': ['Window', 'Limit', 'Watch'], 'tasks.rep.': ['daily', 'weekdays', 'weekly'], 'gs.': ['focus', 'focusD', 'classify', 'classifyD', 'task', 'taskD', 'palette', 'paletteD'], 'palette.g.': ['focus', 'tasks', 'go', 'look', 'add'], 'scope.': ['period', 'weeks16', 'allTime'], 'ap.mode.': ['system', 'light', 'dark', 'schedule'], 'mode.': ['deep', 'sprint', 'study'], 'sc.': ['focus', 'task', 'closeDay', 'customize', 'insights', 'settings', 'help', 'palette'], 'class.': ['productive', 'neutral', 'distracting'], 'preset.': PRESET_IDS, 'bg.': ['look', 'peaks', 'dawn', 'ocean', 'forest', 'dusk', 'sand', 'slate', 'mesh', 'aurora', 'stars', 'waves', 'grain', 'dots', 'grid', 'living', 'plain', 'color', 'photo'], 'block.why.': ['work', 'break', 'habit', 'bored', 'back'], 'itab.': ['overview', 'focus', 'sites', 'patterns'], 'ambient.': ['off', 'brown', 'rain', 'river', 'forest'], 'layout.': ['center', 'split', 'minimal'], 'clock.': ['thin', 'bold', 'mono', 'serif', 'compact', 'stacked', 'none'], 'ty.': ['solid', 'gradient', 'outline'], 'ct.': ['prepare', 'model', 'finish'], 'th.err.': ['size', 'json', 'format', 'version'], 'wg.k.': ['mainfocus', 'rings', 'countdown', 'worldclock', 'percent', 'mantra', 'nextevent', 'week', 'bignumber', 'eyebreak', 'sticky'], 'wg.p.': ['day', 'week', 'month', 'year'], 'wg.m.': ['focusToday', 'sessionsToday', 'streak', 'tasksLeft', 'screenToday'], 'wg.mantra': ['1', '2', '3', '4', '5', '6'], 'accent.': Object.keys(ACCENTS), 'look.': LOOK_IDS, 'lookd.': LOOK_IDS, 'radius.': Object.keys(RADII), 'density.': Object.keys(DENSITY), 'cards.': CARD_STYLES.filter((c) => c !== 'look'), 'range.': ['today', '7', '30'], 'mod.': ['today', 'tasks', 'habits', 'notes', 'links'], 'sec.': ['general', 'appearance', 'focus', 'blocking', 'eye', 'tracking', 'data', 'about'] };
for (const [prefix, list] of Object.entries(dyn)) list.forEach((s) => used.add(prefix + s));
for (const p of files.filter((f) => /\.(js|html)$/.test(f) && !/locales[\\/]|icons\.js$|shared[\\/]i18n\.js$/.test(f))) {
  const src = fs.readFileSync(p, 'utf8');
  for (const k of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'(?!\s*\+)/g)) used.add(k[1]);
  for (const k of src.matchAll(/data-i18n="([^"]+)"/g)) used.add(k[1]);
  for (const k of src.matchAll(/data-i18n-attr="([^"]+)"/g)) k[1].split(';').forEach((pair) => { const key = pair.split(':')[1]; if (key) used.add(key.trim()); });
  for (const k of src.matchAll(/t\(\s*'([a-z]+(?:\.[a-z]+)*\.)'\s*\+/g)) if (!dyn[k[1]]) fail(`${rel(p)}: dynamic i18n prefix "${k[1]}" is not declared in scripts-dev/check.mjs`);
  for (const k of src.matchAll(/t\(\s*([a-z]+)\s*\?\s*'([a-zA-Z0-9_.]+)'/g)) used.add(k[2]);
}
const SKIP_KEYS = new Set(['name']);
for (const k of used) if (!(k in en) && !SKIP_KEYS.has(k)) fail('i18n: key used but missing in en: ' + k);
const ph = (v) => (typeof v === 'string' ? [v] : Object.values(v)).map((s) => (s.match(/\{\w+\}/g) || []).sort().join('')).sort().join('|');
for (const [code, dict] of Object.entries(LOCALES)) {
  if (code === 'en') continue;
  for (const k of Object.keys(en)) if (!(k in dict)) fail(`i18n: ${code} is missing ${k}`);
  for (const k of Object.keys(dict)) {
    if (!(k in en)) fail(`i18n: ${code} has unknown key ${k}`);
    else if (typeof en[k] === 'string' && typeof dict[k] === 'string' && ph(en[k]) !== ph(dict[k])) fail(`i18n: placeholder mismatch in ${code}:${k}`);
  }
}
const unusedKeys = Object.keys(en).filter((k) => !used.has(k));
if (unusedKeys.length && process.argv.includes('--unused')) console.log('unused i18n keys:', unusedKeys.join(', '));

// 5) icons referenced exist in the generated file
const { ICONS } = await import(pathToFileURL(path.join(root, 'src/ui/icons.js')));
const iconRe = /(?:icon\(\s*['"`]|data-icon=["']|\bicon:\s*['"`])([a-z0-9-]+)/g;
for (const p of files.filter((f) => /\.(js|html)$/.test(f) && !/icons\.js$/.test(f) && f.includes(`${path.sep}src${path.sep}`))) {
  const src = fs.readFileSync(p, 'utf8');
  const names = new Set([...src.matchAll(iconRe)].map((k) => k[1]));
  for (const call of src.matchAll(/\bicon\(([^()]*)\)/g)) for (const q of call[1].matchAll(/'([a-z][a-z0-9-]*)'/g)) names.add(q[1]);
  for (const n of names) if (!(n in ICONS) && n !== 'name') fail(`icon not in icons.js (run npm run icons): ${n} (${rel(p)})`);
}

if (errors) { console.error(`\n${errors} problem(s)`); process.exit(1); }
console.log('✓ all checks passed');
