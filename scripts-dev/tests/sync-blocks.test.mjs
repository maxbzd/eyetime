import test from 'node:test';
import assert from 'node:assert/strict';
import { syncBlocks } from '../../src/shared/sync/run.js';
import { blockItem, applyBlockToTask } from '../../src/shared/sync/blocks.js';
import { FakeService, FakeDevice } from './helpers/fake-remote.mjs';

const TODAY = '2026-11-04';
const T = (id, o = {}) => ({ id, text: 'task ' + id, done: false, starred: false, createdAt: 1, ...o });
const run = (svc, dev) => syncBlocks({ provider: svc.provider, deps: dev.deps, today: TODAY });
const events = (svc) => [...svc.events.values()];
const tasks = () => [
  T('a', { at: '10:00', atDay: TODAY, est: 30 }), T('b', { at: '14:00', atDay: '2026-11-05' }), T('c'), T('d', { at: '09:00', atDay: TODAY, done: true }),
  T('e', { at: '09:00', atDay: '2026-12-31' }), T('f', { at: '09:00', atDay: '2026-11-01' }), T('g', { at: '23:50', atDay: TODAY, est: 45 }),
];

test('blocks: which tasks are blocks, and how a moved event writes back', () => {
  assert.deepEqual(blockItem(T('a', { at: '10:00', atDay: TODAY, est: 30 }), TODAY), { taskId: 'a', title: 'task a', day: TODAY, start: 600, end: 630, ok: true });
  assert.equal(blockItem(T('b', { at: '14:00', atDay: TODAY }), TODAY).end, 14 * 60 + 25, 'no estimate: the usual length');
  for (const x of [T('c'), T('d', { at: '09:00', atDay: TODAY, done: true }), T('e', { at: '09:00', atDay: '2026-12-31' }), T('f', { at: '09:00', atDay: '2026-11-01' }), T('g', { at: '23:50', atDay: TODAY, est: 45 }), T('h', { at: '10:00', atDay: TODAY, repeat: 'daily' })]) assert.equal(blockItem(x, TODAY).ok, false, x.id);
  const moved = applyBlockToTask(T('a', { at: '10:00', atDay: TODAY, est: 30 }), { day: '2026-11-06', start: 15 * 60, end: 15 * 60 + 50 });
  assert.deepEqual([moved.atDay, moved.at, moved.est], ['2026-11-06', '15:00', 50]);
  assert.equal(applyBlockToTask(T('a', { at: '10:00', atDay: TODAY, est: 30 }), { start: 11 * 60 }).est, 30, 'moved without a new end: the length stays');
  assert.equal(applyBlockToTask(T('a', { at: '10:00', atDay: TODAY, est: 30 }), { title: '  renamed ' }).text, 'renamed');
});

test('blocks: planned tasks become events, once; a second run does nothing', async () => {
  const svc = new FakeService(), dev = new FakeDevice(tasks());
  const r = await run(svc, dev);
  assert.equal(r.createdRemote, 2);
  assert.deepEqual(events(svc).map((e) => [e.taskId, e.title, e.day, e.start, e.end]).sort(), [['a', 'task a', TODAY, 600, 630], ['b', 'task b', '2026-11-05', 840, 865]]);
  const again = await run(svc, dev);
  assert.equal(again.createdRemote + again.updatedRemote + again.updatedLocal + again.deletedRemote + again.deletedLocal, 0);
  assert.equal(events(svc).length, 2);
});

test('blocks: a moved event moves the task; a rescheduled task moves the event', async () => {
  const svc = new FakeService(), dev = new FakeDevice(tasks());
  await run(svc, dev);
  const ea = events(svc).find((e) => e.taskId === 'a');
  svc.editEvent(ea.id, { start: 16 * 60, end: 17 * 60 });
  dev.tasks = dev.tasks.map((x) => (x.id === 'b' ? { ...x, at: '08:30', est: 60 } : x));
  dev.advance(60_000);
  const r = await run(svc, dev);
  assert.equal(r.updatedLocal, 1); assert.equal(r.updatedRemote, 1);
  assert.deepEqual([dev.task('a').at, dev.task('a').est, dev.task('a').atDay], ['16:00', 60, TODAY]);
  const eb = events(svc).find((e) => e.taskId === 'b');
  assert.deepEqual([eb.start, eb.end], [8 * 60 + 30, 9 * 60 + 30]);
  assert.equal((await run(svc, dev)).updatedLocal, 0);
});

test('blocks: finishing, unscheduling or deleting a task removes its event; removing the event unbooks the task', async () => {
  const svc = new FakeService(), dev = new FakeDevice(tasks());
  await run(svc, dev);
  dev.tasks = dev.tasks.map((x) => (x.id === 'a' ? { ...x, done: true, doneAt: dev.t } : x));
  let r = await run(svc, dev);
  assert.equal(r.deletedRemote, 1); assert.deepEqual(events(svc).map((e) => e.taskId), ['b']);
  const eb = events(svc)[0]; svc.events.delete(eb.id);
  r = await run(svc, dev);
  assert.equal(r.deletedLocal, 1); assert.equal(dev.task('b').at, undefined); assert.equal(dev.task('b').atDay, undefined, 'the event is gone from the calendar: the task is no longer booked');
  assert.ok(dev.task('b'), 'but the task is kept');
  assert.equal(events(svc).length, 0);
});

test('blocks: an event of ours without a task is removed, never turned into a task; events without our mark are never touched', async () => {
  const svc = new FakeService(), dev = new FakeDevice(tasks());
  const orphan = svc.addEvent({ taskId: 'gone', title: 'old plan', day: TODAY, start: 700, end: 730 });
  const theirs = svc.addEvent({ taskId: null, title: 'Dentist', day: TODAY, start: 800, end: 860 });
  await run(svc, dev);
  assert.ok(!svc.events.has(orphan)); assert.ok(svc.events.has(theirs), 'a meeting that is not ours stays as it is');
  assert.equal(dev.tasks.length, tasks().length, 'no task was made from an event');
});

test('blocks: links that were lost are found again by the task id, without doubling the events', async () => {
  const svc = new FakeService(), dev = new FakeDevice(tasks());
  await run(svc, dev);
  const ids = events(svc).map((e) => e.id).sort();
  dev.links.blocks = {};
  const r = await run(svc, dev);
  assert.equal(r.createdRemote, 0); assert.equal(r.adopted, 2);
  assert.deepEqual(events(svc).map((e) => e.id).sort(), ids);
});
