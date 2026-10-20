// Every look × scheme × accent must be readable: contrast is a property the engine guarantees, so test it exhaustively.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LOOKS, LOOK_IDS, ACCENTS, resolveVars, pickScheme, sanitizeCustomCss, buildCache } from '../../src/shared/looks.js';
import { contrast, normalizeHex, readableFill, ensureContrast, mix } from '../../src/shared/color.js';

const vars = (ap, scheme) => { const v = resolveVars({ look: 'calm', accent: 'look', ...ap }, scheme); return (k) => v['--' + k]; };
const ACCENT_CASES = ['look', ...Object.keys(ACCENTS), '#facc15', '#ff0000', '#00ff00', '#808080', '#ffffff', '#000000', '#123456', '#ff00ff'];

test('every look, scheme and accent keeps text readable', () => {
  const bad = [];
  for (const look of LOOK_IDS) for (const scheme of ['light', 'dark']) for (const accent of ACCENT_CASES) {
    const g = vars({ look, accent }, scheme);
    const chk = (name, fg, bgs, min) => { for (const b of bgs) { const r = contrast(g(fg), g(b)); if (r < min - 0.01) bad.push(`${look}/${scheme}/${accent}: ${name} ${r.toFixed(2)} < ${min}`); } };
    chk('text', 'text', ['surface', 'bg'], 7);
    chk('text-2', 'text-2', ['surface', 'bg', 'surface-2'], 4.5);
    chk('text-3', 'text-3', ['surface', 'bg', 'surface-2'], 4.5);
    chk('accent-fg/accent', 'accent-fg', ['accent'], 4.5);
    chk('danger-fg/danger', 'danger-fg', ['danger'], 4.5);
    chk('danger vs surface (UI)', 'danger', ['surface'], 3);
    chk('accent-text', 'accent-text', ['surface', 'accent-soft'], 4.5);
    chk('accent vs surface (UI)', 'accent', ['surface'], 3);
    for (const k of ['productive', 'neutral', 'distracting', 'success', 'warning']) chk(k + '-text', k + '-text', ['surface', k + '-soft'], 4.5);
  }
  assert.deepEqual(bad.slice(0, 20), []);
});

test('radius, font, density, cards and scale overrides land in the variables', () => {
  const v = resolveVars({ look: 'calm', accent: 'look', radius: 'pill', font: 'mono', density: 'compact', cards: 'glass', scale: 110 }, 'light');
  assert.equal(v['--r-md'], '20px'); assert.match(v['--font'], /JetBrains Mono/); assert.equal(v['--ctl-h'], '32px'); assert.match(v['--card-bg'], /color-mix/); assert.equal(v['--ui-scale'], '1.1');
  const d = resolveVars({ look: 'terminal', accent: 'look' }, 'dark'); // look defaults apply when nothing is overridden
  assert.match(d['--font'], /JetBrains Mono/); assert.equal(d['--r-md'], '3px'); assert.equal(d['--card-bg'], 'transparent');
});

test('looks are distinct: no two share bg+surface+accent in the same scheme', () => {
  for (const scheme of ['light', 'dark']) {
    const keys = LOOK_IDS.map((id) => ['bg', 'surface', 'accent'].map((k) => LOOKS[id][scheme][k]).join('|'));
    assert.equal(new Set(keys).size, keys.length);
  }
});

test('pickScheme: system, fixed and scheduled (incl. overnight)', () => {
  const at = (h, m = 0) => new Date(2026, 9, 19, h, m);
  assert.equal(pickScheme({ mode: 'system' }, { prefersDark: true }), 'dark'); assert.equal(pickScheme({ mode: 'system' }, { prefersDark: false }), 'light');
  assert.equal(pickScheme({ mode: 'dark' }, { prefersDark: false }), 'dark');
  const sch = { mode: 'schedule', schedule: { dark: '20:00', light: '07:00' } };
  assert.equal(pickScheme(sch, { now: at(21) }), 'dark'); assert.equal(pickScheme(sch, { now: at(3) }), 'dark'); assert.equal(pickScheme(sch, { now: at(12) }), 'light'); assert.equal(pickScheme(sch, { now: at(7) }), 'light');
});

test('custom CSS: local rules pass, anything remote is rejected', () => {
  assert.equal(sanitizeCustomCss('.card { border-radius: 2px }').ok, true);
  assert.equal(sanitizeCustomCss('.a { background: url(data:image/png;base64,AAA) }').ok, true);
  for (const bad of ['@import "x.css";', '.a{background:url(https://evil.test/x)}', ".a{background:url('//evil.test/x')}", '.a{width:expression(alert(1))}']) assert.equal(sanitizeCustomCss(bad).ok, false, bad);
});

test('colour helpers', () => {
  assert.equal(normalizeHex('#ABC'), '#aabbcc'); assert.equal(normalizeHex('zzz'), null);
  assert.ok(contrast('#000000', '#ffffff') > 20.9);
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
  const r = readableFill('#808080'); assert.ok(contrast(r.fill, r.fg) >= 4.5);
  assert.ok(contrast(ensureContrast('#777777', ['#ffffff'], 4.5), '#ffffff') >= 4.5);
});

test('buildCache contains both schemes and sanitised css', () => {
  const c = buildCache({ look: 'aurora', accent: 'look', mode: 'system', schedule: { dark: '20:00', light: '07:00' }, scale: 100, customCss: '@import "x";' });
  assert.equal(c.light.attrs['data-scheme'], 'light'); assert.equal(c.dark.attrs['data-look'], 'aurora'); assert.equal(c.css, '');
  assert.ok(Object.keys(c.light.vars).length > 40);
});

test('sanitizeAppearance keeps valid values and drops everything else', async () => {
  const { sanitizeAppearance } = await import('../../src/shared/looks.js');
  const a = sanitizeAppearance({ look: 'aurora', mode: 'dark', accent: '#ABCDEF', font: 'serif', scale: 110, radius: 'pill', density: 'compact', cards: 'glass', motion: 'reduced', customCss: '.a{color:red}', hack: 1 });
  assert.deepEqual(a, { look: 'aurora', mode: 'dark', accent: '#abcdef', font: 'serif', scale: 110, radius: 'pill', density: 'compact', cards: 'glass', motion: 'reduced', customCss: '.a{color:red}' });
  assert.deepEqual(sanitizeAppearance({ look: 'nope', mode: 'x', accent: 'zzz', scale: 5000, customCss: '@import "x"' }), {});
  assert.deepEqual(sanitizeAppearance(null), {}); assert.deepEqual(sanitizeAppearance('str'), {});
  assert.equal(sanitizeAppearance({ accent: 'violet' }).accent, 'violet');
});
