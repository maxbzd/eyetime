// Calendar subscription: downloads the user's own .ics address (Settings → Data & privacy) every hour and keeps the events of the next
// two weeks locally. The address is a secret, so it lives in `calendarSub` (local storage only: never synced, never in a backup).
// Nothing else is contacted and nothing is sent: a plain GET with no cookies, to that one site, no redirects followed.

import { getRaw, setRaw } from '../shared/storage.js';
import { parseIcs } from '../shared/ics.js';
import { normalizeCalendarUrl, MAX_ICS_BYTES } from '../shared/calsub.js';

const ALARM = 'calendar-sync';
const RETRY_MS = 30 * 60_000; // neither a fresh copy nor a failed attempt is retried sooner than this, however often the worker wakes
// Test builds declare a local host permission in the manifest; a store build never does, so plain http stays refused there.
const allowLocalHttp = () => { try { return (chrome.runtime.getManifest().host_permissions || []).some((p) => p.startsWith('http://127.0.0.1')); } catch { return false; } };

let inflight = null;

async function fail(error, url, extra = {}) {
  const { calendarSub } = await getRaw('calendarSub');
  if (calendarSub && calendarSub.url === url) await setRaw({ calendarSub: { ...calendarSub, ok: false, error, tried: Date.now(), ...extra } });
  return { state: 'error', error };
}

/** Reads a response body but gives up beyond `max` bytes (a server that never stops must not fill the worker's memory). */
async function readLimited(res, max) {
  if (!res.body) { const t = await res.text(); return t.length > max ? null : t; }
  const reader = res.body.getReader(), dec = new TextDecoder(); let total = 0, out = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { reader.cancel().catch(() => {}); return null; }
    out += dec.decode(value, { stream: true });
  }
  return out + dec.decode();
}

async function run() {
  const { calendarSub } = await getRaw('calendarSub');
  if (!calendarSub || !calendarSub.url) return { state: 'off' };
  const url = calendarSub.url;
  const n = normalizeCalendarUrl(url, { allowLocalHttp: allowLocalHttp() });
  if (!n.ok) return fail('invalid', url);
  let allowed = false;
  try { allowed = await chrome.permissions.contains({ origins: [n.pattern] }); } catch { /* treated as not allowed */ }
  if (!allowed) return fail('permission', url);
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 20_000);
  try {
    // `manual`: a redirect would send the browser to a site the user never agreed to; say so instead of following it
    const res = await fetch(n.url, { cache: 'no-store', credentials: 'omit', redirect: 'manual', signal: ctl.signal });
    if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) return fail('redirect', url);
    if (!res.ok) return fail('http', url, { status: res.status });
    if (Number(res.headers.get('content-length')) > MAX_ICS_BYTES) return fail('size', url);
    const text = await readLimited(res, MAX_ICS_BYTES);
    if (text === null) return fail('size', url);
    if (!/BEGIN:VCALENDAR/i.test(text)) return fail('format', url);
    const events = parseIcs(text, { from: new Date(), days: 14 });
    // the user may have unsubscribed (or subscribed elsewhere) while this was downloading: then the result is dropped, never written back
    const now = (await getRaw('calendarSub')).calendarSub;
    if (!now || now.url !== url) return { state: 'off' };
    await setRaw({ calendar: events, calendarMeta: { at: Date.now(), name: n.host }, calendarSub: { url, since: calendarSub.since || Date.now(), ok: true, at: Date.now(), n: events.length, error: null, status: 200, host: n.host } });
    return { state: 'ok', n: events.length };
  } catch { return fail('network', url); }
  finally { clearTimeout(timer); }
}

/** One download at a time (a wake-up and the hourly alarm can coincide). */
export function syncCalendar() {
  if (!inflight) inflight = run().finally(() => { inflight = null; });
  return inflight;
}

/** Keeps one hourly alarm while a subscription exists (re-creating it on every wake would push it back forever); with `refresh`, downloads now if the last attempt is old. */
export async function armCalendar({ refresh = false } = {}) {
  try {
    const { calendarSub } = await getRaw('calendarSub');
    if (!calendarSub || !calendarSub.url) { await chrome.alarms.clear(ALARM); return; }
    if (!(await chrome.alarms.get(ALARM))) await chrome.alarms.create(ALARM, { periodInMinutes: 60 });
    if (refresh && Date.now() - Math.max(calendarSub.at || 0, calendarSub.tried || 0) > RETRY_MS) syncCalendar();
  } catch { /* alarms unavailable */ }
}

chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) syncCalendar(); });
