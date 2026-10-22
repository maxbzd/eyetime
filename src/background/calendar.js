// Calendar subscriptions: downloads the user's own .ics addresses (up to three; Settings → Data & privacy) every hour and keeps the events
// of the next two weeks locally. An address is a secret, so it lives in `calendarSubs` (local storage only: never synced, never in a backup).
// Nothing else is contacted and nothing is sent: a plain GET with no cookies, to that one site, no redirects followed.

import { parseIcsFull } from '../shared/ics.js';
import { loadSubs, saveSubs, calLock, writeSourceUnlocked } from '../shared/calstore.js';
import { normalizeCalendarUrl, MAX_ICS_BYTES } from '../shared/calsub.js';

const ALARM = 'calendar-sync';
const RETRY_MS = 30 * 60_000; // neither a fresh copy nor a failed attempt is retried sooner than this, however often the worker wakes
// Test builds declare a local host permission in the manifest; a store build never does, so plain http stays refused there.
const allowLocalHttp = () => { try { return (chrome.runtime.getManifest().host_permissions || []).some((p) => p.startsWith('http://127.0.0.1')); } catch { return false; } };

let inflight = null;

/** Updates one subscription's record; false if it was removed or replaced meanwhile (then a finished download must be dropped). */
const patchSub = (id, url, patch) => calLock(() => patchSubUnlocked(id, url, patch));
async function patchSubUnlocked(id, url, patch) {
  const subs = await loadSubs();
  const i = subs.findIndex((x) => x.id === id && x.url === url);
  if (i < 0) return false;
  subs[i] = { ...subs[i], ...patch };
  await saveSubs(subs);
  return true;
}

async function fail(sub, error, extra = {}) {
  await patchSub(sub.id, sub.url, { ok: false, error, tried: Date.now(), ...extra });
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

async function runOne(sub) {
  const n = normalizeCalendarUrl(sub.url, { allowLocalHttp: allowLocalHttp() });
  if (!n.ok) return fail(sub, 'invalid');
  let allowed = false;
  try { allowed = await chrome.permissions.contains({ origins: [n.pattern] }); } catch { /* treated as not allowed */ }
  if (!allowed) return fail(sub, 'permission');
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 20_000);
  try {
    // `manual`: a redirect would send the browser to a site the user never agreed to; say so instead of following it
    const res = await fetch(n.url, { cache: 'no-store', credentials: 'omit', redirect: 'manual', signal: ctl.signal });
    if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) return fail(sub, 'redirect');
    if (!res.ok) return fail(sub, 'http', { status: res.status });
    if (Number(res.headers.get('content-length')) > MAX_ICS_BYTES) return fail(sub, 'size');
    const text = await readLimited(res, MAX_ICS_BYTES);
    if (text === null) return fail(sub, 'size');
    if (!/BEGIN:VCALENDAR/i.test(text)) return fail(sub, 'format');
    const data = parseIcsFull(text, { from: new Date(), days: 14 });
    // the user may have unsubscribed (or subscribed elsewhere) while this was downloading: then the result is dropped, never written back
    const kept = await calLock(async () => {
      if (!(await patchSubUnlocked(sub.id, sub.url, { ok: true, at: Date.now(), n: data.events.length, error: null, status: 200, host: n.host }))) return false;
      await writeSourceUnlocked(sub.id, data);
      return true;
    });
    if (!kept) return { state: 'off' };
    return { state: 'ok', n: data.events.length };
  } catch { return fail(sub, 'network'); }
  finally { clearTimeout(timer); }
}

async function run() {
  const subs = await loadSubs();
  if (!subs.length) return { state: 'off' };
  const out = [];
  for (const sub of subs) out.push(await runOne(sub));
  return { state: out.some((r) => r.state === 'ok') ? 'ok' : out[0].state, results: out };
}

/** One download round at a time (a wake-up and the hourly alarm can coincide). */
export function syncCalendar() {
  if (!inflight) inflight = run().finally(() => { inflight = null; });
  return inflight;
}

/** Keeps one hourly alarm while a subscription exists (re-creating it on every wake would push it back forever); with `refresh`, downloads now if the last attempt is old. */
export async function armCalendar({ refresh = false } = {}) {
  try {
    const subs = await loadSubs();
    if (!subs.length) { await chrome.alarms.clear(ALARM); return; }
    if (!(await chrome.alarms.get(ALARM))) await chrome.alarms.create(ALARM, { periodInMinutes: 60 });
    const last = Math.min(...subs.map((x) => Math.max(x.at || 0, x.tried || 0)));
    if (refresh && Date.now() - last > RETRY_MS) syncCalendar();
  } catch { /* alarms unavailable */ }
}

chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) syncCalendar(); });
