import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeTasks, packTasks, unpackTasks, stable, sameTasks, syncable, T_CHUNK_CHARS, T_MAX_CHUNKS, staleTaskKeys } from '../../src/shared/tasksync.js';

const T = (id, text = id, extra = {}) => ({ id, text, done: false, createdAt: 1, ...extra });
const base0 = (list) => Object.fromEntries(list.map((x) => [x.id, stable(x)]));
const ids = (m) => m.tasks.map((x) => x.id).sort();

test('first sync is a union: nothing is lost either way', () => {
  const m = mergeTasks({}, [T('a'), T('b')], [T('c')]);
  assert.deepEqual(ids(m), ['a', 'b', 'c']);
  assert.equal(m.tasks[0].id, 'c'); // new from the other side goes to the top
});

test('a task changed on one side only takes that change; both sides → the preferred side', () => {
  const a = T('a', 'old'), base = base0([a]);
  assert.equal(mergeTasks(base, [a], [T('a', 'remote edit')]).tasks[0].text, 'remote edit');
  assert.equal(mergeTasks(base, [T('a', 'local edit')], [a]).tasks[0].text, 'local edit');
  assert.equal(mergeTasks(base, [T('a', 'L')], [T('a', 'R')], { preferLocal: true }).tasks[0].text, 'L');
  assert.equal(mergeTasks(base, [T('a', 'L')], [T('a', 'R')], { preferLocal: false }).tasks[0].text, 'R');
});

test('deletions travel, but only for unchanged tasks', () => {
  const a = T('a'), b = T('b'), base = base0([a, b]);
  assert.deepEqual(ids(mergeTasks(base, [a, b], [a])), ['a']);               // deleted there → deleted here
  assert.deepEqual(ids(mergeTasks(base, [a], [a, b])), ['a']);               // deleted here → stays deleted
  assert.deepEqual(ids(mergeTasks(base, [a, T('b', 'edited here')], [a])), ['a', 'b']); // edited here after the other side deleted it: keep
  assert.deepEqual(ids(mergeTasks(base, [a], [a, T('b', 'edited there')])), ['a', 'b']); // edited there after we deleted it: bring it back
});

test('an empty or missing cloud copy never wipes the list when the caller passes the local list as remote (worker rule)', () => {
  const a = T('a'), base = base0([a]);
  const m = mergeTasks(base, [a], [a]); assert.deepEqual(ids(m), ['a']);
});

test('old finished tasks do not travel and are never deleted by a sync', () => {
  const now = Date.now();
  const old = T('o', 'old', { done: true, doneAt: now - 10 * 86_400_000 }), fresh = T('f', 'fresh', { done: true, doneAt: now - 3600_000 });
  assert.equal(syncable(old, now), false); assert.equal(syncable(fresh, now), true);
  const m = mergeTasks(base0([fresh]), [old, fresh], [], { now });
  assert.deepEqual(ids(m), ['o']); // fresh was in base and is gone there → deleted; the old one stays
  const p = packTasks([old, fresh], 1, now); assert.deepEqual(unpackTasks(p.items).tasks.map((x) => x.id), ['f']);
});

test('merge is stable: running it again with its own result changes nothing and does not ping-pong', () => {
  const l = [T('a'), T('b')], r = [T('b'), T('c')];
  const m1 = mergeTasks({}, l, r);
  const m2 = mergeTasks(m1.base, m1.tasks, m1.tasks);
  assert.equal(stable(m2.tasks), stable(m1.tasks));
  assert.ok(sameTasks([T('x'), T('y')], [T('y'), T('x')])); // order does not matter
  assert.ok(!sameTasks([T('x')], [T('x', 'changed')]));
});

test('pack / unpack round-trips, splits small, refuses what does not fit, ignores corrupt data', () => {
  const tasks = Array.from({ length: 40 }, (_, i) => T('t' + i, 'задача № ' + i + ' ' + 'я'.repeat(40), { tags: ['работа'], est: 25 }));
  const p = packTasks(tasks, 5); assert.ok(p.count >= 2);
  for (const [k, v] of Object.entries(p.items)) if (k !== 'st:meta') assert.ok(v.length <= T_CHUNK_CHARS);
  assert.deepEqual(unpackTasks(p.items).tasks, tasks); assert.equal(unpackTasks(p.items).ts, 5);
  assert.equal(packTasks([T('big', 'x'.repeat(T_CHUNK_CHARS * T_MAX_CHUNKS))], 1), null);
  delete p.items['st:1']; assert.equal(unpackTasks(p.items), null);
  assert.equal(unpackTasks({}), null); assert.equal(unpackTasks({ 'st:meta': { v: 9, n: 1 }, 'st:0': '[]' }), null);
  assert.deepEqual(packTasks([], 1).items['st:meta'], { v: 1, n: 1, ts: 1 }); assert.deepEqual(unpackTasks(packTasks([], 1).items).tasks, []);
  assert.deepEqual(staleTaskKeys({ 'st:meta': {}, 'st:0': 'a', 'st:3': 'b', 'sync:5': 'c' }, 1), ['st:3']);
});

test('emoji are never split between two chunks', () => {
  const tasks = [T('e', '😀'.repeat(1300))];
  const p = packTasks(tasks, 1);
  assert.equal(unpackTasks(p.items).tasks[0].text, tasks[0].text);
});
