import test from 'node:test';
import assert from 'node:assert/strict';
import { mondayKey, addItem, toggleItem, removeItem, itemsFor, weekProgress, MAX_WEEK_ITEMS } from '../../src/shared/week.js';

test('mondayKey finds the Monday of any day', () => {
  assert.equal(mondayKey(new Date(2026, 9, 21)), '2026-10-19'); // Wednesday
  assert.equal(mondayKey(new Date(2026, 9, 19)), '2026-10-19'); // Monday
  assert.equal(mondayKey(new Date(2026, 9, 25)), '2026-10-19'); // Sunday belongs to the week that started on Monday
  assert.equal(mondayKey(new Date(2026, 0, 1)), '2025-12-29'); // across a year
});

test('weekly plan: add, toggle, remove, cap, new week starts empty', () => {
  const k = '2026-10-19';
  let p = null;
  for (const t of ['A', 'B', 'C', 'D']) p = addItem(p, k, t, t);
  assert.equal(p.items.length, MAX_WEEK_ITEMS);
  p = toggleItem(p, k, 'B'); assert.deepEqual(weekProgress(p, k), { done: 1, total: 3 });
  p = removeItem(p, k, 'A'); assert.equal(itemsFor(p, k).length, 2);
  assert.deepEqual(itemsFor(p, '2026-10-26'), []);
  const next = addItem(p, '2026-10-26', 'New', 'n'); assert.equal(next.items.length, 1); assert.equal(next.week, '2026-10-26');
  assert.equal(addItem(null, k, '   ').items.length, 0);
});
