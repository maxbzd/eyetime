// WCAG contrast guard for the design tokens (docs/DESIGN.md): text ≥ 4.5:1, large/UI ≥ 3:1, in light and dark.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const css = fs.readFileSync(path.join(root, 'src/ui/tokens.css'), 'utf8');

function vars(block) { return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]])); }
const blockOf = (start) => { const i = css.indexOf(start); return css.slice(css.indexOf('{', i) + 1, css.indexOf('\n}', i)); };
const light = vars(blockOf(':root, :root[data-theme="light"]'));
const dark = { ...vars(blockOf(':root[data-theme="dark"]')) };
const darkAll = { ...light, ...dark }; // dark inherits non-overridden tokens

const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const accentLight = vars(blockOf(':root {')); // base :root accent (light)
const themes = { light: { ...accentLight, ...light }, dark: { ...accentLight, ...darkAll } };

// [foreground, background, minimum]
const PAIRS = [
  ['--text', '--bg', 7], ['--text', '--surface', 7], ['--text-2', '--surface', 4.5], ['--text-2', '--bg', 4.5], ['--text-3', '--surface', 4.5], ['--text-3', '--bg', 4.4], ['--text-3', '--surface-2', 4.0],
  ['--accent-fg', '--accent', 4.5], ['--accent-text', '--surface', 4.5], ['--accent-text', '--accent-soft', 4.5],
  ['--productive-text', '--surface', 4.5], ['--productive-text', '--productive-soft', 4.5],
  ['--distracting-text', '--surface', 4.5], ['--distracting-text', '--distracting-soft', 4.5],
  ['--neutral-text', '--surface', 4.5], ['--neutral-text', '--neutral-soft', 4.5],
  ['--success-text', '--success-soft', 4.5], ['--warning-text', '--warning-soft', 4.5],
  ['--productive', '--surface', 3], ['--distracting', '--surface', 3], ['--accent', '--surface', 3],
];

for (const [name, tk] of Object.entries(themes)) {
  test(`contrast (${name})`, () => {
    const bad = [];
    for (const [fg, bg, min] of PAIRS) {
      if (!tk[fg] || !tk[bg]) { bad.push(`missing token ${fg} or ${bg}`); continue; }
      const r = ratio(tk[fg], tk[bg]);
      if (r < min) bad.push(`${fg} on ${bg} = ${r.toFixed(2)} (needs ${min})`);
    }
    assert.deepEqual(bad, []);
  });
}

test('accent presets: fills have ≥4.5:1 against their foreground in both themes', async () => {
  const src = fs.readFileSync(path.join(root, 'src/ui/theme-init.js'), 'utf8');
  const table = src.slice(src.indexOf('var ACCENTS'), src.indexOf('var KEYS'));
  const bad = [];
  for (const m of table.matchAll(/(\w+):\s*\{ l: \[([^\]]+)\], d: \[([^\]]+)\]/g)) {
    for (const [mode, list] of [['light', m[2]], ['dark', m[3]]]) {
      const [fill, , fg, text, soft] = [...list.matchAll(/#[0-9a-fA-F]{6}/g)].map((x) => x[0]);
      const surface = mode === 'light' ? '#ffffff' : '#181716';
      if (ratio(fill, fg) < 4.5) bad.push(`${m[1]} ${mode}: fill/fg ${ratio(fill, fg).toFixed(2)}`);
      if (ratio(text, surface) < 4.5) bad.push(`${m[1]} ${mode}: text on surface ${ratio(text, surface).toFixed(2)}`);
      if (ratio(text, soft) < 4.0) bad.push(`${m[1]} ${mode}: text on soft ${ratio(text, soft).toFixed(2)}`);
    }
  }
  assert.deepEqual(bad, []);
});
