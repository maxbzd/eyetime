// Settings sync via chrome.storage.sync: browsers cap one item at 8 KB, so the settings JSON is split into small chunks.
// Pure functions only — the worker does the I/O (src/background/sync.js).

export const CHUNK_CHARS = 3500;   // ×2 bytes for non-Latin text stays below the 8 KB per-item limit
export const MAX_CHUNKS = 24;      // ≈ 84 KB of the ~100 KB total quota
export const META_KEY = 'sync:meta';
export const chunkKey = (i) => `sync:${i}`;

/** Fields that belong to this browser, not to the person: never synced. */
export function forSync(settings) {
  const s = JSON.parse(JSON.stringify(settings || {}));
  delete s.onboarded;
  return s;
}

/** → { items, count } to hand to storage.sync.set, or null when the settings are too large to sync. */
export function pack(settings, ts) {
  const json = JSON.stringify(forSync(settings));
  const n = Math.ceil(json.length / CHUNK_CHARS);
  if (n > MAX_CHUNKS) return null;
  const items = { [META_KEY]: { v: 1, n, ts } };
  for (let i = 0; i < n; i++) items[chunkKey(i)] = json.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS);
  return { items, count: n };
}

/** Rebuild { settings, ts } from everything in storage.sync; null when absent or incomplete/corrupt. */
export function unpack(all) {
  const meta = all && all[META_KEY];
  if (!meta || meta.v !== 1 || !(meta.n > 0) || meta.n > MAX_CHUNKS) return null;
  let json = '';
  for (let i = 0; i < meta.n; i++) { const part = all[chunkKey(i)]; if (typeof part !== 'string') return null; json += part; }
  try { const settings = JSON.parse(json); return settings && typeof settings === 'object' ? { settings, ts: Number(meta.ts) || 0 } : null; } catch { return null; }
}

/** Keys of leftover chunks (a shorter payload than last time) that should be removed. */
export function staleKeys(all, count) {
  return Object.keys(all || {}).filter((k) => /^sync:\d+$/.test(k) && Number(k.slice(5)) >= count);
}

/** Newest write wins. 'pull' = take the remote copy, 'push' = upload ours, 'none' = already in step. */
export function decide(localTs, remoteTs) {
  if (remoteTs > localTs) return 'pull';
  if (localTs > remoteTs) return 'push';
  return 'none';
}
