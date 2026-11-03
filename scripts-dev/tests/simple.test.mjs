import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { ADV, RAW_KEYS, isAdvanced, isModified, touchedRaw } from '../../src/options/simple.js';
import { DEFAULT_SETTINGS } from '../../src/shared/defaults.js';
import { calmDefault, starterData, applyStarter, restoreHome } from '../../src/shared/starters.js';

const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);

test('essentials: every setting path in the list exists in the defaults', () => {
  for (const [id, e] of Object.entries(ADV)) for (const p of e.paths || []) assert.notEqual(get(DEFAULT_SETTINGS, p), undefined, `${id}: ${p} is not a setting`);
  assert.ok(RAW_KEYS.includes('calendarSubs') && RAW_KEYS.includes('syncTasks'));
});

test('essentials: the ids used in the settings code are the ids in the list, and every id is used', () => {
  const dir = new URL('../../src/options/', import.meta.url), used = new Set();
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js') && x !== 'simple.js')) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    for (const m of src.matchAll(/\badv: '([A-Za-z]+)'|\badv\([^]*?, '([A-Za-z]+)'\)|\badv(?:Group|Fold)\('([A-Za-z]+)'/g)) used.add(m[1] || m[2] || m[3]);
  }
  for (const id of used) assert.ok(id in ADV, `${id} is used but not in the list`);
  for (const id of Object.keys(ADV)) assert.ok(used.has(id), `${id} is in the list but nothing uses it`);
});

test('essentials: an advanced setting is hidden until the person has changed it or uses it', () => {
  const s = structuredClone(DEFAULT_SETTINGS);
  for (const id of Object.keys(ADV)) assert.equal(isAdvanced(id, s), true, id + ' is hidden on a fresh profile');
  s.dock.enabled = true; assert.equal(isAdvanced('dock', s), false, 'the dock is on: it stays');
  s.focus.reminders = [{ id: 'a', time: '09:00', days: [1], minutes: 25 }]; assert.equal(isAdvanced('reminders', s), false);
  s.blocking.friction.seconds = 15; assert.equal(isAdvanced('friction', s), false, 'a changed pause length keeps the group');
  s.appearance.density = 'compact'; assert.equal(isAdvanced('shape', s), false);
  assert.equal(isAdvanced('goalDays', s), true, 'what was not touched stays hidden');
  assert.equal(isAdvanced('calendar', DEFAULT_SETTINGS, new Set(['calendarSubs'])), false, 'a calendar subscription is in use');
  assert.equal(isAdvanced('sync', DEFAULT_SETTINGS, new Set(['syncSettings'])), false);
  assert.equal(isAdvanced('sync', DEFAULT_SETTINGS, new Set()), true);
  assert.throws(() => isAdvanced('nope', s), /unknown/);
  assert.equal(isModified(DEFAULT_SETTINGS, ['tracking.excluded']), false);
  const reordered = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.focus.modes).replace(/\{"id":"deep","icon":"brain"/, '{"icon":"brain","id":"deep"'));
  assert.equal(isModified({ focus: { modes: reordered } }, ['focus.modes']), false, 'the same values with the keys in another order are not a change');
});

test('essentials: what counts as "in use" among the raw keys', () => {
  const t = touchedRaw({ calendar: [], calendarSrc: {}, calendarSubs: [{ url: 'x' }], syncSettings: true, syncTasks: false, other: 0 });
  assert.deepEqual([...t].sort(), ['calendarSubs', 'syncSettings']);
  assert.deepEqual([...touchedRaw(null)], []);
});

test('calm default: brings back the designed look and leaves what is the person\'s', () => {
  const data = starterData(calmDefault()), c = calmDefault();
  for (const k of Object.keys(c.home)) { assert.ok(k in data.home, 'sanitising keeps ' + k); if (k !== 'depth') assert.deepEqual(data.home[k], c.home[k], k); } // (depth gains its other defaults)
  assert.deepEqual({ on: data.home.depth.on, parallax: data.home.depth.parallax, strength: data.home.depth.strength }, { on: c.home.depth.on, parallax: c.home.depth.parallax, strength: c.home.depth.strength });
  assert.deepEqual(data.appearance, c.appearance);
  const s = structuredClone(DEFAULT_SETTINGS);
  Object.assign(s.appearance, { look: 'noir', mode: 'dark', accent: '#ff0000', font: 'mono', scale: 125, radius: 'sharp', density: 'compact', cards: 'glass', customCss: '.card { border-radius: 2px; }', motion: 'reduced' });
  Object.assign(s.newtab, { layout: 'center', background: 'photo', frame: 'dunes', clockStyle: 'bold', quiet: true, clock24: true, canvas: { on: true, items: { clock: { x: 10, y: 10 } } }, widgets: [{ id: 'w1', kind: 'clock', cfg: {} }], links: [{ title: 'Mine', url: 'https://example.com' }] });
  const before = applyStarter(s, s.newtab, data);
  const a = DEFAULT_SETTINGS.appearance, n = DEFAULT_SETTINGS.newtab;
  for (const k of ['look', 'accent', 'font', 'scale', 'radius', 'density', 'cards', 'customCss']) assert.deepEqual(s.appearance[k], a[k], k);
  for (const k of ['layout', 'background', 'frame', 'clockStyle', 'quiet']) assert.deepEqual(s.newtab[k], n[k], k);
  assert.deepEqual(s.newtab.canvas, { on: false, items: {} });
  assert.equal(s.appearance.mode, 'dark', 'the light / dark choice stays'); assert.equal(s.appearance.motion, 'reduced', 'reduced motion stays');
  assert.equal(s.newtab.clock24, true); assert.equal(s.newtab.widgets.length, 1); assert.equal(s.newtab.links.length, 1);
  restoreHome(s, s.newtab, before);
  assert.equal(s.appearance.look, 'noir'); assert.equal(s.newtab.layout, 'center'); assert.deepEqual(s.newtab.canvas.items.clock, { x: 10, y: 10 }); assert.equal(s.appearance.customCss, '.card { border-radius: 2px; }');
});
