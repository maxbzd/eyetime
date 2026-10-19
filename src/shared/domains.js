// Hostname helpers. Only hostnames are ever stored — never paths, queries or page content.

/** Normalise a hostname: lowercase, strip a leading www./m./mobile. */
export function normalizeHost(host) {
  return String(host || '').toLowerCase().replace(/\.$/, '').replace(/^(www|m|mobile)\./, '');
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
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split(/[/?#]/)[0].replace(/:\d+$/, '');
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
