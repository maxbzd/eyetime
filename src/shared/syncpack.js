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
  delete s.companion; // a bearer token for this computer's companion app: never leaves the device
  return s;
}

/** Version of the payload found in storage.sync (0 = none). A newer version than we understand must not be overwritten. */
export function remoteVersion(all) { const m = all && all[META_KEY]; return m && typeof m.v === 'number' ? m.v : 0; }
export const SYNC_VERSION = 1;

/** → { items, count } to hand to storage.sync.set, or null when the settings are too large to sync. */
export function pack(settings, ts) {
  const json = JSON.stringify(forSync(settings));
  const parts = [];
  for (let at = 0; at < json.length;) {
    let end = Math.min(json.length, at + CHUNK_CHARS);
    const last = json.charCodeAt(end - 1);
    if (end < json.length && last >= 0xd800 && last <= 0xdbff) end--; // never split a surrogate pair (emoji) across two chunks
    parts.push(json.slice(at, end)); at = end;
  }
  if (parts.length > MAX_CHUNKS) return null;
  const items = { [META_KEY]: { v: 1, n: parts.length, ts } };
  parts.forEach((p, i) => { items[chunkKey(i)] = p; });
  return { items, count: parts.length };
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

/** Newest write wins. (The very first sync on a device is decided by the worker: an existing cloud copy always wins.) 'pull' = take the remote copy, 'push' = upload ours, 'none' = already in step. */
export function decide(localTs, remoteTs) {
  if (remoteTs > localTs) return 'pull';
  if (localTs > remoteTs) return 'push';
  return 'none';
}
