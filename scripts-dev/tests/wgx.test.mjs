import test from 'node:test';
import assert from 'node:assert/strict';
import { moonInfo, moonPath, sunTimes, sunProgress, handAngles, zonedParts, monthGrid, yearInfo, heatGrid, hourBars, breathAt, MOON_PHASES } from '../../src/shared/wgx.js';

test('moonInfo: known moons within about a day', () => {
  const full = moonInfo(new Date(Date.UTC(2024, 11, 15, 9, 2))); // a full moon
  assert.ok(full.illum > 0.97 && full.name === 'full', JSON.stringify(full));
  const nw = moonInfo(new Date(Date.UTC(2024, 5, 6, 12, 38))); // a new moon
  assert.ok(nw.illum < 0.03 && nw.name === 'new', JSON.stringify(nw));
  const q = moonInfo(new Date(Date.UTC(2024, 11, 8, 15, 27))); // first quarter
  assert.ok(Math.abs(q.illum - 0.5) < 0.08 && ['firstQuarter', 'waxingCrescent', 'waxingGibbous'].includes(q.name), JSON.stringify(q));
  assert.ok(full.toFull < 1 || full.toFull > 28.5); assert.ok(nw.toFull > 13 && nw.toFull < 16);
  for (let i = 0; i < 60; i++) assert.ok(MOON_PHASES.includes(moonInfo(new Date(Date.UTC(2025, 0, 1 + i))).name));
  assert.ok(moonInfo(new Date(0)).frac >= 0 && moonInfo(new Date(-9e12)).frac < 1);
});

test('moonPath: nothing at new, a whole disc at full, flipped when waning', () => {
  assert.equal(moonPath(0.0).d, '');
  assert.ok(moonPath(0.5).d.includes('A50,50 0 1 1')); // a full circle
  assert.equal(moonPath(0.2).flip, false); assert.equal(moonPath(0.8).flip, true);
  assert.match(moonPath(0.25).d, /A0\.00,50/); // first quarter: a straight terminator
  assert.match(moonPath(0.1).d, /^M0,-50 A50,50 0 0 1 0,50 A[\d.]+,50 0 0 0 0,-50 Z$/); // crescent bulges the same way as the limb
  assert.match(moonPath(0.4).d, /0 0 1 0,-50 Z$/); // gibbous bulges the other way
});

test('sunTimes: Greenwich at the equinox, a midsummer day in Kyiv, the poles', () => {
  const s = sunTimes(new Date(2024, 2, 20), 51.4769, 0);
  const min = (d) => d.getUTCHours() * 60 + d.getUTCMinutes();
  assert.ok(Math.abs(min(s.rise) - (6 * 60 + 3)) < 6 && Math.abs(min(s.set) - (18 * 60 + 15)) < 6, 'rise ' + s.rise.toISOString() + ' set ' + s.set.toISOString());
  const k = sunTimes(new Date(2024, 5, 21), 50.45, 30.52), len = (k.set - k.rise) / 3_600_000;
  assert.ok(len > 16.2 && len < 17.2, 'a long day: ' + len);
  assert.equal(sunTimes(new Date(2024, 5, 21), 80, 0).polar, 'day'); assert.equal(sunTimes(new Date(2024, 11, 21), 80, 0).polar, 'night');
  assert.ok(Math.abs(sunProgress(new Date(s.noon), s.rise, s.set) - 0.5) < 0.02);
});

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

test('yearInfo', () => {
  assert.deepEqual(yearInfo(new Date(2024, 0, 1)), { year: 2024, total: 366, index: 0, left: 365, frac: 1 / 366 });
  const y = yearInfo(new Date(2025, 11, 31)); assert.equal(y.total, 365); assert.equal(y.left, 0); assert.equal(y.frac, 1);
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
