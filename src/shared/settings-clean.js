// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Settings that come from outside (a backup file, another browser through sync) are data, not code: what is shown or run from them is checked here, the way it is when a person types it in.
// Pure (no storage, no DOM), so the odd files can be held by tests.

/** An address that may be opened from a link on the page: http(s) only (a `javascript:` link would run with the rights of the extension's page). '' when it is not one. */
export function safeHref(/** @type {unknown} */ u) {
  try { const x = new URL(String(u)); return x.protocol === 'http:' || x.protocol === 'https:' ? x.href : ''; } catch { return ''; }
}

/** The quick links of Home from a file: only objects with an http(s) address and a short title, at most 80 (the cap of the page). */
export function cleanLinks(/** @type {unknown} */ list) {
  const out = [];
  for (const l of Array.isArray(list) ? list : []) {
    if (!l || typeof l !== 'object') continue;
    const url = safeHref(/** @type {any} */ (l).url); if (!url) continue;
    const title = typeof (/** @type {any} */ (l).title) === 'string' ? /** @type {any} */ (l).title.replace(/[\u0000-\u001f]/g, '').slice(0, 80) : '';
    out.push({ ...l, url, title: title || new URL(url).hostname });
    if (out.length >= 80) break;
  }
  return out;
}

/** Settings from outside: the places that can reach the network or the page are made to pass the same checks as when they are set by hand. Returns a new object; the input is not changed. */
export function cleanOutsideSettings(/** @type {any} */ settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return settings;
  const s = { ...settings };
  if (s.newtab && typeof s.newtab === 'object') {
    s.newtab = { ...s.newtab };
    if ('links' in s.newtab) s.newtab.links = cleanLinks(s.newtab.links);
  }
  return s;
}

/** A list of plain objects, at most `max`; anything else (a string, a number, an object where a list belongs) is no list. */
export const listOfObjects = (/** @type {unknown} */ v, max = 20000) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object' && !Array.isArray(x)).slice(0, max) : []);
/** A plain object (not a list, not null), or null. */
export const plainOrNull = (/** @type {unknown} */ v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
