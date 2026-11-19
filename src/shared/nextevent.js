// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The next meeting of the day. Apart from ics.js (the reader of calendar files and its table of time zones) so that the new tab, which only shows it, does not load the reader.

/** Next event today after `nowMin` (minutes since midnight) → { title, start, end, inMin } or null. */
export function nextEvent(events, today, nowMin) {
  const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const e = (events || []).filter((x) => x.day === today && toMin(x.end) > nowMin).sort((a, b) => toMin(a.start) - toMin(b.start))[0];
  return e ? { ...e, inMin: Math.max(0, toMin(e.start) - nowMin), ongoing: toMin(e.start) <= nowMin } : null;
}
