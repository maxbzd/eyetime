// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The whole road, end to end: many simulated people use EyeTime for weeks with the real client code (record, report schedule, build, subtract), every report goes through the real
// collector handler into the real D1 store (on SQLite), and the statistics are checked against what the simulation knows by itself. If any link drifts, a number here stops being true.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyUsage, record, buildReport, reportDue, subtractPeriod } from '../../src/shared/usage.js';
import { validateReport } from '../../src/shared/usage-schema.js';
import { handle } from '../../server/usage/handler.js';
import { D1Store } from '../../server/usage/d1-store.js';
import { MemoryStore } from '../../server/usage/memory-store.js';
import { computeStats } from '../../server/usage/stats.js';

let DatabaseSync; try { ({ DatabaseSync } = await import('node:sqlite')); } catch { /* an older Node */ }

const DAY = 86_400_000, HOUR = 3_600_000, TODAY = Math.floor(Date.UTC(2026, 10, 20) / DAY), END = TODAY * DAY + 21 * HOUR;
const EXT = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';

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

/** A small deterministic generator, so a failure is the same failure every time. */
function lcg(seed) { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32; }

/** Run the whole simulation against a store. Returns what the simulation knows (the truth) and what the collector holds. */
async function simulate(store, people = 160) {
  const r = lcg(2026), truth = [];
  let accepted = 0, refused = 0;
  const post = async (report, now) => {
    const res = await handle(new Request('https://x.test/v1/usage', { method: 'POST', headers: { 'content-type': 'application/json', origin: EXT }, body: JSON.stringify(report) }), store, now, {});
    if (res.status === 204) accepted++; else refused++;
    return res;
  };
  for (let p = 0; p < people; p++) {
    const id = Array.from({ length: 32 }, () => Math.floor(r() * 16).toString(16)).join('');
    const installDay = TODAY - Math.floor(r() * 56) - 1;          // 1 … 56 days ago
    const kind = r() < 0.45 ? 'leaves' : r() < 0.5 ? 'casual' : 'daily';
    const leavesAfter = kind === 'leaves' ? 1 + Math.floor(r() * 6) : 10_000; // days of use before it is gone for good
    const pActive = kind === 'daily' ? 0.8 : kind === 'casual' ? 0.3 : 0.6;
    const usage = emptyUsage(installDay * DAY + 9 * HOUR);
    const share = { on: true, id, optInAt: installDay * DAY + 9 * HOUR };
    const me = { id, installDay, acts: [], uses: 0, reportedUses: 0, lastReportAge: -1, reportedActs: [], startedFirstDay: false };
    for (let d = installDay; d <= TODAY; d++) {
      const age = d - installDay;
      if (age < leavesAfter) {                                     // the morning: use
        const active = age === 0 || r() < pActive;
        if (active) {
          me.acts.push(age);
          record(usage, 'newtab_view', d * DAY + 10 * HOUR);
          if (r() < 0.6) { record(usage, 'focus_start', d * DAY + 10 * HOUR + 60_000); me.uses++; if (r() < 0.7) record(usage, 'focus_done', d * DAY + 11 * HOUR); }
        }
      }
      const now = d * DAY + 20 * HOUR;                             // the evening: the extension checks whether a report is due
      if (age < leavesAfter + 3 && reportDue(share, now, true)) {  // (it still reports for a couple of days after the last use: the browser is still there)
        const report = buildReport(usage, { id, app: '3.8.1', br: 'chrome', os: 'win', lang: 'en', look: 'calm', layout: 'today', mode: 'auto', flags: [] }, now);
        assert.ok(validateReport(report).ok, 'the client never builds what the schema refuses');
        const res = await post(report, now);
        assert.equal(res.status, 204, 'the collector accepts what the client sends');
        subtractPeriod(usage, report.ft);
        share.lastReportAt = now;
        me.lastReportAge = report.age; me.reportedActs = report.act.slice(); me.reportedUses = me.uses;
      }
    }
    // (uses counted before the last report that went out; the rest is still on the person's device)
    truth.push({ ...me, kind });
  }
  return { truth, accepted, refused };
}

async function run(store) {
  const { truth, accepted, refused } = await simulate(store);
  const known = truth.filter((t) => t.lastReportAge >= 0);       // an install the collector has ever heard from
  const s = computeStats(await store.snapshot(), END, { all: true });
  return { truth, known, s, accepted, refused };
}

/** What the simulation says retention is: the same calendar rule, counted by hand from the people. */
const matureAt = (t, end) => TODAY - t.installDay >= end + 7;

test('pipeline: what the collector shows is what the people did (D1 SQLite store)', { skip: !DatabaseSync && 'node:sqlite is not available in this Node' }, async () => {
  const db = new DatabaseSync(':memory:'); db.exec(readFileSync(new URL('../../server/usage/schema.sql', import.meta.url), 'utf8'));
  const store = new D1Store(d1(db));
  const { truth, known, s, accepted, refused } = await run(store);

  assert.ok(known.length > 100, 'most people were heard from: ' + known.length + ' of ' + truth.length);
  assert.equal(refused, 0, 'nothing was turned away');
  assert.equal(s.overview.installs, known.length, 'one install per person heard from');

  // retention, by hand
  const d1set = known.filter((t) => matureAt(t, 1)), d7set = known.filter((t) => matureAt(t, 13));
  assert.equal(s.retention.d1.n, d1set.length);
  assert.equal(s.retention.d1.k, d1set.filter((t) => t.reportedActs.includes(1)).length, 'D1 counted by hand');
  assert.equal(s.retention.d7.n, d7set.length);
  assert.equal(s.retention.d7.k, d7set.filter((t) => t.reportedActs.some((a) => a >= 7 && a <= 13)).length, 'D7 counted by hand');
  assert.ok(s.retention.d1.pct > 0.3 && s.retention.d1.pct < 0.95 && s.retention.d1.lo < s.retention.d1.pct && s.retention.d1.pct < s.retention.d1.hi);

  // uses: exactly the uses that were on a report that arrived
  const fs = s.features.find((f) => f.id === 'focus_start');
  const reported = known.reduce((a, t) => a + t.reportedUses, 0);
  assert.equal(fs.uses, reported, 'every counted use arrives once: not lost, not twice');

  // the door saw every report, once
  const door = (await store.snapshot()).ingest.filter((x) => x.kind === 'accepted').reduce((a, x) => a + x.n, 0);
  assert.equal(door, accepted, 'the door counted each accepted report');
  assert.ok(s.ingest.days.length > 0 && s.ingest.days.every((d) => d.rejected === 0), 'and refused none');

  // the numbers the owner reads are well-formed
  assert.equal(s.v, 3); assert.ok(s.scorecard.length >= 6);
  assert.ok(s.northstar && s.northstar.weeks.length >= 8, 'the north star has a history');
  assert.ok(s.weekday.total > 0 && s.weekday.counts.length === 7);
  assert.ok(JSON.stringify(s).length < 400_000, 'the answer stays a sensible size: ' + JSON.stringify(s).length);

  // the report holds nothing that names anyone
  const stored = db.prepare('SELECT * FROM installs LIMIT 1').get();
  assert.ok(Object.keys(stored).every((k) => !/ip|agent|header|url|title|name|email/i.test(k)), Object.keys(stored).join());
});

test('pipeline: memory store and D1 tell the same story', { skip: !DatabaseSync && 'node:sqlite is not available in this Node' }, async () => {
  const db = new DatabaseSync(':memory:'); db.exec(readFileSync(new URL('../../server/usage/schema.sql', import.meta.url), 'utf8'));
  const a = await run(new MemoryStore()), b = await run(new D1Store(d1(db)));
  assert.deepEqual(JSON.parse(JSON.stringify(b.s)), JSON.parse(JSON.stringify(a.s)));
});

test('pipeline: a person who stops sharing is gone from the collector', async () => {
  const store = new MemoryStore();
  const usage = emptyUsage(TODAY * DAY); record(usage, 'newtab_view', TODAY * DAY + HOUR);
  const rep = buildReport(usage, { id: 'c'.repeat(32), app: '3.8.1', br: 'chrome', os: 'win', lang: 'en', look: 'calm', layout: 'today', mode: 'auto' }, TODAY * DAY + 2 * HOUR);
  const call = (body, now) => handle(new Request('https://x.test/v1/usage', { method: 'POST', headers: { 'content-type': 'application/json', origin: EXT }, body: JSON.stringify(body) }), store, now, {});
  assert.equal((await call(rep, TODAY * DAY + 2 * HOUR)).status, 204);
  assert.equal((await call({ v: 1, op: 'forget', id: rep.id }, TODAY * DAY + 3 * HOUR)).status, 204);
  assert.equal((await store.snapshot()).installs.length, 0, 'forgotten means gone');
});
