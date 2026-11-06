// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Settings sync via chrome.storage.sync: browsers cap one item at 8 KB, so the settings JSON is split into small chunks.
// Pure functions only — the worker does the I/O (src/background/sync.js). With a sync passphrase the payload is sealed (shared/syncseal.js) before it is chunked.

import { SEALED_VERSION, SEALED_CHUNK_CHARS, sealText, openText, splitText, sealContext, declare, declaredEnc } from './syncseal.js';

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
export const SYNC_VERSION = SEALED_VERSION; // the newest payload this version understands (1 = plain, 2 = sealed)
export const MAX_SEALED_CHUNKS = 8;       // ≈ 56 KB of sealed text: about 300 KB of settings once compressed

/** → { items, count } to hand to storage.sync.set, or null when the settings are too large to sync. `off`: the `rot` of an encryption this write replaces (see syncseal.js). */
export function pack(settings, ts, off = 0) {
  const json = JSON.stringify(forSync(settings));
  const parts = [];
  for (let at = 0; at < json.length;) {
    let end = Math.min(json.length, at + CHUNK_CHARS);
    const last = json.charCodeAt(end - 1);
    if (end < json.length && last >= 0xd800 && last <= 0xdbff) end--; // never split a surrogate pair (emoji) across two chunks
    parts.push(json.slice(at, end)); at = end;
  }
  if (parts.length > MAX_CHUNKS) return null;
  const items = { [META_KEY]: { v: 1, n: parts.length, ts, ...(off ? { off } : {}) } };
  parts.forEach((p, i) => { items[chunkKey(i)] = p; });
  return { items, count: parts.length };
}

/** Like pack, sealed under `key` for the encryption `info` (a new payload must carry the same `info` the key was made for). */
export async function packSealed(settings, ts, key, info) {
  const parts = splitText(await sealText(key, sealContext('settings', ts), JSON.stringify(forSync(settings))), MAX_SEALED_CHUNKS, SEALED_CHUNK_CHARS);
  if (!parts) return null;
  const items = { [META_KEY]: { v: SEALED_VERSION, n: parts.length, ts, enc: declare(info) } };
  parts.forEach((p, i) => { items[chunkKey(i)] = p; });
  return { items, count: parts.length };
}

/** Rebuild { settings, ts } from everything in storage.sync; null when absent or incomplete/corrupt. */
export function unpack(all) {
  const meta = all && all[META_KEY];
  if (!meta || meta.v !== 1 || !(meta.n > 0) || meta.n > MAX_CHUNKS) return null;
  let json = '';
  for (let i = 0; i < meta.n; i++) { const part = all[chunkKey(i)]; if (typeof part !== 'string') return null; json += part; }
  try { const settings = JSON.parse(json); return settings && typeof settings === 'object' ? { settings, ts: Number(meta.ts) || 0, off: Number(meta.off) || 0 } : null; } catch { return null; }
}

/** The sealed counterpart of unpack: { settings, ts } or null when absent or incomplete; throws when the key is not the one, or the payload was changed or put back with another time. */
export async function unpackSealed(all, key) {
  const meta = all && all[META_KEY];
  if (!declaredEnc(meta) || !(meta.n > 0) || meta.n > MAX_SEALED_CHUNKS) return null;
  let text = '';
  for (let i = 0; i < meta.n; i++) { const part = all[chunkKey(i)]; if (typeof part !== 'string') return null; text += part; }
  const settings = JSON.parse(await openText(key, sealContext('settings', Number(meta.ts) || 0), text));
  return settings && typeof settings === 'object' ? { settings, ts: Number(meta.ts) || 0 } : null;
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

/**
 * What the cloud says about encryption, from both payloads (settings and tasks are sealed with one passphrase, and the first device to see either must not upload the other in the clear):
 * the meta of the newest sealed one, else a plain meta that carries the newest `off`.
 */
export function cloudMeta(all) {
  const a = all && all[META_KEY], b = all && all['st:meta'];
  const ea = declaredEnc(a), eb = declaredEnc(b);
  if (ea && eb) return ea.rot >= eb.rot ? a : b;
  if (ea) return a;
  if (eb) return b;
  const off = Math.max(Number(a && a.off) || 0, Number(b && b.off) || 0);
  return a || b ? { v: 1, off } : undefined;
}
