// What the optional, anonymous usage report may contain — and nothing else. This one file is read by the extension (to build and to check a report before it
// leaves) and by the reference server (to refuse anything that is not exactly this), so the two cannot drift apart. It has no browser or storage code.
//
// A report holds counters and ages in days. It never holds a URL, a domain, a task, a note, a goal, a title, a time of day, an IP address or a name.

/** The things whose use is counted. Anything else is dropped before it is stored. */
export const FEATURES = [
  'newtab_view', 'popup_open', 'insights_view', 'settings_view',
  'focus_start', 'focus_done', 'focus_stop', 'focus_pause',
  'eye_break_done', 'eye_break_skip', 'block_page', 'block_continue',
  'task_add', 'task_done', 'habit_check', 'shutdown_done', 'plan_done',
  'palette_open', 'drawer_open', 'editor_open', 'starter_apply', 'wall_next', 'standby_open',
];

export const BROWSERS = ['chrome', 'edge', 'firefox', 'other'];
export const SYSTEMS = ['mac', 'win', 'linux', 'cros', 'other'];
export const LANGS = ['en', 'ru', 'es', 'de', 'fr', 'pt', 'it', 'pl', 'uk', 'zh', 'ja'];
export const MODES = ['light', 'dark', 'auto'];

export const LIMITS = { days: 60, maxAge: 4000, maxCount: 100_000, bytes: 2048 };

const SLUG = /^[a-z0-9-]{1,24}$/;
const VERSION = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const ID = /^[0-9a-f]{32}$/;
const isInt = (/** @type {any} */ n, /** @type {number} */ max) => Number.isInteger(n) && n >= 0 && n <= max;

/** The keys of a report, in the order they are written. */
export const REPORT_KEYS = ['v', 'id', 'app', 'br', 'os', 'lang', 'look', 'layout', 'mode', 'age', 'act', 'first', 'ft'];

/**
 * Check a report. Strict on purpose: an unknown key, a value outside its list or a number outside its range makes the whole report invalid.
 * @param {any} r @returns {{ ok: true } | { ok: false, why: string }}
 */
export function validateReport(r) {
  const bad = (/** @type {string} */ why) => ({ ok: /** @type {const} */ (false), why });
  if (!r || typeof r !== 'object' || Array.isArray(r)) return bad('not an object');
  for (const k of Object.keys(r)) if (!REPORT_KEYS.includes(k)) return bad('unknown key ' + k);
  if (r.v !== 1) return bad('version');
  if (typeof r.id !== 'string' || !ID.test(r.id)) return bad('id');
  if (typeof r.app !== 'string' || !VERSION.test(r.app)) return bad('app');
  if (!BROWSERS.includes(r.br)) return bad('browser');
  if (!SYSTEMS.includes(r.os)) return bad('system');
  if (!LANGS.includes(r.lang)) return bad('language');
  if (typeof r.look !== 'string' || !SLUG.test(r.look)) return bad('look');
  if (typeof r.layout !== 'string' || !SLUG.test(r.layout)) return bad('layout');
  if (!MODES.includes(r.mode)) return bad('mode');
  if (!isInt(r.age, LIMITS.maxAge)) return bad('age');
  if (!Array.isArray(r.act) || r.act.length > LIMITS.days || !r.act.every((n) => isInt(n, LIMITS.maxAge))) return bad('active days');
  if (new Set(r.act).size !== r.act.length) return bad('active days repeat');
  for (const [name, max] of /** @type {[string, number][]} */ ([['first', LIMITS.maxAge], ['ft', LIMITS.maxCount]])) {
    const o = r[name];
    if (!o || typeof o !== 'object' || Array.isArray(o)) return bad(name);
    for (const [k, v] of Object.entries(o)) if (!FEATURES.includes(k) || !isInt(v, max)) return bad(`${name}.${k}`);
  }
  if (JSON.stringify(r).length > LIMITS.bytes) return bad('too big');
  return { ok: true };
}

/** A request to forget everything held for an id (sent when someone turns sharing off). */
export function validateForget(r) {
  return !!r && typeof r === 'object' && Object.keys(r).length === 3 && r.v === 1 && r.op === 'forget' && typeof r.id === 'string' && ID.test(r.id);
}
