// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
import test from 'node:test';
import assert from 'node:assert/strict';
import { syncTasks, syncBlocks, SyncError } from '../../src/shared/sync/run.js';
import { challengeOf, googleToken, microsoftSignIn, microsoftRefresh } from '../../src/shared/sync/oauth.js';
import { google } from '../../src/shared/sync/providers/google.js';
import { microsoft } from '../../src/shared/sync/providers/microsoft.js';
import { FakeDevice } from './helpers/fake-remote.mjs';
import { mockGoogle, mockGraph } from './helpers/mock-cloud.mjs';

const TODAY = '2026-11-04';
const T = (id, o = {}) => ({ id, text: 'task ' + id, done: false, starred: false, createdAt: 1, ...o });
const NOW = Date.UTC(2026, 10, 4, 12);
const redirect = 'https://abc.chromiumapp.org/';

test('oauth: PKCE matches the RFC 7636 example, and a sign-in window that returns the wrong state is refused', async () => {
  assert.equal(await challengeOf('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  let asked;
  const env = { redirectUri: redirect, now: () => NOW, launch: async (url, interactive) => { asked = { url: new URL(url), interactive }; return redirect + '#access_token=tok&expires_in=3599&state=' + new URL(url).searchParams.get('state'); } };
  const t = await googleToken('client-1', ['s1', 's2'], { interactive: true }, env);
  assert.deepEqual([t.accessToken, t.expiresAt], ['tok', NOW + 3599_000]);
  assert.equal(asked.url.searchParams.get('response_type'), 'token'); assert.equal(asked.url.searchParams.get('redirect_uri'), redirect); assert.equal(asked.url.searchParams.get('scope'), 's1 s2'); assert.equal(asked.url.searchParams.get('client_id'), 'client-1');
  await googleToken('client-1', ['s'], { interactive: false }, env);
  assert.equal(asked.interactive, false); assert.equal(asked.url.searchParams.get('prompt'), 'none', 'renewal is silent');
  await assert.rejects(googleToken('c', ['s'], { interactive: true }, { ...env, launch: async () => redirect + '#access_token=x&state=forged' }), (e) => e.kind === 'auth');
  await assert.rejects(googleToken('c', ['s'], { interactive: false }, { ...env, launch: async () => { throw new Error('user interaction required'); } }), (e) => e instanceof SyncError && e.kind === 'auth');
  await assert.rejects(googleToken('c', ['s'], { interactive: true }, { ...env, launch: async (u) => redirect + '#error=access_denied&state=' + new URL(u).searchParams.get('state') }), (e) => e.kind === 'auth');
});

test('oauth: Microsoft code flow with PKCE, then a refresh token renews the access', async () => {
  const g = mockGraph();
  let verifierSeen = '';
  const env = { redirectUri: redirect, now: () => NOW, fetchImpl: g.fetch, launch: async (url) => { const q = new URL(url).searchParams; assert.equal(q.get('code_challenge_method'), 'S256'); verifierSeen = q.get('code_challenge'); return redirect + '?code=good-code&state=' + q.get('state'); } };
  const t = await microsoftSignIn('ms-client', ['Tasks.ReadWrite'], env);
  assert.deepEqual([t.accessToken, t.refreshToken], ['m-access', 'm-refresh']); assert.ok(verifierSeen.length > 20);
  const r = await microsoftRefresh('ms-client', 'm-refresh', ['Tasks.ReadWrite'], env);
  assert.equal(r.refreshToken, 'm-refresh2');
  await assert.rejects(microsoftRefresh('ms-client', 'revoked', ['x'], env), (e) => e.kind === 'auth');
});

test('google: tasks both ways, planned blocks as events, and a stale token is renewed without a window', async () => {
  const g = mockGoogle(), dev = new FakeDevice([T('a', { text: 'Write the report', due: '2026-12-01' }), T('b', { text: 'Only here', at: '10:00', atDay: TODAY, est: 30 })]);
  g.state.tasks.set('t0', { id: 't0', title: 'Only there', status: 'completed', due: '2026-12-05T00:00:00.000Z', updated: new Date().toISOString() });
  const conn = { options: { taskList: 'L1', calendar: 'primary' } };
  let renewed = 0, saved = null;
  const env = { fetchImpl: g.fetch, now: () => NOW, redirectUri: redirect, launch: async (u) => { renewed++; return redirect + '#access_token=g-access&expires_in=3600&state=' + new URL(u).searchParams.get('state'); }, saveToken: async (t) => { saved = t; } };
  const provider = google.build(conn, { accessToken: 'old', expiresAt: NOW - 1 }, env);
  const r = await syncTasks({ provider, deps: dev.deps });
  assert.equal(renewed, 1, 'one silent renewal for the whole run'); assert.equal(saved.accessToken, 'g-access');
  assert.equal(r.createdLocal, 1); assert.equal(r.createdRemote, 2);
  assert.equal(dev.tasks.find((x) => x.text === 'Only there').done, true); assert.equal(dev.tasks.find((x) => x.text === 'Only there').due, '2026-12-05');
  const mine = [...g.state.tasks.values()].find((t) => t.title === 'Write the report'); assert.equal(mine.due, '2026-12-01T00:00:00.000Z');
  dev.tasks = dev.tasks.map((x) => (x.text === 'Write the report' ? { ...x, done: true, doneAt: dev.t } : x));
  await syncTasks({ provider, deps: dev.deps });
  assert.equal(g.state.tasks.get(mine.id).status, 'completed');
  // blocks
  const b = await syncBlocks({ provider, deps: dev.deps, today: TODAY });
  assert.equal(b.createdRemote, 1);
  const ev = [...g.state.events.values()][0];
  assert.deepEqual([ev.summary, ev.extendedProperties.private.eyetimeBlock, ev.extendedProperties.private.eyetimeTask, ev.reminders.useDefault], ['Only here', '1', 'b', false]);
  g.state.events.set('meeting', { id: 'meeting', status: 'confirmed', summary: 'Standup', start: { dateTime: new Date(2026, 10, 4, 9, 0).toISOString() }, end: { dateTime: new Date(2026, 10, 4, 9, 30).toISOString() } });
  g.state.events.set('lunch', { id: 'lunch', status: 'confirmed', summary: 'Free', transparency: 'transparent', start: { dateTime: new Date(2026, 10, 4, 12, 0).toISOString() }, end: { dateTime: new Date(2026, 10, 4, 13, 0).toISOString() } });
  g.state.events.set('trip', { id: 'trip', status: 'confirmed', summary: 'Conference', start: { date: '2026-11-05' }, end: { date: '2026-11-06' } });
  ev.start.dateTime = new Date(2026, 10, 4, 15, 0).toISOString(); ev.end.dateTime = new Date(2026, 10, 4, 16, 0).toISOString(); ev.updated = new Date(NOW + 5000).toISOString();
  const b2 = await syncBlocks({ provider, deps: dev.deps, today: TODAY });
  assert.equal(b2.updatedLocal, 1); assert.deepEqual([dev.task('b').at, dev.task('b').est], ['15:00', 60]);
  assert.deepEqual(b2.busy.map((x) => [x.title, x.allDay ? 'all-day' : x.start]).sort(), [['Conference', 'all-day'], ['Standup', '09:00']], 'a meeting and a trip are busy; a "free" event and our own block are not');
  const bad = google.build(conn, { accessToken: 'wrong', expiresAt: NOW + 1e6 }, env);
  await assert.rejects(syncTasks({ provider: bad, deps: dev.deps }), (e) => e.kind === 'auth');
  const found = await google.discover({}, { accessToken: 'g-access' }, env);
  assert.deepEqual([found.calendars.map((c) => c.name), found.taskLists.map((c) => c.name)], [['Me', 'Work cal'], ['My Tasks']]);
});

test('microsoft: To Do both ways (importance is the star), planned blocks as events, a refresh token renews the access', async () => {
  const g = mockGraph(), dev = new FakeDevice([T('a', { text: 'Write the report', starred: true, due: '2026-12-01' }), T('b', { text: 'Only here', at: '10:00', atDay: TODAY, est: 30 })]);
  g.state.tasks.set('t0', { id: 't0', title: 'Only there', status: 'completed', importance: 'normal', dueDateTime: { dateTime: '2026-12-05T00:00:00.0000000', timeZone: 'UTC' }, lastModifiedDateTime: new Date().toISOString() });
  g.state.tasks.set('t1', { id: 't1', title: 'Weekly', status: 'notStarted', importance: 'normal', recurrence: { pattern: {} }, lastModifiedDateTime: new Date().toISOString() });
  const conn = { options: { taskList: 'list1', calendar: 'cal1' } };
  let saved = null;
  const env = { fetchImpl: g.fetch, now: () => NOW, saveToken: async (t) => { saved = t; } };
  const provider = microsoft.build(conn, { accessToken: 'old', refreshToken: 'm-refresh', expiresAt: NOW - 1 }, env);
  const r = await syncTasks({ provider, deps: dev.deps });
  assert.equal(g.state.tokenCalls, 1); assert.deepEqual([saved.accessToken, saved.refreshToken], ['m-access', 'm-refresh2']);
  assert.equal(r.createdLocal, 1); assert.equal(r.createdRemote, 2); assert.ok(!dev.tasks.some((x) => x.text === 'Weekly'), 'a recurring task is left alone');
  const mine = [...g.state.tasks.values()].find((t) => t.title === 'Write the report');
  assert.deepEqual([mine.importance, mine.dueDateTime.dateTime.slice(0, 10)], ['high', '2026-12-01']);
  assert.equal(dev.tasks.find((x) => x.text === 'Only there').done, true);
  const b = await syncBlocks({ provider, deps: dev.deps, today: TODAY });
  assert.equal(b.createdRemote, 1);
  const ev = [...g.state.events.values()][0];
  assert.equal(ev.singleValueExtendedProperties[0].value, 'b'); assert.deepEqual(ev.categories, ['EyeTime']);
  const startUtc = new Date(2026, 10, 4, 14, 0).toISOString().replace(/\.\d+Z$/, ''), endUtc = new Date(2026, 10, 4, 14, 45).toISOString().replace(/\.\d+Z$/, '');
  ev.start = { dateTime: startUtc, timeZone: 'UTC' }; ev.end = { dateTime: endUtc, timeZone: 'UTC' }; ev.lastModifiedDateTime = new Date(NOW + 5000).toISOString();
  g.state.events.set('m', { id: 'm', subject: 'Standup', isAllDay: false, showAs: 'busy', start: { dateTime: new Date(2026, 10, 4, 9, 0).toISOString().replace(/\.\d+Z$/, ''), timeZone: 'UTC' }, end: { dateTime: new Date(2026, 10, 4, 9, 30).toISOString().replace(/\.\d+Z$/, ''), timeZone: 'UTC' } });
  const b2 = await syncBlocks({ provider, deps: dev.deps, today: TODAY });
  assert.equal(b2.updatedLocal, 1); assert.deepEqual([dev.task('b').at, dev.task('b').est], ['14:00', 45]);
  assert.deepEqual(b2.busy.map((x) => x.title), ['Standup']);
  const found = await microsoft.discover({}, { accessToken: 'm-access' }, env);
  assert.deepEqual([found.calendars.map((c) => c.name), found.taskLists.map((c) => c.name)], [['Calendar'], ['Tasks']], 'a read-only calendar is not offered');
  await assert.rejects(syncTasks({ provider: microsoft.build(conn, { accessToken: 'bad', expiresAt: NOW + 1e6 }, env), deps: dev.deps }), (e) => e.kind === 'auth');
});
