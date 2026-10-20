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
  return { task, parsed: p, prioDenied: p.priority && !prioFree };
}

/* ---------- estimate log: finished tasks with a planned length outlive "Clear completed" ---------- */
export const EST_LOG_MAX = 100;

/** New log after `task` changed: finished + estimated tasks are (re)recorded, anything else is removed. Pure. */
export function updateEstLog(log, task) {
  const rest = (log || []).filter((e) => e.id !== task.id);
  if (!task.done || !(task.est > 0)) return rest;
  return [{ id: task.id, text: String(task.text || '').slice(0, 120), est: task.est, focusSec: task.focusSec || 0, at: task.doneAt || Date.now() }, ...rest].slice(0, EST_LOG_MAX);
}

/** Tasks + log as one list for estimateAccuracy(): a live task wins over its log entry. */
export function accuracyInput(tasks, log) {
  const live = new Set((tasks || []).map((x) => x.id));
  return [...(tasks || []), ...(log || []).filter((e) => !live.has(e.id)).map((e) => ({ id: e.id, text: e.text, est: e.est, focusSec: e.focusSec, done: true }))];
}
