import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeScene, sanitizeUi, CAPS, countNodes, nameAllowed } from '../../src/shared/scene/schema.js';

const S = (raw) => sanitizeScene(raw);

test('garbage in, a harmless empty scene out', () => {
  for (const bad of [null, undefined, 5, 'x', [], {}, { layers: 'no' }, { layers: [null, 5, 'x', {}, { t: 'script' }] }]) { const { scene } = S(bad); assert.deepEqual(scene.layers, []); assert.equal(scene.format, 'eyetime-scene'); }
});

test('known nodes keep their valid properties; unknown ones are dropped and numbers clamped', () => {
  const { scene } = S({ layers: [{ t: 'rect', x: 10, y: 20, w: 99999, h: 40, fill: '#ff0000', evil: '<img onerror=x>', onclick: 'alert(1)', op: 5, r: -3 }] });
  const n = scene.layers[0];
  assert.equal(n.t, 'rect'); assert.equal(n.x, 10); assert.equal(n.w, 5000); assert.equal(n.op, 1); assert.equal(n.r, 0); assert.equal(n.fill, '#ff0000'); assert.ok(!('evil' in n) && !('onclick' in n));
});

test('colours: tokens, rgba and hex pass; anything that could carry CSS or a URL does not', () => {
  const { scene } = S({ layers: [{ t: 'rect', fill: 'token:accent', stroke: 'rgba(255, 0, 0, .5)' }, { t: 'rect', fill: 'url(https://evil.example/x.png)' }, { t: 'rect', fill: 'red; background: url(x)' }, { t: 'rect', fill: 'javascript:alert(1)' }, { t: 'rect', fill: '#abc' }] });
  assert.equal(scene.layers[0].fill, 'token:accent'); assert.equal(scene.layers[0].stroke, 'rgba(255, 0, 0, .5)');
  assert.ok(!('fill' in scene.layers[1]) && !('fill' in scene.layers[2]) && !('fill' in scene.layers[3]));
  assert.equal(scene.layers[4].fill, '#abc');
});

test('gradients are structured, never raw CSS', () => {
  const { scene } = S({ layers: [{ t: 'rect', fill: { g: 'linear', a: 90, stops: [[0, '#000'], [1, '#fff'], [2, 'url(x)'], ['a', '#f00']] } }, { t: 'rect', fill: { g: 'radial', stops: [[0, '#000']] } }, { t: 'rect', fill: { g: 'conic', stops: [[0, '#000'], [1, '#fff']] } }] });
  assert.deepEqual(scene.layers[0].fill, { g: 'linear', stops: [[0, '#000'], [1, '#fff']], a: 90 });
  assert.ok(!('fill' in scene.layers[1]), 'a gradient needs two stops'); assert.ok(!('fill' in scene.layers[2]));
});

test('formulas: valid ones stay, unknown names and syntax errors are dropped with a warning', () => {
  const { scene, warnings } = S({ params: { speed: { type: 'number', min: 0, max: 2, def: 1 } }, states: { focus: { when: 'focus > 0.5' } }, layers: [
    { t: 'ellipse', x: '=sin(t * p.speed) * 50 + 500', y: 100, w: '=mix(40, 80, state.focus)' },
    { t: 'ellipse', x: '=secret + 1' }, { t: 'ellipse', x: '=1 +' }, { t: 'ellipse', x: '=eval("1")' }, { t: 'ellipse', x: '=p.nope' }, { t: 'ellipse', x: '=state.nope' }] });
  assert.equal(scene.layers[0].x, '=sin(t * p.speed) * 50 + 500'); assert.equal(scene.layers[0].w, '=mix(40, 80, state.focus)');
  for (const i of [1, 2, 3, 4, 5]) assert.ok(!('x' in scene.layers[i]), 'layer ' + i);
  assert.ok(warnings.length >= 5);
});

test('text templates are checked hole by hole', () => {
  const { scene } = S({ layers: [{ t: 'text', text: '{pad(hour, 2)}:{pad(minute, 2)}' }, { t: 'text', text: 'hello {nothing}' }, { t: 'text', text: 'open {' }, { t: 'text', text: 'x'.repeat(500) }] });
  assert.equal(scene.layers[0].text, '{pad(hour, 2)}:{pad(minute, 2)}'); for (const i of [1, 2, 3]) assert.ok(!('text' in scene.layers[i]));
});

test('paths accept only path syntax', () => {
  const { scene } = S({ layers: [{ t: 'path', d: 'M0 0 L10 10 C 1 2, 3 4, 5 6 Z' }, { t: 'path', d: 'M0 0 <script>' }, { t: 'path', d: 'M' + ' 1'.repeat(1000) }] });
  assert.ok(scene.layers[0].d); assert.ok(!('d' in scene.layers[1])); assert.ok(!('d' in scene.layers[2]));
});

test('groups nest to a depth limit; node counts are capped', () => {
  let deep = { t: 'rect' }; for (let i = 0; i < 12; i++) deep = { t: 'group', children: [deep] };
  assert.ok(countNodes(S({ layers: [deep] }).scene.layers) <= CAPS.depth + 1);
  const many = Array.from({ length: 1000 }, () => ({ t: 'rect' }));
  const { scene, warnings } = S({ layers: many }); assert.equal(countNodes(scene.layers), CAPS.nodes); assert.ok(warnings.includes('too many nodes'));
  const wide = sanitizeUi({ root: many }); assert.equal(countNodes(wide.ui.root), CAPS.widgetNodes);
});

test('lists need a row template and read item.* in it; only known arrays can be listed', () => {
  const { scene } = S({ layers: [{ t: 'list', of: 'tasks', max: 99, item: { t: 'text', text: '{item.text}', x: 0 } }, { t: 'list', of: 'secrets', item: { t: 'text', text: 'x' } }, { t: 'list', of: 'tasks' }, { t: 'text', text: '{item.text}' }] });
  assert.equal(scene.layers[0].max, CAPS.listMax); assert.equal(scene.layers[0].item.text, '{item.text}');
  assert.equal(scene.layers[1].of, 'tasks', 'an unknown array falls back to tasks'); assert.equal(scene.layers.length, 3, 'a list without a row is dropped, and item.* outside a list is not text'); assert.ok(!('text' in scene.layers[2]));
});

test('actions: only whitelisted verbs, with clamped arguments', () => {
  const { scene } = S({ states: { calm: {} }, layers: [{ t: 'rect', on: { click: { do: 'focus.start', min: 9999 } } }, { t: 'rect', on: { click: { do: 'fetch', url: 'https://x' } } }, { t: 'rect', on: { click: { do: 'state.set', name: 'calm' } } }, { t: 'rect', on: { click: { do: 'state.set', name: 'ghost' } } }, { t: 'rect', on: { click: { do: 'task.toggle' } } }] });
  assert.deepEqual(scene.layers[0].on, { click: { do: 'focus.start', min: 240 } }); assert.ok(!('on' in scene.layers[1])); assert.deepEqual(scene.layers[2].on, { click: { do: 'state.set', name: 'calm', to: 1 } }); assert.ok(!('on' in scene.layers[3])); assert.deepEqual(scene.layers[4].on, { click: { do: 'task.toggle' } });
});

test('params, states and particles are bounded', () => {
  const { scene } = S({ params: { a: { type: 'color', def: '#123456' }, b: { type: 'number', min: 0, max: 10, def: 99 }, 'bad name': { type: 'number' }, c: { type: 'weird' } }, states: Object.fromEntries(Array.from({ length: 20 }, (_, i) => ['s' + i, {}])), layers: [{ t: 'particles', n: 99999, size: [1, 3], colors: ['#fff', 'url(x)', '#f00'], speed: [-5, 5] }] });
  assert.deepEqual(Object.keys(scene.params), ['a', 'b']); assert.equal(scene.params.b.def, 10); assert.equal(Object.keys(scene.states).length, CAPS.states);
  assert.equal(scene.layers[0].n, CAPS.particles); assert.deepEqual(scene.layers[0].colors, ['#fff', '#f00']);
});

test('a scene survives a second pass unchanged (idempotent), and the widget form works too', () => {
  const raw = { name: 'x', bg: '#102030', params: { k: { type: 'number', min: 0, max: 1, def: 0.5 } }, states: { f: { when: 'focus > 0.5', ease: 2 } }, layers: [{ t: 'group', op: 0.5, children: [{ t: 'ring', x: 100, y: 100, r: 40, val: '=goal', sw: 8, fill: 'token:accent', track: 'rgba(0,0,0,.2)' }, { t: 'text', x: 10, y: 20, text: '{fmt(goal * 100, 0)}%', size: 40, font: 'display' }] }] };
  const a = S(raw).scene, b = S(a).scene; assert.deepEqual(a, b);
  const w = sanitizeUi({ size: [320, 200], root: raw.layers }); assert.deepEqual(w.ui.size, [320, 200]); assert.equal(w.ui.root.length, 1);
});

test('nameAllowed: bindings, params, states and extra names only', () => {
  const ctx = { names: new Set(['x1']), params: new Set(['speed']), states: new Set(['focus']) };
  for (const n of ['t', 'hour', 'goal', 'x1', 'p.speed', 'state.focus']) assert.ok(nameAllowed(n, ctx), n);
  for (const n of ['p.other', 'state.other', 'constructor', '__proto__', 'window', 'document.cookie']) assert.ok(!nameAllowed(n, ctx), n);
});

import { parseTheme, buildTheme } from '../../src/shared/themefile.js';
import { DEFAULT_SETTINGS } from '../../src/shared/defaults.js';

test('a theme file carries a scene and a custom widget through validation, and a hostile one is cleaned', () => {
  const home = { background: 'scene', scene: { name: 'a', layers: [{ t: 'rect', x: 0, y: 0, w: '=W', h: '=H', fill: '#123456' }] }, sceneParams: { k: 0.5, evil: '<x>', 'bad key': 1 }, widgets: [{ id: 'wabc123', kind: 'custom', cfg: { ui: { size: [300, 200], root: [{ t: 'text', text: '{goal}', x: 0, y: 30 }] } } }] };
  const r = parseTheme(JSON.stringify({ format: 'eyetime-theme', v: 1, appearance: {}, home, layouts: [] }));
  assert.ok(r.ok); assert.equal(r.theme.home.scene.layers.length, 1); assert.deepEqual(r.theme.home.sceneParams, { k: 0.5 }); assert.equal(r.theme.home.widgets[0].kind, 'custom'); assert.equal(r.theme.home.widgets[0].cfg.ui.root.length, 1);
  const hostile = parseTheme(JSON.stringify({ format: 'eyetime-theme', v: 1, appearance: {}, home: { scene: { layers: [{ t: 'script' }] }, widgets: [{ id: 'wabc123', kind: 'custom', cfg: { ui: { root: 'x' } } }] }, layouts: [] }));
  assert.equal(hostile.theme.home.scene, null, 'a scene with nothing drawable is dropped'); assert.ok(hostile.theme.home.widgets[0].cfg.ui.root.length >= 1, 'a broken custom widget falls back to the demo ring');
  const s = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); s.newtab.scene = r.theme.home.scene; const back = parseTheme(JSON.stringify(buildTheme(s)));
  assert.deepEqual(back.theme.home.scene, r.theme.home.scene, 'save and load keep the scene');
});
