// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The formulas behind the dashboard, checked against a small population whose answers can be counted by hand, and the doors of the collector (who may read the numbers).
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStats, publicStats, GROUPS, ADOPTION, LOW_SAMPLE } from '../../server/usage/stats.js';
import { makeDemoSnapshot } from '../../server/usage/demo-data.js';
import { handle, sameSecret, parsePeriod } from '../../server/usage/handler.js';
import { MemoryStore } from '../../server/usage/memory-store.js';
import { D1Store } from '../../server/usage/d1-store.js';
import { FEATURES, FLAGS } from '../../src/shared/usage-schema.js';
import { emptyUsage, record, buildReport } from '../../src/shared/usage.js';

const DAY = 86_400_000, NOW = Date.UTC(2026, 10, 20, 12), TODAY = Math.floor(NOW / DAY);

/** An install made `ago` days ago, last heard from at age `age`, active on the given ages. */
const inst = (id, ago, age, act, extra = {}) => ({ id, first_report: (TODAY - ago + 1) * DAY, last_report: (TODAY - ago + age) * DAY + 3600_000, app: '3.8.1', br: 'chrome', os: 'win', lang: 'en', look: 'calm', layout: 'today', mode: 'dark', age, act, ...extra });
const snapOf = (installs, firsts = [], weeks = [], flags = []) => ({ installs, firsts, weeks, flags });
const WEEKN = Math.floor(NOW / (7 * DAY));

const six = snapOf([
  inst('A', 30, 29, [0, 1, 2, 8, 9, 15, 22, 29]),   // stays
  inst('B', 30, 3, [0, 1]),                          // left after three days
  inst('C', 10, 10, [0, 3, 7, 9]),                   // too young for D7
  inst('D', 2, 2, [0, 1, 2]),                        // new
  inst('E', 40, 12, [0, 1, 5, 12]),                  // left at day 12, but was active in the window
  inst('F', 50, 5, [0, 2]),                          // left at day 5
], [
  { id: 'A', feature: 'newtab_view', age: 0 }, { id: 'A', feature: 'focus_start', age: 0 }, { id: 'A', feature: 'focus_done', age: 0 },
  { id: 'B', feature: 'newtab_view', age: 0 }, { id: 'B', feature: 'focus_start', age: 2 },
  { id: 'C', feature: 'newtab_view', age: 0 }, { id: 'C', feature: 'focus_start', age: 8 },
  { id: 'D', feature: 'newtab_view', age: 0 },
  { id: 'E', feature: 'newtab_view', age: 0 }, { id: 'E', feature: 'focus_start', age: 1 }, { id: 'E', feature: 'focus_done', age: 1 },
  { id: 'F', feature: 'newtab_view', age: 0 },
]);

test('stats: retention counts the people who left, and waits for a window to be observed before it counts it', () => {
  const s = computeStats(six, NOW);
  // D1: the window is over and a week of slack has passed for A B C E F (D, made 2 days ago, is not counted yet); A B E were active the next day
  assert.deepEqual([s.retention.d1.k, s.retention.d1.n], [3, 5]);
  // D7 (any day 7–13): A B E F are old enough (C and D are not); A and E were active in it. B and F left and count as not retained.
  assert.deepEqual([s.retention.d7.k, s.retention.d7.n], [2, 4]);
  // D30: only F is old enough for its window to be seen (a week of slack for the weekly report); it was not active
  assert.deepEqual([s.retention.d30.k, s.retention.d30.n], [0, 1]);
});

test('stats: activation and the funnel', () => {
  const s = computeStats(six, NOW);
  assert.deepEqual([s.activation.session_day1.k, s.activation.session_day1.n], [1, 6], 'only A started a session on day 0');
  // week 1, among the installs old enough (A B E F; C and D are too young for the week and a week of slack): A (0), B (2), E (1) started within 7 days
  assert.deepEqual([s.activation.session_week1.k, s.activation.session_week1.n], [3, 4]);
  assert.deepEqual([s.activation.finished_week1.k, s.activation.finished_week1.n], [2, 4]);
  assert.equal(s.activation.median_days_to_first_session, 1.5, 'the first sessions came on days 0, 2, 8 and 1');
  assert.deepEqual(s.funnel.map((f) => [f.id, f.n]), [['reported', 6], ['newtab', 6], ['started', 4], ['finished', 2], ['days3', 4], ['days7', 1]]);
});

test('stats: cohorts group installs by the week they were made, weekly activity is shown only for weeks that have been observed', () => {
  const s = computeStats(six, NOW);
  assert.ok(s.cohorts.length >= 3 && s.cohorts.length <= 12);
  assert.equal(s.cohorts.reduce((a, c) => a + c.n, 0), 6, 'every install is in exactly one cohort');
  for (const c of s.cohorts) for (const w of c.weeks) assert.ok(w.n >= 0 && w.k <= w.n);
  const withA = s.cohorts.find((c) => c.n >= 1 && c.weeks[1].n >= 1);
  assert.ok(withA, 'there is a cohort that has a second week observed');
});

test('stats: weekly active installs, with the weeks still open marked', () => {
  const s = computeStats(six, NOW);
  assert.equal(s.weekly.length, 13, 'the default period is 90 days: thirteen weeks');
  assert.equal(computeStats(six, NOW, { recentDays: 28 }).weekly.length, 12, 'never fewer than twelve');
  assert.equal(s.weekly.at(-1).to, new Date(TODAY * DAY).toISOString().slice(0, 10));
  assert.ok(s.weekly.at(-1).partial && s.weekly.at(-2).partial && !s.weekly.at(-3).partial);
  const last = s.weekly.at(-1); assert.ok(last.active <= last.installed);
});

test('stats: feature adoption is among the installs that reported in the last four weeks, with the uses, and a feature almost nobody uses is flagged only when the sample is big enough', () => {
  const weeks = [
    { id: 'A', week: WEEKN, feature: 'focus_start', n: 5 }, { id: 'A', week: WEEKN - 1, feature: 'focus_start', n: 3 }, { id: 'D', week: WEEKN, feature: 'focus_start', n: 1 },
    { id: 'A', week: WEEKN - 9, feature: 'task_add', n: 9 },                 // too old: outside the four weeks
    { id: 'F', week: WEEKN, feature: 'focus_start', n: 4 },                   // F has not reported in the window: not counted
  ];
  const s = computeStats(snapOf(six.installs, six.firsts, weeks), NOW, { recentDays: 28 });
  const f = Object.fromEntries(s.features.map((x) => [x.id, x]));
  assert.equal(s.overview.recent, 4, 'A, B (last heard 27 days ago), C and D reported in the last 28 days; E and F long ago');
  assert.equal(f.focus_start.uses, 9); assert.deepEqual([f.focus_start.users.k, f.focus_start.users.n], [2, s.overview.recent]); assert.equal(f.focus_start.per_user, 4.5);
  assert.equal(f.task_add.uses, 0);
  assert.equal(f.task_add.cut_candidate, false, 'with ' + s.overview.recent + ' installs nothing is called a candidate to cut');
  assert.ok(s.features.every((x) => ADOPTION.includes(x.id)) && s.features.length === ADOPTION.length);
  assert.ok(ADOPTION.every((x) => FEATURES.includes(x)), 'every feature of a group exists');
  assert.deepEqual(Object.keys(GROUPS), ['focus', 'blocking', 'eyes', 'planning', 'home']);
});

test('stats: sessions, blocking, speed and health come from the counters, never from a guess', () => {
  const w = (feature, n, id = 'A') => ({ id, week: WEEKN, feature, n });
  const s = computeStats(snapOf(six.installs, six.firsts, [w('focus_start', 10), w('focus_done', 8), w('fl_early_stop', 1), w('fl_u35', 6), w('fl_u50', 2), w('block_page', 20), w('block_continue', 5), w('bp_friction', 15), w('bp_focus', 5),
    w('eye_break_done', 6), w('eye_break_skip', 2), w('nt_u100', 10), w('nt_u250', 70), w('nt_u500', 15), w('nt_u1000', 4), w('nt_slow', 1), w('err_sync', 2), w('err_page', 1)]), NOW, { recentDays: 28 });
  assert.equal(s.sessions.finish_rate, 0.8); assert.equal(s.sessions.early_stop_rate, 0.1);
  assert.deepEqual(s.sessions.length.map((x) => x.k), [0, 0, 6, 2, 0, 0]);
  assert.equal(s.blocking.continue_rate, 0.25); assert.deepEqual(s.blocking.reasons.map((x) => x.k), [0, 5, 0, 0, 0, 15]);
  assert.equal(s.eyes.rate, 0.75);
  assert.equal(s.speed.opens, 100); assert.equal(s.speed.under250, 0.8); assert.equal(s.speed.p50_upper, 250); assert.equal(s.speed.p90_upper, 500);
  assert.equal(s.health.by_place.find((x) => x.id === 'err_sync').k, 2); assert.equal(s.health.installs_with_error.k, 1);
});

test('stats: an empty collector answers with empty figures, not an error', () => {
  const s = computeStats(snapOf([]), NOW);
  assert.equal(s.overview.installs, 0); assert.equal(s.retention.d1.pct, null); assert.equal(s.sessions.finish_rate, null); assert.equal(s.speed.p50_upper, null);
  assert.equal(publicStats(s).collecting, true);
});

test('stats: the demo population gives figures in a plausible range and the same every time', () => {
  const a = computeStats(makeDemoSnapshot(NOW), NOW), b = computeStats(makeDemoSnapshot(NOW), NOW);
  assert.deepEqual(a, b, 'seeded');
  assert.ok(a.overview.installs > 300 && a.overview.recent > 200);
  for (const k of ['d1', 'd7', 'd30']) assert.ok(a.retention[k].pct > 0.1 && a.retention[k].pct < 0.8, k);
  assert.ok(a.sessions.finish_rate > 0.6 && a.sessions.finish_rate <= 1); assert.ok(a.speed.under250 > 0.5);
  assert.ok(a.setup.flags.of > 100 && a.setup.flags.items.length === FLAGS.length);
  assert.ok(a.features.some((f) => f.cut_candidate), 'a population this size shows some features nobody uses');
});

test('public statistics: only totals over many installs, small groups folded, nothing per person or per cohort', () => {
  const full = computeStats(makeDemoSnapshot(NOW), NOW), p = publicStats(full);
  assert.equal(p.public, true); assert.equal(p.collecting, false);
  for (const hidden of ['cohorts', 'health', 'activation.median_days_to_first_session']) assert.ok(!JSON.stringify(p).includes('"' + hidden.split('.').pop() + '"') || hidden.includes('.'), hidden);
  assert.ok(!('cohorts' in p) && !('health' in p) && !('funnel' in p));
  for (const grp of ['look', 'lang', 'mode', 'browser', 'os']) for (const x of p.setup[grp]) assert.ok(x.k >= LOW_SAMPLE || x.value === 'other', `${grp} ${x.value} ${x.k}`);
  assert.ok(!JSON.stringify(p).match(/[0-9a-f]{32}/), 'no identifier');
  const tiny = publicStats(computeStats(makeDemoSnapshot(NOW, { installs: 40 }), NOW));
  assert.equal(tiny.collecting, true); assert.ok(!('features' in tiny), 'below the threshold nothing but "still collecting"');
});

// ---- the doors ----
const get = (path, headers = {}) => new Request('https://usage.example' + path, { method: 'GET', headers });
const filled = async () => { const st = new MemoryStore(); for (let i = 0; i < 3; i++) { const u = emptyUsage(NOW - 5 * DAY); record(u, 'focus_start', NOW); await st.save(buildReport(u, { id: String(i).repeat(32), app: '3.8.1', br: 'chrome', os: 'win', lang: 'en', look: 'calm', layout: 'today', mode: 'dark', flags: ['friction', 'tasks_0'] }, NOW), NOW); } return st; };

test('collector: the numbers need the secret; without a secret configured there is no dashboard at all', async () => {
  const st = await filled(), TOKEN = 'k'.repeat(40);
  assert.equal((await handle(get('/v1/stats'), st, NOW, { dashToken: TOKEN })).status, 401);
  assert.equal((await handle(get('/v1/stats', { authorization: 'Bearer wrong' }), st, NOW, { dashToken: TOKEN })).status, 401);
  assert.equal((await handle(get('/v1/stats', { authorization: 'Bearer ' + TOKEN.slice(0, -1) }), st, NOW, { dashToken: TOKEN })).status, 401);
  assert.equal((await handle(get('/v1/stats', { authorization: 'Basic ' + TOKEN }), st, NOW, { dashToken: TOKEN })).status, 401);
  const ok = await handle(get('/v1/stats', { authorization: 'Bearer ' + TOKEN }), st, NOW, { dashToken: TOKEN });
  assert.equal(ok.status, 200); assert.equal(ok.headers.get('cache-control'), 'no-store'); assert.equal(ok.headers.get('access-control-allow-origin'), null, 'no CORS: the page that reads it is on the same origin');
  const body = await ok.json(); assert.equal(body.overview.installs, 3); assert.equal(body.setup.flags.of, 3);
  assert.equal((await handle(get('/v1/stats', { authorization: 'Bearer ' + TOKEN }), st, NOW, {})).status, 404, 'no secret configured: no door');
  assert.equal((await handle(get('/v1/stats', { authorization: 'Bearer short' }), st, NOW, { dashToken: 'short' })).status, 404, 'a short secret is refused as a configuration');
  assert.equal(sameSecret('abc', 'abc'), true); assert.equal(sameSecret('abc', 'abd'), false); assert.equal(sameSecret('abc', 'abcd'), false); assert.equal(sameSecret('', ''), true);
});

test('collector: the public totals exist only when switched on, and the page is served with a strict policy', async () => {
  const st = await filled();
  assert.equal((await handle(get('/v1/public-stats'), st, NOW, {})).status, 404);
  const on = await handle(get('/v1/public-stats'), st, NOW, { publicStats: true });
  assert.equal(on.status, 200); assert.equal((await on.json()).collecting, true, 'three installs are below the threshold');
  const page = await handle(get('/'), st, NOW, { dashboardHtml: '<!doctype html><title>x</title>' });
  assert.equal(page.status, 200); assert.match(page.headers.get('content-security-policy'), /default-src 'none'/); assert.match(page.headers.get('content-security-policy'), /connect-src 'self'/); assert.equal(page.headers.get('x-frame-options'), 'DENY');
  assert.equal((await handle(get('/'), st, NOW, {})).status, 404, 'no page, no route');
  assert.equal((await handle(new Request('https://usage.example/', { method: 'POST' }), st, NOW, { dashboardHtml: 'x' })).status, 404);
});

test('collector: flags are a state (each report replaces the last), forgetting removes them, and D1 and memory hold the same', async () => {
  const mem = new MemoryStore();
  const u = emptyUsage(NOW - 5 * DAY); record(u, 'focus_start', NOW);
  const rep = (fl, id = 'a'.repeat(32)) => buildReport(u, { id, app: '3.8.1', br: 'chrome', os: 'win', lang: 'en', look: 'calm', layout: 'today', mode: 'dark', flags: fl }, NOW);
  await mem.save(rep(['dock', 'friction']), NOW); await mem.save(rep(['friction', 'tasks_1_5']), NOW + 7 * DAY);
  assert.deepEqual((await mem.snapshot()).flags.map((f) => f.flag).sort(), ['friction', 'tasks_1_5']);
  const old = rep(undefined); delete old.fl; await mem.save({ ...old, id: 'b'.repeat(32) }, NOW); // an earlier EyeTime: no flags
  assert.equal((await mem.snapshot()).flags.filter((f) => f.id === 'b'.repeat(32)).length, 0);
  await mem.forget('a'.repeat(32)); assert.equal((await mem.snapshot()).flags.filter((f) => f.id === 'a'.repeat(32)).length, 0);
  let DatabaseSync = null; try { ({ DatabaseSync } = await import('node:sqlite')); } catch { return; }
  const db = new DatabaseSync(':memory:'); db.exec((await import('node:fs')).readFileSync(new URL('../../server/usage/schema.sql', import.meta.url), 'utf8'));
  const stmt = (sql, args = []) => ({ bind: (...a) => stmt(sql, a), first: async () => db.prepare(sql).get(...args) ?? null, all: async () => ({ results: db.prepare(sql).all(...args) }), run: async () => db.prepare(sql).run(...args) });
  const d1 = new D1Store({ prepare: (sql) => stmt(sql), batch: async (list) => { for (const s of list) await s.run(); } });
  const mem2 = new MemoryStore();
  for (const [r, t] of [[rep(['dock', 'friction']), NOW], [rep(['friction', 'tasks_1_5']), NOW + 7 * DAY], [{ ...old, id: 'b'.repeat(32) }, NOW]]) { await d1.save(r, t); await mem2.save(r, t); }
  const norm = (s) => JSON.stringify({ i: s.installs.map((x) => ({ ...x })).sort((a, b) => (a.id < b.id ? -1 : 1)), f: s.firsts.sort((a, b) => (a.id + a.feature < b.id + b.feature ? -1 : 1)), w: s.weeks.sort((a, b) => (a.id + a.feature < b.id + b.feature ? -1 : 1)), fl: s.flags.sort((a, b) => (a.id + a.flag < b.id + b.flag ? -1 : 1)) });
  assert.equal(norm(await d1.snapshot()), norm(await mem2.snapshot()));
  await d1.forget('a'.repeat(32)); assert.equal((await d1.snapshot()).flags.filter((f) => f.id === 'a'.repeat(32)).length, 0);
});

test('stats: the period scopes who is active, which installs the funnel follows, and what the previous period was', () => {
  // a window in the past: from 35 to 21 days ago
  const p = computeStats(six, NOW, { from: TODAY - 35, to: TODAY - 21 });
  assert.deepEqual(p.range, { from: new Date((TODAY - 35) * DAY).toISOString().slice(0, 10), to: new Date((TODAY - 21) * DAY).toISOString().slice(0, 10), days: 15, all: false, weeks_from: p.range.weeks_from, weeks_to: p.range.weeks_to });
  assert.equal(p.overview.installs, 4, 'A B E F existed by then (C and D came later)');
  assert.equal(p.overview.new_in_range, 2, 'A and B were made in the window');
  assert.equal(p.overview.recent, 3, 'A, B and E showed a day of activity in it; F was gone, C and D not there yet');
  assert.equal(p.funnel[0].n, 2, 'the funnel follows the installs of the period');
  assert.equal(p.weekly.at(-1).to, p.range.to, 'the weekly chart ends with the period');
  assert.equal(p.prev.installs_new, 2, 'before it (days 50 to 36 ago) E and F were made');
  assert.equal(p.prev.installs_active, 2, 'and both were active');
  assert.equal(p.prev.range.to, new Date((TODAY - 36) * DAY).toISOString().slice(0, 10));
  // everything: from the first install, no comparison
  const all = computeStats(six, NOW, { all: true });
  assert.equal(all.overview.new_in_range, 6); assert.equal(all.range.days, 51); assert.equal(all.prev, null);
  // a period is never longer than the time there is, and never reaches into the future
  const odd = computeStats(six, NOW, { from: TODAY + 5, to: TODAY + 9 });
  assert.equal(odd.range.to, odd.range.from, 'a period in the future shrinks to today'); assert.equal(odd.range.days, 1);
  assert.equal(computeStats(snapOf([]), NOW, { all: true }).prev, null);
  // the default period carries a comparison
  const d = computeStats(six, NOW, { recentDays: 28 }); assert.ok(d.prev && d.prev.range.days === 28);
  assert.equal(computeStats(six, NOW, { recentDays: 28, compare: false }).prev, null);
});

test('collector: the period of the dashboard is read strictly', () => {
  const q = (s) => parsePeriod(new URL('https://x.test/v1/stats' + s));
  assert.deepEqual(q(''), {}); assert.deepEqual(q('?range=all'), { all: true }); assert.deepEqual(q('?days=28'), { recentDays: 28 });
  const d = q('?from=2026-10-01&to=2026-10-31'); assert.equal(d.to - d.from, 30);
  assert.ok(q('?from=2026-10-01').from !== undefined && q('?to=2026-10-31').to !== undefined);
  for (const bad of ['?days=0', '?days=99999', '?days=x', '?from=2026-13-01', '?from=2026-02-30', '?from=yesterday', '?from=2026-10-31&to=2026-10-01', '?from=2000-01-01&to=2026-10-01']) assert.equal(q(bad), null, bad);
});

test('collector: the dashboard numbers answer for a period, and a malformed one is a 400', async () => {
  const store = new MemoryStore(); store.snapshot = async () => six;
  const get = (qs, auth = 'Bearer ' + 'k'.repeat(20)) => handle(new Request('https://x.test/v1/stats' + qs, { headers: { authorization: auth } }), store, NOW, { dashToken: 'k'.repeat(20) });
  const a = await (await get('?days=28')).json(), b = await (await get('?range=all')).json();
  assert.equal(a.range.days, 28); assert.equal(b.range.all, true); assert.equal(b.overview.new_in_range, 6);
  assert.equal((await get('?days=0')).status, 400);
  assert.equal((await get('?days=28', 'Bearer wrong')).status, 401, 'the secret is checked before the period');
});

test('stats v2: who came, stayed, came back and left, week by week', () => {
  const l = snapOf([
    inst('N', 2, 2, [0, 1, 2]),          // made this week
    inst('R', 30, 27, [0, 20, 27]),      // active last week and this week
    inst('Z', 40, 35, [0, 35]),          // quiet for a month, back this week
    inst('C', 30, 20, [0, 20]),          // active last week, not this week
  ]);
  const s = computeStats(l, NOW, { recentDays: 28 });
  const last = s.lifecycle.at(-1), before = s.lifecycle.at(-2);
  assert.deepEqual([last.new, last.retained, last.resurrected, last.churned, last.quick_ratio], [1, 1, 1, 1, 2]);
  assert.deepEqual([before.new, before.retained, before.resurrected, before.churned, before.quick_ratio], [0, 0, 2, 0, null], 'no churn, so no ratio');
  assert.ok(last.partial);
  // 28 fully reported days (ending a week ago): R and C were active on two of them
  assert.equal(s.engagement.mau, 2); assert.equal(s.engagement.avg_active_days, 2); assert.ok(Math.abs(s.engagement.dau_mau - 4 / 56) < 1e-9);
  assert.equal(s.engagement.depth.find((d) => d.id === 'd2').k, 2); assert.equal(s.engagement.dau.length, 35); assert.ok(s.engagement.dau.slice(28).every((d) => d.partial));
});

test('stats v2: what the people who stayed did in their first week', () => {
  const installs = [], firsts = [];
  for (let n = 0; n < 80; n++) {
    const did = n < 40, back = did ? n < 30 : n < 50;                  // 30 of 40 who used it came back; 10 of 40 who did not
    installs.push(inst('p' + n, 30, 29, back ? [0, 8] : [0]));
    if (did) firsts.push({ id: 'p' + n, feature: 'focus_done', age: 2 });
  }
  const f = computeStats(snapOf(installs, firsts), NOW).aha.find((x) => x.id === 'focus_done');
  assert.deepEqual([f.did.k, f.did.n, f.not.k, f.not.n], [30, 40, 10, 40]);
  assert.ok(Math.abs(f.lift - 0.5) < 1e-9); assert.ok(f.reliable);
  const small = computeStats(snapOf(installs.slice(0, 20), firsts.slice(0, 20)), NOW).aha.find((x) => x.id === 'focus_done');
  assert.ok(!small || !small.reliable, 'a few installs do not make a finding');
});

test('stats v2: counters by week, releases, segments and filters', () => {
  const two = snapOf([inst('A', 30, 29, [0, 1, 2, 8, 9, 15, 22, 29], { app: '3.9.0' }), inst('B', 30, 3, [0, 1], { br: 'firefox' }), inst('C', 10, 10, [0, 3, 7, 9])],
    [], [{ id: 'A', week: WEEKN, feature: 'focus_start', n: 5 }, { id: 'C', week: WEEKN, feature: 'focus_start', n: 1 }, { id: 'A', week: WEEKN - 1, feature: 'focus_start', n: 2 }, { id: 'A', week: WEEKN, feature: 'focus_done', n: 4 }]);
  const s = computeStats(two, NOW, { recentDays: 28 });
  assert.equal(s.trends.weeks.length, s.trends.uses.focus_start.length); assert.equal(s.trends.uses.focus_start.at(-1), 6); assert.equal(s.trends.users.focus_start.at(-1), 2); assert.equal(s.trends.uses.focus_start.at(-2), 2);
  assert.equal(s.releases.latest, '3.9.0'); assert.deepEqual([s.releases.on_latest.k, s.releases.on_latest.n], [1, 3]);
  const v = s.releases.versions.find((x) => x.value === '3.9.0'); assert.equal(v.installs, 1); assert.ok(v.latest); assert.ok(Math.abs(v.finish_rate - 4 / 7) < 1e-9, 'A started 5 + 2 and finished 4');
  assert.deepEqual(s.segments.br.map((x) => [x.value, x.installs]), [['chrome', 2], ['firefox', 1]]);
  assert.deepEqual(s.facets.br.map((x) => [x.value, x.k]), [['chrome', 2], ['firefox', 1]]);
  // narrowed to Firefox, everything is about B alone, while the choices to narrow by stay what they were
  const ff = computeStats(two, NOW, { recentDays: 28, filter: { br: 'firefox' } });
  assert.equal(ff.overview.installs, 1); assert.deepEqual(ff.filter, { br: 'firefox' }); assert.deepEqual(ff.facets.br.map((x) => x.k), [2, 1]); assert.equal(ff.prev.installs_active, 1, 'the period before is narrowed too: B was active then');
  assert.equal(computeStats(two, NOW, { filter: { br: 'safari' } }).overview.installs, 0, 'a value nobody has gives an empty, not an error');
});

test('collector: the narrowing of the dashboard is read strictly', () => {
  const q = (s) => parsePeriod(new URL('https://x.test/v1/stats' + s));
  assert.deepEqual(q('?days=28&br=chrome&lang=ru'), { recentDays: 28, filter: { br: 'chrome', lang: 'ru' } });
  assert.deepEqual(q('?br=edge'), { filter: { br: 'edge' } });
  for (const bad of ['?br=Chrome!', '?lang=', '?os=' + 'x'.repeat(30), '?app=3.8.1;drop']) assert.equal(q(bad), null, bad);
  assert.deepEqual(q('?app=3.8.1'), { filter: { app: '3.8.1' } });
});
