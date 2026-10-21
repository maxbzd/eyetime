// "What pulls you": for each distracting site, when in the day it takes your time and what to do about it.
// Needs hourly data (days older than 120 days may have lost it), so every claim is made only when enough of the time is covered.

const roundTo5 = (n) => Math.round(n / 5) * 5;

/** entries: [[dayKey, day]]. classify(host) → class. Returns up to `top` rows sorted by time spent. */
export function triggerInsights(entries, classify, { minSec = 900, minDays = 3, top = 3 } = {}) {
  const byHost = new Map();
  for (const [, day] of entries) {
    if (!day) continue;
    for (const [host, sec] of Object.entries(day.d || {})) {
      if (classify(host) !== 'distracting') continue;
      const r = byHost.get(host) || { host, sec: 0, days: 0, hours: Array(24).fill(0), hourSec: 0, attempts: 0 };
      r.sec += sec; if (sec >= 60) r.days++;
      byHost.set(host, r);
    }
    for (const [hr, hosts] of Object.entries(day.h || {})) for (const [host, sec] of Object.entries(hosts)) { const r = byHost.get(host); if (r && Number(hr) < 24) { r.hours[Number(hr)] += sec; r.hourSec += sec; } }
    for (const [host, c] of Object.entries(day.pa || {})) { const r = byHost.get(host); if (r) r.attempts += c; }
  }
  const rows = [];
  for (const r of byHost.values()) {
    if (r.sec < minSec || r.days < minDays) continue;
    const avgMin = Math.round(r.sec / r.days / 60);
    let peak = null;
    if (r.hourSec >= r.sec * 0.6) { // hourly data covers most of the time: safe to talk about the time of day
      let best = -1, from = 0;
      for (let hr = 0; hr < 24; hr++) { const w = r.hours[hr] + r.hours[(hr + 1) % 24]; if (w > best) { best = w; from = hr; } }
      peak = { from, to: (from + 2) % 24, share: best / r.hourSec };
    }
    const kind = peak && peak.share >= 0.5 ? 'window' : avgMin >= 20 ? 'limit' : 'watch';
    rows.push({ host: r.host, totalSec: r.sec, days: r.days, avgMin, attempts: r.attempts, peak, kind, limitMin: Math.max(10, roundTo5(avgMin * 0.6)) });
  }
  return rows.sort((a, b) => b.totalSec - a.totalSec).slice(0, top);
}
