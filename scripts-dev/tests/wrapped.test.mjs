import test from 'node:test';
import assert from 'node:assert/strict';
import { wrappedStats } from '../../src/shared/wrapped.js';

const day = (fs) => ({ fs });
const cur = [['2026-10-14', day(7200)], ['2026-10-15', day(0)], ['2026-10-16', day(9000)], ['2026-10-17', day(8000)], ['2026-10-18', day(7300)], ['2026-10-19', day(10000)], ['2026-10-20', day(7300)]];

test('goal week', () => {
  const s = wrappedStats({ sum: { total: 1000, distracting: 300, focusSec: 48800 }, prev: { total: 1000, distracting: 200, focusSec: 40000 }, cur, goalMin: 120 });
  assert.equal(s.goalDays, 6); assert.equal(s.msg, 'goal'); assert.equal(s.best.key, '2026-10-19'); assert.equal(s.share, 30); assert.equal(s.shareDelta, 10);
});

test('up week without a goal, and steady fallback', () => {
  const up = wrappedStats({ sum: { total: 100, distracting: 10, focusSec: 5500 }, prev: { total: 100, distracting: 10, focusSec: 5000 }, cur: cur.slice(0, 3), goalMin: 0 });
  assert.equal(up.goalDays, null); assert.equal(up.msg, 'up'); assert.equal(up.focusDelta, 10);
  const flat = wrappedStats({ sum: { total: 0, distracting: 0, focusSec: 0 }, prev: { total: 0, distracting: 0, focusSec: 0 }, cur: [['2026-10-14', {}]], goalMin: 0 });
  assert.equal(flat.msg, 'steady'); assert.equal(flat.best, null); assert.equal(flat.shareDelta, null);
});
