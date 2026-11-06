// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// What the optional, anonymous usage report may contain — and nothing else. This one file is read by the extension (to build and to check a report before it
// leaves) and by the reference server (to refuse anything that is not exactly this), so the two cannot drift apart. It has no browser or storage code.
//
// A report holds counters and ages in days. It never holds a URL, a domain, a task, a note, a goal, a title, a time of day, an IP address or a name.

/** The things whose use is counted. Anything else is dropped before it is stored. */
export const FEATURES = [
  'newtab_view', 'popup_open', 'insights_view', 'settings_view',
  'focus_start', 'focus_done', 'focus_stop', 'focus_pause',
  'eye_break_done', 'eye_break_skip', 'block_page', 'block_continue',
  'task_add', 'task_done', 'habit_check', 'shutdown_done', 'plan_done', 'ritual_plan', 'ritual_skip', 'connection_add',
  'palette_open', 'drawer_open', 'editor_open', 'starter_apply', 'wall_next', 'standby_open',
  // the first run
  'onboarding_done',
  // how sessions go: finished ones by length (planned minutes), and sessions stopped in the first five minutes (the start was a mistake or the goal was too big)
  'fl_u15', 'fl_u25', 'fl_u35', 'fl_u50', 'fl_u75', 'fl_75p', 'fl_early_stop',
  // which mechanism stopped a page: the person's own list, a session, work hours, a daily limit, the daily budget, the pause
  'bp_always', 'bp_focus', 'bp_schedule', 'bp_limit', 'bp_budget', 'bp_friction',
  // how fast the new tab was ready, in milliseconds (the speed that is promised, measured where it is lived)
  'nt_u100', 'nt_u250', 'nt_u500', 'nt_u1000', 'nt_slow',
  // errors by where they came from (a count: the text of an error never leaves the device)
  'err_worker', 'err_page', 'err_blocker', 'err_sync', 'err_other',
];

/**
 * The setup, as a list of the things that are ON (a state, not a count of uses): which optional parts of EyeTime a person keeps after trying them,
 * plus a few sizes in coarse steps (how many tasks, habits and own sites). A name that is not in this list is never sent.
 */
export const FLAGS = [
  'ritual', 'dock', 'weather', 'calendar', 'tasks_sync', 'settings_sync', 'sync_encrypted', 'instant_block', 'smart_sites', 'connections',
  'schedule', 'limits', 'budget', 'friction', 'eye_notify', 'bedtime', 'standby', 'custom_css', 'companion', 'daily_goal', 'focus_sound', 'review',
  'tasks_0', 'tasks_1_5', 'tasks_6_20', 'tasks_21p', 'habits_0', 'habits_1_2', 'habits_3p', 'sites_0', 'sites_1_5', 'sites_6p',
];

/**
 * Experiments that may be running, each with its arms (the first arm is the control). Empty until one is started (docs/MEASUREMENT.md says how). A person is put in an arm
 * on the device, by a random number that is kept there and never sent; a report says only which arm ("onboarding-v2:short"), and only for an experiment in this list.
 * @type {{ id: string, arms: string[] }[]}
 */
export const EXPERIMENTS = [];

/** Why someone removed EyeTime, as the page that opens after removal offers it. One click, no text, no identifier: a count per day on the collector. */
export const UNINSTALL_REASONS = ['slow', 'broken', 'not_useful', 'too_strict', 'other_tool', 'temporary', 'other'];

/**
 * The Windows app is a second product with its own, smaller list of counters (a report says `pr: "win"`). Only the names below can be sent, and none of them can hold a program,
 * a site, a path, a window title or a rule name: they count kinds of events.
 */
export const WIN_FEATURES = [
  // what was closed, by the reason the engine gave (a program or a page, never which one)
  'blk_rule', 'blk_session', 'blk_limit', 'blk_cool',
  // the challenge shown before something is loosened, and how it ends: by kind of challenge and by what it was for
  'ch_shown', 'ch_done', 'ch_wrong', 'ch_expired', 'ch_hold', 'ch_wait', 'ch_type', 'ch_math', 'ch_pin', 'ch_friend',
  'ch_for_end', 'ch_for_break', 'ch_for_unblock', 'ch_for_edit', 'ch_for_emergency',
  // focus sessions started by hand
  'ses_start', 'ses_done', 'ses_stop',
  // the window and the service
  'ui_open', 'svc_start', 'svc_unclean',
  // updates
  'upd_found', 'upd_applied', 'upd_failed',
];
/** What is set up in the Windows app (a state, from the list). Windows 10 or 11 is a flag too. */
export const WIN_FLAGS = ['pin', 'partner_pin', 'auto_update', 'browser_ext', 'locked_rules', 'limits', 'schedule', 'sessions_used', 'strict', 'w10', 'w11'];
export const PRODUCTS = ['ext', 'win'];

export const BROWSERS = ['chrome', 'edge', 'firefox', 'other'];
export const SYSTEMS = ['mac', 'win', 'linux', 'cros', 'other'];
export const LANGS = ['en', 'ru', 'es', 'de', 'fr', 'pt', 'it', 'pl', 'uk', 'zh', 'ja'];
export const MODES = ['light', 'dark', 'auto'];

export const LIMITS = { days: 60, maxAge: 4000, maxCount: 100_000, bytes: 6144 };

const SLUG = /^[a-z0-9-]{1,24}$/;
const VERSION = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const ID = /^[0-9a-f]{32}$/;
const isInt = (/** @type {any} */ n, /** @type {number} */ max) => Number.isInteger(n) && n >= 0 && n <= max;

/** The keys of a report, in the order they are written. */
export const REPORT_KEYS = ['v', 'id', 'pr', 'app', 'br', 'os', 'lang', 'look', 'layout', 'mode', 'age', 'act', 'first', 'ft', 'fl', 'x'];
/** The keys of a report of the Windows app: no browser, look, layout or mode, no experiments. */
export const WIN_REPORT_KEYS = ['v', 'id', 'pr', 'app', 'lang', 'age', 'act', 'first', 'ft', 'fl'];

/**
 * Check a report. Strict on purpose: an unknown key, a value outside its list or a number outside its range makes the whole report invalid.
 * @param {any} r @param {{ id: string, arms: string[] }[]} [experiments] the experiments that may be running (default: EXPERIMENTS)
 * @returns {{ ok: true } | { ok: false, why: string }}
 */
export function validateReport(r, experiments = EXPERIMENTS) {
  const bad = (/** @type {string} */ why) => ({ ok: /** @type {const} */ (false), why });
  if (!r || typeof r !== 'object' || Array.isArray(r)) return bad('not an object');
  if ('pr' in r && !PRODUCTS.includes(r.pr)) return bad('product');
  const win = r.pr === 'win';
  if (r.pr === 'ext') return bad('product'); // the extension says nothing: that is what it always did
  for (const k of Object.keys(r)) if (!(win ? WIN_REPORT_KEYS : REPORT_KEYS).includes(k)) return bad('unknown key ' + k);
  if (r.v !== 1) return bad('version');
  if (typeof r.id !== 'string' || !ID.test(r.id)) return bad('id');
  if (typeof r.app !== 'string' || !VERSION.test(r.app)) return bad('app');
  if (!LANGS.includes(r.lang)) return bad('language');
  if (!win) {
    if (!BROWSERS.includes(r.br)) return bad('browser');
    if (!SYSTEMS.includes(r.os)) return bad('system');
    if (typeof r.look !== 'string' || !SLUG.test(r.look)) return bad('look');
    if (typeof r.layout !== 'string' || !SLUG.test(r.layout)) return bad('layout');
    if (!MODES.includes(r.mode)) return bad('mode');
  }
  const counters = win ? WIN_FEATURES : FEATURES, flagList = win ? WIN_FLAGS : FLAGS;
  if (!isInt(r.age, LIMITS.maxAge)) return bad('age');
  if (!Array.isArray(r.act) || r.act.length > LIMITS.days || !r.act.every((n) => isInt(n, LIMITS.maxAge))) return bad('active days');
  if (new Set(r.act).size !== r.act.length) return bad('active days repeat');
  for (const [name, max] of /** @type {[string, number][]} */ ([['first', LIMITS.maxAge], ['ft', LIMITS.maxCount]])) {
    const o = r[name];
    if (!o || typeof o !== 'object' || Array.isArray(o)) return bad(name);
    for (const [k, v] of Object.entries(o)) if (!counters.includes(k) || !isInt(v, max)) return bad(`${name}.${k}`);
  }
  if ('fl' in r) { // optional: an earlier version of EyeTime does not send it
    if (!Array.isArray(r.fl) || r.fl.length > flagList.length || !r.fl.every((f) => flagList.includes(f)) || new Set(r.fl).size !== r.fl.length) return bad('flags');
  }
  if ('x' in r) { // optional: the arms of the experiments that are running, "id:arm", at most one per experiment
    const known = new Set(experiments.flatMap((e) => e.arms.map((a) => `${e.id}:${a}`)));
    if (!Array.isArray(r.x) || r.x.length > Math.max(1, experiments.length) || !r.x.every((a) => typeof a === 'string' && known.has(a)) || new Set(r.x.map((a) => a.split(':')[0])).size !== r.x.length) return bad('experiments');
  }
  if (JSON.stringify(r).length > LIMITS.bytes) return bad('too big');
  return { ok: true };
}

/** A request to forget everything held for an id (sent when someone turns sharing off). */
export function validateForget(r) {
  return !!r && typeof r === 'object' && Object.keys(r).length === 3 && r.v === 1 && r.op === 'forget' && typeof r.id === 'string' && ID.test(r.id);
}
