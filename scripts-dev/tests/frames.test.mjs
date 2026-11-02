// The wallpapers of Home · Today: one a day, in turn; a veil that keeps white type readable; every file is where the code says it is.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FRAMES, FRAME_IDS, WALL_IDS, DAILY, dailyFrame, normalizeFrame, wallVeil, framePaths } from '../../src/shared/frames.js';
import { sanitizeHome } from '../../src/shared/themefile.js';
import { DEFAULT_SETTINGS } from '../../src/shared/defaults.js';

const root = new URL('../../', import.meta.url).pathname;

test('dailyFrame: the same wallpaper all day, the next one tomorrow, every one in turn', () => {
  const d = (day) => new Date(2026, 10, day, 3, 0);
  assert.equal(dailyFrame(d(2)), dailyFrame(new Date(2026, 10, 2, 23, 59)));
  assert.notEqual(dailyFrame(d(2)), dailyFrame(d(3)));
  const seen = new Set(); for (let i = 0; i < WALL_IDS.length; i++) seen.add(dailyFrame(d(1 + i)));
  assert.equal(seen.size, WALL_IDS.length); // a full round shows each one once
  assert.equal(dailyFrame(d(2), WALL_IDS.length), dailyFrame(d(2))); // skipping a whole round comes back
  assert.equal(dailyFrame(d(2), 1), dailyFrame(d(3))); // "another photo" is tomorrow's
  assert.ok(WALL_IDS.includes(dailyFrame(d(2), -7)) && WALL_IDS.includes(dailyFrame(d(2), 1e6))); // negative and huge skips stay inside the list
});

test('wallpapers: registered, with files, a thumbnail, a credit and a sane veil', () => {
  assert.ok(WALL_IDS.length >= 14);
  for (const id of WALL_IDS) {
    const f = FRAMES[id], p = framePaths(id);
    assert.ok(fs.existsSync(root + p.photo), id + ' photo'); assert.ok(fs.existsSync(root + `src/newtab/frames/${id}-t.webp`), id + ' thumbnail');
    assert.ok(f.credit, id + ' credit');
    const v = wallVeil(id); assert.equal(v.length, 3); for (const x of v) assert.ok(x >= 0 && x <= 0.7, id + ' veil ' + x);
  }
  assert.deepEqual(wallVeil('peak'), [0, 0, 0]); assert.deepEqual(wallVeil('nope'), [0, 0, 0]);
  const credits = fs.readFileSync(root + 'docs/PHOTO-CREDITS.md', 'utf8');
  for (const id of WALL_IDS) assert.ok(credits.includes('`' + id + '`'), id + ' is credited');
});

test('normalizeFrame knows our ids only; "daily" is kept by theme files and is the default', () => {
  assert.equal(normalizeFrame('aurum'), 'aurum'); assert.equal(normalizeFrame('../x'), ''); assert.equal(normalizeFrame(DAILY), '');
  assert.ok(FRAME_IDS.includes('aurum'));
  assert.equal(sanitizeHome({ frame: 'daily' }).frame, 'daily');
  assert.equal(sanitizeHome({ frame: 'sand' }).frame, 'sand');
  assert.equal(sanitizeHome({ frame: '<script>' }).frame, '');
  assert.equal(DEFAULT_SETTINGS.newtab.frame, 'daily'); assert.equal(DEFAULT_SETTINGS.newtab.layout, 'today');
  assert.equal(sanitizeHome({ layout: 'today' }).layout, 'today'); assert.equal(sanitizeHome({ layout: 'nope' }).layout, undefined);
});

test('moveHomeToToday: only the old default arrangement moves, and only once it is the plain "center"', async () => {
  const { moveHomeToToday } = await import('../../src/shared/migrate.js');
  const a = { newtab: { layout: 'center', canvas: { on: false } } }; assert.equal(moveHomeToToday(a), true); assert.equal(a.newtab.layout, 'today');
  assert.equal(moveHomeToToday(a), false); // already moved
  const b = { newtab: { layout: 'split' } }; assert.equal(moveHomeToToday(b), false); assert.equal(b.newtab.layout, 'split');
  const c = { newtab: { layout: 'center', canvas: { on: true } } }; assert.equal(moveHomeToToday(c), false); assert.equal(c.newtab.layout, 'center'); // a free-form arrangement stays
  assert.equal(moveHomeToToday(null), false); assert.equal(moveHomeToToday({}), false);
});
