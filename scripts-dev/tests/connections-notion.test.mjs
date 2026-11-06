// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
import test from 'node:test';
import assert from 'node:assert/strict';
import { syncTasks, SyncError } from '../../src/shared/sync/run.js';
import { notion, databaseId } from '../../src/shared/sync/providers/notion.js';
import { FakeDevice } from './helpers/fake-remote.mjs';
import { mockNotion } from './helpers/mock-notion.mjs';

const T = (id, o = {}) => ({ id, text: 'task ' + id, done: false, starred: false, createdAt: 1, ...o });
const env = (mock) => ({ fetchImpl: mock.fetch, sleep: async () => {}, noThrottle: true });
const conn = (mock, extra = {}) => ({ options: { databaseId: mock.dbId, titleProp: 'Name', doneProp: 'Done', dueProp: 'Due', ...extra } });
const run = (mock, dev, c = conn(mock)) => syncTasks({ provider: notion.build(c, { token: 'ntn_secret' }, env(mock)), deps: dev.deps });

test('notion: the database is found in a link, and its properties are offered', async () => {
  const id = 'a'.repeat(32);
  assert.equal(databaseId(`https://www.notion.so/My-Tasks-${id}?v=0123456789abcdef0123456789abcdef`), id);
  assert.equal(databaseId(`https://www.notion.so/workspace/${id}?v=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`), id);
  assert.equal(databaseId('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), id);
  assert.equal(databaseId('nothing here'), '');
  const mock = mockNotion();
  const d = await notion.discover({ options: { database: `https://notion.so/x-${id}` } }, { token: 'ntn_secret' }, env(mock));
  assert.equal(d.title, 'Name'); assert.deepEqual(d.done.map((x) => x.id), ['Done']); assert.deepEqual(d.date.map((x) => x.id), ['Due']);
  await assert.rejects(notion.discover({ options: { database: 'zzz' } }, { token: 'x' }, env(mock)), (e) => e instanceof SyncError);
});

test('notion: tasks go both ways, finishing and the date included; deleting archives', async () => {
  const mock = mockNotion(), dev = new FakeDevice([T('a', { text: 'Write the report', due: '2026-12-01' }), T('b', { text: 'Only here' })]);
  mock.add('Only there', false, '2026-12-05'); mock.add('write the report', true);
  const r = await run(mock, dev);
  assert.equal(r.adopted, 1); assert.equal(r.createdRemote, 1); assert.equal(r.createdLocal, 1);
  assert.equal(dev.task('a').done, true, 'finished in Notion: finished here');
  assert.equal(dev.tasks.find((x) => x.text === 'Only there').due, '2026-12-05');
  const here = [...mock.state.pages.values()].find((p) => p.properties.Name.title[0].plain_text === 'Only here');
  assert.ok(here, 'created in Notion'); assert.equal(here.properties.Done.checkbox, false);
  dev.tasks = dev.tasks.filter((x) => x.text !== 'Only here'); // deleted here
  const r2 = await run(mock, dev, conn(mock));
  assert.equal(r2.deletedRemote, 1); assert.equal(here.archived, true, 'Notion\'s own trash, not a purge');
  assert.equal((await run(mock, dev)).createdRemote + (await run(mock, dev)).createdLocal, 0);
});

test('notion: a status property works as "done", and a long database says when the listing is partial', async () => {
  const mock = mockNotion({ status: true }), dev = new FakeDevice([T('a', { text: 'one' })]);
  const c = conn(mock, { doneType: 'status' });
  await run(mock, dev, c);
  const pg = [...mock.state.pages.values()][0];
  assert.equal(pg.properties.Done.status.name, 'Not started');
  dev.tasks = dev.tasks.map((x) => ({ ...x, done: true, doneAt: dev.t }));
  await run(mock, dev, c);
  assert.equal(pg.properties.Done.status.name, 'Complete', 'finished here: the "complete" option of the status');
  mock.state.pageSize = 2; for (let i = 0; i < 4; i++) mock.add('more ' + i);
  const tasks = notion.build(c, { token: 'ntn_secret' }, env(mock)).tasks;
  const l = await tasks.list();
  assert.equal(l.items.length, 5); assert.equal(l.complete, true, 'every page was read');
});

test('notion: a wrong token, an unshared database, and a busy service', async () => {
  const mock = mockNotion(), dev = new FakeDevice([T('a')]);
  await assert.rejects(syncTasks({ provider: notion.build(conn(mock), { token: 'wrong' }, env(mock)), deps: dev.deps }), (e) => e.kind === 'auth');
  mock.state.failNext = 429;
  await assert.rejects(run(mock, dev), (e) => e.kind === 'rate');
});
