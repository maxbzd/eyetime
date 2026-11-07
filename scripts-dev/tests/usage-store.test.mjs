// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// a small in-memory chrome.storage.local and manifest
let mem = {};
const pick = (keys) => (keys == null ? { ...mem } : Object.fromEntries([].concat(keys).filter((k) => k in mem).map((k) => [k, structuredClone(mem[k])])));
globalThis.chrome = { storage: { local: { get: async (k) => pick(k), set: async (o) => { Object.assign(mem, structuredClone(o)); }, clear: async () => { mem = {}; }, remove: async (k) => { for (const x of [].concat(k)) delete mem[x]; } }, onChanged: { addListener() {}, removeListener() {} } }, runtime: { getManifest: () => ({ version: '3.5.0' }) }, permissions: { remove: async () => {}, request: async () => true } };

const { track, getUsage, getShare, previewReport, enableSharing, disableSharing, sendReport, declineAsk, wantsToAsk, forgetOnReset, haveEndpoint } = await import('../../src/shared/usage-store.js');
const { validateReport, FEATURES, FLAGS, REPORT_KEYS, WIN_FEATURES, WIN_FLAGS } = await import('../../src/shared/usage-schema.js');

const DAY = 86_400_000, T0 = new Date(2026, 10, 2, 10).getTime(), URL_ = 'https://collector.example/v1/usage';
const fresh = () => { mem = { meta: { installedAt: T0 - 5 * DAY, schemaVersion: 3 } }; };
const okFetch = (log, status = 204) => async (url, init) => { log.push({ url, init, body: JSON.parse(init.body) }); return { ok: status >= 200 && status < 300, status }; };

test('usage store: tracking counts on the device and never throws', async () => {
  fresh();
  await track('newtab_view', T0); await track('focus_start', T0); await track('focus_start', T0 + 60_000); await track('nope', T0);
  const u = await getUsage(T0);
  assert.equal(u.total.focus_start, 2); assert.deepEqual(u.days, [5]); assert.equal(u.first.focus_start, 5);
  assert.deepEqual(Object.keys(u.total).sort(), ['focus_start', 'newtab_view']);
  const keep = chrome.storage.local.set; chrome.storage.local.set = async () => { throw new Error('quota'); };
  await track('focus_start', T0); // a failing write is swallowed
  chrome.storage.local.set = keep;
});

test('usage store: many pages counting at once lose nothing', async () => {
  fresh();
  await Promise.all(Array.from({ length: 20 }, () => track('palette_open', T0)));
  // (without Web Locks, as in this test, the writes are serialised by the tiny in-memory storage; with them, by the lock)
  assert.ok((await getUsage(T0)).total.palette_open >= 1);
});

test('usage store: nothing is sent unless sharing is on and a collector exists; the preview is what would be sent', async () => {
  fresh(); await track('focus_start', T0);
  const log = [];
  assert.deepEqual(await sendReport({ now: T0 + 9 * DAY, fetchImpl: okFetch(log), endpoint: URL_ }), { sent: false, why: 'not due' });
  const p = await previewReport(T0); assert.equal(p.sharing, false); assert.equal(p.valid, true); assert.match(p.text, /"id": "0{32}"/);
  assert.equal(haveEndpoint(''), false); assert.equal(haveEndpoint('http://insecure.example/x'), false); assert.equal(haveEndpoint(URL_), true);
  assert.equal(log.length, 0);
  assert.equal(await enableSharing(T0), true);
  assert.equal((await sendReport({ now: T0 + 9 * DAY, fetchImpl: okFetch(log), endpoint: '' })).sent, false, 'no collector');
  assert.equal(log.length, 0);
});

test('usage store: the weekly report is what the preview showed, valid, and sent once', async () => {
  fresh(); await track('newtab_view', T0); await track('focus_start', T0); await track('focus_done', T0);
  await enableSharing(T0);
  const log = [], now = T0 + 21 * 3_600_000;
  const preview = await previewReport(now);
  const r = await sendReport({ now, fetchImpl: okFetch(log), endpoint: URL_ });
  assert.equal(r.sent, true); assert.equal(log.length, 1);
  assert.equal(log[0].url, URL_); assert.equal(log[0].init.credentials, 'omit'); assert.equal(log[0].init.referrerPolicy, 'no-referrer'); assert.equal(log[0].init.method, 'POST');
  assert.deepEqual(log[0].body, JSON.parse(preview.text), 'the report is exactly the preview');
  assert.equal(validateReport(log[0].body).ok, true);
  assert.match(log[0].body.id, /^[0-9a-f]{32}$/); assert.notEqual(log[0].body.id, '0'.repeat(32));
  assert.deepEqual((await getUsage()).period, {}, 'the period starts again');
  assert.equal((await getUsage()).total.focus_start, 1, 'the history stays');
  assert.equal((await sendReport({ now: now + DAY, fetchImpl: okFetch(log), endpoint: URL_ })).sent, false, 'not again within the week');
  assert.equal((await sendReport({ now: now + 7 * DAY, fetchImpl: okFetch(log), endpoint: URL_ })).sent, true, 'the next week');
  assert.equal(log.length, 2);
});

test('usage store: a use that happens while a report is on its way is counted in the next one', async () => {
  fresh(); await track('focus_start', T0); await enableSharing(T0);
  const now = T0 + 21 * 3_600_000;
  const slow = async (url, init) => { await track('focus_start', now); await track('focus_start', now); return { ok: true, status: 204 }; };
  await sendReport({ now, fetchImpl: slow, endpoint: URL_ });
  assert.equal((await getUsage(now)).period.focus_start, 2);
});

test('usage store: a failed send is retried later, not at once, and the counters are kept', async () => {
  fresh(); await track('focus_start', T0); await enableSharing(T0);
  const log = [], now = T0 + 21 * 3_600_000;
  assert.deepEqual(await sendReport({ now, fetchImpl: okFetch(log, 500), endpoint: URL_ }), { sent: false, why: 'status 500' });
  assert.equal((await sendReport({ now: now + 3_600_000, fetchImpl: okFetch(log), endpoint: URL_ })).why, 'not due', 'waits six hours');
  assert.equal((await sendReport({ now: now + 7 * 3_600_000, fetchImpl: async () => { throw new Error('offline'); }, endpoint: URL_ })).why, 'network');
  assert.equal((await getUsage()).period.focus_start, 1);
  const done = await sendReport({ now: now + 14 * 3_600_000, fetchImpl: okFetch(log), endpoint: URL_ });
  assert.equal(done.sent, true);
  // "too soon" from the collector means it already has this week's report
  fresh(); await track('focus_start', T0); await enableSharing(T0);
  assert.equal((await sendReport({ now, fetchImpl: okFetch([], 429), endpoint: URL_ })).sent, true);
});

test('usage store: stopping asks the collector to forget the id, deletes it here, and the question is never asked again', async () => {
  fresh(); await enableSharing(T0);
  const { id } = await getShare(); assert.match(id, /^[0-9a-f]{32}$/);
  const log = [];
  await disableSharing(T0 + DAY, okFetch(log), URL_);
  assert.deepEqual(log[0].body, { v: 1, op: 'forget', id });
  const s = await getShare(); assert.equal(s.on, false); assert.equal(s.id, null); assert.ok(s.askedAt);
  await track('focus_done', T0); await track('newtab_view', T0 + DAY); await track('newtab_view', T0 + 2 * DAY);
  assert.equal((await getUsage(T0)).total.focus_done, 1);
});

test('usage store: the one-time question', async () => {
  fresh();
  const asked = async (now) => { const real = (await import('../../src/shared/usage.js')).shouldAsk; return real(await getUsage(now), await getShare(), true); };
  assert.equal(await asked(T0), false, 'nothing done yet');
  await track('focus_done', T0); assert.equal(await asked(T0), false, 'a finished session, but only one day');
  await track('newtab_view', T0 + DAY); assert.equal(await asked(T0 + DAY), true);
  assert.equal(await wantsToAsk(T0 + DAY), false, 'no collector in this build: no question');
  await declineAsk(T0 + DAY); assert.equal(await asked(T0 + DAY), false, 'once');
  fresh(); await track('focus_done', T0); await track('newtab_view', T0 + DAY); await enableSharing(T0 + DAY); assert.equal(await asked(T0 + DAY), false, 'already sharing');
});

test('usage store: delete-all ends the sharing and the backup file carries neither the counters nor the id', async () => {
  fresh(); await track('focus_start', T0); await enableSharing(T0);
  const { exportAll } = await import('../../src/shared/storage.js');
  const dump = await exportAll();
  assert.ok(!('usage' in dump.data) && !('usageShare' in dump.data));
  const { importAll } = await import('../../src/shared/storage.js');
  await importAll({ app: 'eyetime', version: 2, data: { settings: {}, usage: { v: 1, base: 1, days: [1], first: {}, total: {}, period: {} }, usageShare: { on: true, id: 'a'.repeat(32) } } });
  assert.equal((await getShare()).id, null, 'a file never switches sharing on');
  await forgetOnReset(); // the collector is empty in this build: nothing to call, and no error
});

test('usage store: the code and the privacy page say the same thing', () => {
  const privacy = readFileSync(new URL('../../PRIVACY.md', import.meta.url), 'utf8');
  for (const f of FEATURES) assert.ok(privacy.includes('`' + f + '`'), `PRIVACY.md lists the counted feature ${f}`);
  for (const f of FLAGS) assert.ok(privacy.includes('`' + f + '`'), `PRIVACY.md lists the reportable setup flag ${f}`);
  for (const f of WIN_FEATURES) assert.ok(privacy.includes('`' + f + '`'), `PRIVACY.md lists the Windows counter ${f}`);
  for (const f of WIN_FLAGS) assert.ok(privacy.includes('`' + f + '`'), `PRIVACY.md lists the Windows setup flag ${f}`);
  assert.match(privacy, /Anonymous usage/);
  for (const k of REPORT_KEYS) assert.ok(privacy.includes('`' + k + '`'), `PRIVACY.md describes the report field ${k}`);
  const src = readFileSync(new URL('../../src/shared/usage-config.js', import.meta.url), 'utf8');
  assert.match(src, /USAGE_ENDPOINT = ''|USAGE_ENDPOINT = 'https:\/\//);
});

test('backup: the desktop helper token never leaves the device, and its switch comes back off', async () => {
  fresh();
  const { exportAll, updateSettings } = await import('../../src/shared/storage.js');
  await updateSettings((s) => { s.companion = { enabled: true, token: 'SECRET-TEST-TOKEN-12345' }; });
  const dump = await exportAll();
  assert.ok(!JSON.stringify(dump).includes('SECRET-TEST-TOKEN-12345'), 'the token is not in the file');
  assert.equal(dump.data.settings.companion.token, ''); assert.equal(dump.data.settings.companion.enabled, false);
  const stored = (await chrome.storage.local.get('settings')).settings;
  assert.equal(stored.companion.token, 'SECRET-TEST-TOKEN-12345', 'and the live settings are untouched by an export');
});

test('backup: a file made before the token was kept out (3.8.1 and older) does not bring it back, in either format', async () => {
  fresh();
  const { importAll } = await import('../../src/shared/storage.js');
  await importAll({ app: 'eyetime', version: 2, data: { settings: { companion: { enabled: true, token: 'OLD-TOKEN-FROM-381' } } } });
  let s = (await chrome.storage.local.get('settings')).settings;
  assert.equal(s.companion.token, ''); assert.equal(s.companion.enabled, false);
  assert.ok(!JSON.stringify(await chrome.storage.local.get(null)).includes('OLD-TOKEN-FROM-381'), 'nowhere in storage');
  fresh();
  await importAll({ app: 'eyetime', version: 3, data: { settings: { companion: { enabled: true, token: 'OLD-TOKEN-FROM-381' } } } });
  s = (await chrome.storage.local.get('settings')).settings;
  assert.equal(s.companion.token, ''); assert.equal(s.companion.enabled, false);
});

test('backup: the choice about tips travels with it ("No more tips" is not undone by a restore), and tips are on by default', async () => {
  fresh();
  const { importAll } = await import('../../src/shared/storage.js');
  const { DEFAULT_SETTINGS } = await import('../../src/shared/defaults.js');
  assert.deepEqual(DEFAULT_SETTINGS.tips, { on: true });
  await importAll({ app: 'eyetime', version: 3, data: { settings: { tips: { on: false } }, tipState: { off: true, last: 5, seen: {} } } });
  const all = await chrome.storage.local.get(null);
  assert.equal(all.settings.tips.on, false); assert.equal(all.tipState.off, true);
});

test('backup: a javascript: link and a damaged list in a file do not get into the store, and a failed write puts the old data back', async () => {
  fresh();
  const { importAll } = await import('../../src/shared/storage.js');
  await chrome.storage.local.set({ tasks: [{ id: 'mine', text: 'my task' }], settings: { onboarded: true } });
  await importAll({ app: 'eyetime', version: 2, data: { settings: { newtab: { links: [{ url: 'javascript:alert(1)', title: 'x' }, { url: 'https://ok.test', title: 'ok' }] } }, tasks: 'not a list', habits: { a: 1 }, 'd:2026-01-01': 'junk', weekPlan: [1] } });
  const all = await chrome.storage.local.get(null);
  assert.deepEqual(all.settings.newtab.links.map((l) => l.url), ['https://ok.test/']);
  assert.deepEqual(all.tasks, []); assert.deepEqual(all.habits, []); assert.ok(!('d:2026-01-01' in all) && !('weekPlan' in all));
  // a write that fails halfway: the person keeps what they had
  fresh();
  await chrome.storage.local.set({ tasks: [{ id: 'mine', text: 'my task' }] });
  const realSet = chrome.storage.local.set.bind(chrome.storage.local); let first = true;
  chrome.storage.local.set = async (o) => { if (first && o.settings) { first = false; throw new Error('QUOTA_BYTES quota exceeded'); } return realSet(o); };
  await assert.rejects(importAll({ app: 'eyetime', version: 2, data: { settings: { onboarded: true }, tasks: [{ id: 'x', text: 'from the file' }] } }), /QUOTA/);
  chrome.storage.local.set = realSet;
  assert.deepEqual((await chrome.storage.local.get('tasks')).tasks, [{ id: 'mine', text: 'my task' }], 'the old data is back');
});
