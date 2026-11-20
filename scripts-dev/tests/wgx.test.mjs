// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
import test from 'node:test';
import assert from 'node:assert/strict';
import { handAngles, zonedParts, monthGrid, heatGrid, hourBars, breathAt } from '../../src/shared/wgx.js';

test('handAngles and zonedParts', () => {
  assert.deepEqual(handAngles(new Date(2024, 0, 1, 3, 0, 0)), { h: 90, m: 0, s: 0 });
  const b = handAngles(new Date(2024, 0, 1, 15, 30, 30)); assert.equal(b.m, 183); assert.equal(b.s, 180); assert.ok(Math.abs(b.h - 105.25) < 1e-9);
  const a = handAngles(new Date(2024, 0, 1, 12, 15, 0)); assert.equal(a.m, 90); assert.ok(Math.abs(a.h - 7.5) < 1e-9);
  assert.equal(zonedParts(new Date(Date.UTC(2024, 0, 1, 12, 0, 0)), 'Asia/Tokyo').h, 21);
  assert.equal(zonedParts(new Date(Date.UTC(2024, 0, 1, 0, 5, 9)), 'America/New_York').h, 19);
  const bad = zonedParts(new Date(2024, 0, 1, 7, 8, 9), 'Not/AZone'); assert.deepEqual(bad, { h: 7, m: 8, s: 9 });
});

test('monthGrid: weeks start where asked, always whole weeks, the month is inside', () => {
  const m = monthGrid(2024, 1, 1); // February 2024 starts on a Thursday
  assert.equal(m[0][0].key, '2024-01-29'); assert.equal(m[0][0].inMonth, false); assert.equal(m[0][3].key, '2024-02-01'); assert.equal(m[0][3].inMonth, true);
  assert.equal(m.length, 5); assert.ok(m.every((r) => r.length === 7));
  assert.equal(m.flat().filter((c) => c.inMonth).length, 29);
  const s = monthGrid(2024, 1, 0); assert.equal(s[0][0].key, '2024-01-28');
  assert.equal(monthGrid(2026, 1, 0).length, 4); // February 2026 starts on a Sunday: exactly four weeks when weeks start on Sunday
  assert.equal(monthGrid(2024, 8, 1).length, 6); // September 2024 needs six
});

test('heatGrid: the last column holds today, future cells are empty, levels follow the busiest day', () => {
  const today = new Date(2024, 4, 15); // a Wednesday
  const g = heatGrid((k) => ({ '2024-05-15': 3600, '2024-05-14': 900, '2024-05-13': 1800 }[k] || 0), 4, today, 1);
  assert.equal(g.length, 4); assert.ok(g.every((c) => c.length === 7));
  const last = g[3]; assert.equal(last[0].key, '2024-05-13'); assert.equal(last[2].key, '2024-05-15');
  assert.equal(last[2].level, 4); assert.equal(last[0].level, 2); assert.equal(last[1].level, 1);
  assert.equal(last[3].future, true); assert.equal(last[3].level, 0);
  assert.ok(heatGrid(() => 0, 3, today).every((c) => c.every((x) => x.level === 0)));
});

test('hourBars: null with too little data, the busiest hour is 1', () => {
  const t = (h) => new Date(2024, 0, 1, h, 5).getTime();
  assert.equal(hourBars([{ t: t(9), m: 25 }]), null);
  const b = hourBars([{ t: t(9), m: 50 }, { t: t(9), m: 25 }, { t: t(15), m: 25 }, { t: t(15), m: 25 }, { t: t(2), m: 2 }]);
  assert.equal(b.length, 24); assert.equal(b[9], 1); assert.ok(Math.abs(b[15] - 50 / 75) < 1e-9); assert.equal(b[2], 0);
});

test('breathAt: phases follow the pattern; the circle grows on the in-breath and shrinks on the out-breath', () => {
  assert.equal(breathAt('box', 0).phase, 'in'); assert.equal(breathAt('box', 0).size, 0);
  assert.ok(breathAt('box', 3.99).size > 0.99); assert.equal(breathAt('box', 5).phase, 'hold'); assert.equal(breathAt('box', 5).size, 1);
  assert.equal(breathAt('box', 9).phase, 'out'); assert.ok(breathAt('box', 11.9).size < 0.02); assert.equal(breathAt('box', 13).phase, 'rest');
  assert.equal(breathAt('calm', 4.5).phase, 'out'); assert.equal(breathAt('calm', 10).phase, 'in'); // a pattern without holds wraps cleanly
  assert.equal(breathAt('nope', 0).phase, 'in'); assert.equal(breathAt('relax', -1).phase !== undefined, true);
});
