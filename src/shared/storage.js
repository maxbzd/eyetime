// chrome.storage.local access layer shared by the service worker and every page.
//
// Layout
//   settings            user preferences (see defaults.js)
//   meta                { schemaVersion, installedAt }
//   focus               the running focus session, or null
//   passes              { [ruleDomain]: untilTs }  temporary "continue" permissions
//   tasks / habits / captures / links   small user data used by the new tab
//   d:YYYY-MM-DD        one record per day (see stats.js) – small, independent writes
//   newtabBg            custom background photo (data URL)

import { normalizeCalendarUrl } from './calsub.js';
import { DEFAULT_SETTINGS, deepMerge, clone, SCHEMA_VERSION } from './defaults.js';
import { migrate, needsMigration, upgradeSettingsV2 } from './migrate.js';
import { dayKey, rangeKeys, addDays } from './time.js';
import { emptyDay, slimDay } from './stats.js';

export const DAY_PREFIX = 'd:';
export const RETENTION_DAYS = 400;

const area = () => chrome.storage.local;

export async function getRaw(keys) { return area().get(keys); }
export async function setRaw(obj) { return area().set(obj); }

/* ---------- settings ---------- */

export async function getSettings() {
  const { settings } = await area().get('settings');
  const s = deepMerge(DEFAULT_SETTINGS, settings || {});
  // the synthesised "café" ambience was replaced by real recordings in 2.5.3
  if (s.focus.ambient === 'cafe') s.focus.ambient = 'rain';
  for (const m of s.focus.modes || []) if (m && m.ambient === 'cafe') m.ambient = 'rain';
  return s;
}

let settingsQueue = Promise.resolve();
/**
 * Read-modify-write with a per-context queue. `fn` may mutate and return nothing, or return a new object.
 * `settingsUpdatedAt` (what settings sync compares) moves only when the settings really changed, and not at all with
 * `{ touch: false }` — for "last used" bookkeeping (session length, mode…) that must never win over a deliberate edit made elsewhere.
 */
export function updateSettings(fn, { touch = true } = {}) {
  const run = async () => {
    const cur = await getSettings();
    const before = JSON.stringify(cur);
    const next = fn(cur) || cur;
    const changed = JSON.stringify(next) !== before;
    await area().set(changed && touch ? { settings: next, settingsUpdatedAt: Date.now() } : { settings: next });
    return next;
  };
  const p = settingsQueue.then(run, run);
  settingsQueue = p.catch(() => {});
  return p;
}

/** Subscribe to storage changes of the given top-level keys. Returns an unsubscribe function. */
export function onChange(keys, cb) {
  const set = new Set([].concat(keys));
  const handler = (changes, areaName) => {
    if (areaName !== 'local') return;
    const hit = Object.keys(changes).filter((k) => set.has(k) || [...set].some((s) => s.endsWith('*') && k.startsWith(s.slice(0, -1))));
    if (hit.length) cb(changes);
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

/* ---------- days ---------- */

export const dayStorageKey = (key) => DAY_PREFIX + key;

export async function getDays(keys) {
  const raw = await area().get(keys.map(dayStorageKey));
  return keys.map((k) => [k, raw[dayStorageKey(k)] || null]);
}

export async function getRange(n, end = new Date()) { return getDays(rangeKeys(n, end)); }

let dayQueue = Promise.resolve();
/** Serialised read-modify-write of a single day record. */
export function updateDay(key, fn) {
  const run = async () => {
    const k = dayStorageKey(key);
    const cur = (await area().get(k))[k] || emptyDay();
    fn(cur);
    await area().set({ [k]: cur });
    return cur;
  };
  const p = dayQueue.then(run, run);
  dayQueue = p.catch(() => {});
  return p;
}

/** Add `sec` seconds on `host` (or a desktop app) to a day. */
/** @param {{ host?: string, app?: string, sec: number, hour: number, date?: Date }} p */
export function addTime({ host = undefined, app = undefined, sec, hour, date = new Date() }) {
  return updateDay(dayKey(date), (day) => {
    if (host) {
      day.d[host] = (day.d[host] || 0) + sec;
      const slot = ((day.h ||= {})[hour] ||= {});
      slot[host] = (slot[host] || 0) + sec;
    } else if (app) {
      day.a[app] = (day.a[app] || 0) + sec;
    }
  });
}

export async function pruneOldDays(now = new Date()) {
  const cutoff = dayKey(addDays(now, -RETENTION_DAYS));
  const all = await area().get(null);
  const stale = Object.keys(all).filter((k) => k.startsWith(DAY_PREFIX) && k.slice(DAY_PREFIX.length) < cutoff);
  if (stale.length) await area().remove(stale);
  await slimIfNearQuota(all, cutoff);
  return stale.length;
}

/** chrome.storage.local holds 10 MB. A very heavy browser (100+ sites a day) can approach that over 400 days:
 *  past 8 MB the per-hour breakdown of days older than 120 days is dropped first (daily totals, sessions and the calendar stay). */
export const LOCAL_QUOTA = 10_000_000;
const SOFT_QUOTA = 8_000_000, SLIM_AFTER_DAYS = 120;
const isFirefox = () => typeof chrome.runtime.getBrowserInfo === 'function'; // Firefox has no 10 MB cap

/** How much room the history takes: { bytes (day records), total (everything), days, limit (null where there is no cap) }. */
export async function storageUsage() {
  const all = await area().get(null);
  const dayKeys = Object.keys(all).filter((k) => k.startsWith(DAY_PREFIX));
  return { bytes: await area().getBytesInUse(dayKeys), total: await area().getBytesInUse(null), days: dayKeys.length, limit: isFirefox() ? null : LOCAL_QUOTA };
}

/** The "Free up space" button: drops the hour-by-hour detail of days older than `afterDays` (totals, sessions and tasks stay). → number of days slimmed. */
export async function slimNow(afterDays = 30) {
  const all = await area().get(null);
  return slimDays(all, dayKey(addDays(new Date(), -RETENTION_DAYS)), afterDays);
}

async function slimIfNearQuota(all, cutoff) {
  if (isFirefox()) return 0; // never thin out history there
  const dayKeys = Object.keys(all).filter((k) => k.startsWith(DAY_PREFIX));
  if ((await area().getBytesInUse(dayKeys)) < SOFT_QUOTA) return 0; // only the day records decide (a big background photo is not a reason to drop history)
  return slimDays(all, cutoff, SLIM_AFTER_DAYS);
}

async function slimDays(all, cutoff, afterDays) {
  const slimBefore = dayKey(addDays(new Date(), -afterDays));
  const patch = {};
  for (const [k, v] of Object.entries(all)) {
    if (!k.startsWith(DAY_PREFIX) || k.slice(DAY_PREFIX.length) < cutoff || k.slice(DAY_PREFIX.length) >= slimBefore) continue;
    const slim = slimDay(v); if (slim !== v) patch[k] = slim;
  }
  if (Object.keys(patch).length) await area().set(patch);
  return Object.keys(patch).length;
}

/* ---------- small collections ---------- */

export async function getCollection(name, fallback) {
  const v = (await area().get(name))[name];
  return v === undefined ? clone(fallback) : v;
}
export const setCollection = (name, value) => area().set({ [name]: value });

const collectionQueues = new Map();
/** Read-modify-write of one collection through a per-name queue, so the worker's own writers (credit time, review, rollover) never overwrite each other. `fn` mutates or returns the new value. */
export const UNCHANGED = Symbol('unchanged');
export function updateCollection(name, fallback, fn) {
  const run = async () => { const cur = await getCollection(name, fallback); const next = fn(cur); if (next === UNCHANGED) return cur; await setCollection(name, next === undefined ? cur : next); return next === undefined ? cur : next; };
  const p = (collectionQueues.get(name) || Promise.resolve()).then(run, run);
  collectionQueues.set(name, p.catch(() => {}));
  return p;
}

/* ---------- first run & migration ---------- */

/** Ensure the storage layout is current. Safe to call on every service-worker start. */
export async function ensureSchema() {
  const { meta } = await area().get('meta');
  if (meta && (meta.schemaVersion || 0) >= SCHEMA_VERSION) return { migrated: false };
  if (meta && meta.schemaVersion === 2) { // 2.0 -> 2.1: settings only
    const { settings } = await area().get('settings');
    await area().set({ settings: deepMerge(DEFAULT_SETTINGS, upgradeSettingsV2(settings)), meta: { ...meta, schemaVersion: SCHEMA_VERSION } });
    return { migrated: true, from: '2.0' };
  }
  const raw = await area().get(null);
  if (!needsMigration(raw)) return { migrated: false };
  const m = migrate(raw);
  const out = { settings: m.settings, meta: m.meta, tasks: raw.tasks || m.tasks, captures: raw.captures || m.captures };
  if (m.habits) out.habits = m.habits;
  for (const [k, rec] of Object.entries(m.days)) out[dayStorageKey(k)] = rec;
  await area().set(out);
  if (m.removeKeys.length) await area().remove(m.removeKeys);
  return { migrated: true, from: m.meta.migratedFrom };
}

/* ---------- export / import / reset ---------- */

/** A calendar subscription's browser permission goes away with its data (reset / restoring a backup), not only with the Unsubscribe button. */
async function dropCalendarPermission() {
  try {
    const raw = await area().get(['calendarSubs', 'calendarSub']);
    const subs = Array.isArray(raw.calendarSubs) ? raw.calendarSubs : raw.calendarSub ? [raw.calendarSub] : [];
    for (const sub of subs) { const n = sub && sub.url ? normalizeCalendarUrl(sub.url) : null; if (n && n.ok) await chrome.permissions.remove({ origins: [n.pattern] }); }
  } catch { /* no permissions API or nothing to remove */ }
}

export async function exportAll() {
  const all = await area().get(null);
  delete all.newtabBg;
  delete all.tasksBase; delete all.tasksSyncStatus; // device-level sync bookkeeping
  delete all.calendarSub; delete all.calendarSubs; delete all.calendarSrc; // calendar addresses are secrets: they never leave this device, not even in a backup file
  return { app: 'eyetime', version: 2, exportedAt: new Date().toISOString(), data: all };
}

export async function importAll(payload) {
  if (!payload || payload.app !== 'eyetime' || typeof payload.data !== 'object') throw new Error('Not an EyeTime backup');
  const data = payload.data;
  const ver = data.meta?.schemaVersion || 0;
  const m = ver >= 2 ? null : migrate(data);
  // never trust a file blindly: keep only the keys EyeTime itself writes
  const KNOWN = new Set(['settings', 'meta', 'tasks', 'habits', 'captures', 'weekPlan', 'weekPlanPrev', 'estLog']);
  const clean = {};
  for (const [k, v] of Object.entries(data)) if (KNOWN.has(k) || /^d:\d{4}-\d{2}-\d{2}$/.test(k)) clean[k] = v;
  await dropCalendarPermission();
  await area().clear();
  if (m) {
    const out = { settings: m.settings, meta: m.meta, tasks: m.tasks, captures: m.captures };
    if (m.habits) out.habits = m.habits;
    for (const [k, rec] of Object.entries(m.days)) out[dayStorageKey(k)] = rec;
    await area().set(out);
  } else {
    if (ver === 2 && clean.settings) clean.settings = upgradeSettingsV2(clean.settings);
    if (clean.meta) clean.meta = { ...clean.meta, schemaVersion: 2 };
    await area().set(clean);
  }
  await ensureSchema();
}

export async function resetAll() {
  await dropCalendarPermission();
  await area().clear();
  await ensureSchema();
}
