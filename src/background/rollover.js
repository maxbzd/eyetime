// Repeating tasks: reopen finished daily / weekday / weekly tasks when their day has come (Home does it too; this covers the popup and
// the palette when Home was not opened today). Runs at worker start and on the daily alarm.

import { getCollection, setCollection } from '../shared/storage.js';
import { applyRepeats } from '../shared/tasks.js';
import { dayKey } from '../shared/time.js';

export async function rolloverTasks() {
  try {
    const tasks = await getCollection('tasks', []);
    if (!tasks.some((x) => x.repeat && x.done)) return;
    const r = applyRepeats(tasks, dayKey(), (ms) => dayKey(new Date(ms)));
    if (r.changed) await setCollection('tasks', r.tasks);
  } catch { /* never block startup */ }
}
