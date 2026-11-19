// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Hostname helpers. Only hostnames are ever stored — never paths, queries or page content.

/** The second-level suffixes of the countries that use them (co.uk, com.au…): "mobile.co.uk" is a site of its own, not the mobile address of "co.uk". */
const SECOND_LEVEL = /^(?:co|com|org|net|gov|edu|ac|or|ne|go)\.[a-z]{2}$/;

/**
 * Normalise a hostname: lowercase, no trailing dot, and no leading www. / m. / mobile. when a real site is left behind it.
 * "mobile.de" (a big German car market) and "m.me" are sites whose names START with those words: what is left would be "de" or "me", a top-level domain, and the
 * time, the lists and the blocks would all be filed under it. A prefix is dropped only when at least two labels remain and they are not a bare "co.uk".
 */
export function normalizeHost(host) {
  const h = String(host || '').toLowerCase().replace(/\.$/, '');
  const m = /^(?:www|m|mobile)\.(.+)$/.exec(h);
  if (!m || !m[1].includes('.') || SECOND_LEVEL.test(m[1])) return h;
  return m[1];
}

/** Hostname of a trackable page URL, or null (chrome://, extension pages, files, new tab…). */
export function hostFromUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return normalizeHost(u.hostname) || null;
  } catch { return null; }
}

const HOST_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/;

/** Turn user input ("https://www.YouTube.com/watch?v=1", "youtube.com/") into "youtube.com", or null if it isn't a domain. */
export function parseUserDomain(input) {
  let s = String(input || '').trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split(/[/?#]/)[0].replace(/^[^@]*@/, '').replace(/:\d+$/, '');
  if (/[^\x00-\x7f]/.test(s)) { try { s = new URL('http://' + s).hostname; } catch { return null; } } // a name in the person's own letters (москва.рф) is kept the way the browser says it: punycode
  s = normalizeHost(s);
  if (s === 'localhost') return s;
  return HOST_RE.test(s) ? s : null;
}

/** true when `host` is `rule` or a subdomain of it. */
export const matches = (host, rule) => !!host && !!rule && (host === rule || host.endsWith('.' + rule));

export const matchesAny = (host, rules) => !!host && (rules || []).some((r) => matches(host, r));

/** The most specific rule in `rules` that matches `host`, or null. */
export function bestMatch(host, rules) {
  let best = null;
  for (const r of rules || []) if (matches(host, r) && (!best || r.length > best.length)) best = r;
  return best;
}

/** Extension-local favicon URL (Chrome's _favicon API; needs the "favicon" permission). */
export function faviconUrl(host, size = 32) {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) return null;
    return chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent('https://' + host)}&size=${size}`);
  } catch { return null; }
}
