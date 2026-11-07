// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Messages to the maker: what a message may hold, how the collector keeps and shows it, and how the owner's answer finds its way back to the person.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch { /* Node before 22.5 */ }
import { validateFeedback, validatePoll, validateReplyText, newTicket, daysBucket, FB_LIMITS } from '../../src/shared/feedback-schema.js';
import { MemoryFeedbackStore, D1FeedbackStore, checkPatch, ticketHash } from '../../server/usage/feedback-store.js';
import { feedbackSummary, filterMessages } from '../../server/usage/feedback-stats.js';
import { makeDemoFeedback } from '../../server/usage/demo-feedback.js';
import { handle } from '../../server/usage/handler.js';
import { MemoryStore } from '../../server/usage/memory-store.js';
import { runScheduled, buildDigest, WEEKLY_CRON } from '../../server/usage/digest.js';

const DAY = 86_400_000, T0 = Date.UTC(2026, 10, 2, 12), EXT = 'chrome-extension://abcdefghijklmnop';
const ctx = { app: '3.8.1', br: 'chrome', os: 'win', lang: 'ru', days: 'd14_29' };
const msg = (o = {}) => ({ v: 1, kind: 'idea', via: 'door', tags: ['focus'], text: 'Хочу тёмную страницу паузы', ctx, ...o });
const TOKEN = 'x'.repeat(24);
const req = (path, body, { method = 'POST', origin = EXT, token = null } = {}) => new Request('https://c.example' + path, { method, headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });

test('schema: a message is exactly what the list allows', () => {
  assert.equal(validateFeedback(msg()).ok, true);
  const bad = (m) => assert.equal(validateFeedback(m).ok, false, JSON.stringify(m));
  bad(msg({ kind: 'spam' })); bad(msg({ via: 'x' })); bad(msg({ extra: 1 })); bad(msg({ text: 'a' })); bad(msg({ text: 'x'.repeat(1001) }));
  bad(msg({ tags: ['nope'] })); bad(msg({ tags: ['focus', 'focus'] })); bad(msg({ rating: 3 })); bad(msg({ text: 'ok\u0000ok' })); bad(msg({ text: 'ok ok' }));
  bad(msg({ ctx: { ...ctx, ip: '1.2.3.4' } })); bad(msg({ ctx: { app: 'x' } })); bad(msg({ contact: 'not-an-address' })); bad(msg({ kind: 'kudos', contact: 'a@b.co' }));
  assert.equal(validateFeedback(msg({ contact: 'a@b.co' })).ok, true);
  // the answers to the small questions
  assert.equal(validateFeedback({ v: 1, kind: 'session', via: 'after_session', rating: 4, tags: ['timer'], ctx }).ok, true);
  bad({ v: 1, kind: 'session', via: 'after_session', rating: 5, ctx });
  assert.equal(validateFeedback({ v: 1, kind: 'pmf', via: 'pmf', rating: 2, ctx }).ok, true);
  assert.equal(validateFeedback({ v: 1, kind: 'pause', via: 'pause_page', rating: 1, ctx }).ok, true);
  bad({ v: 1, kind: 'pause', via: 'pause_page', ctx }); // empty
  assert.equal(daysBucket(3), 'd0_6'); assert.equal(daysBucket(7), 'd7_13'); assert.equal(daysBucket(20), 'd14_29'); assert.equal(daysBucket(90), 'd30p');
});

test('schema: a ticket is for the messages that were written, and is checked', () => {
  const t = newTicket();
  assert.match(t, /^[A-Za-z0-9_-]{22}$/);
  assert.notEqual(t, newTicket());
  assert.equal(validateFeedback(msg({ ticket: t })).ok, true);
  assert.equal(validateFeedback(msg({ kind: 'session', via: 'after_session', rating: 3, text: undefined, tags: undefined, ticket: t })).ok, false); // not for a rating
  assert.equal(validateFeedback(msg({ ticket: 'short' })).ok, false);
  assert.equal(validatePoll({ v: 1, t: [t] }), true);
  assert.equal(validatePoll({ v: 1, t: [] }), false);
  assert.equal(validatePoll({ v: 1, t: [t, t] }), false);
  assert.equal(validatePoll({ v: 1, t: Array.from({ length: FB_LIMITS.polls + 1 }, () => newTicket()) }), false);
  assert.equal(validatePoll({ v: 1, t: [t], x: 1 }), false);
  assert.equal(validateReplyText('Спасибо!'), true); assert.equal(validateReplyText('  '), false); assert.equal(validateReplyText('x'.repeat(1001)), false); assert.equal(validateReplyText('a\u0000'), false);
});

test('owner patch: only what the owner may change', () => {
  assert.deepEqual(checkPatch({ status: 'starred' }), { status: 'starred' });
  assert.deepEqual(checkPatch({ theme: ' тёмная пауза ', quote_ok: true }), { theme: 'тёмная пауза', quote_ok: true });
  assert.equal(checkPatch({ status: 'bogus' }), null); assert.equal(checkPatch({ text: 'rewritten' }), null); assert.equal(checkPatch({}), null);
  assert.equal(checkPatch({ theme: '<script>' }), null); assert.equal(checkPatch({ note: 'x'.repeat(501) }), null); assert.equal(checkPatch({ replied: false }), null);
  assert.equal(checkPatch({ note: '   ' }).note, null);
});

/** The D1 interface over node:sqlite (enough for the feedback store). */
function d1(db) {
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { last_row_id: Number(r.lastInsertRowid) } }; },
  });
  return { prepare: (sql) => stmt(sql) };
}
const stores = () => {
  const out = [['memory', () => new MemoryFeedbackStore()]];
  if (DatabaseSync) out.push(['d1', () => { const db = new DatabaseSync(':memory:'); db.exec(readFileSync(new URL('../../server/usage/feedback.sql', import.meta.url), 'utf8')); return new D1FeedbackStore(d1(db)); }]);
  return out;
};

for (const [name, make] of stores()) {
  test(`store (${name}): keep, change, answer, hand over, erase`, async () => {
    const s = make(), t = newTicket();
    const id = await s.add(msg({ ticket: t, contact: 'me@example.com' }), T0);
    const other = await s.add(msg({ text: 'Без билета', contact: 'x@example.com' }), T0 + 1);
    assert.equal(typeof id, 'number');
    let row = await s.get(id);
    assert.equal(row.can_reply, true); assert.equal('tk' in row, false); assert.equal(row.status, 'new'); assert.deepEqual(row.tags, ['focus']); assert.equal(row.ctx.lang, 'ru');
    assert.equal((await s.get(other)).can_reply, false);
    assert.equal(JSON.stringify(await s.all()).includes(await ticketHash(t)), false); // the hash is not shown to anyone
    assert.equal(JSON.stringify(await s.all()).includes(t), false);
    // the owner changes only their own fields; 'done' sets and clears the time
    assert.equal(await s.update(id, { status: 'done', theme: 'тёмная пауза' }, T0 + 5), true);
    row = await s.get(id); assert.equal(row.done_at, T0 + 5); assert.equal(row.theme, 'тёмная пауза');
    await s.update(id, { status: 'read' }, T0 + 6); assert.equal((await s.get(id)).done_at, null);
    assert.equal(await s.update(999, { status: 'read' }), false);
    // answers: only where a ticket was left; at most three; the reply address goes once answered
    assert.equal(await s.addReply(other, 'hi', T0 + 10), 'no_ticket'); assert.equal(await s.addReply(999, 'hi'), 'none');
    assert.equal(typeof (await s.addReply(id, '  Спасибо, сделаем.  ', T0 + 10)), 'number');
    row = await s.get(id); assert.equal(row.contact, null); assert.equal(row.replied_at, T0 + 10); assert.equal(row.replies[0].text, 'Спасибо, сделаем.'); assert.equal(row.replies[0].delivered_at, null);
    await s.addReply(id, 'два', T0 + 11); await s.addReply(id, 'три', T0 + 12);
    assert.equal(await s.addReply(id, 'четыре', T0 + 13), 'limit');
    // the device asks with its ticket: it gets its answers, and nobody else's
    assert.deepEqual(await s.takeReplies([newTicket()], T0 + DAY), []);
    const got = await s.takeReplies([t, newTicket()], T0 + DAY);
    assert.deepEqual(got.map((x) => x.text), ['Спасибо, сделаем.', 'два', 'три']); assert.equal(got[0].t, t);
    assert.equal((await s.get(id)).replies[0].delivered_at, T0 + DAY);
    // handed over answers are erased after 14 days; a message stays
    assert.equal(await s.scrubReplies(T0 + DAY + 13 * DAY), 0);
    assert.equal(await s.scrubReplies(T0 + DAY + 15 * DAY), 3);
    assert.equal((await s.get(id)).replies.length, 0); assert.ok(await s.get(id));
    // an unasked-for answer waits for six months, and the way back closes with the last answer after that
    const t2 = newTicket(), id2 = await s.add(msg({ ticket: t2 }), T0);
    await s.addReply(id2, 'ждёт', T0 + 1);
    assert.equal(await s.scrubReplies(T0 + 100 * DAY), 0); assert.equal((await s.takeReplies([t2], T0 + 100 * DAY)).length, 1);
    const t3 = newTicket(), id3 = await s.add(msg({ ticket: t3 }), T0); await s.addReply(id3, 'старое', T0 + 1);
    assert.equal(await s.scrubReplies(T0 + 200 * DAY), 2); assert.equal((await s.get(id3)).can_reply, false); assert.deepEqual(await s.takeReplies([t3]), []);
    // addresses: erased after 90 days
    assert.equal(await s.scrubContacts(T0 + 89 * DAY), 0); assert.equal(await s.scrubContacts(T0 + 91 * DAY), 1); assert.equal((await s.get(other)).contact, null);
    // the person deletes their own message with the ticket they hold; a wrong ticket deletes nothing
    const t4 = newTicket(), id4 = await s.add(msg({ ticket: t4 }), T0); await s.addReply(id4, 'bye', T0 + 1);
    assert.equal(await s.forgetTickets([newTicket()]), 0); assert.ok(await s.get(id4));
    assert.equal(await s.forgetTickets([t4]), 1); assert.equal(await s.get(id4), null); assert.deepEqual(await s.takeReplies([t4]), []);
    // deleting a message deletes its answers
    assert.equal(await s.remove(id2), true); assert.equal(await s.get(id2), null); assert.deepEqual(await s.takeReplies([t2]), []); assert.equal(await s.remove(id2), false);
  });

  test(`store (${name}): the day's cap`, async () => {
    const s = make();
    for (let i = 0; i < 3; i++) assert.ok(await s.add(msg(), T0 + i, 3));
    assert.equal(await s.add(msg(), T0 + 10, 3), null);
    assert.ok(await s.add(msg(), T0 + DAY, 3)); // the next day
  });
}

test('numbers: the question of fit, the ratings, what people ask for', () => {
  const now = Date.UTC(2026, 10, 2, 12);
  const mk = (kind, rating, ts, extra = {}) => ({ id: 0, ts, kind, via: 'x', rating, tags: [], text: '', contact: null, status: 'new', theme: null, replied_at: null, ctx: { days: 'd30p', lang: 'ru' }, ...extra });
  const rows = [mk('pmf', 2, now), mk('pmf', 2, now), mk('pmf', 1, now), mk('pmf', 0, now, { ctx: { days: 'd0_6', lang: 'en' } }),
    mk('session', 4, now), mk('session', 1, now - 8 * DAY), mk('idea', null, now, { text: 'a idea', theme: 'dark', status: 'done' }), mk('idea', null, now, { text: 'b idea', theme: 'dark' }),
    mk('idea', null, now, { text: 'c', tags: ['sync'], can_reply: true }), mk('leaving', null, now, { tags: ['slow'] })];
  const s = feedbackSummary(rows, now);
  assert.equal(s.pmf.n, 4); assert.equal(s.pmf.very, 2); assert.equal(s.pmf.score.pct, 0.5); assert.equal(s.pmf.target, 0.4); assert.ok(s.pmf.score.lo < 0.5 && s.pmf.score.hi > 0.5);
  assert.deepEqual(s.pmf.by_days.map((g) => [g.group, g.n]), [['d30p', 3], ['d0_6', 1]]);
  assert.equal(s.session.n, 2); assert.equal(s.session.weekly.length, 12); assert.equal(s.session.weekly.at(-1).avg, 4);
  assert.deepEqual(s.ideas[0], { theme: 'dark', k: 2, open: 1, done: 1, own: true });
  assert.equal(s.ideas[1].theme, 'sync'); assert.equal(s.done, 1); assert.equal(s.waiting_reply, 1); assert.equal(s.leaving.reasons[0].tag, 'slow');
  assert.equal(feedbackSummary([], now).pmf.score.pct, null); // no division by zero
  assert.equal(filterMessages(rows, { q: 'IDEA' }).length, 2); assert.equal(filterMessages(rows, { kind: 'pmf' }).length, 4); assert.equal(filterMessages(rows, { written: true }).length, 3);
});

test('demo: the same call gives the same messages, and they hold together', () => {
  const a = makeDemoFeedback(T0), b = makeDemoFeedback(T0);
  assert.deepEqual(a, b);
  assert.ok(a.length > 300);
  for (const m of a) { assert.ok(m.ts <= T0); assert.ok(['new', 'read', 'starred', 'done', 'wont'].includes(m.status)); assert.ok(Array.isArray(m.replies)); }
  for (let i = 1; i < a.length; i++) assert.ok(a[i - 1].ts >= a[i].ts); // newest first
  const s = feedbackSummary(a, T0);
  assert.ok(s.pmf.n > 40 && s.pmf.score.pct > 0.3 && s.pmf.score.pct < 0.6);
});

test('routes: a message is accepted from EyeTime only, and checked', async () => {
  const fb = new MemoryFeedbackStore(), opts = { feedback: fb };
  const st = new MemoryStore();
  assert.equal((await handle(req('/v1/feedback', msg()), st, T0, opts)).status, 204);
  assert.equal((await handle(req('/v1/feedback', msg(), { origin: 'https://evil.example' }), st, T0, opts)).status, 403);
  assert.equal((await handle(req('/v1/feedback', msg({ kind: 'nope' })), st, T0, opts)).status, 400);
  assert.equal((await handle(req('/v1/feedback', 'not json'), st, T0, opts)).status, 400);
  assert.equal((await handle(req('/v1/feedback', 'x'.repeat(9000)), st, T0, opts)).status, 400);
  assert.equal((await handle(new Request('https://c.example/v1/feedback', { method: 'POST', headers: { 'content-type': 'text/plain', origin: EXT }, body: '{}' }), st, T0, opts)).status, 415);
  assert.equal((await fb.all()).length, 1);
  const pre = await handle(req('/v1/feedback', undefined, { method: 'OPTIONS' }), st, T0, opts);
  assert.equal(pre.status, 204); assert.equal(pre.headers.get('access-control-allow-origin'), EXT);
  assert.equal((await handle(req('/v1/feedback', msg()), st, T0, {})).status, 404); // no store, no route
  // the day's cap
  const tiny = new MemoryFeedbackStore();
  for (let i = 0; i < FB_LIMITS.perDay; i++) tiny.rows.push({ id: i + 1, ts: T0, kind: 'idea' });
  const full = await handle(req('/v1/feedback', msg()), st, T0, { feedback: tiny });
  assert.equal(full.status, 429);
});

test('routes: the owner reads, sorts and answers; the answer comes back by ticket', async () => {
  const fb = new MemoryFeedbackStore(), st = new MemoryStore(), opts = { feedback: fb, dashToken: TOKEN };
  const t = newTicket();
  await handle(req('/v1/feedback', msg({ ticket: t })), st, T0, opts);
  await handle(req('/v1/feedback', msg({ text: 'Вторая мысль про блокировку', tags: ['blocking'] })), st, T0 + 1, opts);
  const owner = (path, body, method = 'POST') => handle(req(path, body, { method, origin: null, token: TOKEN }), st, T0 + 5, opts);
  // behind the secret
  assert.equal((await handle(req('/v1/feedback', undefined, { method: 'GET', origin: null }), st, T0, opts)).status, 401);
  assert.equal((await handle(req('/v1/feedback', undefined, { method: 'GET', origin: null, token: 'y'.repeat(24) }), st, T0, opts)).status, 401);
  assert.equal((await handle(req('/v1/feedback/1', { status: 'read' }, { method: 'PATCH', origin: null }), st, T0, opts)).status, 401);
  assert.equal((await handle(req('/v1/feedback/1/reply', { text: 'hi' }, { origin: null }), st, T0, opts)).status, 401);
  const list = await (await owner('/v1/feedback', undefined, 'GET')).json();
  assert.equal(list.messages.length, 2); assert.equal(list.matching, 2); assert.equal(list.summary.total, 2); assert.equal(list.messages[0].id, 2); // newest first
  assert.equal(list.summary.waiting_reply, 1);
  assert.equal((await (await owner('/v1/feedback?q=блокировк', undefined, 'GET')).json()).messages.length, 1);
  assert.equal((await owner('/v1/feedback?kind=wrong', undefined, 'GET')).status, 400);
  assert.equal((await owner('/v1/feedback?status=wrong', undefined, 'GET')).status, 400);
  // change
  assert.equal((await owner('/v1/feedback/1', { status: 'starred', theme: 'тёмная пауза' }, 'PATCH')).status, 204);
  assert.equal((await owner('/v1/feedback/1', { text: 'rewrite' }, 'PATCH')).status, 400);
  assert.equal((await owner('/v1/feedback/99', { status: 'read' }, 'PATCH')).status, 404);
  // answer
  assert.equal((await owner('/v1/feedback/2/reply', { text: 'Спасибо' })).status, 409); // no ticket: cannot be answered in EyeTime
  assert.equal((await owner('/v1/feedback/1/reply', { text: '  ' })).status, 400);
  assert.equal((await owner('/v1/feedback/1/reply', { text: 'ok', more: 1 })).status, 400);
  assert.equal((await owner('/v1/feedback/99/reply', { text: 'ok' })).status, 404);
  assert.equal((await owner('/v1/feedback/1/reply', { text: 'Спасибо! Тёмная пауза выйдет в 3.9.' })).status, 201);
  assert.equal((await (await owner('/v1/feedback', undefined, 'GET')).json()).summary.waiting_reply, 0);
  // the device asks: from EyeTime only, with a valid poll
  const poll = (b, origin = EXT) => handle(req('/v1/feedback/replies', b, { origin }), st, T0 + 2 * DAY, opts);
  assert.equal((await poll({ v: 1, t: [t] }, 'https://evil.example')).status, 403);
  assert.equal((await poll({ v: 1, t: [] })).status, 400);
  assert.equal((await poll({ v: 1, t: ['short'] })).status, 400);
  assert.deepEqual((await (await poll({ v: 1, t: [newTicket()] })).json()).r, []);
  const res = await poll({ v: 1, t: [t] });
  assert.equal(res.status, 200); assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = await res.json();
  assert.equal(body.r.length, 1); assert.equal(body.r[0].text, 'Спасибо! Тёмная пауза выйдет в 3.9.'); assert.equal(body.r[0].t, t);
  assert.deepEqual(Object.keys(body.r[0]).sort(), ['id', 't', 'text', 'ts']);
  // the person deletes their message
  const t5 = newTicket(); await handle(req('/v1/feedback', msg({ ticket: t5, text: 'Удалите это потом' })), st, T0 + 3, opts);
  assert.equal((await handle(req('/v1/feedback/forget', { v: 1, t: [t5] }, { origin: 'https://evil.example' }), st, T0, opts)).status, 403);
  assert.equal((await handle(req('/v1/feedback/forget', { v: 1, t: [] }), st, T0, opts)).status, 400);
  assert.equal((await handle(req('/v1/feedback/forget', { v: 1, t: [t5] }), st, T0, opts)).status, 204);
  assert.equal((await fb.all()).some((x) => x.text === 'Удалите это потом'), false);
  // delete
  assert.equal((await owner('/v1/feedback/1', undefined, 'DELETE')).status, 204);
  assert.equal((await owner('/v1/feedback/1', undefined, 'DELETE')).status, 404);
  assert.deepEqual((await (await poll({ v: 1, t: [t] })).json()).r, []);
});

test('routes: the demo answers the same way, only where the host passes it', async () => {
  const st = new MemoryStore(), opts = { demoFeedback: makeDemoFeedback };
  const r = await handle(req('/v1/demo-feedback?kind=idea', undefined, { method: 'GET', origin: null }), st, T0, opts);
  const j = await r.json();
  assert.equal(r.status, 200); assert.ok(j.messages.every((m) => m.kind === 'idea')); assert.ok(j.summary.total > 300);
  assert.equal((await handle(req('/v1/demo-feedback', undefined, { method: 'GET', origin: null }), st, T0, {})).status, 404);
});

test('page after removal: a few words and an address become a message of the kind "leaving"', async () => {
  const fb = new MemoryFeedbackStore(), st = new MemoryStore(), opts = { feedback: fb };
  const site = 'https://maxbzd.github.io';
  const go = (b, o = opts) => handle(req('/v1/uninstall', b, { origin: site }), st, T0, o);
  assert.equal((await go({ reason: 'slow' })).status, 204); assert.equal((await fb.all()).length, 0); // the reason alone is only counted
  assert.equal((await go({ reason: 'broken', text: 'Не открывалась новая вкладка', contact: 'me@example.com', app: '3.8.1' })).status, 204);
  const rows = await fb.all();
  assert.equal(rows.length, 1); assert.equal(rows[0].kind, 'leaving'); assert.deepEqual(rows[0].tags, ['broken']); assert.equal(rows[0].contact, 'me@example.com'); assert.equal(rows[0].ctx.app, '3.8.1');
  // words added afterwards: stored, not counted a second time
  const total = () => [...st.uninstalls.values()].reduce((a, b) => a + b, 0), tallied = total();
  assert.equal((await go({ reason: 'slow', text: 'Стало медленнее после обновления', more: true })).status, 204);
  assert.equal((await fb.all()).length, 2); assert.equal(total(), tallied);
  assert.equal((await go({ reason: 'slow', more: true })).status, 400); // nothing added
  assert.equal((await go({ reason: 'slow', text: 'ещё', more: false })).status, 400);
  assert.equal((await go({ reason: 'broken', text: 'x\u0000y' })).status, 400);
  assert.equal((await go({ reason: 'broken', contact: 'nope' })).status, 400);
  assert.equal((await go({ reason: 'broken', app: 'x' })).status, 400);
  assert.equal((await go({ reason: 'broken', ip: '1' })).status, 400);
  assert.equal((await go({ reason: 'broken', text: 'без хранилища' }, {})).status, 400); // no store: the reason alone, as before
});

test('weekly run: addresses and old answers are erased, and the digest says how many are waiting', async () => {
  const fb = new MemoryFeedbackStore(), st = new MemoryStore();
  await fb.add(msg({ contact: 'a@b.co' }), T0 - 100 * DAY);
  await fb.add(msg({ text: 'ещё одна мысль', ticket: newTicket() }), T0 - DAY);
  const out = await runScheduled({ store: st, now: T0, env: {}, cron: WEEKLY_CRON, feedback: fb });
  assert.deepEqual(out.scrubbed, { contacts: 1, replies: 0 });
  assert.equal((await runScheduled({ store: st, now: T0, env: {}, cron: '30 */6 * * *', feedback: fb })).scrubbed, undefined); // only the weekly run does the housekeeping
  const sent = [];
  await runScheduled({ store: st, now: T0, env: { TG_BOT_TOKEN: 't', TG_CHAT_ID: 'c' }, cron: WEEKLY_CRON, feedback: fb, fetchImpl: async (_u, o) => { sent.push(JSON.parse(o.body).text); return { ok: true }; } });
  assert.match(sent[0], /Сообщения: новых 2, ждут ответа 1/);
  assert.doesNotMatch(buildDigest({}, { fb: null }), /Сообщения/);
});
