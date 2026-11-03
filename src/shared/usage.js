// Usage measurement, the pure part. EyeTime counts, on the device and always, which of its own features get used and on how many days;
// the numbers go nowhere unless the person switches "Share anonymous usage" on (see usage-store.js, background/usage.js and PRIVACY.md).
//
//   record(u, 'focus_start', now)       count one use, mark today active, remember the first time
//   buildReport(u, ctx, now)            the exact JSON that would be sent (usage-schema.js says what it may hold)
//
// Time is counted in whole local days since the install ("age"), never as a clock time, so a report cannot tell when in the day anything happened.

import { FEATURES, LIMITS, LANGS, MODES } from './usage-schema.js';

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

/** @typedef {{ id: string, app: string, br: string, os: string, lang: string, look: string, layout: string, mode: string }} ReportContext */

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
 * Show the one-time question "share anonymous usage?" Only to someone who has finished a focus session and come back on another day, only once,
 * and only when there is a collector to share with. `share` is the stored consent.
 */
export function shouldAsk(/** @type {Usage} */ u, /** @type {any} */ share, /** @type {boolean} */ haveEndpoint) {
  return haveEndpoint && !(share && (share.on || share.askedAt)) && (u.total.focus_done || 0) >= 1 && u.days.length >= 2;
}

/**
 * Is a report due? `share` is the stored consent: `{ on, optInAt, lastReportAt, lastTryAt }`.
 * Weekly, the first one a day after turning sharing on; a failed try waits six hours.
 */
export function reportDue(/** @type {any} */ share, /** @type {number} */ now, /** @type {boolean} */ haveEndpoint) {
  if (!haveEndpoint || !share || share.on !== true || typeof share.id !== 'string') return false;
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
