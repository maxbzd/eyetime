// Weekly report: pure functions shared by the service worker and tests.
(function (root) {
  const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Monday 00:00 of the week containing `d`
  function weekStart(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  }

  function sumWeek(stats, start, isDistraction) {
    const out = { total: 0, distraction: 0, sites: {}, focusSessions: 0, breaks: 0, days: 0 };
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      const day = stats[key(d)];
      if (!day) continue;
      out.days++;
      out.total += day.totalSeconds || 0;
      out.focusSessions += day.focusSessions || 0;
      out.breaks += day.breaksCompleted || 0;
      Object.entries(day.domains || {}).forEach(([dom, sec]) => {
        out.sites[dom] = (out.sites[dom] || 0) + sec;
        if (isDistraction && isDistraction(dom)) out.distraction += sec;
      });
    }
    return out;
  }

  // Report for the last *completed* week (Mon–Sun) compared with the week before it
  function computeWeeklyReport(stats, isDistraction, now) {
    now = now || new Date();
    const thisMonday = weekStart(now);
    const lastMonday = new Date(thisMonday); lastMonday.setDate(lastMonday.getDate() - 7);
    const prevMonday = new Date(lastMonday); prevMonday.setDate(prevMonday.getDate() - 7);
    const last = sumWeek(stats || {}, lastMonday, isDistraction);
    const prev = sumWeek(stats || {}, prevMonday, isDistraction);
    return {
      weekKey: key(lastMonday),
      total: last.total,
      deltaPct: prev.total > 0 ? Math.round((last.total - prev.total) / prev.total * 100) : null,
      distraction: last.distraction,
      topSites: Object.entries(last.sites).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]),
      focusSessions: last.focusSessions,
      breaks: last.breaks
    };
  }

  const api = { computeWeeklyReport, weekStart, key };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.EyeTimeReport = api;
})(typeof self !== 'undefined' ? self : this);
