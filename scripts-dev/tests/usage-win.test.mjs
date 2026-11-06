// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The Windows app as a second product: its own short list of counters and flags, a report that has no browser, look, layout or mode, kept apart from the extension in the collector
// and in every number, and read on its own block of the statistics.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReport, WIN_FEATURES, WIN_FLAGS, FEATURES } from '../../src/shared/usage-schema.js';
import { handle } from '../../server/usage/handler.js';
import { MemoryStore } from '../../server/usage/memory-store.js';
import { computeStats, DIMS } from '../../server/usage/stats.js';
import { parsePeriod } from '../../server/usage/handler.js';
import { makeDemoSnapshot } from '../../server/usage/demo-data.js';

const DAY = 86_400_000, NOW = Date.UTC(2026, 10, 20, 12), TODAY = Math.floor(NOW / DAY);
const W = 'a'.repeat(32), E = 'b'.repeat(32);
const winRep = (id = W, extra = {}) => ({ v: 1, id, pr: 'win', app: '0.2.1', lang: 'ru', age: 9, act: [0, 1, 8], first: { ses_start: 1, blk_rule: 0 }, ft: { blk_rule: 12, blk_session: 3, ch_shown: 2, ch_done: 1, ch_expired: 1, ch_wait: 2, ch_for_break: 2, ses_start: 4, ses_done: 3 }, fl: ['pin', 'w11', 'locked_rules'], ...extra });
const extRep = (id = E, extra = {}) => ({ v: 1, id, app: '3.8.1', br: 'chrome', os: 'win', lang: 'en', look: 'calm', layout: 'today', mode: 'auto', age: 9, act: [0, 1], first: { focus_start: 1 }, ft: { focus_start: 2, focus_done: 1 }, ...extra });

test('the report of the Windows app: the names are from its own lists, and nothing of a browser comes with it', () => {
  assert.deepEqual(validateReport(winRep()), { ok: true });
  for (const [bad, why] of [
    [{ ...winRep(), br: 'chrome' }, 'a browser'], [{ ...winRep(), look: 'calm' }, 'a look'], [{ ...winRep(), x: [] }, 'an experiment'], [{ ...winRep(), os: 'win' }, 'the system'],
    [winRep(W, { ft: { focus_start: 1 } }), 'an extension counter'], [winRep(W, { first: { newtab_view: 0 } }), 'an extension counter, first use'], [winRep(W, { fl: ['ritual'] }), 'an extension flag'],
    [winRep(W, { ft: { 'blk_rule:steam.exe': 1 } }), 'a name made up of a program'], [winRep(W, { app: 'x' }), 'a version'], [winRep(W, { lang: 'xx' }), 'a language'],
  ]) assert.equal(validateReport(bad).ok, false, why);
  assert.equal(validateReport({ ...extRep(), pr: 'ext' }).ok, false, 'the extension says nothing about the product');
  assert.equal(validateReport({ ...extRep(), pr: 'win' }).ok, false, 'an extension report cannot pass as the other product');
  assert.equal(validateReport(extRep(E, { ft: { blk_rule: 1 } })).ok, false, 'and the extension cannot use the other list');
  assert.ok(WIN_FEATURES.every((f) => /^[a-z_0-9]{3,20}$/.test(f)) && WIN_FEATURES.every((f) => !FEATURES.includes(f)) && new Set(WIN_FEATURES).size === WIN_FEATURES.length, 'the lists are kept apart');
  assert.ok(WIN_FLAGS.every((f) => /^[a-z_0-9]{2,20}$/.test(f)));
});

test('the collector takes both products, keeps them apart, and says nothing about a program or a site', async () => {
  const store = new MemoryStore();
  const post = (body) => handle(new Request('https://x.test/v1/usage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), store, NOW, {}); // (no Origin: not a browser page)
  assert.equal((await post(winRep())).status, 204);
  assert.equal((await handle(new Request('https://x.test/v1/usage', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'chrome-extension://abcdefghijklmnop' }, body: JSON.stringify(extRep()) }), store, NOW, {})).status, 204);
  assert.equal((await post(winRep(W, { ft: { focus_start: 1 } }))).status, 400);
  const snap = await store.snapshot();
  assert.deepEqual(snap.installs.map((i) => [i.id[0], i.pr]).sort(), [['a', 'win'], ['b', 'ext']]);
  assert.equal(JSON.stringify(snap).match(/steam|chrome\.exe|\.com/), null);
  const e = computeStats(snap, NOW, {}), w = computeStats(snap, NOW, { filter: { pr: 'win' } });
  assert.equal(e.overview.installs, 1, 'the extension numbers are the extension\'s alone'); assert.equal(w.overview.installs, 1);
  assert.equal(e.product, 'ext'); assert.equal(w.product, 'win');
  assert.ok(!('pr' in e.filter) && !('pr' in w.filter), 'the product is not a filter chip');
  assert.equal(w.features, null); assert.equal(w.funnel, null); assert.ok(w.win && !e.win);
});

test('stats: the Windows block, counted by hand', () => {
  const inst = (id, age, act, extra = {}) => ({ id, pr: 'win', first_report: (TODAY - age) * DAY, last_report: TODAY * DAY + 3600_000, app: '0.2.1', br: 'other', os: 'win', lang: 'ru', look: '-', layout: '-', mode: 'auto', age, act, ...extra });
  const week = Math.floor(TODAY / 7);
  const weeks = [['a', 'blk_rule', 40], ['a', 'blk_limit', 10], ['b', 'blk_rule', 20], ['a', 'ch_shown', 10], ['b', 'ch_shown', 10], ['a', 'ch_done', 6], ['b', 'ch_done', 2], ['a', 'ch_expired', 3], ['a', 'ses_start', 4], ['b', 'ses_start', 2], ['a', 'ses_done', 3], ['b', 'svc_crash', 1], ['a', 'upd_found', 2], ['a', 'upd_failed', 1]].map(([id, feature, n]) => ({ id, week, feature, n }));
  const snap = { installs: [inst('a', 30, [0, 1, 8, 20]), inst('b', 12, [0, 3])], firsts: [{ id: 'a', feature: 'ses_start', age: 1 }, { id: 'b', feature: 'ses_start', age: 3 }], weeks, flags: [{ id: 'a', flag: 'pin' }, { id: 'a', flag: 'w11' }, { id: 'b', flag: 'w10' }] };
  const w = computeStats(snap, NOW, { filter: { pr: 'win' } }).win;
  assert.equal(w.installs, 2); assert.equal(w.blocks_total, 70); assert.equal(w.blocks.find((x) => x.id === 'blk_rule').k, 60);
  assert.deepEqual([w.challenges.shown, w.challenges.done, w.challenges.expired], [20, 8, 3]); assert.equal(w.challenges.done_rate, 0.4); assert.equal(w.challenges.give_up_rate, 0.15);
  assert.deepEqual([w.sessions.started, w.sessions.finished], [6, 3]); assert.equal(w.sessions.finish_rate, 0.5); assert.deepEqual([w.sessions.users.k, w.sessions.users.n], [2, 2]);
  assert.equal(w.service.crashes, 1); assert.equal(w.service.crashes_per_1000, 500); assert.equal(w.updates.failed_rate, 0.5);
  assert.deepEqual(w.flags.items.filter((x) => x.k).map((x) => [x.id, x.k]), [['pin', 1], ['w10', 1], ['w11', 1]]);
  assert.deepEqual(w.flags.of, 2);
});

test('the product is a parameter of the request, and only a product', () => {
  assert.ok(DIMS.includes('pr'));
  assert.deepEqual(parsePeriod(new URL('https://x.test/v1/stats?pr=win')).filter, { pr: 'win' });
  assert.equal(parsePeriod(new URL('https://x.test/v1/stats?pr=mac')), null);
  const demo = makeDemoSnapshot(NOW);
  assert.ok(demo.installs.some((i) => i.pr === 'win') && demo.installs.some((i) => !i.pr || i.pr === 'ext'));
  const w = computeStats(demo, NOW, { filter: { pr: 'win' } }), e = computeStats(demo, NOW, {});
  assert.ok(w.overview.installs > 20 && e.overview.installs > 300 && w.overview.installs + e.overview.installs === demo.installs.length);
  assert.ok(w.win.challenges.shown > 0 && w.retention.d7.n > 0);
});
