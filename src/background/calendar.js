// Calendar subscription: downloads the user's own .ics address (Settings → Data & privacy) every hour and keeps the events of the next
// two weeks locally. The address is a secret, so it lives in `calendarSub` (local storage only: never synced, never in a backup).
// Nothing else is contacted and nothing is sent: a plain GET with no cookies.

import { getRaw, setRaw } from '../shared/storage.js';
import { parseIcs } from '../shared/ics.js';
import { normalizeCalendarUrl, MAX_ICS_BYTES } from '../shared/calsub.js';

const ALARM = 'calendar-sync';
const STALE_MS = 30 * 60_000;

async function fail(error, extra = {}) {
  const { calendarSub } = await getRaw('calendarSub');
  if (calendarSub) await setRaw({ calendarSub: { ...calendarSub, ok: false, error, tried: Date.now(), ...extra } });
  return { state: 'error', error };
}

export async function syncCalendar() {
  const { calendarSub } = await getRaw('calendarSub');
  if (!calendarSub || !calendarSub.url) return { state: 'off' };
  const n = normalizeCalendarUrl(calendarSub.url);
  if (!n.ok) return fail('invalid');
  let allowed = false;
  try { allowed = await chrome.permissions.contains({ origins: [n.pattern] }); } catch { /* treated as not allowed */ }
  if (!allowed) return fail('permission');
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 20_000);
  try {
    const res = await fetch(n.url, { cache: 'no-store', credentials: 'omit', signal: ctl.signal });
    if (!res.ok) return fail('http', { status: res.status });
    if (Number(res.headers.get('content-length')) > MAX_ICS_BYTES) return fail('size');
    const text = await res.text();
    if (text.length > MAX_ICS_BYTES) return fail('size');
    if (!/BEGIN:VCALENDAR/i.test(text)) return fail('format');
    const events = parseIcs(text, { from: new Date(), days: 14 });
    await setRaw({ calendar: events, calendarMeta: { at: Date.now(), name: n.host }, calendarSub: { url: calendarSub.url, since: calendarSub.since || Date.now(), ok: true, at: Date.now(), n: events.length, error: null, status: 200, host: n.host } });
    return { state: 'ok', n: events.length };
  } catch { return fail('network'); }
  finally { clearTimeout(timer); }
}

/** Keeps the hourly alarm in step with whether a subscription exists; with `refresh`, also downloads now if the last copy is old. */
export async function armCalendar({ refresh = false } = {}) {
  try {
    const { calendarSub } = await getRaw('calendarSub');
    if (!calendarSub || !calendarSub.url) { await chrome.alarms.clear(ALARM); return; }
    await chrome.alarms.create(ALARM, { periodInMinutes: 60 });
    if (refresh && Date.now() - (calendarSub.at || 0) > STALE_MS) syncCalendar();
  } catch { /* alarms unavailable */ }
}

chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) syncCalendar(); });
