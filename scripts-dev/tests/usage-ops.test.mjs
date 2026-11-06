// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// What turns the numbers into decisions: intervals and tests against chance, the north star, behavioural segments, coverage, experiments, the door's own counters, notes, targets,
// the scorecard; the stores that keep them (memory and D1 agree), the owner's routes of the collector, and the client's part (arms, the page after removal).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeStats, wilson, compareProps, normalizeTargets, scorecard, DEFAULT_TARGETS } from '../../server/usage/stats.js';
import { makeDemoSnapshot } from '../../server/usage/demo-data.js';
import { handle } from '../../server/usage/handler.js';
import { MemoryStore } from '../../server/usage/memory-store.js';
import { D1Store } from '../../server/usage/d1-store.js';
import { validateReport, UNINSTALL_REASONS } from '../../src/shared/usage-schema.js';
import { assignArms, buildReport, emptyUsage, hash32 } from '../../src/shared/usage.js';

let DatabaseSync; try { ({ DatabaseSync } = await import('node:sqlite')); } catch { /* an older Node */ }

const DAY = 86_400_000, NOW = Date.UTC(2026, 10, 20, 12), TODAY = Math.floor(NOW / DAY);
const iso = (d) => new Date(d * DAY).toISOString().slice(0, 10);
const inst = (id, ago, age, act, extra = {}) => ({ id, first_report: (TODAY - ago + 1) * DAY, last_report: (TODAY - ago + age) * DAY + 3600_000, app: '3.8.1', br: 'chrome', os: 'win', lang: 'en', look: 'calm', layout: 'today', mode: 'dark', age, act, ...extra });
const snapOf = (installs, firsts = [], weeks = [], flags = [], extra = {}) => ({ installs, firsts, weeks, flags, ...extra });
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

test('stats: a share has an interval, and a change is tested against chance', () => {
  assert.equal(wilson(0, 0), null);
  const [lo, hi] = wilson(50, 100); assert.ok(Math.abs(lo - 0.4038) < 0.002 && Math.abs(hi - 0.5962) < 0.002, 'half of a hundred');
  const z = wilson(0, 10); assert.equal(z[0], 0); assert.ok(Math.abs(z[1] - 0.2775) < 0.003, 'none of ten is not "exactly zero"');
  assert.equal(wilson(10, 10)[1], 1);
  const big = compareProps({ k: 60, n: 100 }, { k: 40, n: 100 }); assert.ok(big.significant && Math.abs(big.z - 2.828) < 0.01 && big.p < 0.01);
  assert.ok(!compareProps({ k: 6, n: 10 }, { k: 4, n: 10 }).significant, 'ten people each is never enough');
  assert.ok(compareProps({ k: 50, n: 100 }, { k: 50, n: 100 }).p > 0.999);
  assert.equal(compareProps({ k: 5, n: 10 }, null), null); assert.equal(compareProps({ k: 0, n: 0 }, { k: 1, n: 2 }), null);
  // every figure of the dashboard carries its interval
  const s = computeStats(snapOf([inst('A', 30, 29, [0, 1, 8]), inst('B', 30, 3, [0])]), NOW);
  assert.ok(s.retention.d1.lo >= 0 && s.retention.d1.hi <= 1 && s.retention.d1.lo < s.retention.d1.hi);
});

test('stats: the owner sets targets within ranges, and clears one with null', () => {
  assert.deepEqual(normalizeTargets({ finish: 0.9, d7: 0.5, early: null }), { ok: true, targets: { finish: 0.9, d7: 0.5 } });
  for (const bad of [null, [], { nope: 1 }, { finish: 2 }, { speed_p90: 5 }, { d7: 'x' }, { quick: NaN }]) assert.equal(normalizeTargets(bad).ok, false, JSON.stringify(bad));
});

test('stats: the scorecard measures against the targets, and says nothing when there is too little', () => {
  const T = { ...DEFAULT_TARGETS, d7: 0.5 };
  const s = {
    targets: { values: T }, speed: { p90_upper: 600, opens: 200 }, sessions: { started: 100, finish_rate: 0.6, early_stop_rate: 0.25 }, health: { installs_with_error: { pct: 0.03, n: 100 } },
    lifecycle: [{ partial: false, quick_ratio: 0.9, churned: 10 }, { partial: true, quick_ratio: 5, churned: 1 }], releases: { latest: '3.9.0', on_latest: { pct: 0.9, n: 100 }, versions: [1, 2] }, engagement: { dau_mau: 0.25, mau: 100 },
    retention: { d1: { pct: 0.3, n: 100 }, d7: { pct: 0.4, n: 100 }, d30: { pct: 0.2, n: 100 } }, activation: { session_week1: { pct: 0.5, n: 100 } },
  };
  const by = Object.fromEntries(scorecard(s).map((r) => [r.id, r.status]));
  assert.deepEqual(by, { speed: 'warn', finish: 'warn', early: 'bad', err: 'good', quick: 'warn', upd: 'good', stick: 'good', goal_d7: 'warn' }, 'only a target that is set gets a goal row');
  const thin = scorecard({ ...s, sessions: { started: 10, finish_rate: 0.1, early_stop_rate: 0.9 }, speed: { p90_upper: 5000, opens: 10 } });
  assert.ok(thin.filter((r) => ['speed', 'finish', 'early'].includes(r.id)).every((r) => r.status === 'na'), 'ten sessions say nothing');
});

test('stats: who is power, regular, casual, once, new or idle, and narrowing to that', () => {
  const P = inst('P', 60, 45, range(30, 45)), R = inst('R', 60, 38, range(30, 38)), C = inst('C', 60, 32, [30, 31, 32]), O = inst('O', 60, 30, [30]), N = inst('N', 3, 3, [0, 1, 2, 3]), I = inst('I', 100, 5, range(0, 5));
  const snap = snapOf([P, R, C, O, N, I], [{ id: 'P', feature: 'focus_start', age: 1 }], [], [{ id: 'R', flag: 'schedule' }, { id: 'C', flag: 'tasks_0' }]);
  const s = computeStats(snap, NOW);
  const by = (d) => Object.fromEntries(s.facets[d].map((x) => [x.value, x.k]));
  assert.deepEqual(by('use'), { power: 1, regular: 1, casual: 1, once: 1, new: 1, idle: 1 });
  assert.deepEqual(by('session'), { yes: 1, no: 5 });
  assert.deepEqual(by('blocking'), { yes: 1, no: 1, unknown: 4 }, 'a setup that was never reported is unknown, not "no"');
  assert.equal(computeStats(snap, NOW, { filter: { use: 'power' } }).overview.installs, 1);
  assert.equal(computeStats(snap, NOW, { filter: { session: 'yes', blocking: 'unknown' } }).overview.installs, 1);
  assert.deepEqual(computeStats(snap, NOW, { filter: { use: 'power' } }).filter, { use: 'power' });
  assert.ok(s.segments.use.length >= 5 && s.segments.session.length === 2, 'the behaviours are compared like any setting');
});

test('stats: days of the week are counted from the days of activity, over the days that are fully reported', () => {
  const A = inst('A', 30, 27, [0, 18, 20, 27]); // TODAY-30, TODAY-12, TODAY-10, TODAY-3 (the last is in the week still arriving)
  const want = new Array(7).fill(0); for (const d of [TODAY - 30, TODAY - 12, TODAY - 10]) want[(new Date(d * DAY).getUTCDay() + 6) % 7]++;
  const w = computeStats(snapOf([A]), NOW).weekday;
  assert.deepEqual(w.counts, want); assert.equal(w.total, 3);
});

test('stats: the north star is finished sessions per active install in a full week, with the minutes behind it', () => {
  const six = snapOf([inst('A', 30, 29, [0, 1, 2, 8, 9, 15, 22, 29]), inst('B', 30, 3, [0, 1]), inst('C', 10, 10, [0, 3, 7, 9])]);
  const s0 = computeStats(six, NOW, { recentDays: 28 }), k = s0.northstar.weeks.findLastIndex((w) => !w.partial);
  const wk = Date.parse(s0.trends.weeks[k].from) / DAY / 7;
  const weeks = [{ id: 'A', week: wk, feature: 'focus_done', n: 6 }, { id: 'B', week: wk, feature: 'focus_done', n: 2 }, { id: 'A', week: wk, feature: 'fl_u25', n: 4 }, { id: 'B', week: wk, feature: 'fl_u35', n: 2 }];
  const ns = computeStats({ ...six, weeks }, NOW, { recentDays: 28 }).northstar, row = ns.weeks[k];
  assert.equal(row.finished, 8); assert.ok(row.active > 0);
  assert.ok(Math.abs(row.value - 8 / row.active) < 1e-9); assert.ok(Math.abs(row.minutes - (4 * 20 + 2 * 30) / row.active) < 1e-9, 'minutes: the middle of each length bucket');
  assert.equal(ns.value, row.value); assert.ok(!ns.weeks.at(-1).partial === false, 'the week still arriving is marked');
});

test('stats: coverage compares the store’s count of active users with the installs that report', () => {
  const N = inst('N', 3, 3, [0, 1, 2, 3]), P = inst('P', 60, 45, range(30, 45));
  const s = computeStats(snapOf([N, P], [], [], [], { store_stats: [{ day: iso(TODAY), users: 4, installs: 10, uninstalls: 2 }] }), NOW);
  assert.deepEqual(s.coverage.rows.map((r) => [r.ours, r.coverage, r.uninstall_rate]), [[1, 0.25, 0.5]]);
});

test('stats: experiments set the arms side by side, each against the control', () => {
  const installs = [], experiments = [];
  for (let n = 0; n < 40; n++) {
    installs.push(inst('c' + n, 30, 29, n < 10 ? [0, 8] : [0])); experiments.push({ id: 'c' + n, exp: 'demo-len', arm: 'control' });
    installs.push(inst('s' + n, 30, 29, n < 25 ? [0, 8] : [0])); experiments.push({ id: 's' + n, exp: 'demo-len', arm: 'short' });
  }
  const [e] = computeStats(snapOf(installs, [], [], [], { experiments }), NOW).experiments;
  assert.equal(e.id, 'demo-len'); assert.equal(e.control, 'control');
  const [c, sh] = e.arms; assert.deepEqual([c.arm, c.d7.k, c.d7.n, sh.arm, sh.d7.k, sh.d7.n], ['control', 10, 40, 'short', 25, 40]);
  assert.equal(c.vs_control, null); assert.ok(sh.vs_control.d7.significant && sh.vs_control.d7.diff > 0.3);
  assert.equal(computeStats(snapOf(installs, [], [], [], { experiments }), NOW, { filter: { br: 'safari' } }).experiments.length, 0);
});

test('stats: the door’s counters, the reasons for leaving, notes on the charts and the owner’s targets', () => {
  const extra = {
    ingest: [{ day: iso(TODAY), kind: 'accepted', n: 10 }, { day: iso(TODAY), kind: 'bad_report', n: 2 }, { day: iso(TODAY), kind: 'too_soon', n: 5 }, { day: iso(TODAY - 40), kind: 'accepted', n: 99 }],
    uninstalls: [{ day: iso(TODAY - 3), reason: 'slow', n: 4 }, { day: iso(TODAY - 3), reason: 'broken', n: 1 }, { day: iso(TODAY - 200), reason: 'slow', n: 50 }],
    notes: [{ id: 1, day: iso(TODAY - 10), text: 'Release 3.8.1' }, { id: 2, day: iso(TODAY - 400), text: 'long ago' }],
    settings: { targets: '{"finish":0.9,"d7":0.5}' },
  };
  const s = computeStats(snapOf([inst('A', 30, 29, [0, 1, 8])], [], [], [], extra), NOW);
  const today = s.ingest.days.at(-1);
  assert.deepEqual([today.accepted, today.rejected, today.throttled], [10, 2, 5], 'a report that came too soon is throttled, not refused');
  assert.equal(s.ingest.days.length, 28); assert.equal(s.ingest.accepted_7d, 10); assert.ok(Math.abs(s.ingest.rejected_share_7d - 2 / 12) < 1e-9);
  assert.equal(s.uninstalls.total, 5); assert.equal(s.uninstalls.reasons.find((r) => r.id === 'slow').k, 4); assert.equal(s.uninstalls.reasons.length, UNINSTALL_REASONS.length);
  assert.deepEqual(s.notes.map((n) => n.id), [1], 'a note from long ago is not on these charts');
  assert.equal(s.targets.values.finish, 0.9); assert.deepEqual(s.targets.custom, ['finish', 'd7']); assert.equal(s.targets.values.speed_p90, 500);
  assert.ok(s.scorecard.some((r) => r.id === 'goal_d7'));
  assert.equal(computeStats(snapOf([]), NOW).targets.custom.length, 0);
  assert.equal(computeStats(snapOf([], [], [], [], { settings: { targets: 'not json' } }), NOW).targets.custom.length, 0, 'a damaged setting is no setting');
});

test('stats: a change against the period before says whether it is more than chance', () => {
  const s = computeStats(makeDemoSnapshot(NOW), NOW, { recentDays: 28 });
  assert.equal(s.v, 3); assert.ok(s.compare && Object.keys(s.compare).includes('d7') && Object.keys(s.compare).includes('finish_rate'));
  for (const c of Object.values(s.compare)) if (c) assert.ok(typeof c.significant === 'boolean' && c.p >= 0 && c.p <= 1);
  assert.ok(s.scorecard.length >= 6 && s.scorecard.every((r) => ['good', 'warn', 'bad', 'na'].includes(r.status)));
  assert.equal(computeStats(makeDemoSnapshot(NOW), NOW, { all: true }).compare, null);
});

// ---------- the stores ----------
function d1(db) {
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => { const info = db.prepare(sql).run(...args); return { meta: { last_row_id: Number(info.lastInsertRowid) } }; },
    _run: () => db.prepare(sql).run(...args),
  });
  return { prepare: (sql) => stmt(sql), batch: async (list) => { db.exec('BEGIN'); try { for (const s of list) s._run(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } } };
}
const rep = (id, extra = {}) => ({ v: 1, id, app: '3.8.1', br: 'chrome', os: 'win', lang: 'en', look: 'calm', layout: 'today', mode: 'auto', age: 5, act: [0, 1], first: { focus_start: 1 }, ft: { focus_start: 2 }, ...extra });
const A = 'a'.repeat(32), B = 'b'.repeat(32);

/** The same story on any store; returns what it holds at the end so the two can be compared. */
async function story(store) {
  await store.save(rep(A, { x: ['demo-len:short'] }), NOW);
  await store.save(rep(B), NOW - 500 * DAY);
  const n1 = await store.addNote('2026-11-01', 'Release 3.8.1'), n2 = await store.addNote('2026-11-02', 'A post');
  await store.deleteNote(n1);
  await store.tally('accepted', NOW); await store.tally('accepted', NOW); await store.tally('bad_json', NOW);
  assert.equal(await store.tallyUninstall('slow', NOW), true);
  await store.saveStoreStat({ day: '2026-11-19', users: 100, installs: 7, uninstalls: 3 }); await store.saveStoreStat({ day: '2026-11-19', users: 120, installs: null, uninstalls: null });
  await store.setSetting('targets', '{"finish":0.8}'); assert.equal(await store.getSetting('targets'), '{"finish":0.8}');
  await assert.rejects(() => store.setSetting('evil', 'x'), 'only known settings');
  await store.setSetting('alert:err', '2026-11-19'); await store.setSetting('targets', null); assert.equal(await store.getSetting('targets'), null);
  const before = await store.snapshot();
  assert.equal(await store.purge(NOW, 400), 1, 'the install that has not reported for 500 days goes');
  const after = await store.snapshot();
  assert.deepEqual(after.installs.map((i) => i.id), [A]); assert.ok(!after.firsts.some((f) => f.id === B) && !after.weeks.some((w) => w.id === B), 'and everything of it');
  await store.forget(A); assert.equal((await store.snapshot()).experiments.length, 0, 'forgetting removes the arm too');
  let notes = 0; for (let i = 0; i < 400; i++) if ((await store.addNote('2026-11-03', 'x')) !== null) notes++;
  assert.equal(notes, 299, 'at most 300 notes in all (one is there already)');
  let answers = 0; for (let i = 0; i < 2100; i++) if (await store.tallyUninstall('other', NOW)) answers++;
  assert.equal(answers, 1999, 'at most 2000 answers a day in all (one was counted)');
  const sort = (xs) => [...xs].sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : 1);
  return { notes: before.notes, n2, experiments: before.experiments, ingest: sort(before.ingest), uninstalls: before.uninstalls, store_stats: before.store_stats, settings: before.settings };
}

test('stores: notes, door counters, answers, store numbers, settings, experiments, purge and the caps (memory)', async () => {
  const r = await story(new MemoryStore());
  assert.deepEqual(r.notes.map((n) => n.text), ['A post']); assert.deepEqual(r.experiments, [{ id: A, exp: 'demo-len', arm: 'short' }]);
  assert.deepEqual(r.ingest.map((x) => [x.kind, x.n]), [['accepted', 2], ['bad_json', 1]]); assert.deepEqual(r.store_stats, [{ day: '2026-11-19', users: 120, installs: null, uninstalls: null }]);
  assert.deepEqual(r.settings, { 'alert:err': '2026-11-19' });
});

test('stores: D1 holds what memory holds', { skip: !DatabaseSync && 'node:sqlite is not available in this Node' }, async () => {
  const db = new DatabaseSync(':memory:'); db.exec(readFileSync(new URL('../../server/usage/schema.sql', import.meta.url), 'utf8'));
  const a = await story(new MemoryStore()), b = await story(new D1Store(d1(db)));
  assert.deepEqual(JSON.parse(JSON.stringify(b)), JSON.parse(JSON.stringify(a))); // (node:sqlite rows have no prototype)
});

// ---------- the owner's routes and the door ----------
const TOKEN = 'k'.repeat(20);
const call = (store, method, path, body, { auth = true, origin, extra = {} } = {}) => handle(new Request('https://x.test' + path, { method, headers: { ...(auth ? { authorization: 'Bearer ' + TOKEN } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(origin ? { origin } : {}) }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) }), store, NOW, { dashToken: TOKEN, ...extra });

test('collector: the owner writes notes, store numbers and targets, only with the key', async () => {
  const store = new MemoryStore();
  for (const [m, p, b] of [['POST', '/v1/notes', { day: '2026-11-01', text: 'x' }], ['PUT', '/v1/targets', { finish: 0.8 }], ['PUT', '/v1/store-stats', { day: '2026-11-01', users: 5 }], ['DELETE', '/v1/notes/1', undefined]]) {
    assert.equal((await call(store, m, p, b, { auth: false })).status, 401, 'no key: ' + p);
    assert.equal((await handle(new Request('https://x.test' + p, { method: m, headers: { 'content-type': 'application/json' }, body: b === undefined ? undefined : JSON.stringify(b) }), store, NOW, {})).status, 404, 'no key set on the collector: ' + p);
  }
  const ok = await call(store, 'POST', '/v1/notes', { day: '2026-11-01', text: '  Release 3.8.1  ' }); assert.equal(ok.status, 201); const { id } = await ok.json();
  assert.equal((await store.snapshot()).notes[0].text, 'Release 3.8.1');
  for (const bad of [{ day: '2026-13-01', text: 'x' }, { day: '2026-11-01', text: '' }, { day: '2026-11-01', text: 'x'.repeat(81) }, { day: '2026-11-01', text: 'a\nb' }, { day: '2026-11-01', text: 'x', more: 1 }, { text: 'x' }, 'not json']) assert.equal((await call(store, 'POST', '/v1/notes', bad)).status, 400, JSON.stringify(bad));
  assert.equal((await call(store, 'DELETE', '/v1/notes/' + id)).status, 204); assert.equal((await store.snapshot()).notes.length, 0);
  assert.equal((await call(store, 'PUT', '/v1/store-stats', { day: '2026-11-19', users: 120, installs: 7 })).status, 204); assert.equal((await store.snapshot()).store_stats[0].users, 120);
  for (const bad of [{ day: '2026-11-19' }, { day: '2026-11-19', users: -1 }, { day: '2030-01-01', users: 1 }, { day: '2026-11-19', users: 1, extra: 2 }, { users: 5 }]) assert.equal((await call(store, 'PUT', '/v1/store-stats', bad)).status, 400, JSON.stringify(bad));
  assert.equal((await call(store, 'PUT', '/v1/targets', { finish: 0.8, d7: 0.5 })).status, 204); assert.deepEqual(JSON.parse(await store.getSetting('targets')), { finish: 0.8, d7: 0.5 });
  assert.equal((await call(store, 'PUT', '/v1/targets', { finish: null, d7: null })).status, 204); assert.equal(await store.getSetting('targets'), null, 'clearing every target clears the setting');
  assert.equal((await call(store, 'PUT', '/v1/targets', { finish: 7 })).status, 400);
});

test('collector: the page after removal counts one answer from the project’s own page, and nothing else', async () => {
  const store = new MemoryStore(), site = 'https://maxbzd.github.io';
  const ok = await call(store, 'POST', '/v1/uninstall', { reason: 'slow' }, { auth: false, origin: site });
  assert.equal(ok.status, 204); assert.equal(ok.headers.get('access-control-allow-origin'), site);
  assert.equal((await call(store, 'OPTIONS', '/v1/uninstall', undefined, { auth: false, origin: site })).status, 204);
  assert.equal((await call(store, 'POST', '/v1/uninstall', { reason: 'slow' }, { auth: false, origin: 'https://evil.test' })).status, 403, 'another page may not');
  for (const bad of [{ reason: 'because' }, { reason: 'slow', text: 'hello' }, { why: 'slow' }, 'nope', {}]) assert.equal((await call(store, 'POST', '/v1/uninstall', bad, { auth: false, origin: site })).status, 400, JSON.stringify(bad));
  assert.equal((await call(store, 'POST', '/v1/uninstall', { reason: 'slow' }, { auth: false, origin: site, extra: { siteOrigins: ['https://example.org'] } })).status, 403, 'the origins are configurable');
  const snap = await store.snapshot(); assert.deepEqual(snap.uninstalls.map((u) => [u.reason, u.n]), [['slow', 1]]);
  assert.ok(Object.keys(snap.uninstalls[0]).sort().join() === 'day,n,reason', 'a day, a reason and a count: nothing that names anyone');
});

test('collector: the door counts what it accepts and what it refuses, by day, and an experiment is accepted only when it is named', async () => {
  const store = new MemoryStore(), ext = 'chrome-extension://abcdefghijklmnop';
  const post = (body, o = {}) => handle(new Request('https://x.test/v1/usage', { method: 'POST', headers: { 'content-type': o.type || 'application/json', ...(o.origin === null ? {} : { origin: o.origin || ext }) }, body: typeof body === 'string' ? body : JSON.stringify(body) }), store, o.now || NOW, o.opts || {});
  assert.equal((await post(rep(A))).status, 204); assert.equal((await post(rep(A))).status, 429, 'too soon');
  assert.equal((await post('not json')).status, 400); assert.equal((await post(rep(B), { type: 'text/plain' })).status, 415); assert.equal((await post(rep(B), { origin: 'https://evil.test' })).status, 403);
  assert.equal((await post({ ...rep(B), nope: 1 })).status, 400); assert.equal((await post('x'.repeat(9000))).status, 413);
  assert.equal((await post({ v: 1, op: 'forget', id: A })).status, 204);
  const counts = Object.fromEntries((await store.snapshot()).ingest.map((r) => [r.kind, r.n]));
  assert.deepEqual(counts, { accepted: 1, too_soon: 1, bad_json: 1, bad_type: 1, wrong_origin: 1, bad_report: 1, too_big: 1, forgot: 1 });
  const exps = [{ id: 'demo-len', arms: ['control', 'short'] }];
  assert.equal((await post(rep(B, { x: ['demo-len:short'] }))).status, 400, 'an experiment nobody has started is refused');
  assert.equal((await post(rep(B, { x: ['demo-len:short'] }), { opts: { experiments: exps } })).status, 204);
  assert.deepEqual((await store.snapshot()).experiments, [{ id: B, exp: 'demo-len', arm: 'short' }]);
  const broken = { tally: async () => { throw new Error('counter down'); }, lastReceived: async () => null, newSince: async () => 0, save: async () => {}, forget: async () => {} };
  assert.equal((await handle(new Request('https://x.test/v1/usage', { method: 'POST', headers: { 'content-type': 'application/json', origin: ext }, body: JSON.stringify(rep(A)) }), broken, NOW, {})).status, 204, 'a failing counter never stops a report');
});

// ---------- the client ----------
test('client: arms are the same every time, spread evenly, and a report names them only when an experiment runs', () => {
  const exps = [{ id: 'demo-len', arms: ['control', 'short'] }, { id: 'welcome', arms: ['a', 'b', 'c'] }];
  const seed = (i) => i.toString(16).padStart(32, '0');
  assert.deepEqual(assignArms(seed(7), exps), assignArms(seed(7), exps), 'the same device, the same arms');
  const n = { control: 0, short: 0 }, m = { a: 0, b: 0, c: 0 };
  for (let i = 0; i < 3000; i++) { const [x, y] = assignArms(seed(i), exps); n[x.split(':')[1]]++; m[y.split(':')[1]]++; }
  assert.ok(n.control > 1350 && n.control < 1650, 'two arms: ' + JSON.stringify(n)); assert.ok(Object.values(m).every((v) => v > 850 && v < 1150), 'three arms: ' + JSON.stringify(m));
  assert.notEqual(hash32('a'), hash32('b')); assert.deepEqual(assignArms(seed(1), []), []);
  const u = emptyUsage(NOW), ctx = { id: A, app: '3.8.1', br: 'chrome', os: 'win', lang: 'en', look: 'calm', layout: 'today', mode: 'auto' };
  assert.ok(!('x' in buildReport(u, ctx, NOW)) && !('x' in buildReport(u, { ...ctx, experiments: [] }, NOW)));
  const r = buildReport(u, { ...ctx, experiments: assignArms(seed(1), exps) }, NOW);
  assert.ok(validateReport(r, exps).ok && !validateReport(r).ok, 'valid only for the experiments that are listed');
  assert.ok(!validateReport({ ...r, x: ['demo-len:control', 'demo-len:short'] }, exps).ok, 'one arm per experiment');
  assert.ok(!validateReport({ ...r, x: ['demo-len:nope'] }, exps).ok && !validateReport({ ...r, x: 'demo-len:short' }, exps).ok);
});

test('client: the page after removal is set only when there is a collector to count the answer', async () => {
  const calls = [];
  globalThis.chrome = { runtime: { setUninstallURL: async (u) => { calls.push(u); }, getManifest: () => ({ version: '3.8.1' }) }, storage: { local: { get: async () => ({}), set: async () => {} }, onChanged: { addListener() {}, removeListener() {} } } };
  const { armUninstall, UNINSTALL_PAGE } = await import('../../src/background/usage.js');
  assert.equal(await armUninstall(''), false); assert.deepEqual(calls, [], 'no collector, no page: a build like this sets nothing');
  assert.equal(await armUninstall('https://collector.example/v1/usage'), true);
  assert.deepEqual(calls, [UNINSTALL_PAGE + '?v=3.8.1'], 'the version and nothing else');
  globalThis.chrome.runtime.setUninstallURL = async () => { throw new Error('not allowed'); };
  assert.equal(await armUninstall('https://collector.example/v1/usage'), false, 'a refusal is no error');
});
