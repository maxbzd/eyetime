import test from 'node:test';
import assert from 'node:assert/strict';
import { HOME_KEYS, normalizeLayouts, pickLayout, inRange, effectiveHome, homeView, copyHome, newLayoutId, MAX_LAYOUTS } from '../../src/shared/layouts.js';
import { buildTheme, parseTheme, applyTheme, sanitizeHome, THEME_FORMAT } from '../../src/shared/themefile.js';
import { DEFAULT_SETTINGS } from '../../src/shared/defaults.js';

const L = (id, kind, extra = {}) => ({ id, name: id, when: { kind, from: '20:00', to: '06:00', ...extra }, data: {} });
const clone = (o) => JSON.parse(JSON.stringify(o));

test('normalizeLayouts keeps well-formed layouts only', () => {
  const list = normalizeLayouts([
    { id: 'lwork01', name: ' Work ', when: { kind: 'focus' }, data: { type: {}, tasks: 1, background: 'peaks' } },
    { id: 'lwork01', name: 'dup' }, { id: 'bad', name: 'x' }, null, 'x',
    { id: 'lnight1', when: { kind: 'time', from: '99:99', to: '07:30' }, data: null },
  ]);
  assert.deepEqual(list.map((l) => l.id), ['lwork01', 'lnight1']);
  assert.equal(list[0].name, 'Work'); assert.deepEqual(Object.keys(list[0].data).sort(), ['background', 'type']);
  assert.deepEqual(list[1].when, { kind: 'time', from: '20:00', to: '07:30' });
  assert.deepEqual(normalizeLayouts(list), list);
  assert.equal(normalizeLayouts(Array.from({ length: 30 }, (_, i) => ({ id: 'l' + String(i).padStart(5, '0') }))).length, MAX_LAYOUTS);
});

test('inRange handles a range that wraps past midnight', () => {
  assert.equal(inRange('20:00', '06:00', 23 * 60), true); assert.equal(inRange('20:00', '06:00', 3 * 60), true); assert.equal(inRange('20:00', '06:00', 12 * 60), false);
  assert.equal(inRange('09:00', '17:00', 12 * 60), true); assert.equal(inRange('09:00', '17:00', 17 * 60), false); assert.equal(inRange('08:00', '08:00', 1), true);
});

test('pickLayout: pin first, then focus, then the hours, else the default', () => {
  const layouts = [L('lfocus1', 'focus'), L('lnight1', 'time'), L('lmanual', 'manual')];
  assert.equal(pickLayout(layouts, { focus: false, minutes: 12 * 60 }), 'default');
  assert.equal(pickLayout(layouts, { focus: true, minutes: 12 * 60 }), 'lfocus1');
  assert.equal(pickLayout(layouts, { focus: false, minutes: 22 * 60 }), 'lnight1');
  assert.equal(pickLayout(layouts, { focus: true, minutes: 22 * 60 }), 'lfocus1', 'focus beats the clock');
  assert.equal(pickLayout(layouts, { focus: true, minutes: 22 * 60, pin: 'lmanual' }), 'lmanual');
  assert.equal(pickLayout(layouts, { focus: false, minutes: 12 * 60, pin: 'gone' }), 'default', 'a pin to a deleted layout is ignored');
  assert.equal(pickLayout([], { focus: true, minutes: 0 }), 'default');
});

test('effectiveHome overlays the layout on the default', () => {
  const base = { background: 'look', links: [1], canvas: { on: false, items: {} }, depth: { on: true } };
  const eff = effectiveHome(base, { data: { background: 'peaks', links: ['ignored'], canvas: { on: true, items: {} } } });
  assert.equal(eff.background, 'peaks'); assert.equal(eff.canvas.on, true); assert.deepEqual(eff.links, [1], 'links are shared, never per layout'); assert.deepEqual(eff.depth, { on: true });
  assert.equal(effectiveHome(base, null), base);
});

test('homeView: writes of Home keys land in the layout, nested changes never leak into the default', () => {
  const s = { newtab: { ...clone(DEFAULT_SETTINGS.newtab), layouts: [{ id: 'lwork01', name: 'Work', when: { kind: 'focus' }, data: {} }] } };
  const before = clone(s.newtab);
  const v = homeView(s, 'lwork01');
  v.background = 'peaks'; v.modules.tasks = false; v.canvas = { on: true, items: {} }; v.clock24 = true; v.links.push({ url: 'https://example.com', title: 'x' });
  assert.equal(s.newtab.layouts[0].data.background, 'peaks'); assert.equal(s.newtab.layouts[0].data.modules.tasks, false); assert.equal(s.newtab.layouts[0].data.canvas.on, true);
  assert.deepEqual(s.newtab.modules, before.modules, 'the default modules are untouched'); assert.equal(s.newtab.background, before.background); assert.equal(s.newtab.canvas.on, false);
  assert.equal(s.newtab.clock24, true, 'a shared key is written to the shared settings'); assert.equal(s.newtab.links.length, 1, 'links are shared');
  assert.equal(v.greeting, true, 'unset keys read through to the default');
  assert.equal(homeView(s, 'default'), s.newtab); assert.equal(homeView(s, 'missing'), s.newtab);
});

test('copyHome copies only Home keys, deeply', () => {
  const nt = clone(DEFAULT_SETTINGS.newtab); const c = copyHome(nt);
  assert.deepEqual(Object.keys(c).sort(), [...HOME_KEYS].filter((k) => nt[k] !== undefined).sort());
  c.modules.tasks = false; assert.equal(nt.modules.tasks, true);
  assert.match(newLayoutId([{ id: 'l000000' }], (() => { let n = 0; return () => (n++ === 0 ? 0 : 0.4); })()), /^l[0-9a-z]{6}$/);
});

test('theme file: build -> parse round trip, and hostile input is cleaned or refused', () => {
  const s = clone(DEFAULT_SETTINGS);
  s.newtab.canvas = { on: true, items: { clock: { x: 40, y: 30, s: 1.4 } } }; s.newtab.background = 'peaks'; s.appearance.look = 'tide'; s.newtab.links = [{ url: 'https://secret.example', title: 'secret' }];
  s.newtab.layouts = [{ id: 'lwork01', name: 'Work', when: { kind: 'focus' }, data: { background: 'sea' } }];
  const file = JSON.stringify(buildTheme(s, { name: 'Evening' }));
  assert.ok(!file.includes('secret.example'), 'personal data (links) never goes into a theme');
  const r = parseTheme(file); assert.equal(r.ok, true);
  assert.equal(r.theme.appearance.look, 'tide'); assert.equal(r.theme.home.background, 'peaks'); assert.equal(r.theme.home.canvas.items.clock.s, 1.4); assert.equal(r.theme.layouts[0].data.background, 'sea');
  const target = clone(DEFAULT_SETTINGS); applyTheme(target, r.theme);
  assert.equal(target.appearance.look, 'tide'); assert.equal(target.newtab.layouts.length, 1); assert.equal(target.newtab.layoutPin, null);

  assert.deepEqual(parseTheme('{').ok, false); assert.equal(parseTheme('{"format":"x"}').error, 'format'); assert.equal(parseTheme(JSON.stringify({ format: THEME_FORMAT, v: 9 })).error, 'version');
  assert.equal(parseTheme('x'.repeat(7_000_000)).error, 'size');
  const bad = parseTheme(JSON.stringify({ format: THEME_FORMAT, v: 1, appearance: { look: 'evil', customCss: '@import url(http://x)' }, home: { canvas: { on: true, items: { clock: { x: 'a' }, zzz: {} } }, background: '<script>', layout: 'x', modules: { tasks: false } },
    media: { bg: 'javascript:alert(1)', fg: 'data:image/png;base64,AAAA' }, layouts: [{ id: 'lbad001', data: { background: 'peaks', canvas: 5 } }] }));
  assert.equal(bad.ok, true);
  assert.equal(bad.theme.appearance.look, undefined); assert.equal(bad.theme.home.background, undefined); assert.equal(bad.theme.home.layout, undefined);
  assert.deepEqual(bad.theme.home.canvas.items, {}); assert.equal(bad.theme.home.modules.tasks, false); assert.equal(bad.theme.home.modules.today, true);
  assert.deepEqual(bad.theme.media, {}, 'a cut-out without a valid photo is dropped, and so is a non-image URL');
  assert.equal(bad.theme.layouts[0].data.background, 'peaks'); assert.deepEqual(bad.theme.layouts[0].data.canvas, { on: false, items: {} });
  assert.deepEqual(sanitizeHome(null), {});
});
