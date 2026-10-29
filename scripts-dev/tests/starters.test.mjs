import test from 'node:test';
import assert from 'node:assert/strict';
import { STARTERS, STARTER_IDS, starterData, applyStarter, restoreHome, surprise } from '../../src/shared/starters.js';
import { sanitizeHome } from '../../src/shared/themefile.js';
import { DEFAULT_SETTINGS as DEFAULTS } from '../../src/shared/defaults.js';
import { LOOKS } from '../../src/shared/looks.js';
import { WIDGET_KINDS } from '../../src/shared/widgets.js';

const PARKED = ['spectrum', 'tide', 'ledger', 'vital', 'aura', 'obsidian', 'void', 'noir', 'pearl', 'bento'];
const seeded = (seed) => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; // mulberry32
const clone = (v) => JSON.parse(JSON.stringify(v));

test('eight starters with distinct ids, only long-standing looks, and every part survives validation', () => {
  assert.equal(STARTERS.length, 8);
  assert.equal(new Set(STARTER_IDS).size, 8);
  for (const s of STARTERS) {
    assert.ok(!PARKED.includes(s.appearance.look), s.id + ' uses a look that is not released');
    assert.ok(LOOKS[s.appearance.look], s.id + ' look exists');
    const d = starterData(s);
    assert.equal(d.appearance.look, s.appearance.look); assert.equal(d.appearance.mode, s.appearance.mode);
    assert.equal(d.home.widgets.length, s.home.widgets.length, s.id + ': no widget was dropped');
    assert.equal(Object.keys(d.home.canvas.items).length, Object.keys(s.home.canvas.items).length, s.id + ': no canvas item was dropped');
    assert.equal(d.home.background, s.home.background, s.id + ' background'); assert.equal(d.home.dna.s, s.home.dna.s);
    assert.deepEqual(d.home.type.clock.font, s.home.type.clock.font);
    for (const id of Object.keys(d.home.canvas.items)) assert.ok(['clock', 'greeting', 'quote', 'focus'].includes(id) || d.home.widgets.some((w) => w.id === id), s.id + ': canvas item ' + id + ' has a widget');
    assert.deepEqual(sanitizeHome(d.home), d.home, s.id + ': validation is stable');
  }
});

test('applying a starter replaces the Home keys and merges the appearance; restoring gives the old state back', () => {
  const s = clone(DEFAULTS);
  s.newtab.widgets = [{ id: 'wold001', kind: 'sticky', cfg: { text: 'mine' } }]; s.newtab.background = 'photo';
  const before = clone(s);
  const prev = applyStarter(s, s.newtab, starterData(STARTERS[1]));
  assert.equal(s.appearance.look, 'midnight'); assert.equal(s.newtab.background, 'stars'); assert.ok(s.newtab.widgets.some((w) => w.kind === 'goal'));
  assert.equal(s.newtab.canvas.on, true);
  assert.equal(s.newtab.links.length, before.newtab.links.length, 'links (data) are untouched');
  restoreHome(s, s.newtab, prev);
  assert.deepEqual(s, before);
});

test('surprise: always valid, hangs together, and is reproducible from a seed', () => {
  for (let i = 1; i <= 300; i++) {
    const a = surprise(seeded(i)), b = surprise(seeded(i));
    assert.deepEqual(a, b, 'same seed, same theme');
    const d = starterData(a);
    assert.ok(LOOKS[d.appearance.look] && !PARKED.includes(d.appearance.look));
    const widgets = d.home.widgets;
    assert.ok(widgets.length >= 2 && widgets.length <= 4, 'a few widgets, not a wall: ' + widgets.length);
    assert.equal(new Set(widgets.map((w) => w.id)).size, widgets.length, 'unique ids');
    assert.equal(widgets.length, a.home.widgets.length, 'none dropped by validation');
    for (const w of widgets) assert.ok(WIDGET_KINDS[w.kind] && !['weather', 'sun', 'agenda', 'label', 'countdown', 'stack'].includes(w.kind), 'no widget that needs set-up: ' + w.kind);
    assert.ok(d.home.canvas.items.clock && d.home.canvas.items.greeting);
    assert.equal(Object.keys(d.home.canvas.items).length, widgets.length + 2);
    assert.deepEqual(sanitizeHome(d.home), d.home);
  }
  const kinds = new Set(); for (let i = 1; i <= 300; i++) surprise(seeded(i)).home.widgets.forEach((w) => kinds.add(w.kind));
  assert.ok(kinds.size >= 18, 'a good spread of kinds over many surprises: ' + kinds.size);
});

test('surprise: a good spread of looks and both arrangements', () => {
  const looks = new Set(), bottoms = []; 
  for (let i = 1; i <= 300; i++) { const a = surprise(seeded(i)); looks.add(a.appearance.look); bottoms.push(Object.values(a.home.canvas.items).some((it) => it.y >= 78)); }
  assert.ok(looks.size >= 8, 'looks: ' + looks.size);
  const share = bottoms.filter(Boolean).length / bottoms.length; assert.ok(share > 0.1 && share < 0.5, 'bottom row share ' + share);
});
