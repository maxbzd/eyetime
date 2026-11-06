// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The numbers behind the dashboard: plain functions from what the collector holds (a "snapshot": installs, first uses, weekly counters, switched-on flags) to one JSON object.
// No storage, no clock of its own (the time is an argument), so the same code answers in the Worker, in a test and in the demo.
//
// Every figure is a pair { k, n } (k of n installs) or a count, never a rounded-off guess: the page shows both, and greys out what rests on few installs.
// What a figure means is written next to it below, and in docs/MEASUREMENT.md; read the numbers as the behaviour of people who agreed to share (not a census).

import { FEATURES, FLAGS, UNINSTALL_REASONS, WIN_FEATURES, WIN_FLAGS } from '../../src/shared/usage-schema.js';

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
/**
 * What a view can be narrowed to, and what segments are compared by: the choices and facts of the setup (app, br, os, lang, look, layout, mode) and three things about the
 * behaviour, worked out from the reports: `use` (new, once, casual, regular, power or idle, by the days active of 28), `session` (ever started a focus session: yes / no)
 * and `blocking` (keeps a schedule, limits, a budget or instant blocking switched on: yes / no / unknown).
 */
export const DIMS = ['app', 'br', 'os', 'lang', 'look', 'layout', 'mode', 'use', 'session', 'blocking', 'pr'];
const BLOCK_FLAGS = ['schedule', 'limits', 'budget', 'instant_block'];
const WIN_BLOCK_FLAGS = ['locked_rules', 'limits', 'schedule'];
/** The middle of each length bucket, in minutes: a finished-session length is only known by bucket, so minutes of focus are an estimate and the page says so. */
const LENGTH_MID = { fl_u15: 10, fl_u25: 20, fl_u35: 30, fl_u50: 42, fl_u75: 62, fl_75p: 90 };

/**
 * The targets the scorecard is measured against, and the range each may be set to. A target the owner has not set stays at its default; the optional ones (the return and
 * activation rates) have none until the owner sets one. They are ours, not an industry standard.
 */
export const DEFAULT_TARGETS = { speed_p90: 500, finish: 0.7, early: 0.1, err: 0.05, quick: 1, upd: 0.8, stick: 0.2 };
export const TARGET_RANGES = { speed_p90: [100, 5000], finish: [0, 1], early: [0, 1], err: [0, 1], quick: [0, 10], upd: [0, 1], stick: [0, 1], d1: [0, 1], d7: [0, 1], d30: [0, 1], act: [0, 1] };
/**
 * The targets a request may set: an object of known keys with a number in range, or null to clear one. Returns the cleaned object.
 * @param {any} b @returns {{ ok: true, targets: Record<string, number> } | { ok: false, why: string }}
 */
export function normalizeTargets(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { ok: false, why: 'not an object' };
  /** @type {Record<string, number>} */ const targets = {};
  for (const [k, v] of Object.entries(b)) {
    const range = /** @type {Record<string, number[]>} */ (TARGET_RANGES)[k];
    if (!range) return { ok: false, why: 'unknown target ' + k };
    if (v === null) continue;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < range[0] || v > range[1]) return { ok: false, why: 'out of range: ' + k };
    targets[k] = v;
  }
  return { ok: true, targets };
}
const LENGTHS = ['fl_u15', 'fl_u25', 'fl_u35', 'fl_u50', 'fl_u75', 'fl_75p'];
const REASONS = ['bp_always', 'bp_focus', 'bp_schedule', 'bp_limit', 'bp_budget', 'bp_friction'];
const SPEEDS = ['nt_u100', 'nt_u250', 'nt_u500', 'nt_u1000', 'nt_slow'];
/** The upper bound of the slowest bucket: a number (JSON has no Infinity), read as "no bound". */
export const OPEN_END = 100_000;
const SPEED_UPPER = [100, 250, 500, 1000, OPEN_END];
const ERRORS = ['err_worker', 'err_page', 'err_blocker', 'err_sync', 'err_other'];

/** The size of a sample below which a figure is shown as unreliable (the dashboard greys it out); docs/MEASUREMENT.md says "fewer than 50". */
export const LOW_SAMPLE = 50;

/** The 95% interval of a share k of n (Wilson): honest at small n and at shares near 0 or 1, where the usual formula is not. null when there is nobody. */
export function wilson(/** @type {number} */ k, /** @type {number} */ n) {
  if (!(n > 0)) return null;
  const z = 1.96, p = k / n, z2 = z * z, d = 1 + z2 / n, c = p + z2 / (2 * n), m = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)];
}
const normalCdf = (/** @type {number} */ x) => { // Abramowitz and Stegun 7.1.26: good to about 1e-7, plenty for "is this noise"
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
};
/**
 * Is the difference between two shares more than chance (two-proportion z-test, two-sided)? `significant` only at p < 0.05 and at least 20 people in each; a bare
 * difference of two small groups is not a finding, and the dashboard says so next to the arrow.
 * @param {{ k: number, n: number } | null | undefined} a @param {{ k: number, n: number } | null | undefined} b
 */
export function compareProps(a, b) {
  if (!a || !b || !(a.n > 0) || !(b.n > 0)) return null;
  const p1 = a.k / a.n, p2 = b.k / b.n, pool = (a.k + b.k) / (a.n + b.n), se = Math.sqrt(pool * (1 - pool) * (1 / a.n + 1 / b.n));
  const z = se > 0 ? (p1 - p2) / se : 0, p = 2 * (1 - normalCdf(Math.abs(z)));
  return { diff: p1 - p2, z, p, significant: p < 0.05 && a.n >= 20 && b.n >= 20 };
}
const r4 = (/** @type {number} */ x) => Math.round(x * 10_000) / 10_000;
const pair = (/** @type {number} */ k, /** @type {number} */ n) => { const w = wilson(k, n); return { k, n, pct: n > 0 ? k / n : null, lo: w ? r4(w[0]) : null, hi: w ? r4(w[1]) : null }; };
const median = (/** @type {number[]} */ a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const countBy = (/** @type {any[]} */ list, /** @type {(x: any) => string} */ f) => { const m = new Map(); for (const x of list) { const v = f(x); m.set(v, (m.get(v) || 0) + 1); } return [...m].map(([value, k]) => ({ value, k })).sort((a, b) => b.k - a.k || (a.value < b.value ? -1 : 1)); };
const isoDay = (/** @type {number} */ dayNumber) => new Date(dayNumber * DAY).toISOString().slice(0, 10);
const semver = (/** @type {string} */ v) => v.split('.').map((x) => parseInt(x, 10) || 0);
const newer = (/** @type {string} */ a, /** @type {string} */ b) => { const x = semver(a), y = semver(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0; } return false; };

/**
 * @typedef {{ installs: any[], firsts: { id: string, feature: string, age: number }[], weeks: { id: string, week: number, feature: string, n: number }[], flags: { id: string, flag: string }[], experiments?: { id: string, exp: string, arm: string }[], notes?: { id: number, day: string, text: string }[], ingest?: { day: string, kind: string, n: number }[], uninstalls?: { day: string, reason: string, n: number }[], store_stats?: { day: string, users: number | null, installs: number | null, uninstalls: number | null }[], settings?: Record<string, string> }} Snapshot
 * The period: `from`/`to` are day numbers (days since 1970-01-01, UTC), or `all` for everything since the first install, or `recentDays` counted back from `to` (default: 90 days up to today; 90 so that the 30-day return of the people who came in the period can be seen).
 * What the period scopes: who counts as active, the weekly counters (rounded outward to whole weeks, they are stored by week), the installs made in it (the funnel, activation and
 * retention follow those people for as long as they have been around), and the comparison with the period of the same length right before it.
 * @param {Snapshot} snap @param {number} now ms @param {{ recentDays?: number, from?: number, to?: number, all?: boolean, compare?: boolean, filter?: Record<string, string> }} [opts]
 * `filter` narrows everything to the installs with those values ({ br: 'chrome', lang: 'ru' }); `facets` always lists what there is to choose from, counted over all installs.
 */
export function computeStats(snap, now = Date.now(), { recentDays = 90, from: fromOpt, to: toOpt, all = false, compare = true, filter = {} } = {}) {
  const today = Math.floor(now / DAY);
  filter = { pr: 'ext', ...filter }; // the numbers are of one product at a time: the extension unless the Windows app is asked for
  const win = filter.pr === 'win';
  // what each install does, worked out once from the reports (the three behavioural dimensions of DIMS), so that a view can be narrowed to it like to a browser
  const toDay = Math.min(toOpt ?? today, today);
  const startedIds = new Set(snap.firsts.filter((f) => f.feature === (filter.pr === 'win' ? 'ses_start' : 'focus_start')).map((f) => f.id)), flagged = new Set(snap.flags.map((f) => f.id)), blocks = new Set(snap.flags.filter((f) => (filter.pr === 'win' ? WIN_BLOCK_FLAGS : BLOCK_FLAGS).includes(f.flag)).map((f) => f.id));
  snap = {
    ...snap,
    installs: snap.installs.map((i) => {
      const day0 = Math.floor(i.last_report / DAY) - i.age;
      let used = 0; for (const a of i.act) { const d = day0 + a; if (d >= toDay - 34 && d <= toDay - 7) used++; }
      const use = day0 > toDay - 7 ? 'new' : used >= 15 ? 'power' : used >= 8 ? 'regular' : used >= 2 ? 'casual' : used >= 1 ? 'once' : 'idle';
      return { ...i, pr: i.pr || 'ext', use, session: startedIds.has(i.id) ? 'yes' : 'no', blocking: blocks.has(i.id) ? 'yes' : flagged.has(i.id) ? 'no' : 'unknown' };
    }),
  };
  const everyone = snap.installs; // before any narrowing: the coverage of the sample is about all of them
  const facets = Object.fromEntries(DIMS.map((d) => [d, countBy(snap.installs, (i) => i[d])]));
  const narrow = DIMS.filter((d) => filter[d]);
  if (narrow.length) {
    const keep = new Set(snap.installs.filter((i) => narrow.every((d) => i[d] === filter[d])).map((i) => i.id));
    snap = { ...snap, installs: snap.installs.filter((i) => keep.has(i.id)), firsts: snap.firsts.filter((x) => keep.has(x.id)), weeks: snap.weeks.filter((x) => keep.has(x.id)), flags: snap.flags.filter((x) => keep.has(x.id)), experiments: (snap.experiments || []).filter((x) => keep.has(x.id)) };
  }
  const installs = snap.installs.map((i) => {
    const lastDay = Math.floor(i.last_report / DAY);
    return { ...i, act: [...i.act].sort((a, b) => a - b), lastDay, day0: lastDay - i.age };
  });
  const firstDay = installs.length ? Math.min(...installs.map((i) => i.day0)) : today;
  const to = toDay;
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

  // ---- the north star: finished focus sessions per active install per week, with the minutes behind it (an estimate: lengths are known by bucket) ----
  const stable = tWeeks.map((_, k) => !trends.weeks[k].partial);
  const lastFull = stable.lastIndexOf(true), prevFull = lastFull > 0 ? stable.lastIndexOf(true, lastFull - 1) : -1;
  const nsRow = (/** @type {number} */ k) => ({ from: trends.weeks[k].from, to: trends.weeks[k].to, partial: trends.weeks[k].partial, active: trends.active[k], finished: tUses.focus_done[k], value: trends.active[k] > 0 ? tUses.focus_done[k] / trends.active[k] : null, minutes: trends.active[k] > 0 ? Object.entries(LENGTH_MID).reduce((a, [id, mid]) => a + mid * tUses[id][k], 0) / trends.active[k] : null });
  const nsWeeks = tWeeks.map((_, k) => nsRow(k));
  const northstar = { weeks: nsWeeks, value: lastFull >= 0 ? nsWeeks[lastFull].value : null, minutes: lastFull >= 0 ? nsWeeks[lastFull].minutes : null, prev_value: prevFull >= 0 ? nsWeeks[prevFull].value : null, enough: lastFull >= 0 && nsWeeks[lastFull].active >= LOW_SAMPLE };

  // ---- when it is used: active days by day of the week, over the fully reported part of the period (Monday first) ----
  const weekdayCounts = new Array(7).fill(0);
  for (const i of installs) for (const a of i.act) { const d = i.day0 + a; if (d >= from && d <= to - 7) weekdayCounts[(d + 3) % 7]++; }
  const weekday = { from: isoDay(from), to: isoDay(Math.max(from, to - 7)), counts: weekdayCounts, total: weekdayCounts.reduce((a, b) => a + b, 0) };

  // ---- coverage: how much of the store's own count of active users reports here (typed in by the owner for a day), and how many people remove it ----
  const coverage = {
    rows: (snap.store_stats || []).map((r) => {
      const d = Math.floor(Date.parse(r.day + 'T00:00:00Z') / DAY);
      const ours = everyone.filter((i) => { const d0 = Math.floor(i.last_report / DAY) - i.age; return i.act.some((/** @type {number} */ a) => d0 + a >= d - 6 && d0 + a <= d); }).length;
      return { day: r.day, users: r.users, installs: r.installs, uninstalls: r.uninstalls, ours, coverage: r.users ? ours / r.users : null, uninstall_rate: r.users && r.uninstalls != null ? r.uninstalls / r.users : null };
    }),
  };

  // ---- notes for the charts, the door's own counters, and why people leave ----
  const notes = (snap.notes || []).filter((n) => n.day >= isoDay(to - 7 * trend - 7) && n.day <= isoDay(to)).map((n) => ({ id: n.id, day: n.day, text: n.text }));
  const doorDays = Array.from({ length: 28 }, (_, k) => isoDay(today - 27 + k));
  const REJECTED = ['bad_report', 'bad_json', 'bad_type', 'too_big', 'wrong_origin'], THROTTLED = ['too_soon', 'flood'];
  const door = doorDays.map((day) => { const by = Object.fromEntries((snap.ingest || []).filter((r) => r.day === day).map((r) => [r.kind, r.n])); const tot = (/** @type {string[]} */ ks) => ks.reduce((a, k) => a + (by[k] || 0), 0); return { day, accepted: by.accepted || 0, forgot: by.forgot || 0, rejected: tot(REJECTED), throttled: tot(THROTTLED), by }; });
  const door7 = door.slice(-7), got = door7.reduce((a, d) => a + d.accepted + d.rejected, 0);
  const ingest = { days: door, accepted_7d: door7.reduce((a, d) => a + d.accepted, 0), rejected_7d: door7.reduce((a, d) => a + d.rejected, 0), rejected_share_7d: got ? door7.reduce((a, d) => a + d.rejected, 0) / got : null, reasons_7d: [...REJECTED, ...THROTTLED].map((kind) => ({ id: kind, k: door7.reduce((a, d) => a + (d.by[kind] || 0), 0) })) };
  const leaving = (snap.uninstalls || []).filter((u) => u.day >= isoDay(from) && u.day <= isoDay(to));
  const uninstalls = { total: leaving.reduce((a, u) => a + u.n, 0), reasons: UNINSTALL_REASONS.map((id) => ({ id, k: leaving.filter((u) => u.reason === id).reduce((a, u) => a + u.n, 0) })) };

  // ---- experiments: for each, the arms side by side and each against the control (the arm called "control", else the first by name) ----
  const armsOf = new Map(); for (const e of snap.experiments || []) { if (!armsOf.has(e.exp)) armsOf.set(e.exp, new Map()); armsOf.get(e.exp).set(e.id, e.arm); }
  const experiments = [...armsOf].map(([exp, byId]) => {
    const names = [...new Set(byId.values())].sort(), control = names.includes('control') ? 'control' : names[0];
    const arms = names.map((arm) => {
      const inArm = installs.filter((i) => byId.get(i.id) === arm), M = inArm.filter((i) => i.day0 >= from && i.day0 <= to), R = inArm.filter((i) => recentIds.has(i.id));
      const M1 = M.filter((i) => mature(i, 1)), M7 = M.filter((i) => mature(i, 13)), W1 = M.filter((i) => mature(i, 7)), st = sumOf(R, ['focus_start']);
      return { arm, installs: inArm.length, made: M.length, d1: pair(M1.filter((i) => i.act.includes(1)).length, M1.length), d7: pair(M7.filter(back).length, M7.length), session_week1: pair(W1.filter((i) => first(i, 'focus_start') <= 7).length, W1.length), finish_rate: st ? Math.min(1, sumOf(R, ['focus_done']) / st) : null, avg_active_days: R.length ? R.reduce((a, i) => a + (daysIn.get(i.id) || 0), 0) / R.length : null };
    });
    const c = arms.find((a) => a.arm === control);
    return { id: exp, control, arms: arms.map((a) => ({ ...a, vs_control: a.arm === control || !c ? null : { d1: compareProps(a.d1, c.d1), d7: compareProps(a.d7, c.d7), session_week1: compareProps(a.session_week1, c.session_week1) } })) };
  });

  // ---- the targets the scorecard uses: ours by default, the owner's where set ----
  let custom = {}; try { const t = normalizeTargets(JSON.parse(snap.settings?.targets || 'null') ?? {}); if (t.ok) custom = t.targets; } catch { /* a damaged setting is no setting */ }
  const targets = { values: { ...DEFAULT_TARGETS, ...custom }, custom: Object.keys(custom) };

  const out = {
    v: 3, generated_at: now, window_days: days, range, low_sample: LOW_SAMPLE, product: filter.pr, filter: Object.fromEntries(narrow.filter((d) => d !== 'pr').map((d) => [d, filter[d]])), facets,
    overview, weekly, lifecycle, engagement, weekday, northstar, trends, aha, releases, segments, coverage, notes, ingest, uninstalls, experiments, targets, activation, funnel, retention, cohorts, features, groups: GROUPS, sessions, blocking, eyes, speed, health, setup,
    prev: /** @type {ReturnType<typeof before> | null} */ (null),
    compare: /** @type {Record<string, ReturnType<typeof compareProps>> | null} */ (null),
    scorecard: /** @type {ReturnType<typeof scorecard>} */ ([]),
  };
  // the period of the same length right before this one (not for "everything", and not when it would end before the first install)
  if (compare && !all && from - 1 >= firstDay) {
    out.prev = before(computeStats(snap, now, { from: from - days, to: from - 1, compare: false, filter }));
    // which of the changes against the period before are more than chance (a share against a share; counts are not tested)
    const q = out.prev, rate = (/** @type {number} */ k, /** @type {number} */ n) => pair(Math.min(k, n), n), fast = speed.hist[0].k + speed.hist[1].k;
    out.compare = {
      d1: compareProps(retention.d1, q.d1), d7: compareProps(retention.d7, q.d7), d30: compareProps(retention.d30, q.d30), session_week1: compareProps(activation.session_week1, q.session_week1),
      finish_rate: compareProps(rate(sessions.finished, sessions.started), rate(q.counts.finished, q.counts.started)), early_stop_rate: compareProps(rate(sessions.early_stop, sessions.started), rate(q.counts.early_stop, q.counts.started)),
      continue_rate: compareProps(rate(blocking.continued, blocking.pages), rate(q.counts.continued, q.counts.pages)), eye_rate: compareProps(rate(eyes.done, eyes.done + eyes.skipped), rate(q.counts.eye_done, q.counts.eye_done + q.counts.eye_skip)),
      under250: compareProps(rate(fast, speed.opens), rate(q.counts.fast, q.counts.opens)), with_error: compareProps(health.installs_with_error, q.with_error),
    };
  }
  if (win) return asWindows(out, winBlock({ snap, recent, made, firsts, weekFrom, weekTo, mature }));
  out.scorecard = scorecard(out);
  return out;
}

/**
 * The Windows app, as its own block: what it closed and why, how the challenges end, sessions, updates and crashes, what is set up. Counters are the weekly buckets of the installs
 * seen in the period; every share is a pair { k, n } like everywhere else.
 */
function winBlock({ snap, recent, made, firsts, weekFrom, weekTo, mature }) {
  const ids = new Set(recent.map((i) => i.id)), total = Object.fromEntries(WIN_FEATURES.map((f) => [f, 0])), users = Object.fromEntries(WIN_FEATURES.map((f) => [f, new Set()]));
  for (const w of snap.weeks) if (ids.has(w.id) && w.week >= weekFrom && w.week <= weekTo && w.feature in total) { total[w.feature] += w.n; if (w.n > 0) users[w.feature].add(w.id); }
  const cnt = (/** @type {string} */ f) => total[f] || 0, rate = (/** @type {number} */ k, /** @type {number} */ n) => (n ? Math.min(1, k / n) : null);
  const flags = new Map(); for (const f of snap.flags) if (ids.has(f.id)) { if (!flags.has(f.id)) flags.set(f.id, new Set()); flags.get(f.id).add(f.flag); }
  const withFlags = recent.filter((i) => flags.has(i.id));
  const first = (/** @type {any} */ i, /** @type {string} */ f) => firsts.get(i.id)?.[f];
  const mature7 = made.filter((i) => mature(i, 7));
  return {
    installs: recent.length,
    blocks: ['blk_rule', 'blk_session', 'blk_limit', 'blk_cool'].map((id) => ({ id, k: cnt(id) })),
    blocks_total: cnt('blk_rule') + cnt('blk_session') + cnt('blk_limit') + cnt('blk_cool'),
    // the challenge before something is loosened: how often it is shown, how it ends, which kinds, and what for
    challenges: {
      shown: cnt('ch_shown'), done: cnt('ch_done'), wrong: cnt('ch_wrong'), expired: cnt('ch_expired'),
      done_rate: rate(cnt('ch_done'), cnt('ch_shown')), give_up_rate: rate(cnt('ch_expired'), cnt('ch_shown')),
      kinds: ['ch_hold', 'ch_wait', 'ch_type', 'ch_math', 'ch_pin', 'ch_friend'].map((id) => ({ id, k: cnt(id) })),
      purposes: ['ch_for_end', 'ch_for_break', 'ch_for_unblock', 'ch_for_edit', 'ch_for_emergency'].map((id) => ({ id, k: cnt(id) })),
    },
    sessions: { started: cnt('ses_start'), finished: cnt('ses_done'), stopped: cnt('ses_stop'), finish_rate: rate(cnt('ses_done'), cnt('ses_start')), users: pair(users.ses_start.size, recent.length), first_week: pair(mature7.filter((i) => first(i, 'ses_start') <= 7).length, mature7.length) },
    service: { starts: cnt('svc_start'), crashes: cnt('svc_crash'), crashes_per_1000: recent.length ? (1000 * cnt('svc_crash')) / recent.length : null, installs_with_crash: pair(users.svc_crash.size, recent.length), opens: cnt('ui_open') },
    updates: { found: cnt('upd_found'), applied: cnt('upd_applied'), failed: cnt('upd_failed'), failed_rate: rate(cnt('upd_failed'), cnt('upd_found')) },
    flags: { of: withFlags.length, items: WIN_FLAGS.map((f) => ({ id: f, k: withFlags.filter((i) => flags.get(i.id).has(f)).length })) },
    lang: countBy(recent, (i) => i.lang),
    versions: countBy(recent, (i) => i.app),
  };
}

/** The answer for the Windows app: the generic parts (growth, retention, cohorts, engagement) stand; the parts that are about the extension's features are dropped, and its own block is added. */
function asWindows(out, win) {
  for (const k of ['funnel', 'activation', 'features', 'sessions', 'blocking', 'eyes', 'speed', 'health', 'aha', 'trends', 'segments', 'experiments', 'northstar', 'releases', 'setup', 'uninstalls', 'coverage']) out[k] = null;
  out.groups = {};
  out.win = win;
  out.setup = { lang: win.lang, flags: win.flags, win: true };
  if (out.compare) out.compare = Object.fromEntries(['d1', 'd7', 'd30'].map((k) => [k, out.compare[k]]));
  out.scorecard = [];
  return out;
}

/**
 * The product-health rows, measured against the targets (ours unless the owner set them): one place for the dashboard, the report and the weekly digest, so they cannot disagree.
 * `status` is good, warn, bad or na (too little data to say). Higher-is-better figures are amber from 75% of the target, lower-is-better ones up to twice the target.
 * @param {any} s the statistics
 */
export function scorecard(s) {
  const T = s.targets.values, rows = /** @type {{ id: string, page: string, status: string, value: number | null, target: number | null, enough: boolean }[]} */ ([]);
  const row = (/** @type {string} */ id, /** @type {string} */ page, /** @type {number | null} */ value, /** @type {number | null} */ target, /** @type {boolean} */ higher, /** @type {boolean} */ enough) => {
    const status = !enough || value == null || target == null ? 'na' : higher ? (value >= target ? 'good' : value >= target * 0.75 ? 'warn' : 'bad') : (value <= target ? 'good' : value <= target * 2 ? 'warn' : 'bad');
    rows.push({ id, page, status, value, target, enough: enough && value != null });
  };
  if (s.speed) row('speed', 'quality', s.speed.p90_upper, T.speed_p90, false, s.speed.opens >= 100 && s.speed.p90_upper != null);
  if (s.sessions) { const en = s.sessions.started >= 30; row('finish', 'product', s.sessions.finish_rate, T.finish, true, en); row('early', 'product', s.sessions.early_stop_rate, T.early, false, en); }
  if (s.health) row('err', 'quality', s.health.installs_with_error.pct, T.err, false, s.health.installs_with_error.n >= 50);
  if (s.lifecycle) { const l = s.lifecycle.filter((/** @type {any} */ x) => !x.partial).at(-1); row('quick', 'growth', l ? l.quick_ratio : null, T.quick, true, !!l && l.churned > 0); }
  if (s.releases && s.releases.latest) row('upd', 'quality', s.releases.on_latest.pct, T.upd, true, s.releases.on_latest.n >= 50 && s.releases.versions.length > 1);
  if (s.engagement) row('stick', 'growth', s.engagement.dau_mau, T.stick, true, s.engagement.mau >= 50);
  for (const [id, page, p] of /** @type {[string, string, any][]} */ ([['d1', 'retention', s.retention.d1], ['d7', 'retention', s.retention.d7], ['d30', 'retention', s.retention.d30], ['act', 'activation', s.activation.session_week1]])) if (T[id] != null) row('goal_' + id, page, p.pct, T[id], true, p.n >= LOW_SAMPLE);
  return rows;
}

/** The few figures worth a comparison with the period before, with the period they are from. */
function before(/** @type {any} */ p) {
  return {
    range: p.range, installs_active: p.overview.recent, installs_new: p.overview.new_in_range,
    d1: p.retention.d1, d7: p.retention.d7, d30: p.retention.d30, session_week1: p.activation.session_week1,
    finish_rate: p.sessions.finish_rate, early_stop_rate: p.sessions.early_stop_rate, started: p.sessions.started,
    continue_rate: p.blocking.continue_rate, eye_rate: p.eyes.rate, under250: p.speed.under250, with_error: p.health.installs_with_error,
    // the counts behind the rates, to test a change against chance
    counts: { started: p.sessions.started, finished: p.sessions.finished, early_stop: p.sessions.early_stop, pages: p.blocking.pages, continued: p.blocking.continued, eye_done: p.eyes.done, eye_skip: p.eyes.skipped, opens: p.speed.opens, fast: p.speed.hist[0].k + p.speed.hist[1].k },
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
