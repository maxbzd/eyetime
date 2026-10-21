// Task creation from one line of text ("Write the report 14:30 45m ! #work"), shared by Home and the command palette.

import { parseQuickAdd } from './quickadd.js';
import { MAX_PRIORITIES } from './productivity.js';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** Build a task from raw input. `tasks` (the current list) only decides whether another priority slot is free. */
export function taskFromInput(input, tasks = [], now = new Date()) {
  const p = parseQuickAdd(input, now);
  const prioFree = tasks.filter((x) => x.starred && !x.done).length < MAX_PRIORITIES;
  const task = { id: uid(), text: p.text.slice(0, 300), done: false, starred: p.priority && prioFree, createdAt: now.getTime() };
  if (p.est) task.est = p.est;
  if (p.at) { task.at = p.at; task.atDay = p.atDay; }
  if (p.tags.length) task.tags = p.tags.slice(0, 5);
  if (p.repeat) task.repeat = p.repeat;
  return { task, parsed: p, prioDenied: p.priority && !prioFree };
}

/* ---------- estimate log: finished tasks with a planned length outlive "Clear completed" ---------- */
export const EST_LOG_MAX = 100;

/** New log after `task` changed: finished + estimated tasks are (re)recorded, anything else is removed. Pure. */
export function updateEstLog(log, task) {
  // a recurring task finishes many times: one log entry per day it was done (id@day), so earlier days survive its reopening
  const d = new Date(task.doneAt || Date.now());
  const id = task.repeat ? `${task.id}@${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : task.id;
  const rest = (log || []).filter((e) => e.id !== id);
  if (!task.done || !(task.est > 0)) return rest;
  return [{ id, text: String(task.text || '').slice(0, 120), est: task.est, focusSec: task.focusSec || 0, at: task.doneAt || Date.now() }, ...rest].slice(0, EST_LOG_MAX);
}

/** Tasks + log as one list for estimateAccuracy(): a live task wins over its log entry. */
export function accuracyInput(tasks, log) {
  const live = new Set((tasks || []).map((x) => x.id));
  const doneAt = new Map((tasks || []).filter((x) => x.repeat && x.done).map((x) => [x.id, x.doneAt])); // today's finish of a recurring task is the live task itself
  return [...(tasks || []), ...(log || []).filter((e) => !live.has(e.id) && !(e.id.includes('@') && doneAt.get(e.id.split('@')[0]) === e.at)).map((e) => ({ id: e.id, text: e.text, est: e.est, focusSec: e.focusSec, done: true }))];
}

/* ---------- recurring tasks: a finished daily / weekday / weekly task comes back on its next day ---------- */

const addDaysKey = (key, n) => { const [y, m, d] = key.split('-').map(Number); const x = new Date(y, m - 1, d + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const weekdayOf = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d).getDay(); };

/** The first day (key) on which a task finished on `doneKey` is due again. */
export function nextOccurrence(repeat, doneKey) {
  if (repeat === 'weekly') return addDaysKey(doneKey, 7);
  let k = addDaysKey(doneKey, 1);
  if (repeat === 'weekdays') while ([0, 6].includes(weekdayOf(k))) k = addDaysKey(k, 1);
  return k;
}

/** Reopens finished repeating tasks whose next day has come. Pure: returns { tasks, changed }. `keyOf(ms)` turns a timestamp into a day key. */
export function applyRepeats(tasks, todayKey, keyOf) {
  let changed = false;
  const out = tasks.map((x) => {
    if (x.repeat && !x.done && x.at && x.atDay && x.atDay < todayKey) { changed = true; return { ...x, atDay: todayKey }; } // missed yesterday: today's reminder still fires
    if (!x.repeat || !x.done || !x.doneAt) return x;
    if (todayKey < nextOccurrence(x.repeat, keyOf(x.doneAt))) return x;
    changed = true;
    const { atDay, ...rest } = x; // eslint-disable-line no-unused-vars
    return { ...rest, done: false, doneAt: 0, focusSec: 0, doneCount: (x.doneCount || 0) + 1, ...(x.at ? { atDay: todayKey } : {}) };
  });
  return { tasks: out, changed };
}
