import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeTasks, packTasks, unpackTasks, stable, sameTasks, samePayload, syncable, T_CHUNK_CHARS, T_MAX_BYTES, staleTaskKeys } from '../../src/shared/tasksync.js';

const T = (id, text = id, extra = {}) => ({ id, text, done: false, createdAt: 1, ...extra });
const base0 = (list) => Object.fromEntries(list.map((x) => [x.id, stable(x)]));
const ids = (m) => m.tasks.map((x) => x.id).sort();
const R = (tasks, del = {}) => ({ tasks, del });
const S = (list, tomb = {}) => ({ base: base0(list), tomb });

test('first sync is a union: nothing is lost either way', () => {
  const m = mergeTasks({}, [T('a'), T('b')], R([T('c')]));
  assert.deepEqual(ids(m), ['a', 'b', 'c']);
  assert.equal(m.tasks[0].id, 'c'); // new from the other side goes to the top
});

test('a task changed on one side only takes that change; the same field on both → the preferred side', () => {
  const a = T('a', 'old'), s = S([a]);
  assert.equal(mergeTasks(s, [a], R([T('a', 'remote edit')])).tasks[0].text, 'remote edit');
  assert.equal(mergeTasks(s, [T('a', 'local edit')], R([a])).tasks[0].text, 'local edit');
  assert.equal(mergeTasks(s, [T('a', 'L')], R([T('a', 'R')]), { preferLocal: true }).tasks[0].text, 'L');
  assert.equal(mergeTasks(s, [T('a', 'L')], R([T('a', 'R')]), { preferLocal: false }).tasks[0].text, 'R');
});

test('different fields of one task, changed on two devices, both survive', () => {
  const a = T('a', 'Report', { est: 25 }), s = S([a]);
  const m = mergeTasks(s, [{ ...a, done: true, doneAt: Date.now() }], R([{ ...a, focusSec: 600 }]), { preferLocal: false });
  assert.equal(m.tasks[0].done, true); assert.equal(m.tasks[0].focusSec, 600);
});

test('absence is never deletion: a copy that lacks our new task does not delete it (the two-writers race)', () => {
  // cloud = [x]; A adds p, B adds q; B's write lands last, so the cloud lacks p
  const x = T('x'), p = T('p'), q = T('q');
  const aState = { base: base0([x, p]), tomb: {} };          // A pushed [x, p]
  const merged = mergeTasks(aState, [p, x], R([q, x]), { preferLocal: false });
  assert.deepEqual(ids(merged), ['p', 'q', 'x']);            // p survives, q arrives
  const bAfter = mergeTasks({ base: base0([x, q]), tomb: {} }, [q, x], R(merged.tasks), { preferLocal: false });
  assert.deepEqual(ids(bAfter), ['p', 'q', 'x']);
});

test('a task deleted on one device goes through an explicit tombstone, and only if unchanged on the other', () => {
  const a = T('a'), b = T('b'), s = S([a, b]);
  const del = mergeTasks(s, [a], R([a, b]));                 // B (here) deleted b: tombstone made
  assert.ok(del.tomb.b); assert.deepEqual(ids(del), ['a']);
  assert.deepEqual(ids(mergeTasks(S([a, b]), [a, b], R([a], { b: 5 }))), ['a']);                       // tombstone from elsewhere, unchanged here → gone
  assert.deepEqual(ids(mergeTasks(S([a, b]), [a, T('b', 'edited here')], R([a], { b: 5 }))), ['a', 'b']); // edited here after the deletion: lives
  assert.deepEqual(ids(mergeTasks(del.base ? { base: del.base, tomb: del.tomb } : {}, [a], R([a, b]))), ['a']); // our deletion holds against a stale copy that still has b
  assert.deepEqual(ids(mergeTasks({ base: del.base, tomb: del.tomb }, [a], R([a, T('b', 'edited elsewhere')]))), ['a', 'b']); // ...unless it was edited elsewhere
});

test('tombstones travel on and expire after 30 days', () => {
  const m = mergeTasks({}, [T('a')], R([T('a')], { gone: 100 }), { now: 200 });
  assert.equal(m.tomb.gone.at, 100);
  const old = mergeTasks({ tomb: { gone: { at: 1, j: '' } } }, [T('a')], R([T('a')]), { now: 31 * 86_400_000 });
  assert.equal(old.tomb.gone, undefined);
});

test('old finished tasks stay where they are; a reopened one comes back', () => {
  const now = Date.now();
  const old = T('o', 'old', { done: true, doneAt: now - 10 * 86_400_000 }), fresh = T('f', 'fresh', { done: true, doneAt: now - 3600_000 });
  assert.equal(syncable(old, now), false); assert.equal(syncable(fresh, now), true);
  assert.deepEqual(ids(mergeTasks({}, [old, fresh], R([]), { now })), ['f', 'o']);
  const reopened = T('o', 'old'); // un-ticked on the other device
  assert.equal(mergeTasks({}, [old], R([reopened]), { now }).tasks[0].done, false);
  const p = packTasks([old, fresh], 1, {}, now); assert.deepEqual(unpackTasks(p.items).tasks.map((x) => x.id), ['f']);
});

test('merge is stable: running it again with its own result changes nothing', () => {
  const l = [T('a'), T('b')], r = [T('b'), T('c')];
  const m1 = mergeTasks({}, l, R(r));
  const m2 = mergeTasks({ base: m1.base, tomb: m1.tomb }, m1.tasks, R(m1.tasks));
  assert.equal(stable(m2.tasks), stable(m1.tasks));
  assert.ok(sameTasks([T('x'), T('y')], [T('y'), T('x')]));
  assert.ok(!sameTasks([T('x')], [T('x', 'changed')]));
  assert.ok(samePayload({ tasks: [T('x')], del: { a: 1 } }, { tasks: [T('x')], del: { a: 1 } })); assert.ok(!samePayload({ tasks: [], del: { a: 1 } }, { tasks: [], del: {} }));
});

test('pack / unpack round-trips, splits small, counts bytes, ignores corrupt data', () => {
  const tasks = Array.from({ length: 40 }, (_, i) => T('t' + i, 'задача № ' + i + ' ' + 'я'.repeat(40), { tags: ['работа'], est: 25 }));
  const p = packTasks(tasks, 5, { gone: 9 }); assert.ok(p.count >= 2);
  for (const [k, v] of Object.entries(p.items)) if (k !== 'st:meta') assert.ok(v.length <= T_CHUNK_CHARS);
  const back = unpackTasks(p.items);
  assert.deepEqual(back.tasks, tasks); assert.equal(back.ts, 5); assert.deepEqual(back.del, { gone: 9 });
  assert.equal(packTasks([T('big', 'x'.repeat(T_MAX_BYTES))], 1), null);
  const cjk = Array.from({ length: 300 }, (_, i) => T('c' + i, '汉'.repeat(40) + i));            // ~3 bytes a character
  assert.equal(packTasks(cjk, 1), null);
  delete p.items['st:1']; assert.equal(unpackTasks(p.items), null);
  assert.equal(unpackTasks({}), null); assert.equal(unpackTasks({ 'st:meta': { v: 9, n: 1 }, 'st:0': '{}' }), null);
  assert.deepEqual(unpackTasks(packTasks([], 1).items).tasks, []);
  assert.deepEqual(staleTaskKeys({ 'st:meta': {}, 'st:0': 'a', 'st:3': 'b', 'sync:5': 'c' }, 1), ['st:3']);
});

test('emoji are never split between two chunks', () => {
  const tasks = [T('e', '😀'.repeat(1300))];
  assert.equal(unpackTasks(packTasks(tasks, 1).items).tasks[0].text, tasks[0].text);
});
