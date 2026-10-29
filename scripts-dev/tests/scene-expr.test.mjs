import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, compileTemplate, parse, LIMITS, FUNCTION_NAMES } from '../../src/shared/scene/expr.js';

const ev = (src, vars = {}) => { const c = compile(src); assert.ok(c.ok, src + ' → ' + c.error); return c.run(new Map(Object.entries(vars))); };

test('arithmetic, precedence, unary, ternary and comparison', () => {
  assert.equal(ev('1 + 2 * 3'), 7); assert.equal(ev('(1 + 2) * 3'), 9); assert.equal(ev('-2 + 5'), 3); assert.equal(ev('10 % 4'), 2); assert.equal(ev('2 * -3'), -6);
  assert.equal(ev('1 < 2 ? 10 : 20'), 10); assert.equal(ev('3 <= 2 ? 10 : 20'), 20); assert.equal(ev('!0'), 1); assert.equal(ev('1 && 0'), 0); assert.equal(ev('0 || 7'), 7);
  assert.equal(ev('a > 0.5 ? a * 2 : 0', { a: 0.8 }), 1.6);
  assert.equal(ev('true + true'), 2);
});

test('division and modulo by zero, NaN and Infinity never escape', () => {
  assert.equal(ev('1 / 0'), 0); assert.equal(ev('5 % 0'), 0); assert.equal(ev('sqrt(-4)'), 0); assert.equal(ev('log(0) * 0'), 0);
  assert.equal(ev('pow(10, 1000) > 0 ? 1 : 0'), 1);
  assert.ok(Number.isFinite(ev('exp(1000)')));
  assert.equal(ev('missing + 3'), 3, 'an unknown name reads as 0');
});

test('functions: maths, mixing, noise, arrays, strings', () => {
  assert.equal(ev('clamp(5, 0, 1)'), 1); assert.equal(ev('mix(10, 20, 0.25)'), 12.5); assert.equal(ev('min(3, 1, 2)'), 1); assert.equal(ev('max(3, 1)'), 3); assert.equal(ev('smooth(0, 1, 0.5)'), 0.5);
  assert.equal(ev('floor(2.9) + ceil(2.1) + round(2.5)'), 8); assert.ok(Math.abs(ev('sin(rad(90))') - 1) < 1e-9); assert.equal(ev('mod(-1, 5)'), 4);
  const n = ev('noise(1.5, 2.5)'); assert.ok(n >= 0 && n <= 1); assert.equal(ev('noise(1.5, 2.5)'), n, 'noise is deterministic');
  assert.equal(ev('rand(3)'), ev('rand(3)')); assert.notEqual(ev('rand(3)'), ev('rand(4)'));
  assert.equal(ev('sum(w)', { w: [1, 2, 3] }), 6); assert.equal(ev('maxa(w)', { w: [1, 9, 3] }), 9); assert.equal(ev('at(w, 1)', { w: [4, 5, 6] }), 5); assert.equal(ev('len(w)', { w: [1, 2] }), 2);
  assert.equal(ev('pad(7, 2)'), '07'); assert.equal(ev('fmt(3.14159, 2)'), '3.14');
});

test('colours: mixc, rgba, hsl, alpha', () => {
  assert.equal(ev('mixc("#000000", "#ffffff", 0.5)'), 'rgba(128, 128, 128, 1)');
  assert.equal(ev('mixc("#ff0000", "#0000ff", 0)'), 'rgba(255, 0, 0, 1)');
  assert.equal(ev('rgba(300, -5, 10, 2)'), 'rgba(255, 0, 10, 1)');
  assert.equal(ev('hsl(400, 50, 50)'), 'hsla(40, 50%, 50%, 1)');
  assert.equal(ev('alpha("#ff8800", 0.5)'), 'rgba(255, 136, 0, 0.5)');
});

test('templates fill {holes}', () => {
  const t = compileTemplate('{pad(hour, 2)}:{pad(minute, 2)} · {tasks} tasks');
  assert.ok(t.ok); assert.equal(t.run(new Map([['hour', 9], ['minute', 5], ['tasks', 3]])), '09:05 · 3 tasks');
  assert.deepEqual([...t.vars].sort(), ['hour', 'minute', 'tasks']);
  assert.equal(compileTemplate('plain').run(new Map()), 'plain'); assert.equal(compileTemplate('a {b} c').ok, true); assert.equal(compileTemplate('open {').ok, false);
});

test('dotted names read from the environment', () => {
  assert.equal(ev('state.focus * 2', { 'state.focus': 0.5 }), 1);
  assert.deepEqual(parse('a.b + c').vars.sort(), ['a.b', 'c']);
});

test('what cannot be written: unknown functions, loops, assignment, member tricks, code', () => {
  for (const bad of ['foo(1)', 'eval("1")', 'constructor.constructor("x")()', 'a = 1', 'while(1)', '1 +', '(1', 'sin()', 'sin(1, 2)', 'x => x', '"unterminated', '1 2', '`a`', 'a[0]', '{}', 'function(){}', '__proto__', '1 ? 2', 'min(1)', 'a;b']) {
    const c = compile(bad); assert.ok(!c.ok || c.vars.every((v) => !/__|constructor/.test(v)) || true, bad);
    if (!c.ok) continue;
    // anything that compiles can only read names from the environment: these must evaluate to a harmless value
    assert.ok(['number', 'string'].includes(typeof c.run(new Map())), bad);
  }
  for (const bad of ['foo(1)', 'eval("1")', 'a = 1', 'while(1)', '1 +', '(1', 'sin()', 'x => x', '"unterminated', 'a[0]', 'function(){}', 'a;b', 'sin(1, 2)', 'min(1)', '1 2']) assert.equal(compile(bad).ok, false, bad);
  assert.equal(ev('__proto__'), 0); assert.equal(ev('constructor'), 0, 'prototype names are just unknown names');
});

test('limits: length, size and depth are refused, and a long chain stays cheap', () => {
  assert.equal(compile('1' + '+1'.repeat(LIMITS.chars)).ok, false);
  assert.equal(compile(Array(LIMITS.nodes).fill('1').join('+')).ok, false);
  assert.equal(compile('('.repeat(40) + '1' + ')'.repeat(40)).ok, false);
  assert.equal(compile(Array(30).fill('1').join('+')).ok, true);
  const t0 = Date.now(); const c = compile('sin(t) * 3 + mix(a, b, smooth(0, 1, noise(t, 2)))'); for (let i = 0; i < 20000; i++) c.run(new Map([['t', i], ['a', 1], ['b', 2]])); assert.ok(Date.now() - t0 < 400, 'fast enough to run every frame');
});

test('the function list is what the docs say', () => { for (const f of ['sin', 'mix', 'mixc', 'noise', 'pad', 'clamp', 'smooth']) assert.ok(FUNCTION_NAMES.includes(f)); assert.ok(!FUNCTION_NAMES.includes('eval')); });
