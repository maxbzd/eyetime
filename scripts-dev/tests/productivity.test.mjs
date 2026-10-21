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
  const e = [['2026-10-13', day(130)], ['2026-10-14', day(125)], ['2026-10-15', day(10)], ['2026-10-16', day(120)], ['2026-10-17', day(121)], ['2026-10-18', day(20)]];
  assert.equal(goalStreak(e, 120), 2); // d, e — f (today) not there yet
  assert.equal(goalStreak([...e.slice(0, 5), ['2026-10-18', day(130)]], 120), 3);
  assert.equal(goalStreak(e, 0), 0);
  assert.equal(goalStreak([['2026-10-18', null]], 60), 0);
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

test('goalStreak: days off neither count nor break the streak', async () => {
  const { goalStreak } = await import('../../src/shared/productivity.js');
  const d = (min) => ({ fs: min * 60 });
  // Thu 2026-10-15, Fri 16, Sat 17, Sun 18, Mon 19 (today, goal days Mon–Fri)
  const e = [['2026-10-15', d(130)], ['2026-10-16', d(121)], ['2026-10-17', d(0)], ['2026-10-18', d(0)], ['2026-10-19', d(30)]];
  assert.equal(goalStreak(e, 120, [1, 2, 3, 4, 5]), 2);      // Sat/Sun skipped, today still in progress
  assert.equal(goalStreak(e, 120), 0);                         // with all days counting, the empty weekend broke it
  assert.equal(goalStreak([...e.slice(0, 4), ['2026-10-19', d(150)]], 120, [1, 2, 3, 4, 5]), 3);
});

test('suggestMinutes learns the best length from the user’s own ratings', async () => {
  const { suggestMinutes } = await import('../../src/shared/productivity.js');
  const day = (list) => ['k', { ss: list.map(([p, r], i) => ({ id: p + '-' + i + '-' + r + Math.random(), t: 1, m: p, p, c: 1, r })) }];
  assert.equal(suggestMinutes([day([[25, 2], [25, 2], [25, 3]])]), null);                               // only one length: nothing to compare
  const e = [day([[25, 2], [25, 1], [25, 2], [50, 3], [50, 3], [50, 2], [90, 1]])];
  const s = suggestMinutes(e);
  assert.equal(s.minutes, 50); assert.equal(s.lengths.length, 2);
  assert.equal(suggestMinutes([day([[25, 2], [25, 2], [25, 3], [50, 2], [50, 2], [50, 3]])]), null);   // no clear winner
});

test('planning: tomorrow’s picks become priorities, capped at three', async () => {
  const { planDay, applyPlans } = await import('../../src/shared/productivity.js');
  const tasks = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e', done: true }];
  const planned = planDay(tasks, ['a', 'b', 'c', 'd', 'e'], '2026-10-20');
  assert.deepEqual(planned.filter((x) => x.planFor).map((x) => x.id), ['a', 'b', 'c']);
  assert.equal(planDay(planned, ['d'], '2026-10-21').find((x) => x.id === 'a').planFor, undefined); // replaced
  const r = applyPlans(planned, '2026-10-20');
  assert.equal(r.changed, true); assert.deepEqual(r.tasks.filter((x) => x.starred).map((x) => x.id), ['a', 'b', 'c']);
  assert.ok(r.tasks.every((x) => !x.planFor));
  const stale = applyPlans(planned, '2026-10-22');                                                       // a plan for a past day is just dropped
  assert.ok(stale.tasks.every((x) => !x.starred && !x.planFor));
  const full = applyPlans([{ id: 'x', starred: true }, { id: 'y', starred: true }, { id: 'z', starred: true }, { id: 'w', planFor: '2026-10-20' }], '2026-10-20');
  assert.equal(full.tasks.find((x) => x.id === 'w').starred, undefined);                                 // never more than three
  assert.equal(applyPlans([{ id: 'q' }], '2026-10-20').changed, false);
});

test('nextTaskSlot, switchRate, topTemptations, recentWins, weekdayPattern', async () => {
  const m = await import('../../src/shared/productivity.js');
  const now = new Date(2026, 9, 19, 9, 0);
  const tasks = [{ id: 'a', at: '08:00', atDay: '2026-10-19' }, { id: 'b', at: '14:30', atDay: '2026-10-19' }, { id: 'c', at: '10:00', atDay: '2026-10-19' }, { id: 'd', at: '09:30', atDay: '2026-10-20' }, { id: 'e', at: '11:00', atDay: '2026-10-19', done: true }];
  assert.equal(m.nextTaskSlot(tasks, now).task.id, 'c');
  assert.equal(m.nextTaskSlot([], now), null);
  assert.equal(m.switchRate({ sw: 60, d: { a: 3600 } }), 60);
  assert.equal(m.switchRate({ sw: 5, d: { a: 100 } }), null);
  assert.deepEqual(m.topTemptations([['a', { pa: { 'x.com': 2, 'y.com': 5 } }], ['b', { pa: { 'x.com': 4 } }], ['c', null]], 2), [{ host: 'x.com', count: 6 }, { host: 'y.com', count: 5 }]);
  assert.deepEqual(m.recentWins([['a', { w: 'Shipped it' }], ['b', {}], ['c', { w: 'Walked' }]], 5), [{ key: 'c', text: 'Walked' }, { key: 'a', text: 'Shipped it' }]);
  const p = m.weekdayPattern([['2026-10-19', { fs: 7200 }], ['2026-10-26', { fs: 3600 }], ['2026-10-20', { fs: 0 }]], 120);
  assert.deepEqual(p[1], { days: 2, avgMin: 90, hitRate: 0.5 }); assert.equal(p[0].days, 0);
});

test('goalStreak with grace: one missed day in seven is forgiven, two within a week are not', () => {
  const day = (min) => ({ fs: min * 60 });
  const mk = (...mins) => mins.map((m, i) => [`2026-10-${String(11 + i).padStart(2, '0')}`, day(m)]);
  const all = [0, 1, 2, 3, 4, 5, 6];
  // 11..17: ok ok MISS ok ok ok (17 = today, in progress)
  const one = mk(130, 130, 5, 130, 130, 130, 10);
  assert.equal(goalStreak(one, 120, all), 3);                          // without grace the miss on the 13th ends it
  assert.equal(goalStreak(one, 120, all, { grace: true }), 5);         // with grace it is forgiven: 5 goal days
  // two misses six days apart: only the newer one is forgiven
  const two = mk(130, 5, 130, 130, 130, 130, 5, 130);
  assert.equal(goalStreak(two, 120, all, { grace: true }), 5);          // 18th ok, 17th missed (forgiven), 16..13 ok, 12th missed and too close -> stop
  // two misses a week apart: both forgiven
  const spaced = [['2026-10-04', day(130)], ['2026-10-05', day(5)], ...mk(130, 130, 130, 130, 130, 130, 5, 130).slice(0, 7), ['2026-10-18', day(130)]];
  assert.ok(goalStreak(spaced, 120, all, { grace: true }) > goalStreak(spaced, 120, all));
  assert.equal(goalStreak([], 120, all, { grace: true }), 0);
});
