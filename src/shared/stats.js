// Pure aggregation over per-day records. No browser APIs, so everything here is unit-tested.
//
// A day record:  { d: {host: sec}, h: {hour: {host: sec}}, a: {app: sec}, fs: focusSec, fc: focusSessions, b: breaks }

import { parseKey } from './time.js';

export const emptyDay = () => ({ d: {}, h: {}, a: {}, fs: 0, fc: 0, b: 0 });

const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);

/**
 * Summarise a list of [key, dayRecord|null] pairs (oldest first).
 * `classify(host)` -> 'productive' | 'neutral' | 'distracting'. Desktop apps count as neutral.
 */
export function summarize(entries, classify) {
  const out = {
    total: 0, productive: 0, neutral: 0, distracting: 0,
    focusSec: 0, focusSessions: 0, breaks: 0, activeDays: 0,
    sites: new Map(), apps: new Map(),
    hourly: Array.from({ length: 24 }, () => ({ productive: 0, neutral: 0, distracting: 0 })),
    days: [],
  };
  for (const [key, day] of entries) {
    const row = { key, total: 0, productive: 0, neutral: 0, distracting: 0, focusSec: 0, focusSessions: 0 };
    if (day) {
      for (const [host, sec] of Object.entries(day.d || {})) {
        const cls = classify(host);
        row[cls] += sec; row.total += sec;
        const s = out.sites.get(host) || { host, sec: 0, cls };
        s.sec += sec; s.cls = cls; out.sites.set(host, s);
      }
      for (const [app, sec] of Object.entries(day.a || {})) {
        row.neutral += sec; row.total += sec;
        out.apps.set(app, (out.apps.get(app) || 0) + sec);
      }
      for (const [hr, hosts] of Object.entries(day.h || {})) {
        const slot = out.hourly[Number(hr)];
        if (!slot) continue;
        for (const [host, sec] of Object.entries(hosts)) slot[host === '?' ? 'neutral' : classify(host)] += sec;
      }
      row.focusSec = day.fs || 0; row.focusSessions = day.fc || 0;
      out.breaks += day.b || 0;
    }
    if (row.total > 0) out.activeDays++;
    out.total += row.total; out.productive += row.productive; out.neutral += row.neutral; out.distracting += row.distracting;
    out.focusSec += row.focusSec; out.focusSessions += row.focusSessions;
    out.days.push(row);
  }
  out.topSites = [...out.sites.values()].sort((a, b) => b.sec - a.sec);
  out.topApps = [...out.apps.entries()].map(([name, sec]) => ({ name, sec })).sort((a, b) => b.sec - a.sec);
  return out;
}

/** Percentage change from `prev` to `cur`, or null when there is nothing to compare with. */
export function delta(cur, prev) {
  if (!prev || prev < 60) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

/**
 * Plain-language observations. Returns [{ id, params }]; the UI turns each into a sentence.
 * Needs at least a few days of data before saying anything about patterns.
 */
export function insights(cur, prev) {
  const out = [];
  if (cur.total < 600) return out;

  if (cur.activeDays >= 3) {
    const worst = [...cur.days].filter((d) => d.distracting > 0).sort((a, b) => b.distracting - a.distracting)[0];
    if (worst && worst.distracting >= 600) out.push({ id: 'worstDay', params: { weekday: parseKey(worst.key).getDay(), sec: worst.distracting, key: worst.key } });
    const best = [...cur.days].filter((d) => d.total >= 1800).sort((a, b) => (a.distracting / a.total) - (b.distracting / b.total))[0];
    if (best && (!worst || best.key !== worst.key)) out.push({ id: 'bestDay', params: { weekday: parseKey(best.key).getDay(), pct: Math.round((best.distracting / best.total) * 100), key: best.key } });
  }

  const peak = cur.hourly.map((h, hr) => ({ hr, sec: h.productive })).sort((a, b) => b.sec - a.sec)[0];
  if (peak && peak.sec >= 900 && cur.activeDays >= 3) out.push({ id: 'peakHour', params: { hour: peak.hr } });

  const night = cur.hourly.slice(23).concat(cur.hourly.slice(0, 5)).reduce((a, h) => a + h.productive + h.neutral + h.distracting, 0);
  if (night >= 1800 && night / cur.total > 0.08) out.push({ id: 'lateNight', params: { sec: night } });

  if (cur.distracting >= 600 && cur.total > 0) {
    const share = Math.round((cur.distracting / cur.total) * 100);
    const d = prev ? delta(cur.distracting, prev.distracting) : null;
    out.push({ id: 'distractionShare', params: { pct: share, delta: d } });
  }
  const top = cur.topSites[0];
  if (top && top.cls === 'distracting' && top.sec >= 900) out.push({ id: 'topDistraction', params: { host: top.host, sec: top.sec } });

  if (cur.focusSessions >= 2) out.push({ id: 'focusTotal', params: { sessions: cur.focusSessions, sec: cur.focusSec } });
  return out.slice(0, 4);
}

/** Consecutive days (ending today, or yesterday if today has none yet) with at least one completed focus session. */
export function focusStreak(entries) {
  let streak = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    const has = (entries[i][1]?.fc || 0) > 0;
    if (has) streak++;
    else if (i === entries.length - 1) continue; // today may still be empty
    else break;
  }
  return streak;
}

/** Heatmap levels 0–4 relative to the busiest day of the range. */
export function heatLevel(sec, max) {
  if (!sec || !max) return 0;
  const r = sec / max;
  return r > 0.75 ? 4 : r > 0.5 ? 3 : r > 0.25 ? 2 : 1;
}

export { sum };

/**
 * A gentle, specific suggestion for next week: cap the heaviest distracting site at ~60% of its recent daily average.
 * Returns { host, avgMin, limitMin } or null (nothing worth suggesting, or a limit already exists).
 */
export function suggestLimit(sum, existingLimits = {}) {
  const days = Math.max(1, sum.activeDays);
  for (const s of sum.topSites) {
    if (s.cls !== 'distracting') continue;
    const avgMin = s.sec / days / 60;
    if (avgMin < 15) return null; // top distraction is already small: nothing to suggest
    if (Object.keys(existingLimits).some((d) => s.host === d || s.host.endsWith('.' + d))) continue;
    return { host: s.host, avgMin: Math.round(avgMin), limitMin: Math.max(10, Math.round((avgMin * 0.6) / 5) * 5) };
  }
  return null;
}
