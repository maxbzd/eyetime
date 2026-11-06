// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The numbers behind the dashboard: plain functions from what the collector holds (a "snapshot": installs, first uses, weekly counters, switched-on flags) to one JSON object.
// No storage, no clock of its own (the time is an argument), so the same code answers in the Worker, in a test and in the demo.
//
// Every figure is a pair { k, n } (k of n installs) or a count, never a rounded-off guess: the page shows both, and greys out what rests on few installs.
// What a figure means is written next to it below, and in docs/MEASUREMENT.md; read the numbers as the behaviour of people who agreed to share (not a census).

import { FEATURES, FLAGS } from '../../src/shared/usage-schema.js';

const DAY = 86_400_000;

/** The features that are real actions of a person (the others are measurements of how things went; they have their own blocks). */
export const GROUPS = {
  focus: ['focus_start', 'focus_done', 'focus_stop', 'focus_pause'],
  blocking: ['block_page', 'block_continue'],
  eyes: ['eye_break_done', 'eye_break_skip'],
  planning: ['task_add', 'task_done', 'habit_check', 'shutdown_done', 'plan_done', 'ritual_plan', 'ritual_skip', 'connection_add'],
  home: ['newtab_view', 'popup_open', 'insights_view', 'settings_view', 'palette_open', 'drawer_open', 'editor_open', 'starter_apply', 'wall_next', 'standby_open'],
};
export const ADOPTION = Object.values(GROUPS).flat();
/** What a view can be narrowed to: the fields of an install that are a choice or a fact about the setup. */
export const DIMS = ['app', 'br', 'os', 'lang', 'look', 'layout', 'mode'];
const LENGTHS = ['fl_u15', 'fl_u25', 'fl_u35', 'fl_u50', 'fl_u75', 'fl_75p'];
const REASONS = ['bp_always', 'bp_focus', 'bp_schedule', 'bp_limit', 'bp_budget', 'bp_friction'];
const SPEEDS = ['nt_u100', 'nt_u250', 'nt_u500', 'nt_u1000', 'nt_slow'];
/** The upper bound of the slowest bucket: a number (JSON has no Infinity), read as "no bound". */
export const OPEN_END = 100_000;
const SPEED_UPPER = [100, 250, 500, 1000, OPEN_END];
const ERRORS = ['err_worker', 'err_page', 'err_blocker', 'err_sync', 'err_other'];

/** The size of a sample below which a figure is shown as unreliable (the dashboard greys it out); docs/MEASUREMENT.md says "fewer than 50". */
export const LOW_SAMPLE = 50;

const pair = (/** @type {number} */ k, /** @type {number} */ n) => ({ k, n, pct: n > 0 ? k / n : null });
const median = (/** @type {number[]} */ a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const countBy = (/** @type {any[]} */ list, /** @type {(x: any) => string} */ f) => { const m = new Map(); for (const x of list) { const v = f(x); m.set(v, (m.get(v) || 0) + 1); } return [...m].map(([value, k]) => ({ value, k })).sort((a, b) => b.k - a.k || (a.value < b.value ? -1 : 1)); };
const isoDay = (/** @type {number} */ dayNumber) => new Date(dayNumber * DAY).toISOString().slice(0, 10);
const semver = (/** @type {string} */ v) => v.split('.').map((x) => parseInt(x, 10) || 0);
const newer = (/** @type {string} */ a, /** @type {string} */ b) => { const x = semver(a), y = semver(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0; } return false; };

/**
 * @typedef {{ installs: any[], firsts: { id: string, feature: string, age: number }[], weeks: { id: string, week: number, feature: string, n: number }[], flags: { id: string, flag: string }[] }} Snapshot
 * The period: `from`/`to` are day numbers (days since 1970-01-01, UTC), or `all` for everything since the first install, or `recentDays` counted back from `to` (default: 90 days up to today; 90 so that the 30-day return of the people who came in the period can be seen).
 * What the period scopes: who counts as active, the weekly counters (rounded outward to whole weeks, they are stored by week), the installs made in it (the funnel, activation and
 * retention follow those people for as long as they have been around), and the comparison with the period of the same length right before it.
 * @param {Snapshot} snap @param {number} now ms @param {{ recentDays?: number, from?: number, to?: number, all?: boolean, compare?: boolean, filter?: Record<string, string> }} [opts]
 * `filter` narrows everything to the installs with those values ({ br: 'chrome', lang: 'ru' }); `facets` always lists what there is to choose from, counted over all installs.
 */
export function computeStats(snap, now = Date.now(), { recentDays = 90, from: fromOpt, to: toOpt, all = false, compare = true, filter = {} } = {}) {
  const today = Math.floor(now / DAY);
  const facets = Object.fromEntries(DIMS.map((d) => [d, countBy(snap.installs, (i) => i[d])]));
  const narrow = DIMS.filter((d) => filter[d]);
  if (narrow.length) {
    const keep = new Set(snap.installs.filter((i) => narrow.every((d) => i[d] === filter[d])).map((i) => i.id));
    snap = { installs: snap.installs.filter((i) => keep.has(i.id)), firsts: snap.firsts.filter((x) => keep.has(x.id)), weeks: snap.weeks.filter((x) => keep.has(x.id)), flags: snap.flags.filter((x) => keep.has(x.id)) };
  }
  const installs = snap.installs.map((i) => {
    const lastDay = Math.floor(i.last_report / DAY);
    return { ...i, act: [...i.act].sort((a, b) => a - b), lastDay, day0: lastDay - i.age };
  });
  const firstDay = installs.length ? Math.min(...installs.map((i) => i.day0)) : today;
  const to = Math.min(toOpt ?? today, today);
  const from = Math.min(to, all ? firstDay : (fromOpt ?? to - recentDays + 1));
  const days = to - from + 1;
  const weekFrom = Math.floor(from / 7), weekTo = Math.floor(to / 7);
  const firsts = new Map(); // id → { feature → age of the first use }
  for (const f of snap.firsts) { if (!firsts.has(f.id)) firsts.set(f.id, {}); firsts.get(f.id)[f.feature] = f.age; }
  /** Seen in the period: a day of activity in it, or the last report in it. (To the end of today this is the same as "reported since `from`".) */
  const inPeriod = (/** @type {any} */ i) => i.day0 <= to && (i.lastDay >= from && i.lastDay <= to || i.act.some((/** @type {number} */ a) => i.day0 + a >= from && i.day0 + a <= to));
  const recent = installs.filter(inPeriod);
  const made = installs.filter((i) => i.day0 >= from && i.day0 <= to); // the installs of the period: their path is what the funnel, activation and retention show
  const recentIds = new Set(recent.map((i) => i.id));
  // counters of the last four weekly buckets, per install and in total
  const perInstall = new Map(); const total = Object.fromEntries(FEATURES.map((f) => [f, 0]));
  for (const w of snap.weeks) {
    if (w.week < weekFrom || w.week > weekTo || !recentIds.has(w.id)) continue;
    total[w.feature] = (total[w.feature] || 0) + w.n;
    if (!perInstall.has(w.id)) perInstall.set(w.id, {});
    perInstall.get(w.id)[w.feature] = (perInstall.get(w.id)[w.feature] || 0) + w.n;
  }
  const flagsOf = new Map(); for (const f of snap.flags) { if (!flagsOf.has(f.id)) flagsOf.set(f.id, new Set()); flagsOf.get(f.id).add(f.flag); }
  // An install whose window has been observed: it was made at least `end + 7` days ago, so the window is over and a week more (for the weekly report to arrive) has passed.
  // The rule looks only at the calendar, never at whether the install kept reporting: an install that left (uninstalled, or stopped for good) is counted as NOT retained instead of
  // vanishing from the denominator, and an install that has not yet had time to report is not counted as lost. Either mistake would flatter or sink every retention figure.
  const mature = (/** @type {any} */ i, /** @type {number} */ end) => today - i.day0 >= end + 7;
  const hasAct = (/** @type {any} */ i, /** @type {number} */ lo, /** @type {number} */ hi) => i.act.some((/** @type {number} */ a) => a >= lo && a <= hi);

  // ---- overview ----
  const overview = {
    installs: installs.filter((i) => i.day0 <= to).length, recent: recent.length, new_in_range: made.length,
    new_7d: installs.filter((i) => i.first_report >= now - 7 * DAY).length,
    first_day: installs.length ? isoDay(firstDay) : null,
    asOf: installs.length ? isoDay(Math.max(...installs.map((i) => i.lastDay))) : null,
    versions: countBy(recent, (i) => i.app),
  };
  const range = { from: isoDay(from), to: isoDay(to), days, all, weeks_from: isoDay(weekFrom * 7), weeks_to: isoDay(weekTo * 7 + 6) };

  // ---- weekly active installs: 12 weeks ending at the end of the period, more for a long period, at most 26 (a window of seven days ending on a day; one that is still open is "partial") ----
  const trend = Math.max(12, Math.min(26, Math.ceil(days / 7)));
  const weekly = [];
  for (let w = trend - 1; w >= 0; w--) {
    const end = to - 7 * w, start = end - 6;
    const here = installs.filter((i) => i.day0 <= end);
    const active = here.filter((i) => i.act.some((a) => { const d = i.day0 + a; return d >= start && d <= end; }));
    weekly.push({ from: isoDay(start), to: isoDay(end), active: active.length, installed: here.length, partial: end >= today - 7 });
  }

  // ---- activation and the funnel ----
  const first = (/** @type {any} */ i, /** @type {string} */ f) => firsts.get(i.id)?.[f];
  const mature7 = made.filter((i) => mature(i, 7));
  const activation = {
    newtab_day1: pair(made.filter((i) => first(i, 'newtab_view') <= 0).length, made.length),
    session_day1: pair(made.filter((i) => first(i, 'focus_start') <= 0).length, made.length),
    session_week1: pair(mature7.filter((i) => first(i, 'focus_start') <= 7).length, mature7.length),
    finished_week1: pair(mature7.filter((i) => first(i, 'focus_done') <= 7).length, mature7.length),
    // only installs made with the version that counts it have it: the share is among installs that send the setup (version 2 of the report), so read it as a floor
    onboarding_done: pair(made.filter((i) => first(i, 'onboarding_done') !== undefined).length, made.filter((i) => flagsOf.has(i.id)).length),
    median_days_to_first_session: median(made.map((i) => first(i, 'focus_start')).filter((a) => a !== undefined)),
  };
  const funnel = [
    { id: 'reported', n: made.length },
    { id: 'newtab', n: made.filter((i) => first(i, 'newtab_view') !== undefined).length },
    { id: 'started', n: made.filter((i) => first(i, 'focus_start') !== undefined).length },
    { id: 'finished', n: made.filter((i) => first(i, 'focus_done') !== undefined).length },
    { id: 'days3', n: made.filter((i) => i.act.length >= 3).length },
    { id: 'days7', n: made.filter((i) => i.act.length >= 7).length },
  ];

  // ---- retention: D1, D7, D30 (an install counts only once its window has been observed), and the cohorts by week of install ----
  const D1 = made.filter((i) => mature(i, 1)), D7 = made.filter((i) => mature(i, 13)), D30 = made.filter((i) => mature(i, 36));
  const retention = {
    d1: pair(D1.filter((i) => i.act.includes(1)).length, D1.length),
    d7: pair(D7.filter((i) => hasAct(i, 7, 13)).length, D7.length),
    d30: pair(D30.filter((i) => hasAct(i, 30, 36)).length, D30.length),
  };
  const byCohort = new Map(); for (const i of installs.filter((x) => x.day0 <= to)) { const c = Math.floor(i.day0 / 7); if (!byCohort.has(c)) byCohort.set(c, []); byCohort.get(c).push(i); }
  const cohorts = [...byCohort].sort((a, b) => b[0] - a[0]).slice(0, trend).map(([c, list]) => ({
    from: isoDay(c * 7), n: list.length,
    weeks: Array.from({ length: 9 }, (_, w) => { const seen = list.filter((i) => mature(i, 7 * w + 6)); return pair(seen.filter((i) => hasAct(i, 7 * w, 7 * w + 6)).length, seen.length); }),
  })).reverse();

  // ---- the features ----
  const usersOf = (/** @type {string} */ f) => recent.filter((i) => (perInstall.get(i.id)?.[f] || 0) > 0);
  const features = ADOPTION.map((f) => {
    const users = usersOf(f);
    const ever = installs.filter((i) => i.day0 <= to && first(i, f) !== undefined);
    return {
      id: f, group: Object.keys(GROUPS).find((g) => GROUPS[/** @type {keyof typeof GROUPS} */ (g)].includes(f)),
      users: pair(users.length, recent.length), uses: total[f] || 0,
      per_user: median(users.map((i) => perInstall.get(i.id)[f])),
      ever: pair(ever.length, overview.installs), median_days_to_first: median(ever.map((i) => first(i, f))),
      cut_candidate: recent.length >= LOW_SAMPLE && users.length / recent.length < 0.05,
    };
  }).sort((a, b) => (b.users.pct ?? 0) - (a.users.pct ?? 0));

  // ---- how things go ----
  const sum = (/** @type {string[]} */ ids) => ids.reduce((a, f) => a + (total[f] || 0), 0);
  const sessions = {
    started: total.focus_start || 0, finished: total.focus_done || 0, stopped: total.focus_stop || 0, early_stop: total.fl_early_stop || 0,
    finish_rate: total.focus_start ? Math.min(1, (total.focus_done || 0) / total.focus_start) : null,
    early_stop_rate: total.focus_start ? Math.min(1, (total.fl_early_stop || 0) / total.focus_start) : null,
    length: LENGTHS.map((id) => ({ id, k: total[id] || 0 })),
  };
  const blocking = {
    pages: total.block_page || 0, continued: total.block_continue || 0,
    continue_rate: total.block_page ? Math.min(1, (total.block_continue || 0) / total.block_page) : null,
    reasons: REASONS.map((id) => ({ id, k: total[id] || 0 })),
  };
  const eyes = { done: total.eye_break_done || 0, skipped: total.eye_break_skip || 0, rate: (total.eye_break_done || 0) + (total.eye_break_skip || 0) ? (total.eye_break_done || 0) / ((total.eye_break_done || 0) + (total.eye_break_skip || 0)) : null };
  const speedTotal = sum(SPEEDS);
  const quantile = (/** @type {number} */ q) => { if (!speedTotal) return null; let acc = 0; for (let i = 0; i < SPEEDS.length; i++) { acc += total[SPEEDS[i]] || 0; if (acc / speedTotal >= q) return SPEED_UPPER[i]; } return OPEN_END; };
  const speed = {
    opens: speedTotal, hist: SPEEDS.map((id, i) => ({ id, upper: SPEED_UPPER[i], k: total[id] || 0 })),
    under250: speedTotal ? ((total.nt_u100 || 0) + (total.nt_u250 || 0)) / speedTotal : null,
    p50_upper: quantile(0.5), p90_upper: quantile(0.9),
  };
  const withError = recent.filter((i) => ERRORS.some((e) => (perInstall.get(i.id)?.[e] || 0) > 0)).length;
  const health = {
    by_place: ERRORS.map((id) => ({ id, k: total[id] || 0, per_1000: recent.length ? (1000 * (total[id] || 0)) / recent.length : null })),
    installs_with_error: pair(withError, recent.length),
  };

  // ---- what people choose, and what they keep switched on ----
  const withFlags = recent.filter((i) => flagsOf.has(i.id));
  const setup = {
    look: countBy(recent, (i) => i.look), layout: countBy(recent, (i) => i.layout), lang: countBy(recent, (i) => i.lang), mode: countBy(recent, (i) => i.mode),
    browser: countBy(recent, (i) => i.br), os: countBy(recent, (i) => i.os),
    flags: { of: withFlags.length, items: FLAGS.map((f) => ({ id: f, k: withFlags.filter((i) => flagsOf.get(i.id).has(f)).length })) },
  };


  // ---- depth: the new things of the second version of the dashboard ----
  const inWeek = (/** @type {any} */ i, /** @type {number} */ lo, /** @type {number} */ hi) => i.act.some((/** @type {number} */ a) => i.day0 + a >= lo && i.day0 + a <= hi);

  // Who came, who stayed, who came back, who left, week by week (an install is "new" in the week it was made; "retained" if it was active the week before too; "resurrected" if it
  // had gone quiet and is back; "churned" if it was active the week before and is not now). The quick ratio is (new + resurrected) / churned: above 1 the base grows.
  const lifecycle = [];
  for (let w = trend - 1; w >= 0; w--) {
    const end = to - 7 * w, start = end - 6;
    let nw = 0, ret = 0, res = 0, ch = 0;
    for (const i of installs) {
      if (i.day0 > end) continue;
      const a = inWeek(i, start, end), p = i.day0 < start && inWeek(i, start - 7, start - 1);
      if (a) { if (i.day0 >= start) nw++; else if (p) ret++; else res++; } else if (p) ch++;
    }
    lifecycle.push({ from: isoDay(start), to: isoDay(end), new: nw, retained: ret, resurrected: res, churned: ch, quick_ratio: ch ? (nw + res) / ch : null, partial: end >= today - 7 });
  }

  // Engagement over 28 days that have been fully reported (the last week is still arriving): how many days a person was active, DAU / MAU, and the types of use.
  const wEnd = to - 7, wStart = wEnd - 27;
  const daysIn = new Map(); const dauDays = new Array(35).fill(0);
  for (const i of installs) {
    let n = 0;
    for (const a of i.act) { const d = i.day0 + a; if (d >= wStart && d <= wEnd) n++; const k = d - (to - 34); if (k >= 0 && k < 35) dauDays[k]++; }
    if (n) daysIn.set(i.id, n);
  }
  const mauUsers = [...daysIn.values()], MAU = mauUsers.length, sumDays = mauUsers.reduce((a, b) => a + b, 0);
  const bucket = (/** @type {number} */ n) => (n >= 15 ? 'd15' : n >= 8 ? 'd8' : n >= 4 ? 'd4' : n >= 2 ? 'd2' : 'd1');
  const engagement = {
    window: { from: isoDay(wStart), to: isoDay(wEnd) }, mau: MAU,
    dau_mau: MAU ? sumDays / (28 * MAU) : null, avg_active_days: MAU ? sumDays / MAU : null,
    depth: ['d1', 'd2', 'd4', 'd8', 'd15'].map((id) => ({ id, k: mauUsers.filter((n) => bucket(n) === id).length })),
    dau: dauDays.map((n, k) => ({ day: isoDay(to - 34 + k), active: n, partial: k >= 28 })),
  };

  // The weekly counters, week by week, for every feature: the uses, how many installs used it, and how many were active that week.
  const tWeeks = []; for (let w = weekTo - trend + 1; w <= weekTo; w++) tWeeks.push(w);
  const tIndex = new Map(tWeeks.map((w, k) => [w, k]));
  const tUses = Object.fromEntries(FEATURES.map((f) => [f, new Array(tWeeks.length).fill(0)])), tUsers = Object.fromEntries(FEATURES.map((f) => [f, new Array(tWeeks.length).fill(0)]));
  for (const x of snap.weeks) { const k = tIndex.get(x.week); if (k === undefined || !tUses[x.feature]) continue; tUses[x.feature][k] += x.n; if (x.n > 0) tUsers[x.feature][k]++; }
  const trends = {
    weeks: tWeeks.map((w) => ({ from: isoDay(w * 7), to: isoDay(w * 7 + 6), partial: w * 7 + 6 >= today - 7 })),
    active: tWeeks.map((w) => installs.filter((i) => i.day0 <= w * 7 + 6 && inWeek(i, w * 7, w * 7 + 6)).length),
    uses: tUses, users: tUsers,
  };

  // What the people who stayed did in their first week and the people who left did not (the first-week habit): among installs old enough for the second week to be seen,
  // the share active in days 7-13 among those who used a feature in their first week and among those who did not. A correlation, not a proof: it says where to look.
  const ahaPool = made.filter((i) => mature(i, 13)), back = (/** @type {any} */ i) => hasAct(i, 7, 13);
  const aha = ADOPTION.filter((f) => f !== 'newtab_view').map((f) => {
    const did = ahaPool.filter((i) => first(i, f) <= 7), not = ahaPool.filter((i) => !(first(i, f) <= 7));
    const a = pair(did.filter(back).length, did.length), b = pair(not.filter(back).length, not.length);
    return { id: f, did: a, not: b, lift: a.pct != null && b.pct != null ? a.pct - b.pct : null, reliable: did.length >= 30 && not.length >= 30 };
  }).filter((x) => x.did.n > 0).sort((a, b) => Number(b.reliable) - Number(a.reliable) || (b.lift ?? -9) - (a.lift ?? -9)); // findings first, then the groups too small to say
  const firstSession = ['d0', 'd1', 'd2_3', 'd4_7', 'later', 'never'].map((id) => ({ id, k: mature7.filter((i) => { const a = first(i, 'focus_start'); return id === 'd0' ? a <= 0 : id === 'd1' ? a === 1 : id === 'd2_3' ? a >= 2 && a <= 3 : id === 'd4_7' ? a >= 4 && a <= 7 : id === 'later' ? a > 7 : a === undefined; }).length }));
  activation.first_session = { n: mature7.length, buckets: firstSession };

  // Releases: the versions in use, how they behave, and how many people are on the newest.
  const sumOf = (/** @type {any[]} */ list, /** @type {string[]} */ ids) => list.reduce((a, i) => a + ids.reduce((b, f) => b + (perInstall.get(i.id)?.[f] || 0), 0), 0);
  const failures = (/** @type {any[]} */ list) => list.filter((i) => ERRORS.some((e) => (perInstall.get(i.id)?.[e] || 0) > 0)).length;
  const latest = recent.reduce((m, i) => (m === null || newer(i.app, m) ? i.app : m), /** @type {string | null} */ (null));
  const versions = countBy(recent, (i) => i.app).map((v) => {
    const list = recent.filter((i) => i.app === v.value), st = sumOf(list, ['focus_start']);
    return { value: v.value, installs: list.length, share: recent.length ? list.length / recent.length : null, finish_rate: st ? Math.min(1, sumOf(list, ['focus_done']) / st) : null, errors_per_1000: list.length ? (1000 * sumOf(list, ERRORS)) / list.length : null, with_error: pair(failures(list), list.length), latest: v.value === latest };
  });
  const releases = { latest, on_latest: pair(recent.filter((i) => i.app === latest).length, recent.length), versions };

  // Segments: the same few figures for each value of each setup choice (the six biggest values, the rest as "other"), to see where a group differs from the others.
  const segmentOf = (/** @type {string} */ dim) => {
    const top = countBy(recent, (i) => i[dim]).slice(0, 6).map((x) => x.value), name = (/** @type {any} */ i) => (top.includes(i[dim]) ? i[dim] : 'other');
    const groups = [...top, ...(recent.some((i) => !top.includes(i[dim])) ? ['other'] : [])];
    return groups.map((g) => {
      const R = recent.filter((i) => name(i) === g), M = made.filter((i) => name(i) === g), M7 = M.filter((i) => mature(i, 13)), W1 = M.filter((i) => mature(i, 7)), st = sumOf(R, ['focus_start']);
      return {
        value: g, installs: R.length, share: recent.length ? R.length / recent.length : null,
        d7: pair(M7.filter(back).length, M7.length), session_week1: pair(W1.filter((i) => first(i, 'focus_start') <= 7).length, W1.length),
        finish_rate: st ? Math.min(1, sumOf(R, ['focus_done']) / st) : null, errors_per_1000: R.length ? (1000 * sumOf(R, ERRORS)) / R.length : null,
        avg_active_days: (() => { const d = R.map((i) => daysIn.get(i.id) || 0); return d.length ? d.reduce((a, b) => a + b, 0) / d.length : null; })(),
      };
    });
  };
  const segments = Object.fromEntries(DIMS.map((d) => [d, segmentOf(d)]));

  const out = {
    v: 2, generated_at: now, window_days: days, range, low_sample: LOW_SAMPLE, filter: Object.fromEntries(narrow.map((d) => [d, filter[d]])), facets,
    overview, weekly, lifecycle, engagement, trends, aha, releases, segments, activation, funnel, retention, cohorts, features, groups: GROUPS, sessions, blocking, eyes, speed, health, setup,
    prev: /** @type {ReturnType<typeof before> | null} */ (null),
  };
  // the period of the same length right before this one (not for "everything", and not when it would end before the first install)
  if (compare && !all && from - 1 >= firstDay) out.prev = before(computeStats(snap, now, { from: from - days, to: from - 1, compare: false, filter }));
  return out;
}

/** The few figures worth a comparison with the period before, with the period they are from. */
function before(/** @type {any} */ p) {
  return {
    range: p.range, installs_active: p.overview.recent, installs_new: p.overview.new_in_range,
    d1: p.retention.d1, d7: p.retention.d7, d30: p.retention.d30, session_week1: p.activation.session_week1,
    finish_rate: p.sessions.finish_rate, early_stop_rate: p.sessions.early_stop_rate, started: p.sessions.started,
    continue_rate: p.blocking.continue_rate, eye_rate: p.eyes.rate, under250: p.speed.under250, with_error: p.health.installs_with_error,
  };
}

/**
 * The part of the statistics that can be shown to anyone (a public page): only totals over at least `k` installs, no cohorts, no per-version and no error tables,
 * and a category held by fewer than `k` installs is folded into "other". Below `k` installs altogether it says only that it is still collecting.
 * @param {ReturnType<typeof computeStats>} s @param {number} [k]
 */
export function publicStats(s, k = LOW_SAMPLE) {
  const base = { v: 1, public: true, generated_at: s.generated_at, window_days: s.window_days, k };
  if (s.overview.recent < k) return { ...base, collecting: true, overview: { installs: s.overview.installs >= k ? s.overview.installs : null } };
  const fold = (/** @type {{ value: string, k: number }[]} */ list) => {
    const keep = list.filter((x) => x.k >= k), rest = list.filter((x) => x.k < k).reduce((a, x) => a + x.k, 0);
    return rest ? [...keep, { value: 'other', k: rest }] : keep;
  };
  const solid = (/** @type {{ k: number, n: number, pct: number | null }} */ p) => (p.n >= k ? p : { k: 0, n: p.n, pct: null });
  return {
    ...base, collecting: false,
    overview: { installs: s.overview.installs, recent: s.overview.recent },
    weekly: s.weekly,
    activation: { session_day1: solid(s.activation.session_day1), session_week1: solid(s.activation.session_week1) },
    retention: { d1: solid(s.retention.d1), d7: solid(s.retention.d7), d30: solid(s.retention.d30) },
    features: s.features.map((f) => ({ id: f.id, group: f.group, users: f.users, uses: f.uses })),
    groups: s.groups,
    sessions: { finish_rate: s.sessions.finish_rate, early_stop_rate: s.sessions.early_stop_rate, length: s.sessions.length },
    blocking: { continue_rate: s.blocking.continue_rate, reasons: s.blocking.reasons },
    eyes: { rate: s.eyes.rate },
    speed: { opens: s.speed.opens, hist: s.speed.hist, under250: s.speed.under250, p50_upper: s.speed.p50_upper, p90_upper: s.speed.p90_upper },
    setup: { look: fold(s.setup.look), lang: fold(s.setup.lang), mode: fold(s.setup.mode), browser: fold(s.setup.browser), os: fold(s.setup.os), flags: s.setup.flags.of >= k ? s.setup.flags : null },
  };
}
