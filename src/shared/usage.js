// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Usage measurement, the pure part. EyeTime counts, on the device and always, which of its own features get used and on how many days;
// the numbers go nowhere unless the person switches "Share anonymous usage" on (see usage-store.js, background/usage.js and PRIVACY.md).
//
//   record(u, 'focus_start', now)       count one use, mark today active, remember the first time
//   buildReport(u, ctx, now)            the exact JSON that would be sent (usage-schema.js says what it may hold)
//
// Time is counted in whole local days since the install ("age"), never as a clock time, so a report cannot tell when in the day anything happened.

import { FEATURES, FLAGS, LIMITS, LANGS, MODES, EXPERIMENTS } from './usage-schema.js';

export const WEEK_MS = 7 * 86_400_000;
const FIRST_REPORT_AFTER_MS = 20 * 3_600_000; // the day after turning sharing on: the first report carries the first day
const KEEP_DAYS = 800; // active days kept on the device (about two years)

/** Whole days since 1970 of a local calendar date: the same number whatever the time of day or the daylight-saving switch. */
export function dayNumber(ms) {
  const d = new Date(ms);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

/**
 * @typedef {{ v: 1, base: number, days: number[], first: Record<string, number>, total: Record<string, number>, period: Record<string, number> }} Usage
 * `base` is the install day (a day number), `days` the active days as ages, `first` the age at the first use of a feature, `total` all uses, `period` uses since the last report.
 */

/** @param {number} installedAt ms @returns {Usage} */
export function emptyUsage(installedAt) {
  return { v: 1, base: dayNumber(installedAt || Date.now()), days: [], first: {}, total: {}, period: {} };
}

/** A stored value that may be missing or damaged → a usable record.
 * @returns {Usage} */
export function normalizeUsage(/** @type {any} */ u, /** @type {number} */ installedAt) {
  if (!u || typeof u !== 'object' || u.v !== 1 || !Number.isInteger(u.base)) return emptyUsage(installedAt);
  const obj = (/** @type {any} */ o) => (o && typeof o === 'object' && !Array.isArray(o) ? Object.fromEntries(Object.entries(o).filter(([k, v]) => FEATURES.includes(k) && Number.isInteger(v) && v >= 0)) : {});
  return { v: /** @type {1} */ (1), base: u.base, days: Array.isArray(u.days) ? [...new Set(u.days.filter((/** @type {any} */ n) => Number.isInteger(n) && n >= 0))].sort((a, b) => a - b).slice(-KEEP_DAYS) : [], first: obj(u.first), total: obj(u.total), period: obj(u.period) };
}

export const ageOf = (/** @type {Usage} */ u, /** @type {number} */ now) => Math.max(0, dayNumber(now) - u.base);

/** Count one use of `feature` (a name that is not in the list is ignored). Mutates and returns `u`. */
export function record(/** @type {Usage} */ u, /** @type {string} */ feature, /** @type {number} */ now) {
  if (!FEATURES.includes(feature)) return u;
  const age = ageOf(u, now);
  if (!u.days.includes(age)) { u.days.push(age); u.days.sort((a, b) => a - b); if (u.days.length > KEEP_DAYS) u.days.splice(0, u.days.length - KEEP_DAYS); }
  if (!(feature in u.first)) u.first[feature] = age;
  u.total[feature] = Math.min(LIMITS.maxCount, (u.total[feature] || 0) + 1);
  u.period[feature] = Math.min(LIMITS.maxCount, (u.period[feature] || 0) + 1);
  return u;
}

/** A 32-bit hash of a text (FNV-1a): enough to spread people over the arms of an experiment evenly and the same way every time. */
export function hash32(/** @type {string} */ text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; // a final mix, so that the low bits (which choose between two arms) are as good as the rest
  return h >>> 0;
}

/**
 * The arm of each experiment this device is in, as "id:arm". `seed` is a random number kept on the device and never sent, so the same device is always in the same arm
 * and nothing in the report can be traced back to it.
 * @param {string} seed @param {{ id: string, arms: string[] }[]} [list]
 */
export const assignArms = (seed, list = EXPERIMENTS) => list.filter((e) => e.arms.length > 0).map((e) => `${e.id}:${e.arms[hash32(`${seed}:${e.id}`) % e.arms.length]}`);

/** @typedef {{ id: string, app: string, br: string, os: string, lang: string, look: string, layout: string, mode: string, flags?: string[], experiments?: string[] }} ReportContext */

/** The report as it would be sent now. The caller checks it with validateReport before sending. */
export function buildReport(/** @type {Usage} */ u, /** @type {ReportContext} */ ctx, /** @type {number} */ now) {
  const age = ageOf(u, now);
  const slug = (/** @type {any} */ s, /** @type {string} */ fallback) => (typeof s === 'string' && /^[a-z0-9-]{1,24}$/.test(s) ? s : fallback);
  return {
    v: 1, id: ctx.id, app: ctx.app, br: ctx.br, os: ctx.os,
    lang: LANGS.includes(ctx.lang) ? ctx.lang : 'en',
    look: slug(ctx.look, 'calm'), layout: slug(ctx.layout, 'today'), mode: MODES.includes(ctx.mode) ? ctx.mode : 'auto',
    age,
    act: u.days.filter((d) => d <= age).slice(-LIMITS.days),
    first: { ...u.first },
    ft: { ...u.period },
    ...(ctx.flags ? { fl: FLAGS.filter((f) => ctx.flags?.includes(f)) } : {}), // in the order of the list: the same setup is always the same text
    ...(ctx.experiments && ctx.experiments.length ? { x: [...ctx.experiments] } : {}),
  };
}

/** After a report was accepted: the counters of the period start again (the days and the first uses stay: they are the history). */
export function afterReport(/** @type {Usage} */ u) { u.period = {}; return u; }

/** After a report was accepted: take away exactly what was in it, so a use that happened while it was on its way is counted in the next one. */
export function subtractPeriod(/** @type {Usage} */ u, /** @type {Record<string, number>} */ sent) {
  for (const [f, n] of Object.entries(sent)) { const left = (u.period[f] || 0) - n; if (left > 0) u.period[f] = left; else delete u.period[f]; }
  return u;
}

/** The interface mode of the settings in the words of a report. */
export const modeOf = (/** @type {string} */ m) => (m === 'light' || m === 'dark' ? m : 'auto');

/**
 * The version of what a "yes" covers (the list of fields, the purpose, the recipients). Raise it when any of those changes: reports stop until the person has agreed again,
 * because a consent is for what it was given for.
 */
export const CONSENT_VERSION = 1;

/** The rhythm of the question: after "Not now" it waits this long and is asked once more, never a third time. A good moment is right after a finished session; failing that, a week of waiting. */
export const ASK_TIMING = { laterMs: 21 * 86_400_000, peakMs: 30 * 60_000, patienceMs: 7 * 86_400_000, maxDeferrals: 1 };

/** Does this stored consent cover what is sent now? A consent given before the last change of CONSENT_VERSION does not. */
export const consentCurrent = (/** @type {any} */ share) => !!share && (share.consentV ?? 1) === CONSENT_VERSION;

/**
 * May the question be asked at all? Only to someone who has finished a focus session and come back on another day, only when there is a collector to share with, never after a
 * "no" (`askedAt`), not for three weeks after a "not now", and not a second time after that. A consent that is out of date asks again (it is a new question).
 * `share` is the stored consent.
 */
export function shouldAsk(/** @type {Usage} */ u, /** @type {any} */ share, /** @type {boolean} */ haveEndpoint, now = Date.now()) {
  if (!haveEndpoint || (u.total.focus_done || 0) < 1 || u.days.length < 2) return false;
  if (share && share.on) return !consentCurrent(share); // already agreed: only a changed scope asks again
  if (share && share.askedAt) return false;
  if (share && share.deferredAt && now - share.deferredAt < ASK_TIMING.laterMs) return false;
  return true;
}

/**
 * Is this a good moment for the question that may be asked? Right after a finished session (the person has just got something out of EyeTime), or, if that never happens,
 * once the question has been waiting a week. Never mid-session (the caller checks).
 */
export function goodMoment(/** @type {any} */ share, /** @type {number} */ now, /** @type {boolean} */ justFinished) {
  return justFinished || (!!share && !!share.eligibleAt && now - share.eligibleAt >= ASK_TIMING.patienceMs);
}

/**
 * Is a report due? `share` is the stored consent: `{ on, optInAt, lastReportAt, lastTryAt }`.
 * Weekly, the first one a day after turning sharing on; a failed try waits six hours.
 */
export function reportDue(/** @type {any} */ share, /** @type {number} */ now, /** @type {boolean} */ haveEndpoint) {
  if (!haveEndpoint || !share || share.on !== true || typeof share.id !== 'string' || !consentCurrent(share)) return false;
  if (share.lastTryAt && now - share.lastTryAt < 6 * 3_600_000) return false;
  if (!share.lastReportAt) return now - (share.optInAt || now) >= FIRST_REPORT_AFTER_MS;
  return now - share.lastReportAt >= WEEK_MS - 3_600_000;
}

/** The coarse browser and system, from the user-agent text. Versions, models and anything finer are not looked at. */
export function detectEnv(/** @type {string} */ ua = '', /** @type {string} */ platform = '') {
  const s = String(ua);
  const br = /Firefox\//.test(s) ? 'firefox' : /Edg\//.test(s) ? 'edge' : /Chrome\//.test(s) ? 'chrome' : 'other';
  const p = (String(platform) + ' ' + s).toLowerCase();
  const os = /cros/.test(p) ? 'cros' : /mac/.test(p) ? 'mac' : /win/.test(p) ? 'win' : /linux|x11/.test(p) ? 'linux' : 'other';
  return { br, os };
}

/** A random identifier with no meaning: 128 random bits as 32 hex characters. */
export function newId(/** @type {(a: Uint8Array<ArrayBuffer>) => Uint8Array} */ fill = (a) => { crypto.getRandomValues(a); return a; }) {
  return [...fill(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Finished-session length (minutes) → the counter that records it. */
export const lengthFeature = (/** @type {number} */ minutes) => (minutes < 15 ? 'fl_u15' : minutes < 25 ? 'fl_u25' : minutes < 35 ? 'fl_u35' : minutes < 50 ? 'fl_u50' : minutes < 75 ? 'fl_u75' : 'fl_75p');

/** Why a page was stopped → the counter that records it (null for a reason that is not one of the six). */
export const blockFeature = (/** @type {string} */ reason) => ({ always: 'bp_always', focus: 'bp_focus', schedule: 'bp_schedule', limit: 'bp_limit', budget: 'bp_budget', friction: 'bp_friction' }[reason] || null);

/** Milliseconds until the new tab was ready → the counter that records it. */
export const speedFeature = (/** @type {number} */ ms) => (ms < 100 ? 'nt_u100' : ms < 250 ? 'nt_u250' : ms < 500 ? 'nt_u500' : ms < 1000 ? 'nt_u1000' : 'nt_slow');

/** Where an error came from (the first word of the place it was logged) → the counter that records it. Nothing of the error itself is kept. */
export function errorFeature(/** @type {string} */ src) {
  const s = String(src || '');
  if (/^(blocker|instant)/.test(s)) return 'err_blocker';
  if (/^(sync|tasksync|conn|boot:(sync|armConn))/.test(s)) return 'err_sync';
  if (/^worker/.test(s)) return 'err_worker';
  if (/^(page|newtab|popup|options|insights|blocked|break|onboarding|dock|ui)/.test(s)) return 'err_page';
  return 'err_other';
}

const bucket = (/** @type {number} */ n, /** @type {number[]} */ edges, /** @type {string[]} */ names) => { for (let i = 0; i < edges.length; i++) if (n <= edges[i]) return names[i]; return names[names.length - 1]; };

/**
 * What is switched on, from the settings and a few stored lists. `raw` holds what lives next to the settings: { syncSettings, syncTasks, syncEnc, tasks, habits, conns, calendarSubs }.
 * @param {any} s settings @param {any} raw @returns {string[]}
 */
export function flagsOf(s, raw = {}) {
  const on = new Set();
  const add = (/** @type {any} */ c, /** @type {string} */ f) => { if (c) on.add(f); };
  const len = (/** @type {any} */ x) => (Array.isArray(x) ? x.length : x && typeof x === 'object' ? Object.keys(x).length : 0);
  add(s.ritual?.on, 'ritual'); add(s.dock?.enabled, 'dock'); add(s.weather?.on, 'weather'); add(len(raw.calendarSubs) > 0 || s.calendar?.url, 'calendar');
  add(raw.syncTasks, 'tasks_sync'); add(raw.syncSettings, 'settings_sync'); add(raw.syncEnc, 'sync_encrypted'); add(s.blocking?.instant, 'instant_block'); add(s.smartSites?.on, 'smart_sites');
  add(len(raw.conns) > 0, 'connections'); add(s.blocking?.schedule?.enabled, 'schedule'); add(len(s.blocking?.limits) > 0, 'limits'); add(s.blocking?.budget?.enabled, 'budget');
  add(s.blocking?.friction?.enabled, 'friction'); add(s.eye?.notify, 'eye_notify'); add(s.eye?.bedtime?.enabled, 'bedtime'); add(s.standby?.on, 'standby');
  add(String(s.appearance?.customCss || '').trim(), 'custom_css'); add(s.companion?.enabled, 'companion'); add(s.focus?.dailyGoal > 0, 'daily_goal'); add(s.focus?.sound, 'focus_sound'); add(s.focus?.review, 'review');
  const tasks = Array.isArray(raw.tasks) ? raw.tasks.filter((/** @type {any} */ t) => t && !t.done).length : 0;
  on.add(bucket(tasks, [0, 5, 20], ['tasks_0', 'tasks_1_5', 'tasks_6_20', 'tasks_21p']));
  on.add(bucket(len(raw.habits?.items), [0, 2], ['habits_0', 'habits_1_2', 'habits_3p']));
  on.add(bucket(len(s.blocking?.custom), [0, 5], ['sites_0', 'sites_1_5', 'sites_6p']));
  return FLAGS.filter((f) => on.has(f));
}
