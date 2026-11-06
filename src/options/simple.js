// "Essentials / All settings": which settings are for everybody and which are for the few who go looking. Pure data and functions (no DOM), so the list can be tested against the defaults.
//
// Each entry is a setting (or a group of them) that is hidden in the essentials view. It stays visible there when the person has already changed it from the default
// (`paths`: places in the settings object) or uses it (`raw`: things kept outside the settings object, e.g. a calendar subscription): the view must never hide something that is in use.
// Search and the "All settings" view always show everything.

import { DEFAULT_SETTINGS } from '../shared/defaults.js';

/** @type {Record<string, { paths?: string[], raw?: string[] }>} */
export const ADV = {
  // General, Home
  dock: { paths: ['dock.enabled', 'dock.hidden'] },
  smartSites: { paths: ['smartSites.on'] },
  weather: { paths: ['weather.on'] },
  quotesMore: { paths: ['quotes.home', 'quotes.pause', 'quotes.rest', 'quotes.start', 'quotes.every'] },
  standby: { paths: ['standby.on'] },
  // Appearance
  shape: { paths: ['appearance.font', 'appearance.scale', 'appearance.radius', 'appearance.density', 'appearance.cards', 'appearance.motion'] },
  appearanceAdv: { paths: ['appearance.customCss'] },
  ritualTime: { paths: ['ritual.eveningAt'] },
  // Focus
  presets: { paths: ['focus.presets'] },
  longBreak: { paths: ['focus.longBreak'] },
  goalDays: { paths: ['focus.goalDays'] },
  streakGrace: { paths: ['focus.streakGrace'] },
  review: { paths: ['focus.review'] },
  modes: { paths: ['focus.modes'] },
  reminders: { paths: ['focus.reminders'] },
  focusExtras: { paths: ['focus.sound', 'focus.openUrl', 'focus.suggestBreak'] },
  // Blocking
  friction: { paths: ['blocking.friction', 'blocking.budget', 'blocking.plans'] },
  instant: { paths: ['blocking.instant'] },
  schedule: { paths: ['blocking.schedule'] },
  limits: { paths: ['blocking.limits'] },
  feed: { paths: ['blocking.feed'] },
  // Eye care, Tracking
  eyeNotify: { paths: ['eye.notify'] },
  bedtime: { paths: ['eye.bedtime'] },
  trackMore: { paths: ['tracking.idleSeconds', 'tracking.countAudible', 'tracking.incognito'] },
  excluded: { paths: ['tracking.excluded'] },
  companion: { paths: ['companion.enabled'] },
  // Data & privacy
  calendar: { paths: ['calendar'], raw: ['calendar', 'calendarSrc', 'calendarSubs'] },
  tasksIO: {},
  sync: { raw: ['syncSettings', 'syncTasks', 'syncEnc'] },
  backupMore: {},
};

/** The raw storage keys the entries above look at. */
export const RAW_KEYS = [...new Set(Object.values(ADV).flatMap((e) => e.raw || []))];

const get = (/** @type {any} */ o, /** @type {string} */ path) => path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
/** JSON with the keys in order: the storage hands objects back with their keys sorted, and that is not a change. */
const canon = (/** @type {any} */ v) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x));
export const isModified = (/** @type {any} */ s, /** @type {string[]} */ paths) => paths.some((p) => canon(get(s, p)) !== canon(get(DEFAULT_SETTINGS, p)));

/** Raw storage values → the keys that hold something (a calendar, a subscription, sync switched on). */
export function touchedRaw(/** @type {Record<string, any>} */ raw) {
  const set = new Set();
  for (const [k, v] of Object.entries(raw || {})) {
    if (v === true || (typeof v === 'number' && v > 0) || (Array.isArray(v) && v.length) || (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length)) set.add(k);
  }
  return set;
}

/** Is this entry hidden in the essentials view, for these settings? (False when the person already changed or uses it.) */
export function isAdvanced(/** @type {string} */ id, /** @type {any} */ s, /** @type {Set<string>} */ touched = new Set()) {
  const e = ADV[id];
  if (!e) throw new Error('unknown advanced setting: ' + id);
  if (e.paths && s && isModified(s, e.paths)) return false;
  if (e.raw && e.raw.some((k) => touched.has(k))) return false;
  return true;
}

export const MODE_KEY = 'et-settings-mode';
/** The view that was chosen on this device: 'essentials' (the default) or 'all'. */
export function readMode() { try { return localStorage.getItem(MODE_KEY) === 'all' ? 'all' : 'essentials'; } catch { return 'essentials'; } }
export function writeMode(/** @type {'essentials' | 'all'} */ m) { try { localStorage.setItem(MODE_KEY, m); } catch { /* private mode: the choice lasts until the page closes */ } }
