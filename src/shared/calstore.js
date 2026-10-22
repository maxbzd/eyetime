// Calendar data on this device: up to three subscriptions (secret links) plus an optional imported file, merged into what the rest of
// EyeTime reads — `calendar` (timed events) and `calendarDays` (all-day events). The sources are kept apart in `calendarSrc`, so one
// calendar failing or being removed never touches the others.

import { getRaw, setRaw } from './storage.js';

export const MAX_SUBS = 3;
export const FILE_KEY = 'file';

const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));

/** Pure. Subscriptions from the stored keys, migrating the single `calendarSub` of 3.0 → { subs, migrated }. */
export function migrateSubs(raw) {
  if (Array.isArray(raw.calendarSubs)) return { subs: raw.calendarSubs.slice(0, MAX_SUBS), migrated: false };
  if (raw.calendarSub && raw.calendarSub.url) return { subs: [{ ...raw.calendarSub, id: 'c1' }], migrated: true };
  return { subs: [], migrated: false };
}

/** Pure. `src` = { [source]: { events, allDay } } → merged, sorted, with ids made unique across sources. */
export function mergeSources(src) {
  const events = [], days = [];
  for (const [k, v] of Object.entries(src || {})) {
    for (const e of (v && v.events) || []) events.push({ ...e, id: `${k}:${e.id}` });
    for (const d of (v && v.allDay) || []) days.push({ ...d, id: `${k}:${d.id}` });
  }
  events.sort((a, b) => (a.day + a.start < b.day + b.start ? -1 : 1));
  days.sort((a, b) => (a.day < b.day ? -1 : 1));
  return { events, allDay: days };
}

/** Pure. The event that starts within the next `warnMin` minutes today (not yet started), or null. */
export function upcomingMeeting(events, today, nowMin, warnMin = 2) {
  return (events || []).filter((e) => e.day === today && toMin(e.start) > nowMin && toMin(e.start) - nowMin <= warnMin).sort((a, b) => toMin(a.start) - toMin(b.start))[0] || null;
}

/** Pure. The event happening right now, or null. */
export function inMeeting(events, today, nowMin) {
  return (events || []).find((e) => e.day === today && toMin(e.start) <= nowMin && nowMin < toMin(e.end)) || null;
}

/** Subscriptions as stored (migrating the 3.0 single record on first read). */
export async function loadSubs() {
  const raw = await getRaw(['calendarSubs', 'calendarSub']);
  const { subs, migrated } = migrateSubs(raw);
  if (migrated) { await setRaw({ calendarSubs: subs }); await chrome.storage.local.remove('calendarSub'); }
  return subs;
}

export const saveSubs = (subs) => setRaw({ calendarSubs: subs.slice(0, MAX_SUBS) });

async function writeMerged(src) {
  const { events, allDay } = mergeSources(src);
  await setRaw({ calendarSrc: src, calendar: events, calendarDays: allDay });
}

/** Stores one source's events and refreshes the merged views. */
export async function writeSource(key, data) {
  const { calendarSrc } = await getRaw('calendarSrc');
  await writeMerged({ ...(calendarSrc || {}), [key]: data });
}

/** Drops one source (an unsubscribed calendar, the imported file). */
export async function removeSource(key) {
  const { calendarSrc } = await getRaw('calendarSrc');
  const next = { ...(calendarSrc || {}) }; delete next[key];
  await writeMerged(next);
}
