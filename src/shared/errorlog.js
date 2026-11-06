// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// A tiny local error log (last 20 entries, in storage). Nothing is ever sent anywhere: it only feeds the diagnostic report
// that the person can read, copy and attach to a bug report themselves (Settings → About).

import { track } from './usage-store.js';
import { errorFeature } from './usage.js';

const KEY = 'errorLog';
const MAX = 20;

/** Shorten and scrub: keep the first lines of the message/stack, drop query strings and anything that looks like a page URL. */
export function scrub(text) {
  return String(text || '').split('\n').slice(0, 4).join('\n')
    .replace(/(?:chrome|moz)-extension:\/\/[^/\s)]+/g, 'ext:')
    .replace(/https?:\/\/[^\s)]+/g, '<url>')
    .slice(0, 400);
}

/** The text of whatever was thrown (an Error, a string, anything): its message if it has one. */
export const errorText = (/** @type {unknown} */ e) => String((e && /** @type {any} */ (e).message) || e);

/** Pure: new list after adding an entry (newest first, identical consecutive messages are merged into a counter). */
export function addEntry(list, entry) {
  const cur = Array.isArray(list) ? list : [];
  if (cur[0] && cur[0].msg === entry.msg && cur[0].src === entry.src) return [{ ...cur[0], at: entry.at, n: (cur[0].n || 1) + 1 }, ...cur.slice(1)];
  return [{ ...entry, n: 1 }, ...cur].slice(0, MAX);
}

export async function logError(src, err) {
  track(errorFeature(src)); // only the count by place: the text of the error stays in the local log
  try {
    const msg = scrub(err && (err.stack || err.message) || err);
    const { [KEY]: list } = await chrome.storage.local.get(KEY);
    await chrome.storage.local.set({ [KEY]: addEntry(list, { src, msg, at: Date.now() }) });
  } catch { /* logging must never throw */ }
}

export async function readErrors() {
  try { const { [KEY]: list } = await chrome.storage.local.get(KEY); return Array.isArray(list) ? list : []; } catch { return []; }
}

export const clearErrors = () => chrome.storage.local.remove(KEY);

/** Listen for uncaught errors in this context (page or service worker). */
export function captureErrors(src) {
  const g = globalThis;
  g.addEventListener?.('error', (e) => { logError(src, e.error || e.message); });
  g.addEventListener?.('unhandledrejection', (e) => { logError(src, e.reason); });
}
