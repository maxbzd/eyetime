// One-way migration from EyeTime 1.x storage to the 2.0 layout. Pure: takes the raw `chrome.storage.local`
// snapshot and returns what to write. Nothing from the old data is lost that still has a home in 2.0.

import { DEFAULT_SETTINGS, deepMerge, SCHEMA_VERSION } from './defaults.js';
import { PRESET_IDS } from './catalog.js';
import { parseUserDomain } from './domains.js';

const doms = (list) => [...new Set((list || []).map(parseUserDomain).filter(Boolean))];

export function needsMigration(raw) {
  return !raw.meta || (raw.meta.schemaVersion || 0) < SCHEMA_VERSION;
}

/** Only 1.x wrote these: a current settings object has a `blocking` key too, so that one proves nothing. */
export const looksLikeV1 = (raw) => !!raw && !!raw.settings && typeof raw.settings === 'object' && !!(raw.settings.interceptor || raw.settings.nuclearLock || raw.stats);

/**
 * @returns {{ settings, tasks, habits, captures, days: Record<string, object>, meta, removeKeys: string[] }}
 */
export function migrate(raw, now = Date.now()) {
  const old = raw.settings || {};
  const hadV1 = !!raw.settings && (old.interceptor || old.nuclearLock || raw.stats);
  const oldBlocking = old.blocking || {};
  const inter = old.interceptor || {};
  const yt = old.youtubeCleaner || {};

  const patch = {};
  if (hadV1) {
    patch.language = ['en', 'ru'].includes(old.language) ? old.language : 'auto';
    patch.onboarded = true; // existing users have already been through setup
    patch.eye = {
      enabled: old.notificationsEnabled !== false,
      intervalMin: Number(old.eyeRestIntervalMinutes) || 20,
      notify: old.notificationsEnabled !== false,
      bedtime: { enabled: false, time: inter.bedtime || '23:00', leadMin: 30 },
    };
    patch.tracking = { excluded: doms(old.excludedDomains).length ? doms(old.excludedDomains) : ['localhost', '127.0.0.1'], badge: old.showBadge !== false, enabled: true };
    patch.weeklyReport = old.weeklyReport !== false;

    const presets = {};
    for (const id of PRESET_IDS) presets[id] = oldBlocking.presets && id in oldBlocking.presets ? !!oldBlocking.presets[id] : DEFAULT_SETTINGS.blocking.presets[id];
    const limits = {};
    for (const [d, m] of Object.entries(old.customDomainLimits || {})) { const p = parseUserDomain(d); if (p && Number(m) > 0) limits[p] = Number(m); }
    const sched = oldBlocking.schedule || {};
    patch.blocking = {
      presets,
      custom: doms(oldBlocking.customDistractions),
      allow: doms(oldBlocking.allowedDomains),
      always: doms(old.hardBlockedDomains),
      limits,
      schedule: sched.enabled !== undefined ? {
        enabled: !!sched.enabled, days: Array.isArray(sched.days) ? sched.days : [1, 2, 3, 4, 5], start: sched.start || '09:00', end: sched.end || '18:00', strict: !!sched.strict, passMinutes: Number(sched.passMinutes) || 5,
      } : undefined,
      feed: {
        hideShorts: !!yt.hideShorts, hideRecs: !!yt.hideRecommended, hideComments: !!yt.hideComments, hideHome: !!yt.hideHomePage,
        shortLimit: old.antiDoomscroll ? old.antiDoomscroll.enabled !== false : true,
      },
    };
    if (patch.blocking.schedule === undefined) delete patch.blocking.schedule;

    const sites = {};
    for (const [d, cls] of Object.entries(old.domainProductivity || {})) {
      const p = parseUserDomain(d);
      if (p && ['productive', 'neutral', 'distracting'].includes(cls)) sites[p] = cls;
    }
    patch.sites = sites;

    if (inter.musicUrl && /^https?:\/\//.test(inter.musicUrl)) patch.focus = { openUrl: inter.musicUrl };
  }
  const settings = deepMerge(DEFAULT_SETTINGS, patch);

  // tasks
  const tasks = (Array.isArray(raw.dailyGoals) ? raw.dailyGoals : [])
    .filter((t) => t && typeof t.text === 'string' && t.text.trim())
    .map((t, i) => ({ id: String(t.id || `t${now}${i}`), text: t.text.trim().slice(0, 300), done: !!t.done, starred: !!t.isStarred, createdAt: now }));

  // habits
  let habits = null;
  const h = inter.habits;
  if (h && Array.isArray(h.items) && h.items.length) {
    habits = { items: h.items.filter((x) => x && x.name != null && String(x.name).trim()).map((x, i) => ({ id: String(x.id ?? `h${i}`), name: String(x.name).slice(0, 80) })), log: {} };
    for (const [k, ids] of Object.entries(h.log || {})) if (Array.isArray(ids) && ids.length) habits.log[k] = ids.map(String);
  }

  // parked thoughts -> notes inbox
  const captures = (inter.parkedThoughts || []).filter((x) => x && x.text).map((x, i) => ({ id: String(x.id || `c${now}${i}`), text: String(x.text).slice(0, 500), at: Number(x.id) > 1e12 ? Number(x.id) : now }));

  // stats
  const days = {};
  for (const [key, d] of Object.entries(raw.stats || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !d) continue;
    const rec = { d: {}, h: {}, a: {}, fs: 0, fc: d.focusSessions || 0, b: d.breaksCompleted || 0 };
    for (const [host, sec] of Object.entries(d.domains || {})) if (sec > 0) rec.d[host] = Math.round(sec);
    for (const [app, sec] of Object.entries(d.desktopApps || {})) if (sec > 0) rec.a[app] = Math.round(sec);
    for (const [hr, sec] of Object.entries(d.hourly || {})) if (sec > 0 && Number(hr) >= 0 && Number(hr) < 24) rec.h[hr] = { '?': Math.round(sec) };
    days[key] = rec;
  }

  const removeKeys = ['stats', 'dailyGoals', 'newtabLayout', 'newtabProfiles', 'newtabWelcomed', 'pcTrackerStatus', 'notifyPayloads', 'lastDoomChallengeSolved', 'lastEyeRestTime', 'lastWeeklyReport', 'schedulePass'];
  Object.keys(raw).filter((k) => k.startsWith('pomo_')).forEach((k) => removeKeys.push(k));

  return { settings, tasks, habits, captures, days, meta: { schemaVersion: SCHEMA_VERSION, installedAt: raw.meta?.installedAt || now, migratedFrom: hadV1 ? '1.x' : null }, removeKeys };
}

/** 2.0 -> 2.1 settings: the old top-level `theme` / `accent` moved into `appearance`. */
export function upgradeSettingsV2(settings) {
  const s = { ...(settings || {}) };
  const ap = { ...(s.appearance || {}) };
  if (['system', 'light', 'dark'].includes(s.theme)) ap.mode = s.theme;
  if (s.accent && s.accent !== 'ember') ap.accent = s.accent; // ember was the default, which is now simply "the look's own accent"
  delete s.theme; delete s.accent;
  s.appearance = ap;
  return s;
}
