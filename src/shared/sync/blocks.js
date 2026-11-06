// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Planned focus blocks as the sync sees them: a task with a time today or later (`at` + `atDay` + its estimate) is an event in a calendar, and a moved event moves the task.
// Only events EyeTime made are touched; it never creates a task from an event and never edits an event it did not make.

export const BLOCK_FIELDS = ['title', 'day', 'start', 'end'];
export const HORIZON_DAYS = 14;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const toMin = (/** @type {string} */ s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : -1; };
const hhmm = (/** @type {number} */ n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
const addDaysKey = (/** @type {string} */ day, /** @type {number} */ n) => { const [y, m, d] = day.split('-').map(Number); const t = new Date(y, m - 1, d + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };

/** The block of a task, or an item with `ok: false` when the task is not (or no longer) one. @param {any} x @param {string} today @param {number} defaultMin */
export function blockItem(x, today, defaultMin = 25) {
  const start = toMin(x.at), len = x.est > 0 ? Math.round(x.est) : defaultMin;
  const ok = !x.done && start >= 0 && DAY.test(x.atDay || '') && x.atDay >= today && x.atDay <= addDaysKey(today, HORIZON_DAYS) && start + len <= 24 * 60 && !x.repeat;
  return { taskId: x.id, title: String(x.text || '').trim().slice(0, 200), day: x.atDay || null, start: start >= 0 ? start : null, end: start >= 0 ? Math.min(24 * 60, start + len) : null, ok };
}

/** Write what changed on the calendar into the task: the time and the length. (A renamed event renames the task.) */
export function applyBlockToTask(/** @type {any} */ x, /** @type {Record<string, any>} */ patch) {
  const y = { ...x };
  const start = 'start' in patch && patch.start >= 0 ? patch.start : toMin(x.at), end = 'end' in patch && patch.end > 0 ? patch.end : null;
  if ('day' in patch && DAY.test(patch.day || '')) y.atDay = patch.day;
  if ('start' in patch && patch.start >= 0) y.at = hhmm(patch.start);
  if (('end' in patch || 'start' in patch) && start >= 0) { const e = end ?? (start + (x.est > 0 ? x.est : 25)); if (e > start) y.est = Math.min(720, Math.max(5, e - start)); }
  if ('title' in patch && typeof patch.title === 'string' && patch.title.trim()) y.text = patch.title.trim().slice(0, 300);
  return y;
}

/** The task with its time taken away (the event was removed from the calendar). */
export function unschedule(/** @type {any} */ x) { const y = { ...x }; delete y.at; delete y.atDay; return y; }

export const blockMinutes = { toMin, hhmm };
