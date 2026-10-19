import test from 'node:test';
import assert from 'node:assert/strict';
import { restFor, goalProgress, goalStreak, makeSessionEntry, addSession, rateSession, bestHours, dayReview, pauseReasonTotals, nudge, MAX_SESSIONS_PER_DAY } from '../../src/shared/productivity.js';

test('restFor: short break, long break every Nth session, off when 0', () => {
  const f = { breakMinutes: 5, longBreak: { every: 4, minutes: 15 } };
  assert.deepEqual(restFor(f, 1), { minutes: 5, long: false });
  assert.deepEqual(restFor(f, 4), { minutes: 15, long: true });
  assert.deepEqual(restFor(f, 8), { minutes: 15, long: true });
  assert.deepEqual(restFor({ ...f, breakMinutes: 0 }, 4), { minutes: 0, long: false });
  assert.deepEqual(restFor({ breakMinutes: 5 }, 4), { minutes: 5, long: false });
  assert.deepEqual(restFor({ ...f, longBreak: { every: 0, minutes: 15 } }, 4), { minutes: 5, long: false });
  assert.equal(restFor({ breakMinutes: 20, longBreak: { every: 2, minutes: 10 } }, 2).minutes, 20); // a long break is never shorter than a short one
});

test('goalProgress', () => {
  assert.deepEqual(goalProgress(3000, 120), { goalMin: 120, doneMin: 50, pct: 50 / 120, reached: false, leftMin: 70 });
  assert.equal(goalProgress(9000, 120).reached, true);
  assert.equal(goalProgress(9000, 120).pct, 1);
  assert.equal(goalProgress(500, 0).reached, false);
});

test('goalStreak: today in progress does not break it', () => {
  const day = (min) => ({ fs: min * 60 });
  const e = [['a', day(130)], ['b', day(125)], ['c', day(10)], ['d', day(120)], ['e', day(121)], ['f', day(20)]];
  assert.equal(goalStreak(e, 120), 2); // d, e — f (today) not there yet
  assert.equal(goalStreak([...e.slice(0, 5), ['f', day(130)]], 120), 3);
  assert.equal(goalStreak(e, 0), 0);
  assert.equal(goalStreak([['a', null]], 60), 0);
});

test('sessions: entries are de-duplicated, capped and can be rated', () => {
  const s = { id: '1', startedAt: 1000, minutes: 25, goal: 'x'.repeat(200), taskId: 't1' };
  const e = makeSessionEntry(s, { sec: 1500, completed: true });
  assert.equal(e.g.length, 80); assert.equal(e.m, 25); assert.equal(e.k, 't1'); assert.equal(e.c, 1);
  const day = {};
  addSession(day, e); addSession(day, e);
  assert.equal(day.ss.length, 1);
  assert.equal(rateSession(day, '1', 3), true); assert.equal(day.ss[0].r, 3);
  assert.equal(rateSession(day, '1', 9), true); assert.equal(day.ss[0].r, 3); // invalid rating ignored
  assert.equal(rateSession(day, 'nope', 2), false);
  for (let i = 0; i < MAX_SESSIONS_PER_DAY + 5; i++) addSession(day, { ...e, id: 'x' + i });
  assert.equal(day.ss.length, MAX_SESSIONS_PER_DAY);
  assert.equal(makeSessionEntry({ ...s, goal: '' }, { sec: 10, completed: false }).m, 1);
});

test('bestHours needs data, then finds the best two-hour window', () => {
  const at = (h) => new Date(2026, 0, 5, h, 10).getTime();
  const day = (list) => ['k', { ss: list.map(([h, m, r = 0], i) => ({ id: String(h) + i, t: at(h), m, c: 1, r })) }];
  assert.equal(bestHours([day([[9, 25]])]), null);
  const entries = [day([[9, 50, 3], [10, 25], [9, 25], [15, 25], [21, 25, 1], [9, 25]]), day([[9, 25], [10, 50]])];
  const b = bestHours(entries);
  assert.equal(b.start, 9); assert.equal(b.end, 11); assert.ok(b.share > 0.5);
  assert.equal(b.sessions, 8);
});

test('dayReview and pauseReasonTotals', () => {
  const day = { ss: [{ m: 25, c: 1, r: 3, g: 'Report' }, { m: 50, c: 1, r: 2, g: 'Report' }, { m: 10, c: 0, r: 0, g: 'Email' }] };
  const r = dayReview(day);
  assert.equal(r.sessions, 3); assert.equal(r.completed, 2); assert.equal(r.minutes, 85); assert.equal(r.avgRating, 2.5);
  assert.deepEqual(r.top[0], { goal: 'Report', minutes: 75 });
  assert.equal(dayReview(null).sessions, 0);
  assert.deepEqual(pauseReasonTotals([['a', { pr: { bored: 2, work: 1 } }], ['b', null], ['c', { pr: { bored: 1 } }]]), { bored: 3, work: 1 });
});

test('nudge picks one prompt by priority', () => {
  const at = (h) => new Date(2026, 0, 5, h, 0);
  assert.equal(nudge({ now: at(10), fsSec: 7200, goalMin: 120 }), 'goal');
  assert.equal(nudge({ now: at(19), fsSec: 600, goalMin: 120, sessionsToday: 1 }), 'review');
  assert.equal(nudge({ now: at(9), openTasks: 3, starred: 0 }), 'plan');
  assert.equal(nudge({ now: at(9), openTasks: 3, starred: 2 }), 'start');
  assert.equal(nudge({ now: at(9), openTasks: 0 }), 'start');
  assert.equal(nudge({ now: at(15), fsSec: 600, goalMin: 120, sessionsToday: 1 }), null);
  assert.equal(nudge({ now: at(23), fsSec: 0 }), null);
});

test('nextReminder: soonest upcoming slot, weekdays only, skips what has passed', async () => {
  const { nextReminder } = await import('../../src/shared/productivity.js');
  const rs = [{ id: 'a', time: '09:00', days: [1, 2, 3, 4, 5], minutes: 50 }, { id: 'b', time: '20:30', days: [0, 6], minutes: 25 }];
  const mon8 = new Date(2026, 9, 19, 8, 0); // Monday
  assert.equal(nextReminder(rs, mon8).reminder.id, 'a');
  assert.equal(new Date(nextReminder(rs, mon8).at).getHours(), 9);
  const mon10 = new Date(2026, 9, 19, 10, 0);
  assert.equal(new Date(nextReminder(rs, mon10).at).getDate(), 20); // tomorrow 09:00
  const fri10 = new Date(2026, 9, 23, 10, 0);
  const n = nextReminder(rs, fri10);
  assert.equal(n.reminder.id, 'b'); assert.equal(new Date(n.at).getDay(), 6); // Friday's slot passed, Saturday evening comes before Monday
  assert.equal(nextReminder([], mon8), null);
  assert.equal(nextReminder([{ id: 'x', time: 'bad', days: [1] }, { id: 'y', time: '09:00', days: [] }], mon8), null);
});
