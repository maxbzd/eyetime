import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeType, clockDecls, textDecls, TYPEFACES, CLOCK_DEFAULT, TEXT_DEFAULT } from '../../src/shared/typeface.js';

test('normalizeType: nothing set means the look keeps its own typography', () => {
  const n = normalizeType(undefined);
  assert.deepEqual(n.clock, { ...CLOCK_DEFAULT, angle: 100 });
  assert.deepEqual(n.text, TEXT_DEFAULT);
  assert.deepEqual(clockDecls(n.clock), {});
  assert.deepEqual(textDecls(n.text), {});
});

test('normalizeType: bad input is clamped, never trusted', () => {
  const n = normalizeType({ clock: { font: 'comic', weight: 9999, tracking: 5, fill: 'plaid', color: 'red', color2: '#abc', angle: -10, stroke: 99, glow: 7, shadow: -1, seconds: 'yes', tabular: 0 }, text: { font: 'inter', weight: 1, color: '#FFF', upper: 1 } });
  assert.equal(n.clock.font, 'look'); assert.equal(n.clock.weight, 900); assert.equal(n.clock.tracking, 0.3);
  assert.equal(n.clock.fill, 'solid'); assert.equal(n.clock.color, null); assert.equal(n.clock.color2, '#aabbcc');
  assert.equal(n.clock.angle, 0); assert.equal(n.clock.stroke, 6); assert.equal(n.clock.glow, 1); assert.equal(n.clock.shadow, 0);
  assert.equal(n.clock.seconds, false); assert.equal(n.clock.tabular, true);
  assert.equal(n.text.weight, 100); assert.equal(n.text.color, '#ffffff'); assert.equal(n.text.upper, false);
});

test('normalizeType is stable and respects each face\'s real weight range', () => {
  const a = normalizeType({ clock: { font: 'playfair', weight: 100 }, text: { font: 'instrument', weight: 700 } });
  assert.equal(a.clock.weight, 400); assert.equal(a.text.weight, 400);
  assert.deepEqual(normalizeType(a), a);
  for (const [id, f] of Object.entries(TYPEFACES)) { assert.ok(f.w[0] <= f.def && f.def <= f.w[1], id + ' default weight inside its range'); assert.ok(f.stack.includes(f.label.split(' ')[0]) || id === 'system', id); }
});

test('clockDecls: font, weight, spacing and fills', () => {
  const s = (o) => normalizeType({ clock: o }).clock;
  const solid = clockDecls(s({ font: 'unbounded', weight: 200, tracking: -0.05, color: '#ff0000' }));
  assert.match(solid['font-family'], /^"Unbounded"/); assert.equal(solid['font-weight'], '200'); assert.equal(solid['letter-spacing'], '-0.05em');
  assert.equal(solid.color, '#ff0000'); assert.equal(solid['-webkit-text-fill-color'], '#ff0000');
  const grad = clockDecls(s({ fill: 'gradient', color: '#111111', color2: '#eeeeee', angle: 45 }));
  assert.equal(grad['background-image'], 'linear-gradient(45deg, #111111, #eeeeee)'); assert.equal(grad['-webkit-text-fill-color'], 'transparent');
  const gradDefault = clockDecls(s({ fill: 'gradient' }));
  assert.match(gradDefault['background-image'], /#ff8a5c, #8b5cf6/);
  const out = clockDecls(s({ fill: 'outline', stroke: 3 }));
  assert.equal(out['-webkit-text-stroke'], '3px currentColor'); assert.equal(out['-webkit-text-fill-color'], 'transparent');
});

test('clockDecls: glow and shadow combine into one filter, off when zero', () => {
  const s = (o) => normalizeType({ clock: o }).clock;
  assert.equal(clockDecls(s({})).filter, undefined);
  const f = clockDecls(s({ glow: 1, shadow: 0.5 })).filter;
  assert.match(f, /^drop-shadow\(0 0 56px .*\) drop-shadow\(0 11px 23px rgba\(0, 0, 0, 0.35\)\)$/);
  assert.equal(clockDecls(s({ tabular: false }))['font-variant-numeric'], 'proportional-nums');
});

test('textDecls', () => {
  assert.deepEqual(textDecls(normalizeType({ text: { font: 'rubik', weight: 500, color: '#123456', upper: true, tracking: 0.1 } }).text),
    { 'font-family': TYPEFACES.rubik.stack, 'font-weight': '500', 'letter-spacing': '0.1em', color: '#123456', 'text-transform': 'uppercase' });
});

test('glass and photo fills clip the picture to the digits and never leave them invisible', async () => {
  const { clockDecls, normalizeType, FILLS, CLOCK_DEFAULT } = await import('../../src/shared/typeface.js');
  assert.ok(FILLS.includes('glass') && FILLS.includes('photo'));
  for (const fill of ['glass', 'photo']) {
    const d = clockDecls({ ...CLOCK_DEFAULT, fill });
    assert.equal(d['background-clip'], 'text'); assert.equal(d['-webkit-text-fill-color'], 'transparent');
    assert.ok(/var\(--photo/.test(d['background-image']), fill + ' needs the photo variable');
    assert.ok(/--clk-bgs/.test(d['background-size']) && /--clk-bgp/.test(d['background-position']), fill + ' is placed by the page');
  }
  assert.ok(/linear-gradient\(#fff/.test(clockDecls({ ...CLOCK_DEFAULT, fill: 'photo' })['background-image']), 'photo falls back to white without a photo');
  assert.ok(/#ff0000/.test(clockDecls({ ...CLOCK_DEFAULT, fill: 'glass', color: '#ff0000' })['background-image']), 'the glass tint follows the chosen colour');
  assert.equal(normalizeType({ clock: { fill: 'glass' } }).clock.fill, 'glass'); assert.equal(normalizeType({ clock: { fill: 'neon' } }).clock.fill, 'solid');
});
