// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// A made-up population of installs for trying the dashboard and for the tests of stats.js: seeded, so the same call always gives the same numbers.
// Three kinds of person (leaves in a few days, uses it now and then, uses it every day), with the habits of each: which days, which features, what stays switched on.
// None of this is data of anyone: it exists so that a page can be looked at, and a formula checked, before the first real report arrives.

import { FEATURES, FLAGS } from '../../src/shared/usage-schema.js';

const DAY = 86_400_000, WEEK = 7 * DAY;

function rng(/** @type {number} */ seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hex = (/** @type {() => number} */ r) => Array.from({ length: 32 }, () => Math.floor(r() * 16).toString(16)).join('');
const weighted = (/** @type {() => number} */ r, /** @type {[string, number][]} */ items) => { let x = r() * items.reduce((a, [, w]) => a + w, 0); for (const [v, w] of items) { x -= w; if (x <= 0) return v; } return items[0][0]; };

/** Uses per active day, by kind of person: [casual, daily]. */
const RATE = {
  newtab_view: [3, 6], popup_open: [0.4, 0.9], insights_view: [0.05, 0.4], settings_view: [0.04, 0.12],
  focus_start: [0.35, 1.4], focus_done: [0.28, 1.15], focus_stop: [0.07, 0.25], focus_pause: [0.03, 0.2],
  eye_break_done: [0.3, 0.9], eye_break_skip: [0.25, 0.5], block_page: [0.5, 1.4], block_continue: [0.15, 0.5],
  task_add: [0.25, 0.9], task_done: [0.2, 0.8], habit_check: [0.1, 0.5], shutdown_done: [0.02, 0.2], plan_done: [0.02, 0.12], ritual_plan: [0.03, 0.2], ritual_skip: [0.05, 0.12],
  connection_add: [0.002, 0.01], palette_open: [0.04, 0.3], drawer_open: [0.03, 0.2], editor_open: [0.004, 0.03], starter_apply: [0.002, 0.005], wall_next: [0.02, 0.1], standby_open: [0.01, 0.06],
};
const FLAG_ODDS = {
  ritual: 0.7, dock: 0.06, weather: 0.08, calendar: 0.1, tasks_sync: 0.05, settings_sync: 0.07, sync_encrypted: 0.012, instant_block: 0.04, smart_sites: 0.03, connections: 0.04,
  schedule: 0.22, limits: 0.25, budget: 0.06, friction: 0.85, eye_notify: 0.8, bedtime: 0.1, standby: 0.12, custom_css: 0.04, companion: 0.02, daily_goal: 0.9, focus_sound: 0.5, review: 0.6,
};

/**
 * @param {number} now ms @param {{ installs?: number, seed?: number }} [o]
 * @returns {{ installs: any[], firsts: any[], weeks: any[], flags: any[] }}
 */
export function makeDemoSnapshot(now, { installs: count = 520, seed = 11 } = {}) {
  const r = rng(seed), today = Math.floor(now / DAY);
  const out = { installs: /** @type {any[]} */ ([]), firsts: /** @type {any[]} */ ([]), weeks: /** @type {any[]} */ ([]), flags: /** @type {any[]} */ ([]) };
  for (let n = 0; n < count; n++) {
    const id = hex(r);
    const installAgo = Math.floor(Math.pow(r(), 1.5) * 90); // more of the installs are recent: the project grows
    const day0 = today - installAgo;
    const kind = r() < 0.52 ? 'leaves' : r() < 0.8 ? 'casual' : 'daily';
    const act = [0];
    for (let d = 1; d <= installAgo; d++) {
      const p = kind === 'leaves' ? 0.45 * Math.exp(-d / 1.6) : kind === 'casual' ? 0.07 + 0.3 * Math.exp(-d / 18) : 0.2 + 0.65 * Math.exp(-d / 120) + (d % 7 > 4 ? -0.15 : 0.05);
      if (r() < Math.max(0.02, Math.min(0.97, p))) act.push(d);
    }
    const lastActive = act[act.length - 1];
    const reportAge = Math.min(installAgo, lastActive + Math.floor(r() * 6)); // a person who stopped using it stops reporting a few days later
    const lastReport = (day0 + reportAge) * DAY + Math.floor(r() * DAY * 0.9);
    if (lastReport > now) continue;
    const age = Math.floor(lastReport / DAY) - day0;
    const acts = act.filter((a) => a <= age);
    out.installs.push({
      id, first_report: Math.min(lastReport, (day0 + 1) * DAY + Math.floor(r() * DAY)), last_report: lastReport,
      app: weighted(r, [['3.8.1', 70], ['3.8.0', 22], ['3.7.0', 8]]), br: weighted(r, [['chrome', 78], ['edge', 12], ['firefox', 8], ['other', 2]]),
      os: weighted(r, [['win', 52], ['mac', 36], ['linux', 9], ['cros', 3]]), lang: weighted(r, [['en', 38], ['ru', 30], ['de', 7], ['es', 6], ['uk', 5], ['fr', 4], ['pt', 3], ['pl', 3], ['it', 2], ['zh', 1], ['ja', 1]]),
      look: weighted(r, [['calm', 46], ['obsidian', 12], ['void', 8], ['noir', 6], ['pearl', 5], ['paper', 5], ['midnight', 5], ['terminal', 4], ['sakura', 3], ['aurora', 3], ['nord', 3]]),
      layout: weighted(r, [['today', 62], ['center', 22], ['canvas', 10], ['minimal', 6]]), mode: weighted(r, [['auto', 48], ['dark', 34], ['light', 18]]), age, act: acts,
    });
    // first uses and the weekly counters of the last four weeks
    const heavy = kind === 'daily' ? 1 : kind === 'casual' ? 0 : -1; // -1: leaves
    const usesEarly = kind === 'leaves';
    const intensity = (/** @type {string} */ f) => (heavy < 0 ? RATE[/** @type {keyof typeof RATE} */ (f)][0] * 0.6 : RATE[/** @type {keyof typeof RATE} */ (f)][heavy]);
    const adoptP = (/** @type {string} */ f) => { const x = RATE[/** @type {keyof typeof RATE} */ (f)]; return Math.min(0.99, Math.max(0.01, (heavy < 0 ? x[0] : x[heavy]) * (heavy < 0 ? 1.4 : 2.4))); };
    const used = {};
    for (const f of /** @type {(keyof typeof RATE)[]} */ (Object.keys(RATE))) {
      if (f !== 'newtab_view' && r() > adoptP(f)) continue;
      const firstAge = f === 'newtab_view' ? 0 : Math.min(age, Math.floor(-Math.log(1 - r() * 0.98) * (usesEarly ? 1.1 : 5)));
      out.firsts.push({ id, feature: f, age: firstAge });
      used[f] = true;
    }
    if (r() < 0.88) out.firsts.push({ id, feature: 'onboarding_done', age: 0 });
    const weekNow = Math.floor(now / WEEK);
    for (let w = 0; w < 4; w++) {
      const from = Math.floor(lastReport / DAY) - age, activeThisWeek = acts.filter((a) => Math.floor((day0 + a) / 7) === weekNow - w).length;
      if (!activeThisWeek || from > today) continue;
      const row = (/** @type {string} */ f, /** @type {number} */ v) => { const k = Math.max(0, Math.round(v * (0.7 + r() * 0.6))); if (k) out.weeks.push({ id, week: weekNow - w, feature: f, n: k }); };
      for (const f of /** @type {(keyof typeof RATE)[]} */ (Object.keys(RATE))) if (used[f]) row(f, intensity(f) * activeThisWeek * 1.3);
      const done = out.weeks.filter((x) => x.id === id && x.week === weekNow - w && x.feature === 'focus_done').reduce((a, x) => a + x.n, 0);
      const starts = out.weeks.filter((x) => x.id === id && x.week === weekNow - w && x.feature === 'focus_start').reduce((a, x) => a + x.n, 0);
      for (const [f, wgt] of [['fl_u15', 12], ['fl_u25', 22], ['fl_u35', 38], ['fl_u50', 17], ['fl_u75', 8], ['fl_75p', 3]]) row(f, (done * /** @type {number} */ (wgt)) / 100);
      row('fl_early_stop', starts * 0.1);
      const pages = out.weeks.filter((x) => x.id === id && x.week === weekNow - w && x.feature === 'block_page').reduce((a, x) => a + x.n, 0);
      for (const [f, wgt] of [['bp_friction', 70], ['bp_focus', 16], ['bp_schedule', 7], ['bp_limit', 4], ['bp_always', 2], ['bp_budget', 1]]) row(f, (pages * /** @type {number} */ (wgt)) / 100);
      const views = out.weeks.filter((x) => x.id === id && x.week === weekNow - w && x.feature === 'newtab_view').reduce((a, x) => a + x.n, 0);
      for (const [f, wgt] of [['nt_u100', 20], ['nt_u250', 52], ['nt_u500', 22], ['nt_u1000', 5], ['nt_slow', 1]]) row(f, (views * /** @type {number} */ (wgt)) / 100);
      for (const [f, per] of [['err_worker', 0.02], ['err_page', 0.03], ['err_blocker', 0.01], ['err_sync', 0.02], ['err_other', 0.01]]) if (r() < per * activeThisWeek) row(f, 1);
    }
    // what is switched on (a state), with sizes in steps
    const on = new Set(Object.entries(FLAG_ODDS).filter(([, p]) => r() < p * (heavy > 0 ? 1.15 : 0.9)).map(([f]) => f));
    on.add(weighted(r, [['tasks_0', 24], ['tasks_1_5', 46], ['tasks_6_20', 24], ['tasks_21p', 6]]));
    on.add(weighted(r, [['habits_0', 52], ['habits_1_2', 30], ['habits_3p', 18]]));
    on.add(weighted(r, [['sites_0', 40], ['sites_1_5', 42], ['sites_6p', 18]]));
    for (const f of FLAGS) if (on.has(f)) out.flags.push({ id, flag: f });
  }
  for (const f of out.weeks) if (!FEATURES.includes(f.feature)) throw new Error('demo data: unknown feature ' + f.feature);
  return out;
}
