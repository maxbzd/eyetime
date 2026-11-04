import test from 'node:test';
import assert from 'node:assert/strict';
import { syncTasks, syncBlocks, SyncError } from '../../src/shared/sync/run.js';
import { caldav } from '../../src/shared/sync/providers/caldav.js';
import { parseVtodo } from '../../src/shared/sync/ical.js';
import { FakeDevice } from './helpers/fake-remote.mjs';
import { mockCaldav } from './helpers/mock-caldav.mjs';

const TODAY = '2026-11-04';
const T = (id, o = {}) => ({ id, text: 'task ' + id, done: false, starred: false, createdAt: 1, ...o });
const conn = (m, extra = {}) => ({ options: { server: m.base, user: m.user, tasksUrl: m.base + '/u1/tasks/', eventsUrl: m.base + '/u1/work/', ...extra } });
const build = (m, c = conn(m), pass = m.pass) => caldav.build(c, { password: pass }, { fetchImpl: m.fetch, now: () => Date.UTC(2026, 10, 4, 12) });

test('caldav: signing in finds the calendars and the task lists, and the hosts to allow', async () => {
  const m = mockCaldav();
  const d = await caldav.discover({ options: { server: m.base, user: m.user } }, { password: m.pass }, { fetchImpl: m.fetch });
  assert.deepEqual(d.calendars.map((c) => [c.name, c.events, c.tasks]), [['Reminders', false, true], ['Work', true, false]], 'collections that are not calendars (the inbox) are left out');
  assert.equal(d.tasks[0].id, m.base + '/u1/tasks/'); assert.equal(d.events[0].id, m.base + '/u1/work/'); assert.deepEqual(d.hosts, ['https://caldav.test/*']);
  await assert.rejects(caldav.discover({ options: { server: m.base, user: m.user } }, { password: 'wrong' }, { fetchImpl: m.fetch }), (e) => e instanceof SyncError && e.kind === 'auth');
  assert.deepEqual(caldav.origins({ options: { server: 'https://caldav.icloud.com', hosts: ['https://p12-caldav.icloud.com/*'] } }).sort(), ['https://*.icloud.com/*', 'https://caldav.icloud.com/*', 'https://p12-caldav.icloud.com/*']);
});

test('caldav: tasks go both ways; an edit keeps the other app\'s alarms and properties; finishing and deleting travel', async () => {
  const m = mockCaldav(), dev = new FakeDevice([T('a', { text: 'Write the report', starred: true, due: '2026-12-01' }), T('b', { text: 'Only here' })]);
  m.addTodo('/u1/tasks/x.ics', m.todo('x', 'Only there', ['DUE;VALUE=DATE:20261205', 'PRIORITY:1', 'X-APPLE-SORT-ORDER:77', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT15M', 'END:VALARM']));
  m.addTodo('/u1/tasks/rec.ics', m.todo('rec', 'Every day', ['RRULE:FREQ=DAILY']));
  const run = () => syncTasks({ provider: build(m), deps: dev.deps });
  const r = await run();
  assert.equal(r.createdLocal, 1); assert.equal(r.createdRemote, 2);
  assert.deepEqual(dev.tasks.map((x) => x.text).sort(), ['Only here', 'Only there', 'Write the report'], 'the recurring one is left alone');
  const there = dev.tasks.find((x) => x.text === 'Only there'); assert.deepEqual([there.due, there.starred], ['2026-12-05', true]);
  const made = [...m.state.res].find(([, v]) => /Write the report/.test(v.ics))[1];
  assert.deepEqual([parseVtodo(made.ics).due, parseVtodo(made.ics).starred], ['2026-12-01', true]);
  assert.equal((await run()).createdRemote + (await run()).updatedRemote + (await run()).createdLocal, 0, 'agreed');
  // renamed and finished here: the other app's properties survive
  dev.tasks = dev.tasks.map((x) => (x.text === 'Only there' ? { ...x, text: 'Only there, renamed', done: true, doneAt: dev.t } : x));
  await run();
  const x = m.state.res.get('/u1/tasks/x.ics').ics;
  assert.match(x, /SUMMARY:Only there\\, renamed/); assert.match(x, /X-APPLE-SORT-ORDER:77/); assert.match(x, /TRIGGER:-PT15M/); assert.match(x, /STATUS:COMPLETED/);
  // finished and renamed in the other app
  m.state.res.set('/u1/tasks/x.ics', { ics: x.replace('STATUS:COMPLETED', 'STATUS:NEEDS-ACTION').replace(/COMPLETED:[^\r]*\r\n/, '').replace('renamed', 'twice'), etag: '"new"' });
  await run();
  assert.deepEqual([dev.tasks.find((t) => /Only there/.test(t.text)).text, dev.tasks.find((t) => /Only there/.test(t.text)).done], ['Only there, twice', false]);
  // deleted here
  dev.tasks = dev.tasks.filter((t) => t.text !== 'Only here');
  const r2 = await syncTasks({ provider: build(m), deps: dev.deps, options: { allowMassDelete: true } });
  assert.equal(r2.deletedRemote, 1); assert.ok(![...m.state.res.keys()].some((p) => /Only here/.test(m.state.res.get(p).ics)));
});

test('caldav: an edit made in the other app while we were working is not overwritten (412), and is picked up next time', async () => {
  const m = mockCaldav(), dev = new FakeDevice([T('a', { text: 'one' })]);
  await syncTasks({ provider: build(m), deps: dev.deps });
  const [path, res] = [...m.state.res][0];
  dev.tasks = dev.tasks.map((x) => ({ ...x, text: 'mine' }));
  const provider = build(m);
  const real = provider.tasks.list; provider.tasks.list = async () => { const l = await real(); m.state.res.set(path, { ics: res.ics.replace('SUMMARY:one', 'SUMMARY:theirs'), etag: '"other"' }); return l; };
  const r = await syncTasks({ provider, deps: dev.deps });
  assert.equal(r.errors.length, 1); assert.match(r.errors[0], /412/);
  assert.match(m.state.res.get(path).ics, /SUMMARY:theirs/, 'their change is intact');
  await syncTasks({ provider: build(m), deps: dev.deps });
  assert.equal(dev.tasks[0].text, m.state.res.get(path).ics.match(/SUMMARY:(.*)\r/)[1], 'and then both agree');
});

test('caldav: busy times come in, focus blocks go out as events, and a block moved in the calendar moves the task', async () => {
  const m = mockCaldav();
  m.put('/u1/work/standup.ics', m.meeting('standup', 'Standup', '20261104T090000Z', '20261104T093000Z'));
  const tasks = [T('a', { text: 'Write the report', at: '10:00', atDay: TODAY, est: 45 })];
  const dev = new FakeDevice(tasks);
  const run = () => syncBlocks({ provider: build(m), deps: dev.deps, today: TODAY });
  const r = await run();
  assert.equal(r.createdRemote, 1);
  assert.ok(r.busy.some((b) => b.title === 'Standup'), 'the meeting is a busy time'); assert.ok(!r.busy.some((b) => /Write the report/.test(b.title)), 'and our own block is not');
  const [path, ev] = [...m.state.res].find(([p]) => /eyetime-a-/.test(p));
  assert.match(ev.ics, /SUMMARY:Write the report/); assert.match(ev.ics, /X-EYETIME-TASK:a/); assert.match(ev.ics, /^BEGIN:VCALENDAR/);
  assert.equal((await run()).createdRemote, 0);
  // moved by an hour in the calendar app (it rewrites the event, keeping our property)
  const moved = ev.ics.replace(/DTSTART:\S+/, 'DTSTART:20261104T130000Z').replace(/DTEND:\S+/, 'DTEND:20261104T140000Z');
  m.state.res.set(path, { ics: moved, etag: '"moved"' });
  const r2 = await run();
  assert.equal(r2.updatedLocal, 1);
  const wantStart = new Date(Date.UTC(2026, 10, 4, 13)), hh = String(wantStart.getHours()).padStart(2, '0') + ':' + String(wantStart.getMinutes()).padStart(2, '0');
  assert.deepEqual([dev.tasks[0].at, dev.tasks[0].est], [hh, 60], 'the task is where the event is now');
  // finished here: the event goes
  dev.tasks = dev.tasks.map((x) => ({ ...x, done: true, doneAt: dev.t }));
  const r3 = await run();
  assert.equal(r3.deletedRemote, 1); assert.ok(!m.state.res.has(path)); assert.ok(m.state.res.has('/u1/work/standup.ics'), 'the meeting is untouched');
});
