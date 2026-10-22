// Task sync via chrome.storage.sync (opt-in, separate from settings sync). Pure functions only — the worker does the I/O (src/background/tasksync.js).
//
// A task is only ever deleted by an explicit tombstone (`del: { id: deletedAt }`, kept 30 days), never because it is merely absent from a copy:
// chrome.storage.sync keeps the last write per key, so a device that writes before it has seen our push must not make our new tasks look deleted.
// `base` (id → stable JSON of what this device last synced) tells an edit from no change; edits to the same task merge field by field.

export const T_META = 'st:meta';
export const tChunk = (i) => `st:${i}`;
export const T_CHUNK_CHARS = 2500;  // ×3 bytes for CJK stays below the 8 KB per-item limit
export const T_MAX_CHUNKS = 10;
export const T_MAX_BYTES = 40_000;  // measured in bytes (CJK is 3 per character): leaves the settings payload its room in the ~100 KB total
export const TOMB_KEEP_MS = 30 * 86_400_000, TOMB_MAX = 200;
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

const bytes = (s) => new TextEncoder().encode(s).length;

/** → { items, count } for storage.sync.set, or null when even the open tasks alone do not fit. `del` = tombstones { id: deletedAt }. */
export function packTasks(tasks, ts, del = {}, now = Date.now()) {
  const keep = (tasks || []).filter((x) => syncable(x, now));
  const tombs = Object.fromEntries(Object.entries(del || {}).sort((a, b) => b[1] - a[1]).slice(0, TOMB_MAX));
  const json = JSON.stringify({ tasks: keep, del: tombs });
  if (bytes(json) > T_MAX_BYTES) return null;
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

/** → { tasks, del, ts } or null when absent, incomplete or corrupt. */
export function unpackTasks(all) {
  const meta = all && all[T_META];
  if (!meta || meta.v !== T_VERSION || !(meta.n > 0) || meta.n > T_MAX_CHUNKS) return null;
  let json = '';
  for (let i = 0; i < meta.n; i++) { const part = all[tChunk(i)]; if (typeof part !== 'string') return null; json += part; }
  try {
    const p = JSON.parse(json);
    if (!p || !Array.isArray(p.tasks) || !p.tasks.every((x) => x && typeof x.id === 'string' && typeof x.text === 'string')) return null;
    const del = {};
    for (const [id, at] of Object.entries(p.del && typeof p.del === 'object' ? p.del : {})) if (typeof at === 'number') del[id] = at;
    return { tasks: p.tasks, del, ts: Number(meta.ts) || 0 };
  } catch { return null; }
}

export function staleTaskKeys(all, count) {
  return Object.keys(all || {}).filter((k) => /^st:\d+$/.test(k) && Number(k.slice(3)) >= count);
}

/** Same tasks and same tombstones, whatever the order. */
export function samePayload(a, b) {
  return sameTasks(a.tasks, b.tasks) && stable(a.del || {}) === stable(b.del || {});
}

/** Three-way merge of one task, field by field: a field only one side changed takes that change; both → `preferLocal`. */
function mergeFields(b, L, R, preferLocal) {
  const out = {};
  for (const k of new Set([...Object.keys(b), ...Object.keys(L), ...Object.keys(R)])) {
    const sb = stable(b[k]), sl = stable(L[k]), sr = stable(R[k]);
    const v = sl === sr ? L[k] : sl === sb ? R[k] : sr === sb ? L[k] : preferLocal ? L[k] : R[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * → { tasks, base, tomb }.
 *   state  = { base: { id: stable JSON } as of the last sync of this device, tomb: { id: { at, j } } tombstones this device knows }
 *   local  = this device's list (its order is kept; tasks new on the other side are added at the top)
 *   remote = { tasks, del } of the cloud copy (empty when there is none or it is unreadable)
 *   preferLocal: for a field both sides changed: keep ours — true when the sync was triggered by a local change
 */
export function mergeTasks(state, local, remote, { preferLocal = true, now = Date.now() } = {}) {
  const base = (state && state.base) || {};
  const tomb = {};
  for (const [id, t] of Object.entries((state && state.tomb) || {})) if (t && now - t.at < TOMB_KEEP_MS) tomb[id] = t;
  const remT = (remote && remote.tasks) || [], delR = (remote && remote.del) || {};
  const rmap = new Map(remT.map((x) => [x.id, x]));
  const lids = new Set((local || []).map((x) => x.id));
  for (const id of Object.keys(base)) if (!lids.has(id) && !tomb[id]) tomb[id] = { at: now, j: base[id] }; // deleted here since the last sync

  const seen = new Set(), out = [], added = [];
  for (const L of local || []) {
    seen.add(L.id);
    const R = rmap.get(L.id), jl = stable(L), b = base[L.id];
    if (!syncable(L, now)) { // an old finished task stays where it is (unless the other side reopened it)
      out.push(R && syncable(R, now) && stable(R) !== jl ? R : L); delete tomb[L.id]; continue;
    }
    delete tomb[L.id]; // present here: not deleted here
    if (R) {
      if (stable(R) === jl) out.push(L);
      else if (b === undefined) out.push(preferLocal ? L : R);
      else out.push(mergeFields(JSON.parse(b), L, R, preferLocal));
    } else if (delR[L.id] !== undefined && b !== undefined && jl === b) {
      tomb[L.id] = { at: delR[L.id], j: b }; // deleted elsewhere, unchanged here: gone
    } else out.push(L); // absent in the cloud copy is not a deletion; edited after a deletion elsewhere: it lives
  }
  for (const R of remT) {
    if (seen.has(R.id) || !syncable(R, now)) continue;
    const t = tomb[R.id];
    if (t && stable(R) === t.j) continue;      // we deleted it and it is unchanged elsewhere: stays deleted
    if (t) delete tomb[R.id];                  // edited elsewhere after our deletion: back it comes
    added.push(R);
  }
  const tasks = [...added, ...out];
  const present = new Set(tasks.map((x) => x.id));
  for (const [id, at] of Object.entries(delR)) if (!tomb[id] && !present.has(id) && !rmap.has(id)) tomb[id] = { at, j: '' }; // carry others' tombstones
  const nb = {};
  for (const x of tasks) if (syncable(x, now)) nb[x.id] = stable(x);
  const keep = Object.entries(tomb).sort((a, b) => b[1].at - a[1].at).slice(0, TOMB_MAX);
  return { tasks, base: nb, tomb: Object.fromEntries(keep) };
}
