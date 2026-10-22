// Task sync via chrome.storage.sync (opt-in, separate from settings sync). Pure functions only — the worker does the I/O (src/background/tasksync.js).
//
// Merging is three-way: `base` is what this device last synced (id → stable JSON), so a task missing on one side is told apart as
// "deleted there" (it was in base and unchanged here) or "new there". Nothing is ever dropped because a copy is missing as a whole.

export const T_META = 'st:meta';
export const tChunk = (i) => `st:${i}`;
export const T_CHUNK_CHARS = 2500;  // ×3 bytes for CJK stays below the 8 KB per-item limit
export const T_MAX_CHUNKS = 10;     // ≈ 25 KB: leaves the settings payload its room in the ~100 KB total
export const T_VERSION = 1;
export const DONE_KEEP_MS = 3 * 86_400_000; // a finished task travels for three days, then stays only where it was finished

/** Keys sorted, so the same task always serializes the same way on every device. */
export function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  return JSON.stringify(v);
}

/** Does this task travel? Open tasks and recently finished ones. */
export const syncable = (task, now = Date.now()) => !task.done || !task.doneAt || now - task.doneAt < DONE_KEEP_MS;

/** Same set of tasks, whatever the order (the order of the list is not synced, or two devices would keep rewriting each other's). */
export function sameTasks(a, b) {
  const key = (list) => stable([...list].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0)));
  return key(a) === key(b);
}

/** → { items, count } for storage.sync.set, or null when even the open tasks alone are too many to fit. */
export function packTasks(tasks, ts, now = Date.now()) {
  const json = JSON.stringify((tasks || []).filter((x) => syncable(x, now)));
  const parts = [];
  for (let at = 0; at < json.length;) {
    let end = Math.min(json.length, at + T_CHUNK_CHARS);
    const last = json.charCodeAt(end - 1);
    if (end < json.length && last >= 0xd800 && last <= 0xdbff) end--; // never split a surrogate pair
    parts.push(json.slice(at, end)); at = end;
  }
  if (parts.length > T_MAX_CHUNKS) return null;
  const items = { [T_META]: { v: T_VERSION, n: parts.length, ts } };
  parts.forEach((p, i) => { items[tChunk(i)] = p; });
  return { items, count: parts.length };
}

/** Version found in storage.sync (0 = none). A newer one than we understand must not be touched. */
export function remoteTasksVersion(all) { const m = all && all[T_META]; return m && typeof m.v === 'number' ? m.v : 0; }

/** → { tasks, ts } or null when absent, incomplete or corrupt. */
export function unpackTasks(all) {
  const meta = all && all[T_META];
  if (!meta || meta.v !== T_VERSION || !(meta.n >= 0) || meta.n > T_MAX_CHUNKS) return null;
  let json = '';
  for (let i = 0; i < meta.n; i++) { const part = all[tChunk(i)]; if (typeof part !== 'string') return null; json += part; }
  try {
    const tasks = meta.n === 0 ? [] : JSON.parse(json);
    return Array.isArray(tasks) && tasks.every((x) => x && typeof x.id === 'string' && typeof x.text === 'string') ? { tasks, ts: Number(meta.ts) || 0 } : null;
  } catch { return null; }
}

export function staleTaskKeys(all, count) {
  return Object.keys(all || {}).filter((k) => /^st:\d+$/.test(k) && Number(k.slice(3)) >= count);
}

/**
 * Three-way merge → { tasks, base }.
 *   base   = { id: stable JSON } as of the last sync of this device
 *   local  = this device's list (its order is kept; tasks new on the other side are added at the top)
 *   remote = the cloud list
 *   preferLocal: on a real conflict (both sides changed the same task) keep ours — true when the sync was triggered by a local change
 */
export function mergeTasks(base, local, remote, { preferLocal = true, now = Date.now() } = {}) {
  base = base || {};
  const rmap = new Map((remote || []).map((x) => [x.id, x]));
  const seen = new Set(), out = [];
  for (const L of local || []) {
    if (!syncable(L, now)) { seen.add(L.id); out.push(L); continue; } // an old finished task stays where it is
    const R = rmap.get(L.id); seen.add(L.id);
    const jl = stable(L), b = base[L.id];
    if (R) {
      const jr = stable(R);
      if (jl === jr) out.push(L);
      else if (jl === b) out.push(R);                 // only the other side changed it
      else if (jr === b) out.push(L);                 // only we changed it
      else out.push(preferLocal ? L : R);             // both did
    } else if (b === undefined || jl !== b) out.push(L); // new here, or edited here after it was deleted there
    // else: it was in base, unchanged here, gone there → deleted there
  }
  const added = [];
  for (const R of remote || []) {
    if (seen.has(R.id) || !syncable(R, now)) continue;
    const b = base[R.id];
    if (b === undefined || stable(R) !== b) added.push(R); // new there, or edited there after we deleted it
    // else: in base, unchanged there, gone here → deleted here
  }
  const tasks = [...added, ...out];
  const nb = {};
  for (const x of tasks) if (syncable(x, now)) nb[x.id] = stable(x);
  return { tasks, base: nb };
}
