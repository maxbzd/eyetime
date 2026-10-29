import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSkin, skinTokens, autoInk, SKIN_STYLES, SKIN_PRESETS } from '../../src/shared/skins.js';

const env = { ink: 'light', accent: '#cf450a' };

test('normalizeSkin: unknown or broken → null; numbers clamped; only set keys kept', () => {
  for (const bad of [null, undefined, 5, 'glass', {}, { s: 'nope' }, { s: 'javascript:' }]) assert.equal(normalizeSkin(bad), null);
  assert.deepEqual(normalizeSkin({ s: 'glass' }), { s: 'glass' });
  assert.deepEqual(normalizeSkin({ s: 'glass', r: 999, b: -4, o: 55.4, bw: 'x', sh: 10, a: '#ABCDEF', ink: 'dark', evil: '<img>' }), { s: 'glass', r: 44, b: 0, o: 55, sh: 10, a: '#abcdef', ink: 'dark' });
  assert.deepEqual(normalizeSkin({ s: 'solid', ink: 'auto', a: 'red; background: url(x)' }), { s: 'solid' });
  assert.deepEqual(normalizeSkin(normalizeSkin({ s: 'neon', r: 12 })), { s: 'neon', r: 12 });
});

test('autoInk: light text on dark scenes, dark text on light ones, by scheme when the scene has no tone', () => {
  assert.equal(autoInk({ tone: 'dark' }), 'light'); assert.equal(autoInk({ tone: 'light' }), 'dark');
  assert.equal(autoInk({ tone: '', scheme: 'dark' }), 'light'); assert.equal(autoInk({ tone: '', scheme: 'light' }), 'dark'); assert.equal(autoInk(), 'dark');
});

test('every style yields the card variables; "look" yields none', () => {
  assert.deepEqual(skinTokens({ s: 'look' }, env), { vars: {}, liquid: false, bare: false });
  for (const s of SKIN_STYLES.filter((x) => x !== 'look')) {
    const { vars } = skinTokens({ s }, env);
    for (const k of ['--card-bg', '--card-border', '--card-shadow', '--card-blur', '--r-lg', '--border-w', '--text', '--text-2']) assert.ok(typeof vars[k] === 'string' && vars[k], s + ' ' + k);
    assert.ok(!/undefined|NaN/.test(JSON.stringify(vars)), s);
  }
});

test('ink: light ink gives white text on a dark glass; dark ink the reverse; neon and paper force theirs', () => {
  const g = skinTokens({ s: 'glass' }, { ...env, ink: 'light' }).vars, d = skinTokens({ s: 'glass' }, { ...env, ink: 'dark' }).vars;
  assert.equal(g['--text'], '#ffffff'); assert.equal(d['--text'], '#17140f');
  assert.match(g['--card-bg'], /^rgba\(20, 22, 32/); assert.match(d['--card-bg'], /^rgba\(255, 255, 255/);
  assert.equal(skinTokens({ s: 'neon' }, { ...env, ink: 'dark' }).vars['--text'], '#ffffff');
  assert.equal(skinTokens({ s: 'paper' }, { ...env, ink: 'light' }).vars['--text'], '#17140f');
  assert.equal(skinTokens({ s: 'glass', ink: 'dark' }, { ...env, ink: 'light' }).vars['--text'], '#17140f'); // a chosen ink beats the scene
});

test('sliders override the preset; the accent only appears when set or for neon / tint', () => {
  const v = skinTokens({ s: 'glass', r: 8, b: 3, o: 80, bw: 0, sh: 0 }, env).vars;
  assert.equal(v['--r-lg'], '8px'); assert.equal(v['--card-blur'], '3px'); assert.equal(v['--border-w'], '0px'); assert.equal(v['--card-shadow'], 'none'); assert.match(v['--card-bg'], /0\.8\)$/);
  assert.equal(skinTokens({ s: 'glass' }, env).vars['--accent'], undefined);
  assert.equal(skinTokens({ s: 'glass', a: '#34d399' }, env).vars['--accent'], '#34d399');
  assert.equal(skinTokens({ s: 'neon', a: '#4cc9f0' }, env).vars['--card-border'], '#4cc9f0');
  assert.equal(skinTokens({ s: 'tint' }, env).vars['--accent'], '#cf450a');
  assert.equal(skinTokens({ s: 'glass', a: '#facc15' }, env).vars['--accent-fg'], '#1a1208'); // dark text on a bright accent
});

test('flags: liquid and bare are marked; presets stay in range', () => {
  assert.equal(skinTokens({ s: 'liquid' }, env).liquid, true); assert.equal(skinTokens({ s: 'bare' }, env).bare, true); assert.equal(skinTokens({ s: 'glass' }, env).liquid, false);
  for (const [k, p] of Object.entries(SKIN_PRESETS)) assert.ok(p.r >= 0 && p.r <= 44 && p.b >= 0 && p.b <= 44 && p.o >= 0 && p.o <= 100, k);
});
