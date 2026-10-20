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
