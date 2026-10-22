// Optional task sync across the person's browsers (chrome.storage.sync). Off by default and separate from settings sync: tasks are
// personal text, so it is its own switch. Only the task list travels (open tasks and ones finished in the last three days).
// Merged three ways (src/shared/tasksync.js); a missing or unreadable cloud copy never deletes anything here. Event-driven, a 30 s alarm batches bursts.

import { getRaw, setRaw, updateCollection, UNCHANGED } from '../shared/storage.js';
import { packTasks, unpackTasks, staleTaskKeys, remoteTasksVersion, mergeTasks, samePayload, syncable, stable, T_META, T_VERSION } from '../shared/tasksync.js';

const ALARM = 'tasks-sync';
const remote = () => (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) || null;

async function setStatus(status) {
  const { tasksSyncStatus } = await getRaw('tasksSyncStatus');
  if (tasksSyncStatus && tasksSyncStatus.ok === status.ok && tasksSyncStatus.error === status.error && status.ok && Date.now() - tasksSyncStatus.at < 3_600_000) return; // nothing new to say
  await setRaw({ tasksSyncStatus: { at: Date.now(), ...status } });
}

async function run(source) {
  const { syncTasks, tasksBase, tasksTomb } = await getRaw(['syncTasks', 'tasksBase', 'tasksTomb']);
  if (!syncTasks) return { ok: true, off: true };
  const area = remote();
  if (!area) { await setStatus({ ok: false, error: 'unsupported' }); return { ok: false }; }
  try {
    const all = await area.get(null);
    if (remoteTasksVersion(all) > T_VERSION) { await setStatus({ ok: false, error: 'incompatible' }); return { ok: false }; } // written by a newer EyeTime: never overwrite it
    const rem = unpackTasks(all);
    let merged = null;
    // no usable cloud copy = an empty one: a task is only ever deleted by a tombstone, never because a copy lacks it
    const apply = (cur) => {
      merged = mergeTasks({ base: tasksBase, tomb: tasksTomb }, cur, rem || { tasks: [], del: {} }, { preferLocal: source !== 'remote' });
      return stable(merged.tasks) === stable(cur) ? UNCHANGED : merged.tasks;
    };
    await updateCollection('tasks', [], apply);
    const del = Object.fromEntries(Object.entries(merged.tomb).map(([id, t]) => [id, t.at]));
    const mine = { tasks: merged.tasks.filter((x) => syncable(x)), del };
    if (!rem || !samePayload(mine, rem)) {
      const p = packTasks(merged.tasks, Date.now(), del);
      if (!p) { await setStatus({ ok: false, error: 'too_big' }); return { ok: false }; }
      await area.set(p.items); // write the new copy first; only then drop leftover chunks
      const stale = staleTaskKeys(all, p.count);
      if (stale.length) await area.remove(stale);
    }
    await setRaw({ tasksBase: merged.base, tasksTomb: merged.tomb });
    await setStatus({ ok: true });
    return { ok: true };
  } catch (e) {
    const msg = String((e && e.message) || e);
    await setStatus({ ok: false, error: /quota/i.test(msg) ? 'too_big' : msg.slice(0, 120) });
    return { ok: false };
  }
}

/** @type {Promise<any>} */
let chain = Promise.resolve();
/** One run at a time. `source`: 'local' (this device changed something) or 'remote' (another browser did: its side wins a real conflict). */
export function syncTasksNow(source = 'local') {
  const p = chain.then(() => run(source), () => run(source));
  chain = p.catch(() => {});
  return p;
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes.syncTasks) { syncTasksNow(); return; }
    if (changes.tasks) getRaw('syncTasks').then(({ syncTasks }) => { if (syncTasks) chrome.alarms.create(ALARM, { delayInMinutes: 0.5 }); });
  } else if (areaName === 'sync') {
    if (changes[T_META]) syncTasksNow('remote');
  }
});
chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) syncTasksNow(); });
