// Numbers behind the weekly "My week" card (pure, so tests and the canvas agree).

/** Everything the card says, derived once. `cur`: [[dayKey, day]] for the period; `sum`/`prev`: summarize() results. */
export function wrappedStats({ sum, prev, cur, goalMin, weekGoals = null }) {
  const perDay = cur.map(([key, d]) => ({ key, focus: d?.fs || 0 }));
  const best = perDay.reduce((a, b) => (b.focus > a.focus ? b : a), { key: '', focus: 0 });
  const goalDays = goalMin ? perDay.filter((d) => d.focus >= goalMin * 60).length : null;
  const share = sum.total ? Math.round((sum.distracting / sum.total) * 100) : 0;
  const sharePrev = prev.total >= 60 ? Math.round((prev.distracting / prev.total) * 100) : null;
  const focusDelta = prev.focusSec >= 600 ? Math.round(((sum.focusSec - prev.focusSec) / prev.focusSec) * 100) : null;
  let msg = 'steady';
  if (weekGoals && weekGoals.total >= 1 && weekGoals.done === weekGoals.total) msg = 'week';
  else if (goalDays !== null && goalDays >= 5) msg = 'goal';
  else if (focusDelta !== null && focusDelta >= 10) msg = 'up';
  return { perDay, best: best.focus > 0 ? best : null, goalDays, days: cur.length, share, shareDelta: sharePrev === null ? null : share - sharePrev, focusDelta, msg, weekGoals };
}

