// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The numbers of Insights, at their edges. Found by mutation testing (stats.js: only 49 % of changes to the code were noticed by a test): every threshold, every sum,
// every sort order below is a statement the screens rely on.
import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, insights, delta, focusStreak, heatLevel, suggestLimit, slimDay, emptyDay, sum } from '../../src/shared/stats.js';

const cls = (h) => (h.startsWith('work') ? 'productive' : h.startsWith('time') ? 'distracting' : 'neutral');
const day = (o = {}) => ({ ...emptyDay(), ...o });
const rows = (days) => days.map((d, i) => [`2026-11-${String(i + 1).padStart(2, '0')}`, d]);

test('summarize: sites, apps, hours, focus and breaks add up, and a missing day is a day with nothing', () => {
  const s = summarize(rows([
    day({ d: { 'work.com': 600, 'time.com': 300, 'misc.com': 100 }, a: { Code: 500 }, h: { 9: { 'work.com': 400, 'time.com': 100, '?': 50 }, 10: { 'work.com': 200 } }, fs: 1500, fc: 1, b: 2 }),
    null,
    day({ d: { 'work.com': 60, 'time.com': 40 }, a: { Code: 100, Slack: 20 }, h: { 99: { 'work.com': 9 } }, fs: 300, fc: 2, b: 1 }),
  ]), cls);
  assert.equal(s.productive, 660); assert.equal(s.distracting, 340); assert.equal(s.neutral, 100 + 500 + 100 + 20, 'sites of no class and every desktop app are neutral');
  assert.equal(s.total, 660 + 340 + 100 + 620);
  assert.equal(s.focusSec, 1800); assert.equal(s.focusSessions, 3); assert.equal(s.breaks, 3);
  assert.equal(s.activeDays, 2, 'the day without a record is not an active day');
  assert.deepEqual(s.days.map((d) => d.total), [1500, 0, 220]);
  assert.equal(s.hourly[9].productive, 400); assert.equal(s.hourly[9].distracting, 100); assert.equal(s.hourly[9].neutral, 50, 'a stay on an unknown host is neutral');
  assert.equal(s.hourly[10].productive, 200);
  assert.equal(s.hourly.reduce((a, h) => a + h.productive, 0), 600, 'hour 99 is not an hour: dropped, not counted');
  assert.deepEqual(s.topSites.map((x) => [x.host, x.sec]), [['work.com', 660], ['time.com', 340], ['misc.com', 100]], 'biggest first');
  assert.deepEqual(s.topApps, [{ name: 'Code', sec: 600 }, { name: 'Slack', sec: 20 }]);
  assert.equal(s.days[1].key, '2026-11-02'); assert.equal(s.days[0].focusSec, 1500); assert.equal(s.days[2].focusSessions, 2);
});

test('summarize: a day without a record, or with nothing in it, leaves everything at zero and is not "active"', () => {
  const s = summarize(rows([null, day()]), cls);
  assert.equal(s.total, 0); assert.equal(s.activeDays, 0); assert.deepEqual(s.topSites, []); assert.deepEqual(s.topApps, []); assert.equal(s.days.length, 2);
  assert.equal(summarize(rows([day({ d: { 'work.com': 1 } })]), cls).activeDays, 1, 'one second is a day of use');
});

test('delta: a change in percent, nothing to compare with under a minute before', () => {
  assert.equal(delta(150, 100), 50); assert.equal(delta(50, 100), -50); assert.equal(delta(100, 100), 0);
  assert.equal(delta(10, 59), null); assert.equal(delta(10, 60), -83); assert.equal(delta(10, 0), null); assert.equal(delta(10, null), null);
});

test('slimDay drops the hours and keeps everything else; a day with no hours is returned as it is', () => {
  const d = day({ d: { 'a.com': 5 }, h: { 9: { 'a.com': 5 } }, fs: 7 });
  const slim = slimDay(d);
  assert.equal('h' in slim, false); assert.deepEqual(slim.d, { 'a.com': 5 }); assert.equal(slim.fs, 7);
  const none = day({ h: {} }); assert.equal(slimDay(none), none); assert.equal(slimDay(null), null);
});

test('focusStreak: days in a row with a finished session, today may still be empty, a gap ends it', () => {
  const e = (fcs) => fcs.map((fc, i) => [`d${i}`, fc === null ? null : day({ fc })]);
  assert.equal(focusStreak(e([1, 1, 1])), 3);
  assert.equal(focusStreak(e([1, 1, 0])), 2, 'today is empty so far: the streak is still alive');
  assert.equal(focusStreak(e([1, 0, 1])), 1, 'yesterday is empty: the streak is one');
  assert.equal(focusStreak(e([0, 0, 0])), 0); assert.equal(focusStreak(e([1, null, 1])), 1); assert.equal(focusStreak([]), 0);
});

test('heatLevel: five levels relative to the busiest day, with the edges belonging to the lower level', () => {
  assert.deepEqual([0, 1, 25, 26, 50, 51, 75, 76, 100].map((s) => heatLevel(s, 100)), [0, 1, 1, 2, 2, 3, 3, 4, 4]);
  assert.equal(heatLevel(5, 0), 0); assert.equal(heatLevel(undefined, 100), 0);
});

test('suggestLimit: the heaviest distraction that is big enough and has no limit yet, at about 60 % of its daily average', () => {
  const sm = (sites, activeDays = 5) => ({ activeDays, topSites: sites });
  const site = (host, min, cls = 'distracting') => ({ host, cls, sec: min * 60 });
  assert.deepEqual(suggestLimit(sm([site('time.com', 100)]), {}), { host: 'time.com', avgMin: 20, limitMin: 10 });
  assert.equal(suggestLimit(sm([site('time.com', 70)]), {}), null, '14 minutes a day: small enough, nothing to suggest');
  assert.notEqual(suggestLimit(sm([site('time.com', 75)]), {}), null, 'exactly 15 a day is worth a suggestion');
  assert.equal(suggestLimit(sm([site('time.com', 500)]), {}).limitMin, 60, 'about 60 % of 100 minutes, in steps of five');
  assert.equal(suggestLimit(sm([site('a.com', 100, 'neutral')]), {}), null, 'only distractions');
  assert.deepEqual(suggestLimit(sm([site('time.com', 100), site('more.com', 90)]), { 'time.com': 20 }).host, 'more.com', 'a site that has a limit is skipped for the next one');
  assert.deepEqual(suggestLimit(sm([site('www.time.com', 100)]), { 'time.com': 20 }), null, 'and so is its subdomain');
  assert.notEqual(suggestLimit(sm([site('xtime.com', 100)]), { 'time.com': 20 }), null, 'but a different site that ends in the same letters is not');
  assert.equal(suggestLimit(sm([]), {}), null);
  assert.equal(suggestLimit(sm([site('time.com', 100)], 0), {}).avgMin, 100, 'no active days is one, not a division by zero');
  assert.equal(sum({ a: 1, b: 2 }), 3); assert.equal(sum(null), 0);
});

const base = (o = {}) => ({ total: 7200, productive: 3600, neutral: 2400, distracting: 1200, focusSec: 0, focusSessions: 0, activeDays: 5, topSites: [], hourly: Array.from({ length: 24 }, () => ({ productive: 0, neutral: 0, distracting: 0 })), days: [], ...o });
const ids = (r) => r.map((x) => x.id);

test('insights: nothing is said about under ten minutes of data', () => {
  assert.deepEqual(insights(base({ total: 599, distracting: 599 }), null), []);
  assert.ok(ids(insights(base({ total: 600, distracting: 600 }), null)).includes('distractionShare'));
});

test('insights: the worst day needs ten minutes of distraction and three active days; the best day needs half an hour and is not the worst', () => {
  const days = [{ key: '2026-11-02', total: 3600, distracting: 1800 }, { key: '2026-11-03', total: 3600, distracting: 100 }, { key: '2026-11-04', total: 1700, distracting: 0 }];
  const r = insights(base({ days, activeDays: 3 }), null);
  const worst = r.find((x) => x.id === 'worstDay'), best = r.find((x) => x.id === 'bestDay');
  assert.equal(worst.params.key, '2026-11-02'); assert.equal(worst.params.sec, 1800); assert.equal(worst.params.weekday, 1);
  assert.equal(best.params.key, '2026-11-03'); assert.equal(best.params.pct, 3, 'the 1 700 s day is under half an hour and cannot be the best');
  assert.equal(ids(insights(base({ days, activeDays: 2 }), null)).includes('worstDay'), false, 'two days are not a pattern');
  const small = [{ key: '2026-11-02', total: 3600, distracting: 599 }, { key: '2026-11-03', total: 3600, distracting: 700 }];
  assert.equal(ids(insights(base({ days: [{ ...small[0], distracting: 599 }], activeDays: 3 }), null)).includes('worstDay'), false, 'under ten minutes is not a bad day');
  assert.equal(insights(base({ days: [{ key: '2026-11-02', total: 3600, distracting: 3000 }], activeDays: 3 }), null).some((x) => x.id === 'bestDay'), false, 'the only day cannot be both the worst and the best');
});

test('insights: the best hour needs a quarter of an hour of productive time and three active days', () => {
  const hourly = (hr, sec) => base().hourly.map((h, i) => (i === hr ? { ...h, productive: sec } : h));
  assert.equal(insights(base({ hourly: hourly(10, 900) }), null).find((x) => x.id === 'peakHour').params.hour, 10);
  assert.equal(ids(insights(base({ hourly: hourly(10, 899) }), null)).includes('peakHour'), false);
  assert.equal(ids(insights(base({ hourly: hourly(10, 900), activeDays: 2 }), null)).includes('peakHour'), false);
});

test('insights: late nights: half an hour between 23:00 and 05:00 and more than 8 % of all', () => {
  const hourly = (hr, sec) => base().hourly.map((h, i) => (i === hr ? { ...h, productive: sec } : h));
  assert.equal(insights(base({ total: 7200, hourly: hourly(23, 1800) }), null).find((x) => x.id === 'lateNight').params.sec, 1800);
  assert.equal(insights(base({ total: 7200, hourly: hourly(4, 1800) }), null).some((x) => x.id === 'lateNight'), true, 'four in the morning is still the night');
  assert.equal(insights(base({ total: 7200, hourly: hourly(5, 1800) }), null).some((x) => x.id === 'lateNight'), false, 'five is not');
  assert.equal(insights(base({ total: 7200, hourly: hourly(22, 1800) }), null).some((x) => x.id === 'lateNight'), false, 'ten in the evening is not');
  assert.equal(insights(base({ total: 7200, hourly: hourly(2, 1799) }), null).some((x) => x.id === 'lateNight'), false);
  assert.equal(insights(base({ total: 22500, hourly: hourly(2, 1800) }), null).some((x) => x.id === 'lateNight'), false, '8 % of the time, exactly: not more than');
});

test('insights: the share of distraction and its change from the period before; the top distraction; the focus total; at most four lines', () => {
  const cur = base({ total: 10000, distracting: 3333, topSites: [{ host: 'time.com', cls: 'distracting', sec: 900 }], focusSessions: 2, focusSec: 3000 });
  const r = insights(cur, { distracting: 1000 });
  assert.deepEqual(r.find((x) => x.id === 'distractionShare').params, { pct: 33, delta: 233 });
  assert.deepEqual(r.find((x) => x.id === 'distractionShare' && true).params.pct, 33);
  assert.deepEqual(insights(cur, null).find((x) => x.id === 'distractionShare').params.delta, null);
  assert.deepEqual(r.find((x) => x.id === 'topDistraction').params, { host: 'time.com', sec: 900 });
  assert.equal(ids(insights(base({ ...cur, topSites: [{ host: 'time.com', cls: 'distracting', sec: 899 }] }), null)).includes('topDistraction'), false);
  assert.equal(ids(insights(base({ ...cur, topSites: [{ host: 'work.com', cls: 'productive', sec: 5000 }] }), null)).includes('topDistraction'), false, 'only a distraction counts');
  assert.deepEqual(r.find((x) => x.id === 'focusTotal').params, { sessions: 2, sec: 3000 });
  assert.equal(ids(insights(base({ ...cur, focusSessions: 1 }), null)).includes('focusTotal'), false, 'one session is not a total');
  assert.equal(ids(insights(base({ ...cur, distracting: 599, topSites: [] }), null)).includes('distractionShare'), false, 'under ten minutes of distraction says nothing');
  const days = [{ key: '2026-11-02', total: 3600, distracting: 1800 }, { key: '2026-11-03', total: 3600, distracting: 100 }, { key: '2026-11-04', total: 3600, distracting: 200 }];
  const hourly = base().hourly.map((h, i) => (i === 10 ? { ...h, productive: 2000 } : i === 2 ? { ...h, productive: 3000 } : h));
  assert.equal(insights(base({ ...cur, days, hourly, activeDays: 3 }), { distracting: 1000 }).length, 4, 'no more than four, whatever else is true');
});
