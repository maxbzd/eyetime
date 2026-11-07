// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The device side of messages to the maker: when a small question may appear (and when it must not), what "Not now" costs, writing a message, the ticket, and the author's answers coming back.
import test from 'node:test';
import assert from 'node:assert/strict';

let mem = {};
const pick = (keys) => (keys == null ? { ...mem } : Object.fromEntries([].concat(keys).filter((k) => k in mem).map((k) => [k, structuredClone(mem[k])])));
globalThis.chrome = { storage: { local: { get: async (k) => pick(k), set: async (o) => { Object.assign(mem, structuredClone(o)); }, clear: async () => { mem = {}; }, remove: async (k) => { for (const x of [].concat(k)) delete mem[x]; } }, onChanged: { addListener() {}, removeListener() {} } }, runtime: { getManifest: () => ({ version: '3.8.1' }) } };

const F = await import('../../src/shared/feedback.js');
const { newTicket } = await import('../../src/shared/feedback-schema.js');
const { MemoryFeedbackStore } = await import('../../server/usage/feedback-store.js');
const { handle } = await import('../../server/usage/handler.js');
const { MemoryStore } = await import('../../server/usage/memory-store.js');

const DAY = 86_400_000, T0 = Date.UTC(2026, 10, 2, 12);
const base = (o = {}) => ({ fb: F.normalizeFb(null), endpoint: true, activeDays: 10, justFinished: true, now: T0, ...o });

test('endpoint: messages go next to the usage report, and nowhere without a collector', () => {
  assert.equal(F.feedbackEndpoint(''), '');
  assert.equal(F.feedbackEndpoint('https://c.example.workers.dev/v1/usage'), 'https://c.example.workers.dev/v1/feedback');
  assert.equal(F.feedbackEndpoint('http://c.example/v1/usage'), '');
  assert.equal(F.feedbackEndpoint('https://c.example/other'), '');
});

test('weeks: Monday to Sunday, the ISO week', () => {
  assert.equal(F.weekKey(Date.UTC(2026, 10, 2)), '2026-W45'); // a Monday
  assert.equal(F.weekKey(Date.UTC(2026, 10, 8, 23)), '2026-W45'); // the Sunday after
  assert.equal(F.weekKey(Date.UTC(2026, 10, 9)), '2026-W46');
  assert.equal(F.weekKey(Date.UTC(2026, 0, 1)), '2026-W01');
  assert.equal(F.weekKey(Date.UTC(2027, 0, 1)), '2026-W53');
});

test('silence: a question needs a collector, a week of use, a finished session, and never comes mid-session', () => {
  assert.equal(F.promptPlan(base()), 'pmf');
  assert.equal(F.promptPlan(base({ endpoint: false })), null, 'no collector, no question');
  assert.equal(F.promptPlan(base({ activeDays: 6 })), null, 'not in the first week');
  assert.equal(F.promptPlan(base({ justFinished: false })), null, 'only right after a session that went well');
  assert.equal(F.promptPlan(base({ midSession: true })), null, 'never during a session');
});

test('silence: one question in thirty days, the consent question counts, "Not now" is sixty days, "Don\'t ask" is for good', () => {
  const fb = (o) => ({ ...F.normalizeFb(null), ...o });
  assert.equal(F.promptPlan(base({ fb: fb({ lastAt: T0 - 29 * DAY }) })), null);
  assert.equal(F.promptPlan(base({ fb: fb({ lastAt: T0 - 31 * DAY }) })), 'pmf');
  assert.equal(F.promptPlan(base({ consentAt: T0 - 10 * DAY })), null, 'the question about anonymous numbers was asked 10 days ago');
  assert.equal(F.promptPlan(base({ consentAt: T0 - 40 * DAY })), 'pmf');
  assert.equal(F.promptPlan(base({ fb: fb({ lastAt: T0 - 31 * DAY, snoozeUntil: T0 + DAY }) })), null);
  assert.equal(F.promptPlan(base({ fb: fb({ never: true }) })), null);
});

test('silence: the question of fit once, then every ninety days; in between, a rating after a session', () => {
  const fb = (o) => ({ ...F.normalizeFb(null), ...o });
  assert.equal(F.promptPlan(base({ fb: fb({ pmfAt: T0 - 40 * DAY }) })), 'session');
  assert.equal(F.promptPlan(base({ fb: fb({ pmfAt: T0 - 91 * DAY }) })), 'pmf');
});

test('state: what a card does to the rules', async () => {
  mem = {};
  await F.fbShown(T0); assert.equal((await F.getFb()).lastAt, T0);
  await F.fbDismissed({}, T0); let s = await F.getFb(); assert.deepEqual([s.snoozeUntil, s.never], [T0 + 60 * DAY, false]);
  await F.fbDismissed({ never: true }, T0); assert.equal((await F.getFb()).never, true);
  mem = {}; await F.fbAnswered('pmf', T0); s = await F.getFb(); assert.deepEqual([s.pmfAt, s.lastAt, s.snoozeUntil], [T0, T0, null]);
  await F.fbAnswered('session', T0 + DAY); assert.equal((await F.getFb()).pmfAt, T0, 'a rating is not an answer to the question of fit');
  assert.equal(F.weekMoodDue(F.normalizeFb(null), true, 10, T0), true);
  await F.fbWeekDone(T0); assert.equal(F.weekMoodDue(await F.getFb(), true, 10, T0 + 2 * DAY), false, 'once a week');
  assert.equal(F.weekMoodDue(await F.getFb(), true, 10, T0 + 8 * DAY), true);
  assert.equal(F.weekMoodDue(F.normalizeFb(null), true, 3, T0), false); assert.equal(F.weekMoodDue(F.normalizeFb(null), false, 10, T0), false);
  assert.equal(F.weekMoodDue({ ...F.normalizeFb(null), never: true }, true, 10, T0), false);
  assert.deepEqual(F.normalizeFb('junk'), F.normalizeFb(null));
  assert.deepEqual(F.normalizeFb({ outbox: [{ t: 'bad', ts: 1 }, { t: newTicket(), ts: 5, kind: 'nope', text: 'x', answers: [{ id: 1, text: 'a' }, { id: 'x' }] }] }).outbox.map((x) => [x.kind, x.answers.length]), [['idea', 1]]);
});

test('message: the same checks as the collector, and context only as the person left it', async () => {
  const ctx = await F.feedbackContext(true, 20);
  assert.deepEqual(Object.keys(ctx).sort().includes('days') && ctx.days, 'd14_29');
  assert.deepEqual(await F.feedbackContext(false), { app: '3.8.1' }, 'without "Attach version and system" only the version goes');
  const ok = F.buildMessage({ kind: 'idea', text: '  Тёмная страница паузы  ', tags: ['blocking'], ticket: newTicket(), ctx });
  assert.equal(ok.ok, true); assert.equal(ok.msg.text, 'Тёмная страница паузы'); assert.equal(ok.msg.via, 'door');
  assert.equal(F.buildMessage({ kind: 'idea', text: 'a', ctx }).ok, false);
  assert.equal(F.buildMessage({ kind: 'session', rating: 9, ctx }).ok, false);
  assert.equal(F.buildMessage({ kind: 'session', rating: 3, tags: ['slow'], ctx }).ok, true);
  assert.equal(F.buildMessage({ kind: 'week', rating: 5, ctx }).msg.via, 'week_review');
  assert.equal(F.buildMessage({ kind: 'kudos', text: 'Спасибо!', contact: 'a@b.co', ctx }).ok, false, 'a kind word takes no address');
});

/** The collector in memory, behind a fetch with the extension's origin. */
const collector = () => {
  const fb = new MemoryFeedbackStore(), st = new MemoryStore(), calls = [];
  const fetchImpl = async (url, init) => { calls.push(url); const u = new URL(url); return handle(new Request('https://c.example' + u.pathname, { ...init, headers: { ...init.headers, origin: 'chrome-extension://abcdefghijklmnop' } }), st, Date.now(), { feedback: fb }); };
  return { fb, fetchImpl, calls };
};
const EP = 'https://c.example/v1/feedback';

test('sending: the ticket is kept here, the answer is asked for with it, and the message can be deleted again', async () => {
  mem = {}; const c = collector();
  const ticket = newTicket(), ctx = await F.feedbackContext(true, 20), built = F.buildMessage({ kind: 'problem', text: 'Пауза не закрывается', ticket, ctx });
  assert.deepEqual(await F.sendMessage(built.msg, { endpoint: '', fetchImpl: c.fetchImpl }), { ok: false, why: 'no collector' });
  assert.equal(c.calls.length, 0);
  assert.deepEqual(await F.sendMessage(built.msg, { endpoint: EP, fetchImpl: c.fetchImpl, now: T0 }), { ok: true });
  assert.equal((await F.getFb()).outbox[0].t, ticket); assert.equal((await c.fb.all()).length, 1);
  assert.equal(JSON.stringify(await c.fb.all()).includes(ticket), false, 'the collector holds the hash, not the ticket');
  // nothing to ask about with no ticket
  mem = {}; await F.sendMessage(F.buildMessage({ kind: 'kudos', text: 'Спасибо вам', ctx }).msg, { endpoint: EP, fetchImpl: c.fetchImpl }); assert.deepEqual((await F.getFb()).outbox, []);
  assert.equal(await F.pollAnswers({ endpoint: EP, fetchImpl: c.fetchImpl, now: T0 }), 0); assert.equal(c.calls.length, 2, 'no request for answers when there is nothing to ask about');
  // the author answers in the dashboard
  mem = {}; const c2 = collector();
  await F.sendMessage(built.msg, { endpoint: EP, fetchImpl: c2.fetchImpl, now: T0 });
  const id = (await c2.fb.all())[0].id; await c2.fb.addReply(id, 'Спасибо! Починим в 3.9.', T0 + DAY);
  assert.equal(await F.pollAnswers({ endpoint: EP, fetchImpl: c2.fetchImpl, now: T0 + 2 * DAY }), 1);
  let fb = await F.getFb(); const un = F.unreadAnswers(fb);
  assert.equal(un.length, 1); assert.equal(un[0].text, 'Спасибо! Починим в 3.9.'); assert.equal(un[0].message.text, 'Пауза не закрывается');
  assert.equal(await F.pollAnswers({ endpoint: EP, fetchImpl: c2.fetchImpl, now: T0 + 2 * DAY + 3600_000 }), 0, 'at most every six hours');
  assert.equal(await F.pollAnswers({ endpoint: EP, fetchImpl: c2.fetchImpl, now: T0 + 3 * DAY }), 0, 'and the same answer is not new twice');
  await F.markAnswersSeen([un[0].id]); fb = await F.getFb(); assert.equal(F.unreadAnswers(fb).length, 0); assert.equal(fb.outbox[0].answers.length, 1, 'it stays in the history');
  // an old message is not asked about any more
  assert.deepEqual(F.pollTickets(fb, T0 + 200 * DAY), []);
  // delete: on the collector and here; a failed deletion keeps the entry
  assert.equal(await F.deleteMessage(ticket, { endpoint: EP, fetchImpl: async () => { throw new Error('offline'); } }), false); assert.equal((await F.getFb()).outbox.length, 1);
  assert.equal(await F.deleteMessage(ticket, { endpoint: EP, fetchImpl: c2.fetchImpl }), true);
  assert.equal((await F.getFb()).outbox.length, 0); assert.equal((await c2.fb.all()).length, 0);
});

test('sending: a refusal or no network leaves nothing behind', async () => {
  mem = {}; const ctx = await F.feedbackContext(false), built = F.buildMessage({ kind: 'idea', text: 'Очень нужна идея', ticket: newTicket(), ctx });
  assert.deepEqual(await F.sendMessage(built.msg, { endpoint: EP, fetchImpl: async () => { throw new Error('offline'); } }), { ok: false, why: 'network' });
  assert.deepEqual(await F.sendMessage(built.msg, { endpoint: EP, fetchImpl: async () => ({ ok: false, status: 429 }) }), { ok: false, why: 'busy' });
  assert.deepEqual((await F.getFb()).outbox, []);
  assert.equal((await F.sendMessage({ v: 1, kind: 'idea' }, { endpoint: EP, fetchImpl: async () => ({ ok: true }) })).ok, false, 'a message the schema would not accept is not sent');
});
