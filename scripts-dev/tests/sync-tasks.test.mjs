import test from 'node:test';
import assert from 'node:assert/strict';
import { syncTasks, SyncError } from '../../src/shared/sync/run.js';
import { mergeFields, planPairs } from '../../src/shared/sync/pairs.js';
import { FakeService, FakeDevice } from './helpers/fake-remote.mjs';

const T = (id, o = {}) => ({ id, text: 'task ' + id, done: false, starred: false, createdAt: 1, ...o });
const run = (svc, dev, options) => syncTasks({ provider: svc.provider, deps: dev.deps, options });
const total = (r) => r.createdLocal + r.createdRemote + r.updatedLocal + r.updatedRemote + r.deletedLocal + r.deletedRemote;

test('merge: a field changed on one side travels, on both is a conflict, and a finished task stays finished', () => {
  const base = { text: 'a', done: false, due: null };
  const m = mergeFields({ base, local: { text: 'a', done: true, due: null }, remote: { text: 'b', done: false, due: '2026-12-01' }, fields: ['text', 'done', 'due'] });
  assert.deepEqual(m.toRemote, { done: true }); assert.deepEqual(m.toLocal, { text: 'b', due: '2026-12-01' }); assert.deepEqual(m.conflicts, []);
  const c = mergeFields({ base, local: { text: 'x', done: false, due: null }, remote: { text: 'y', done: false, due: null }, fields: ['text', 'done'], localAt: 50, remoteAt: 10 });
  assert.deepEqual(c.conflicts, ['text']); assert.equal(c.merged.text, 'x', 'the later change wins');
  const first = mergeFields({ base: null, local: { text: 'a', done: true, due: '2026-12-01', est: null }, remote: { text: 'a', done: false, due: null, est: 30 }, fields: ['text', 'done', 'due', 'est'] });
  assert.deepEqual(first.merged, { text: 'a', done: true, due: '2026-12-01', est: 30 }, 'paired for the first time: finished wins, and what is written beats what is empty');
  const d = mergeFields({ base, local: { text: 'x', done: false, due: null }, remote: { text: 'y', done: false, due: null }, fields: ['text'], localAt: 10, remoteAt: 50 });
  assert.equal(d.merged.text, 'y');
  const same = mergeFields({ base, local: { text: 'z', done: false }, remote: { text: 'z', done: false }, fields: ['text', 'done'] });
  assert.deepEqual([same.toLocal, same.toRemote, same.conflicts], [{}, {}, []], 'the same change on both sides is no conflict');
});

test('first connection: equal tasks are paired, nothing is doubled, and a second run does nothing', async () => {
  const svc = new FakeService(), dev = new FakeDevice([T('a', { text: 'Write the report' }), T('b', { text: 'Only here' }), T('c', { text: 'call mum', due: '2026-12-01' })]);
  svc.add({ text: 'write  the REPORT' }); svc.add({ text: 'Only there', due: '2026-12-02' }); svc.add({ text: 'Call Mum' });
  const r = await run(svc, dev);
  assert.equal(r.adopted, 2); assert.equal(r.createdRemote, 1); assert.equal(r.createdLocal, 1);
  assert.equal(svc.items.size, 4); assert.equal(dev.tasks.length, 4, 'four in all, none doubled');
  assert.equal(dev.task('c').due, '2026-12-01', 'the date that is written is kept'); assert.ok([...svc.items.values()].some((x) => x.due === '2026-12-01' && /call mum/i.test(x.text)), 'and reaches the other side');
  const again = await run(svc, dev);
  assert.equal(total(again), 0, 'agreed is agreed: ' + JSON.stringify(again));
  assert.equal(Object.keys(dev.links.tasks).length, 4);
});

test('changes travel both ways, and finishing a task here finishes it there', async () => {
  const svc = new FakeService(), dev = new FakeDevice([T('a', { text: 'one' }), T('b', { text: 'two' })]);
  await run(svc, dev);
  const [ra, rb] = [...svc.items.keys()];
  dev.tasks = dev.tasks.map((x) => (x.id === 'a' ? { ...x, text: 'one!', due: '2026-12-24', starred: true } : x));
  svc.edit(rb, { done: true });
  dev.advance(60_000);
  const r = await run(svc, dev);
  assert.equal(r.updatedRemote, 1); assert.equal(r.updatedLocal, 1);
  assert.deepEqual([svc.items.get(ra).text, svc.items.get(ra).due, svc.items.get(ra).starred], ['one!', '2026-12-24', true]);
  assert.equal(dev.task('b').done, true); assert.equal(dev.task('b').doneAt, dev.t, 'finished over there: finished here, stamped now');
  assert.equal(total(await run(svc, dev)), 0);
});

test('a conflict goes to whoever changed last; both end up the same', async () => {
  const svc = new FakeService(), dev = new FakeDevice([T('a', { text: 'one' })]);
  await run(svc, dev); const [ra] = [...svc.items.keys()];
  dev.tasks = dev.tasks.map((x) => ({ ...x, text: 'mine' })); svc.edit(ra, { text: 'theirs' });
  await run(svc, dev);
  assert.equal(dev.task('a').text, svc.items.get(ra).text);
  assert.equal(svc.items.get(ra).text, 'mine', 'the change seen here last (now) is the later one');
  // and the other way: the service's change is later than the moment this side's was first seen
  const svc2 = new FakeService(), dev2 = new FakeDevice([T('a', { text: 'one' })]);
  await run(svc2, dev2); const [r2] = [...svc2.items.keys()];
  dev2.tasks = dev2.tasks.map((x) => ({ ...x, text: 'mine' }));
  const failing = new FakeService(); failing.items = svc2.items; failing.clock = svc2.clock; failing.boom('network', 'update'); // this side's change is noticed, but cannot be sent
  await run(failing, dev2).catch((e) => assert.ok(e instanceof SyncError));
  assert.ok(dev2.links.tasks.a.lc > 0, 'the moment the change was first seen is remembered');
  dev2.advance(3_600_000); svc2.edit(r2, { text: 'theirs, later' }); svc2.items.get(r2).updatedAt = dev2.t + 10_000;
  await run(svc2, dev2);
  assert.equal(dev2.task('a').text, 'theirs, later');
});

test('deletions travel, unless the other side changed the item (an edit is never lost to a deletion)', async () => {
  const svc = new FakeService(), dev = new FakeDevice([T('a'), T('b'), T('c'), T('d'), T('e'), T('f'), T('g'), T('h')]);
  await run(svc, dev);
  const ids = [...svc.items.keys()];
  dev.tasks = dev.tasks.filter((x) => x.id !== 'a');                 // deleted here
  svc.items.delete(ids[1]);                                          // deleted there
  svc.edit(ids[2], { text: 'edited there' }); dev.tasks = dev.tasks.filter((x) => x.id !== 'c'); // deleted here, edited there: it comes back
  dev.tasks = dev.tasks.map((x) => (x.id === 'd' ? { ...x, text: 'edited here' } : x)); svc.items.delete(ids[3]); // deleted there, edited here: it comes back
  const r = await run(svc, dev, { allowMassDelete: true });
  assert.equal(r.deletedRemote, 1); assert.equal(r.deletedLocal, 1);
  assert.ok(!svc.items.has(ids[0])); assert.ok(!dev.task('b'));
  assert.ok(dev.tasks.some((x) => x.text === 'edited there'), 'the edit over there brought the task back here');
  assert.ok([...svc.items.values()].some((x) => x.text === 'edited here'), 'the edit here brought the task back there');
  assert.equal(total(await run(svc, dev, { allowMassDelete: true })), 0);
});

test('a broken answer cannot wipe a list: an empty or incomplete listing deletes nothing', async () => {
  const svc = new FakeService(), dev = new FakeDevice(Array.from({ length: 10 }, (_, i) => T('t' + i)));
  await run(svc, dev);
  svc.items.clear();
  const r = await run(svc, dev);
  assert.equal(r.unsafe, true); assert.equal(r.held, 10); assert.equal(dev.tasks.length, 10, 'nothing deleted here');
  assert.equal(Object.keys(dev.links.tasks).length, 10, 'and the pairs are remembered');
  svc.complete = false; // a listing that says it is partial
  const r2 = await run(svc, dev);
  assert.equal(r2.deletedLocal, 0); assert.equal(dev.tasks.length, 10);
  svc.complete = true;
  const r3 = await run(svc, dev, { allowMassDelete: true }); // when the person confirms
  assert.equal(r3.deletedLocal, 10);
});

test('tasks that are not sent: repeating ones, and ones finished long ago', async () => {
  const svc = new FakeService(), dev = new FakeDevice([T('a', { repeat: 'daily' }), T('b', { done: true, doneAt: 1_700_000_000_000 - 10 * 86_400_000 }), T('c', { done: true, doneAt: 1_700_000_000_000 - 3_600_000 }), T('d', { text: '  ' }), T('e')]);
  await run(svc, dev);
  assert.deepEqual([...svc.items.values()].map((x) => x.text).sort(), ['task c', 'task e']);
});

test('a failure of one item does not stop the others; a failure of the conversation stops, and the next run finishes without doubling', async () => {
  const svc = new FakeService(), dev = new FakeDevice([T('a', { text: 'bad one' }), T('b'), T('c'), T('d')]);
  svc.failCreate.add('bad one');
  const r = await run(svc, dev);
  assert.equal(r.createdRemote, 3); assert.equal(r.errors.length, 1); assert.match(r.errors[0], /refused/);
  svc.failCreate.clear();
  const r2 = await run(svc, dev);
  assert.equal(r2.createdRemote, 1, 'the one that failed is tried again'); assert.equal(svc.items.size, 4);

  const svc2 = new FakeService(), dev2 = new FakeDevice([T('a'), T('b'), T('c')]);
  svc2.boom('rate', 'create');
  await assert.rejects(run(svc2, dev2), (e) => e instanceof SyncError && e.kind === 'rate');
  assert.equal(svc2.items.size, 0);
  await run(svc2, dev2);
  assert.equal(svc2.items.size, 3, 'the next run does the rest');
  // the service accepted a task but the answer was lost: the next run pairs it by its text instead of creating it twice
  const svc3 = new FakeService(), dev3 = new FakeDevice([T('a', { text: 'lost answer' })]);
  const real = svc3.provider.tasks.create; let lost = true;
  const flaky = { ...svc3.provider, tasks: { ...svc3.provider.tasks, async create(i) { const r = await real(i); if (lost) { lost = false; throw new SyncError('timeout', 'network'); } return r; } } };
  await assert.rejects(syncTasks({ provider: flaky, deps: dev3.deps }), (e) => e.kind === 'network');
  await syncTasks({ provider: flaky, deps: dev3.deps });
  assert.equal(svc3.items.size, 1, 'one task, not two');
});

test('a task changed on this side while the run was going is left for the next run', async () => {
  const svc = new FakeService(), dev = new FakeDevice([T('a', { text: 'one' })]);
  await run(svc, dev); const [ra] = [...svc.items.keys()];
  svc.edit(ra, { text: 'from the service' });
  dev.beforeWrite = (d) => { d.tasks = d.tasks.map((x) => ({ ...x, text: 'typed meanwhile' })); };
  await run(svc, dev);
  assert.equal(dev.task('a').text, 'typed meanwhile', 'what was typed is not overwritten');
  await run(svc, dev);
  assert.equal(dev.task('a').text, svc.items.get(ra).text, 'and then the two agree');
});

test('the plan alone: a link whose item is gone on both sides is dropped; unlinked remote items without a key are created', () => {
  const p = planPairs({ local: new Map(), remote: new Map([['r1', { text: 'x' }]]), links: { gone: { remoteId: 'zz', base: { text: 'y' }, lc: 0 } }, fields: ['text'] });
  assert.deepEqual(Object.keys(p.links), []); assert.equal(p.createLocal.length, 1);
});
