// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Task sync as a property: whatever two devices do to the same list (add, edit, finish, delete) and in whatever order they meet the cloud, once they have both
// met it again they hold the same tasks, with no duplicates, and nothing one of them deleted (and the other never touched) comes back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeTasks, packTasks, unpackTasks, sameTasks, syncable } from '../../src/shared/tasksync.js';

// a small deterministic generator, so a failure can be replayed from its seed
const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

/** One device with its own list, and what the worker keeps beside it: `base` (what it last synced) and the tombstones. */
const device = () => ({ tasks: [], base: {}, tomb: {}, deleted: new Set() });

/** One round with the cloud, as src/background/tasksync.js does it: read the copy, merge, write it back when it differs. */
function sync(dev, cloud, now, preferLocal) {
  const rem = cloud.payload ? unpackTasks(cloud.payload) : { tasks: [], del: {} };
  const merged = mergeTasks({ base: dev.base, tomb: dev.tomb }, dev.tasks, rem || { tasks: [], del: {} }, { preferLocal, now });
  dev.tasks = merged.tasks; dev.base = merged.base; dev.tomb = merged.tomb;
  const del = Object.fromEntries(Object.entries(merged.tomb).map(([id, t]) => [id, t.at]));
  const p = packTasks(merged.tasks, now, del, now, 0);
  assert.ok(p, 'the tasks fit');
  const all = {}; for (const [k, v] of Object.entries(p.items)) all[k] = v;
  cloud.payload = all;
}

function scenario(seed, steps) {
  const r = rng(seed), pick = (a) => a[Math.floor(r() * a.length)];
  const A = device(), B = device(), cloud = { payload: null };
  const devs = [A, B]; let now = 1_800_000_000_000, nextId = 1;
  const log = [];
  for (let i = 0; i < steps; i++) {
    now += 60_000 + Math.floor(r() * 3_600_000);
    const d = pick(devs), op = r();
    if (op < 0.25 || !d.tasks.length) { const id = 't' + nextId++; d.tasks.unshift({ id, text: 'task ' + id, done: false, due: null, createdAt: now }); log.push(`${devs.indexOf(d)} add ${id}`); }
    else if (op < 0.5) { const t = pick(d.tasks); t.text = 'edit ' + i; log.push(`${devs.indexOf(d)} text ${t.id}`); }
    else if (op < 0.62) { const t = pick(d.tasks); t.due = r() < 0.5 ? null : '2026-12-' + String(1 + Math.floor(r() * 28)).padStart(2, '0'); log.push(`${devs.indexOf(d)} due ${t.id}`); }
    else if (op < 0.72) { const t = pick(d.tasks); t.done = !t.done; t.doneAt = t.done ? now : 0; log.push(`${devs.indexOf(d)} done ${t.id}`); }
    else if (op < 0.82) { const t = pick(d.tasks); d.tasks = d.tasks.filter((x) => x !== t); log.push(`${devs.indexOf(d)} delete ${t.id}`); }
    else { sync(d, cloud, now, r() < 0.8); log.push(`${devs.indexOf(d)} sync`); }
  }
  // quiet: each meets the cloud twice more
  for (let k = 0; k < 2; k++) for (const d of devs) { now += 1000; sync(d, cloud, now, true); }
  return { A, B, cloud, log };
}

test('two devices that keep meeting the cloud end up with the same tasks (500 random histories)', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const { A, B, log } = scenario(seed, 40);
    const ids = (l) => l.map((x) => x.id);
    assert.equal(new Set(ids(A.tasks)).size, A.tasks.length, `seed ${seed}: duplicates on A\n${log.join('\n')}`);
    assert.equal(new Set(ids(B.tasks)).size, B.tasks.length, `seed ${seed}: duplicates on B`);
    const open = (l) => l.filter((x) => syncable(x));
    assert.ok(sameTasks(open(A.tasks), open(B.tasks)), `seed ${seed}: the devices differ\nA ${JSON.stringify(open(A.tasks).map((x) => [x.id, x.text, x.done, x.due]))}\nB ${JSON.stringify(open(B.tasks).map((x) => [x.id, x.text, x.done, x.due]))}\n${log.join('\n')}`);
  }
});

test('a task deleted on one device, untouched on the other, is gone from both', () => {
  const A = device(), B = device(), cloud = { payload: null };
  A.tasks = [{ id: 'x', text: 'keep', done: false, due: null }, { id: 'y', text: 'drop', done: false, due: null }];
  sync(A, cloud, 1_800_000_000_000, true); sync(B, cloud, 1_800_000_060_000, false);
  assert.equal(B.tasks.length, 2);
  A.tasks = A.tasks.filter((t) => t.id !== 'y'); sync(A, cloud, 1_800_000_120_000, true);
  sync(B, cloud, 1_800_000_180_000, false);
  assert.deepEqual(B.tasks.map((t) => t.id), ['x']);
  sync(A, cloud, 1_800_000_240_000, true);
  assert.deepEqual(A.tasks.map((t) => t.id), ['x']);
});
