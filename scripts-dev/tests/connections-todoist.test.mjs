// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
import test from 'node:test';
import assert from 'node:assert/strict';
import { syncTasks, SyncError } from '../../src/shared/sync/run.js';
import { todoist } from '../../src/shared/sync/providers/todoist.js';
import { FakeDevice } from './helpers/fake-remote.mjs';
import { mockTodoist } from './helpers/mock-todoist.mjs';

const T = (id, o = {}) => ({ id, text: 'task ' + id, done: false, starred: false, createdAt: 1, ...o });
const make = (mock, conn = { options: {} }, token = 'secret-token') => todoist.build(conn, { token }, { fetchImpl: mock.fetch, now: () => 1_700_000_000_000 + 10_000 });
const run = (mock, dev, conn) => syncTasks({ provider: make(mock, conn), deps: dev.deps });

test('todoist: a first run creates in both directions and then agrees; the token goes in every request and nothing else leaves', async () => {
  const mock = mockTodoist(), dev = new FakeDevice([T('a', { text: 'Write the report', due: '2026-12-01', starred: true, est: 45 }), T('b', { text: 'Only here' })]);
  mock.add({ content: 'Only there', priority: 4, due: { date: '2026-12-05', is_recurring: false } }); mock.add({ content: 'write the report' });
  const r = await run(mock, dev);
  assert.equal(r.adopted, 1); assert.equal(r.createdRemote, 1); assert.equal(r.createdLocal, 1);
  const remote = [...mock.state.tasks.values()];
  assert.equal(remote.length, 3);
  const rep = remote.find((t) => /report/i.test(t.content));
  assert.deepEqual([rep.priority, rep.due.date, rep.duration], [4, '2026-12-01', { amount: 45, unit: 'minute' }], 'what is written here reaches Todoist as priority, date and duration');
  const there = dev.tasks.find((x) => x.text === 'Only there');
  assert.deepEqual([there.due, there.starred], ['2026-12-05', true]);
  assert.ok(mock.state.calls.every((c) => /^(GET|POST|DELETE) \//.test(c)));
  assert.equal((await run(mock, dev)).createdRemote + (await run(mock, dev)).updatedRemote, 0, 'and it stays agreed');
});

test('todoist: finishing travels both ways (a closed task leaves the active list, and still counts as finished)', async () => {
  const mock = mockTodoist(), dev = new FakeDevice([T('a', { text: 'one' }), T('b', { text: 'two' })]);
  await run(mock, dev);
  const ids = [...mock.state.tasks.keys()];
  dev.tasks = dev.tasks.map((x) => (x.id === 'a' ? { ...x, done: true, doneAt: dev.t } : x));
  await run(mock, dev);
  assert.ok(mock.state.done.has(ids[0]) && !mock.state.tasks.has(ids[0]), 'finished here: closed there');
  // finished over there
  mock.state.tasks.get(ids[1]) && (() => { const t = mock.state.tasks.get(ids[1]); mock.state.tasks.delete(ids[1]); mock.state.done.set(ids[1], { ...t, completed_at: new Date(dev.t).toISOString() }); })();
  const r = await run(mock, dev);
  assert.equal(dev.task('b').done, true); assert.equal(r.deletedLocal, 0, 'a finished task is not mistaken for a deleted one');
  // reopened here
  dev.tasks = dev.tasks.map((x) => (x.id === 'b' ? { ...x, done: false } : x)); delete dev.tasks.find((x) => x.id === 'b').doneAt;
  await run(mock, dev);
  assert.ok(mock.state.tasks.has(ids[1]), 'reopened here: open there');
});

test('todoist: recurring tasks are left alone; a project can be chosen', async () => {
  const mock = mockTodoist(), dev = new FakeDevice([T('a', { text: 'mine' })]);
  mock.add({ content: 'every day', due: { date: '2026-11-05', is_recurring: true } }); mock.add({ content: 'in work', project_id: 'p2' }); mock.add({ content: 'in inbox', project_id: 'p1' });
  await run(mock, dev, { options: { projectId: 'p2' } });
  assert.deepEqual(dev.tasks.map((x) => x.text).sort(), ['in work', 'mine'], 'only the chosen project, no recurring task');
  const made = [...mock.state.tasks.values()].find((t) => t.content === 'mine');
  assert.equal(made.project_id, 'p2', 'new tasks go to that project');
  const found = await todoist.discover({}, { token: 'secret-token' }, { fetchImpl: mock.fetch });
  assert.deepEqual(found.projects.map((p) => p.name), ['Inbox', 'Work']);
});

test('todoist: a wrong token, a busy service and an unreachable one are told apart', async () => {
  const mock = mockTodoist(), dev = new FakeDevice([T('a')]);
  await assert.rejects(syncTasks({ provider: make(mock, { options: {} }, 'wrong'), deps: dev.deps }), (e) => e instanceof SyncError && e.kind === 'auth');
  mock.state.failNext = 429;
  await assert.rejects(run(mock, dev), (e) => e.kind === 'rate' && e.retryAfter > 0);
  mock.state.failNext = 500;
  await assert.rejects(run(mock, dev), (e) => e.kind === 'other' && e.status === 500);
  const down = todoist.build({ options: {} }, { token: 'x' }, { fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(syncTasks({ provider: down, deps: dev.deps }), (e) => e.kind === 'network');
});
