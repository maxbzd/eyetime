// Calendar subscription by link: the address Google / Outlook / iCloud call "secret address in iCal format".
// Pure helpers only; the download itself lives in background/calendar.js.

export const MAX_ICS_BYTES = 5_000_000;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Turns what the user pasted into { ok, url, host, pattern } — `pattern` is the one match pattern (the whole site) the browser is asked to allow.
 * webcal(s):// becomes https://; addresses with a login in them are refused; plain http only with `allowLocalHttp` (test builds) and only for this machine.
 * @param {string} input @param {{ allowLocalHttp?: boolean }} [opts]
 */
export function normalizeCalendarUrl(input, { allowLocalHttp = false } = {}) {
  const raw = String(input || '').trim().replace(/^webcals?:\/\//i, 'https://');
  if (!raw) return { ok: false, error: 'empty' };
  let u;
  try { u = new URL(raw); } catch { return { ok: false, error: 'invalid' }; }
  if (u.username || u.password) return { ok: false, error: 'invalid' };
  if (u.protocol !== 'https:' && !(allowLocalHttp && u.protocol === 'http:' && LOCAL_HOSTS.has(u.hostname))) return { ok: false, error: 'scheme' };
  if (!u.hostname || raw.length > 2000) return { ok: false, error: 'invalid' };
  u.hash = '';
  return { ok: true, url: u.toString(), host: u.hostname, pattern: `${u.protocol}//${u.host}/*` };
}
