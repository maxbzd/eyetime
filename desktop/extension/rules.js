// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// What is closed, decided from the helper's answer. Pure: no browser in here, so it is tested with plain Node.
// The helper (the Windows service) makes the decision; this only applies it to one address.

export const sameOrUnder = (host, domain) => host === domain || host.endsWith('.' + domain);

/** the host of an http(s) address, without "www."; null for anything else (browser pages, files, the extension's own pages) */
export function hostOf(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

const norm = (s) => String(s || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');

/** is the address on the list of exceptions? "docs.google.com" frees a whole site, "youtube.com/watch?v=abc" frees addresses that begin so */
function excepted(decision, url, host) {
  const full = norm(url);
  for (const raw of decision.exceptions || []) {
    const e = norm(raw);
    if (!e) continue;
    if (e.includes('/') || e.includes('?')) {
      if (full.startsWith(e)) return true;
    } else if (sameOrUnder(host, e)) {
      return true;
    }
  }
  return false;
}

/**
 * Should this page be closed? Returns { blocked: false } or { blocked: true, why: 'site' | 'only' | 'keyword', word? }.
 * `decision` is what the helper sent (camelCase), `title` is the page title when known.
 */
export function verdict(decision, url, title = '') {
  const none = { blocked: false };
  if (!decision) return none;
  const active = decision.allowOnly || (decision.domains || []).length > 0 || (decision.keywords || []).length > 0;
  if (!active) return none;
  const host = hostOf(url);
  if (!host) return none;
  if (excepted(decision, url, host)) return none;
  if (decision.allowOnly) {
    return (decision.allowDomains || []).some((d) => sameOrUnder(host, d)) ? none : { blocked: true, why: 'only' };
  }
  if ((decision.domains || []).some((d) => sameOrUnder(host, d))) return { blocked: true, why: 'site' };
  let text = '';
  try {
    text = decodeURIComponent(url);
  } catch {
    text = url;
  }
  text = (text + ' ' + title).toLowerCase();
  const word = (decision.keywords || []).find((k) => k && text.includes(k));
  return word ? { blocked: true, why: 'keyword', word } : none;
}
