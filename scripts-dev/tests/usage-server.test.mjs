// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch { /* Node before 22.5: the D1 part of the collector is not tested here */ }
import { handle, MIN_GAP_MS, MAX_NEW_PER_HOUR, isExtensionOrigin } from '../../server/usage/handler.js';
import { MemoryStore } from '../../server/usage/memory-store.js';
import { D1Store } from '../../server/usage/d1-store.js';
import { emptyUsage, record, buildReport, dayNumber } from '../../src/shared/usage.js';
import { validateReport, FEATURES } from '../../src/shared/usage-schema.js';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 2, 12);
const ctx = { id: 'a'.repeat(32), app: '3.5.0', br: 'chrome', os: 'mac', lang: 'ru', look: 'calm', layout: 'today', mode: 'dark' };
const post = (body, { type = 'application/json', method = 'POST', path = '/v1/usage' } = {}) => new Request('https://usage.example' + path, { method, headers: { 'content-type': type }, body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined });
const sample = (now = T0, id = ctx.id) => { const u = emptyUsage(now - 10 * DAY); for (const [f, d] of [['newtab_view', 0], ['focus_start', 0], ['focus_start', 1], ['focus_done', 1], ['palette_open', 8]]) record(u, f, now - (10 - d) * DAY); return buildReport(u, { ...ctx, id }, now); };

test('collector: a valid report is stored, anything else is refused', async () => {
  const store = new MemoryStore();
  const r = sample();
  assert.equal((await handle(post(r), store, T0)).status, 204);
  assert.equal(store.installs.get(ctx.id).look, 'calm');
  for (const bad of [{ ...r, url: 'https://example.com' }, { ...r, id: 'short' }, { ...r, ft: { 'github.com': 3 } }, { ...r, br: 'netscape' }, { ...r, act: [1, 1] }, { ...r, age: -1 }, { ...r, ft: { focus_start: 1e9 } }]) {
    assert.equal((await handle(post(bad), new MemoryStore(), T0)).status, 400, JSON.stringify(bad).slice(0, 80));
  }
  assert.equal((await handle(post('not json'), store, T0)).status, 400);
  assert.equal((await handle(post(r, { type: 'text/plain' }), store, T0)).status, 415);
  assert.equal((await handle(post('x'.repeat(5000)), store, T0)).status, 413);
  assert.equal((await handle(post(null, { method: 'GET' }), store, T0)).status, 405);
  assert.equal((await handle(post(r, { path: '/other' }), store, T0)).status, 404);
  const pre = await handle(post(null, { method: 'OPTIONS' }), store, T0);
  assert.equal(pre.status, 204); assert.equal(pre.headers.get('access-control-allow-origin'), null, 'no origin, no CORS header');
});

test('collector: one report per six hours per install; the history adds up; forgetting removes everything', async () => {
  const store = new MemoryStore();
  assert.equal((await handle(post(sample(T0)), store, T0)).status, 204);
  assert.equal((await handle(post(sample(T0)), store, T0 + MIN_GAP_MS - 1)).status, 429, 'too soon');
  const later = T0 + 8 * DAY, r2 = sample(later); r2.act.push(r2.age); r2.ft = { focus_start: 4 };
  assert.equal((await handle(post(r2), store, later)).status, 204);
  assert.ok(store.installs.get(ctx.id).act.length >= 4, 'the active days of both reports are kept');
  assert.equal((await handle(post({ v: 1, op: 'forget', id: ctx.id }), store, later)).status, 204);
  assert.equal(store.installs.size + store.firsts.size + store.weeks.size, 0);
  assert.equal((await handle(post({ v: 1, op: 'forget', id: ctx.id, extra: 1 }), store, later)).status, 400, 'a forget request holds nothing else');
});

test('collector: a response and a stored row carry nothing but the report (no IP, no headers)', async () => {
  const store = new MemoryStore();
  const req = new Request('https://usage.example/v1/usage', { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9', 'user-agent': 'x', cookie: 'a=b' }, body: JSON.stringify(sample()) });
  await handle(req, store, T0);
  const dump = JSON.stringify([...store.installs.values()]) + JSON.stringify([...store.firsts]) + JSON.stringify([...store.weeks]);
  assert.ok(!/203\.0\.113|cookie|user-agent/i.test(dump));
});

/** The D1 interface over node:sqlite, enough for D1Store and queries.sql: prepare().bind().first()/all()/run(), batch(). */
function d1(db) {
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => { db.prepare(sql).run(...args); },
    _run: () => db.prepare(sql).run(...args),
  });
  return { prepare: (sql) => stmt(sql), batch: async (list) => { db.exec('BEGIN'); try { for (const s of list) s._run(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } } };
}

test('collector: the D1 store and the memory store agree, and the questions in queries.sql run', { skip: !DatabaseSync && 'node:sqlite is not available in this Node' }, async () => {
  const db = new DatabaseSync(':memory:'); db.exec(readFileSync(new URL('../../server/usage/schema.sql', import.meta.url), 'utf8'));
  const dstore = new D1Store(d1(db)), mstore = new MemoryStore();
  // 40 installs spread over eight weeks: the first half come back after a week and a month, the others do not
  const now = T0 + 70 * DAY;
  for (let i = 0; i < 40; i++) {
    const installDay = now - (10 + (i % 8) * 7) * DAY - DAY, id = i.toString(16).padStart(32, '0');
    const u = emptyUsage(installDay);
    const days = Math.floor(i / 8) % 2 ? [0, 1] : [0, 1, 7, 9, 31]; // every other install of a cohort comes back
    for (const d of days) record(u, 'newtab_view', installDay + d * DAY);
    record(u, 'focus_start', installDay + (i % 3) * DAY); if (i % 4 === 0) record(u, 'focus_done', installDay + 2 * DAY);
    const at = installDay + (10 + (i % 8) * 7) * DAY; // each install reports once, after the days it was used on
    const rep = buildReport(u, { ...ctx, id, look: i % 3 ? 'calm' : 'noir' }, at);
    assert.equal(validateReport(rep).ok, true);
    await handle(post(rep), dstore, at); await handle(post(rep), mstore, at);
  }
  const rowsD = db.prepare('SELECT id, age, act FROM installs ORDER BY id').all();
  assert.equal(rowsD.length, 40); assert.equal(rowsD.length, mstore.installs.size);
  for (const r of rowsD) assert.deepEqual(JSON.parse(r.act), mstore.installs.get(r.id).act, 'the same active days');
  assert.equal(await dstore.newSince(0), 40); assert.equal(await dstore.newSince(0), await mstore.newSince(0), 'both count the installs of the hour alike');
  assert.equal(await dstore.newSince(now + DAY), 0); assert.equal(await mstore.newSince(now + DAY), 0);

  const sql = readFileSync(new URL('../../server/usage/queries.sql', import.meta.url), 'utf8');
  const queries = Object.fromEntries(sql.split(/^-- name: /m).slice(1).map((q) => [q.split(/\s/)[0], q.split('\n').filter((l, i) => i > 0 && !l.startsWith('--')).join('\n')]));
  assert.deepEqual(Object.keys(queries), ['overview', 'activation', 'retention', 'feature_adoption', 'setup']);
  const NOW = "(CAST(strftime('%s','now') AS INTEGER) * 1000)"; // the queries use the clock of the database: the test sets it to the day of the last report
  const run = (name) => db.prepare(queries[name].replaceAll(NOW, String(now))).all();
  assert.equal(run('overview')[0].installs, 40);
  assert.equal(run('activation').length, 4);
  const ret = run('retention');
  assert.ok(ret.length >= 3 && ret.every((r) => r.installs > 0));
  assert.ok(ret.some((r) => r.d7_pct !== null && r.d7_pct > 0 && r.d7_pct < 100), 'half of them came back: ' + JSON.stringify(ret.slice(0, 2)));
  assert.ok(run('feature_adoption').every((r) => FEATURES.includes(r.feature)));
  assert.ok(run('setup').some((r) => r.what === 'look' && r.value === 'noir'));
  // forgetting removes the rows from every table
  await dstore.forget('0'.repeat(31) + '1');
  assert.equal(db.prepare('SELECT COUNT(*) c FROM installs').get().c, 39);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM firsts WHERE id = ?").get('0'.repeat(31) + '1').c, 0);
  assert.ok(dayNumber(now) > 0);
});

test('collector: only an extension origin may call it, and the answer names that origin, not everyone', async () => {
  const store = new MemoryStore();
  const from = (origin, body = sample()) => new Request('https://usage.example/v1/usage', { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body) });
  const ok = await handle(from('chrome-extension://abcdefghijklmnopabcdefghijklmnop'), store, T0);
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get('access-control-allow-origin'), 'chrome-extension://abcdefghijklmnopabcdefghijklmnop');
  assert.equal(ok.headers.get('vary'), 'Origin');
  assert.equal((await handle(from('moz-extension://12345678-aaaa-bbbb-cccc-1234567890ab', sample(T0, 'b'.repeat(32))), store, T0)).status, 204, 'Firefox');
  for (const web of ['https://evil.example', 'http://localhost:8080', 'null', 'chrome-extension://', 'chrome-extension://x/y']) {
    const r = await handle(from(web, sample(T0, 'c'.repeat(32))), new MemoryStore(), T0);
    assert.equal(r.status, 403, web);
    assert.equal(r.headers.get('access-control-allow-origin'), null, 'a refused origin is not echoed back');
  }
  assert.equal(isExtensionOrigin('chrome-extension://abcdefghijklmnopabcdefghijklmnop'), true);
  assert.equal(isExtensionOrigin(''), false);
});

test('collector: a flood of new made-up ids stops at the hourly budget while installs that are known keep reporting', async () => {
  const store = new MemoryStore();
  const id = (i) => i.toString(16).padStart(32, '0');
  assert.equal((await handle(post(sample(T0, id(1))), store, T0)).status, 204);
  for (let i = 2; i <= MAX_NEW_PER_HOUR; i++) store.installs.set(id(i), { id: id(i), first_report: T0, last_report: T0, act: [] }); // the hour is full
  const refused = await handle(post(sample(T0, id(99999))), store, T0 + 1000);
  assert.equal(refused.status, 429); assert.equal(refused.headers.get('retry-after'), '3600');
  assert.equal(store.installs.has(id(99999)), false, 'nothing was stored');
  assert.equal((await handle(post(sample(T0 + MIN_GAP_MS, id(1))), store, T0 + MIN_GAP_MS)).status, 204, 'a known install still reports (and a new hour has begun anyway)');
  const later = T0 + 61 * 60_000;
  assert.equal((await handle(post(sample(later, id(99999))), store, later)).status, 204, 'an hour later there is room again');
});

test('collector: a body that announces itself as too big is refused before it is read', async () => {
  const store = new MemoryStore();
  const req = new Request('https://usage.example/v1/usage', { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': '999999' }, body: '{}' });
  let read = false; const real = req.text.bind(req); req.text = () => { read = true; return real(); };
  assert.equal((await handle(req, store, T0)).status, 413);
  assert.equal(read, false);
});
