// Repeating tasks: reopen finished daily / weekday / weekly tasks when their day has come (Home does it too; this covers the popup,
// the palette and reminders when Home was not opened today). Runs at worker start and just after every local midnight.

import { updateCollection, getCollection } from '../shared/storage.js';
import { applyRepeats } from '../shared/tasks.js';
import { dayKey } from '../shared/time.js';

const ALARM = 'rollover';

export async function rolloverTasks() {
  try {
    const peek = await getCollection('tasks', []);
    if (peek.some((x) => x.repeat)) await updateCollection('tasks', [], (tasks) => { const r = applyRepeats(tasks, dayKey(), (ms) => dayKey(new Date(ms))); return r.changed ? r.tasks : undefined; });
  } catch { /* never block startup */ }
  armMidnight();
}

/** One alarm at the next local midnight (+1 min); firing it re-arms the next one. */
async function armMidnight() {
  try {
    const n = new Date();
    await chrome.alarms.create(ALARM, { when: new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 1).getTime() });
  } catch { /* alarms unavailable */ }
}

chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) rolloverTasks(); });
