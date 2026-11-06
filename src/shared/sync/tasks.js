// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Tasks as the sync sees them: a small normalised item (text, done, due, starred, estimate), and how a change that came from a service is written back into a task.
// Repeating tasks are left out (every service has its own idea of recurrence); long-finished tasks are not sent (the same three days as the browser sync).

export const DONE_KEEP_MS = 3 * 86_400_000;
export const ALL_TASK_FIELDS = ['text', 'done', 'due', 'starred', 'est'];

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** The text the way two lists are compared when they are paired for the first time. */
export const adoptKeyOf = (/** @type {{ text?: string }} */ it) => String(it.text || '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Does this task go to the service? */
export function eligibleTask(/** @type {any} */ x, /** @type {number} */ now) {
  if (!x || typeof x.text !== 'string' || !x.text.trim() || x.repeat) return false;
  return !x.done || (x.doneAt > 0 && now - x.doneAt < DONE_KEEP_MS);
}

/** @param {any} x a task @returns {Record<string, any>} */
export function localItem(x, now) {
  return { text: x.text.trim(), done: !!x.done, due: DAY.test(x.due || '') ? x.due : null, starred: !!x.starred && !x.done, est: x.est > 0 ? Math.round(x.est) : null, ok: eligibleTask(x, now) };
}

/** What is written into a task for each field the service changed. Returns the new task (the old one is not touched). */
export function applyToTask(/** @type {any} */ x, /** @type {Record<string, any>} */ patch, /** @type {number} */ now) {
  const y = { ...x };
  for (const [f, v] of Object.entries(patch)) {
    if (f === 'text' && typeof v === 'string' && v.trim()) y.text = v.trim().slice(0, 300);
    else if (f === 'done') { y.done = !!v; if (v) { y.doneAt = now; y.starred = false; } else delete y.doneAt; }
    else if (f === 'due') { if (DAY.test(v || '')) y.due = v; else delete y.due; }
    else if (f === 'starred') y.starred = !!v && !y.done;
    else if (f === 'est') { if (v > 0) y.est = Math.round(v); else delete y.est; }
  }
  return y;
}

/** A task made from an item that is new on the service. */
export function taskFromItem(/** @type {Record<string, any>} */ item, /** @type {string} */ id, /** @type {number} */ now) {
  return applyToTask({ id, text: item.text, done: false, starred: false, createdAt: now }, { done: item.done, due: item.due, starred: item.starred, est: item.est }, now);
}
