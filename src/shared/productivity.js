// Pure productivity logic: the plan → focus → review loop. No browser APIs, unit-tested.
//
// Day records gain two optional fields:
//   ss: [{ id, t, m, p, g, k, c, r }]   focus sessions: id, start ts, minutes done, minutes planned, goal text, task id, completed (1/0), rating (0 = none, 1–3)
//   pr: { [reason]: count }             why the user continued past a pause page

export const MAX_SESSIONS_PER_DAY = 60;
export const PAUSE_REASONS = ['break', 'work', 'habit', 'bored', 'back']; // 'back' = turned around instead of continuing
export const RATINGS = [1, 2, 3]; // 1 distracted · 2 okay · 3 deep focus

/** The rest that should follow a finished session: a long one after every Nth session of the day. */
export function restFor(focus, sessionsToday) {
  const base = focus.breakMinutes || 0;
  if (!base) return { minutes: 0, long: false };
  const lb = focus.longBreak || {};
  if (lb.every > 0 && lb.minutes > 0 && sessionsToday > 0 && sessionsToday % lb.every === 0) return { minutes: Math.max(lb.minutes, base), long: true };
  return { minutes: base, long: false };
}

export function goalProgress(fsSec, goalMin) {
  const goal = Math.max(0, goalMin || 0);
  const doneMin = Math.floor((fsSec || 0) / 60);
  return { goalMin: goal, doneMin, pct: goal ? Math.min(1, doneMin / goal) : 0, reached: goal > 0 && doneMin >= goal, leftMin: goal ? Math.max(0, goal - doneMin) : 0 };
}

/** Consecutive days (ending today, or yesterday while today is still in progress) that reached the daily goal. */
export function goalStreak(entries, goalMin) {
  if (!goalMin) return 0;
  const need = goalMin * 60;
  let n = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    if ((entries[i][1]?.fs || 0) >= need) n++;
    else if (i === entries.length - 1) continue;
    else break;
  }
  return n;
}

export function makeSessionEntry(session, { sec, completed, now = Date.now() }) {
  return {
    id: session.id, t: session.startedAt, m: Math.max(1, Math.round(sec / 60)), p: session.minutes,
    g: (session.goal || '').slice(0, 80), k: session.taskId || '', c: completed ? 1 : 0, r: 0,
  };
}

/** Append a session to a day record (capped), tolerant of records without `ss`. */
export function addSession(day, entry) {
  const list = (day.ss ||= []);
  if (list.some((s) => s.id === entry.id)) return list;
  list.push(entry);
  if (list.length > MAX_SESSIONS_PER_DAY) list.splice(0, list.length - MAX_SESSIONS_PER_DAY);
  return list;
}

export function rateSession(day, id, rating) {
  const s = (day.ss || []).find((x) => x.id === id);
  if (s && RATINGS.includes(rating)) s.r = rating;
  return !!s;
}

export const sessionsOf = (entries) => entries.flatMap(([key, day]) => (day?.ss || []).map((s) => ({ ...s, key })));

/**
 * When does the user focus best? Minutes of focus per start hour, then the best 2-hour window.
 * Returns null until there is enough data to say anything honest.
 */
export function bestHours(entries, { minSessions = 6 } = {}) {
  const sessions = sessionsOf(entries).filter((s) => s.m >= 5);
  if (sessions.length < minSessions) return null;
  const byHour = Array(24).fill(0);
  for (const s of sessions) {
    // weight deep sessions higher so "best" means good focus, not just busy
    const w = s.r === 3 ? 1.5 : s.r === 1 ? 0.5 : 1;
    byHour[new Date(s.t).getHours()] += s.m * w;
  }
  let best = 0, bestSum = -1;
  for (let h = 0; h < 24; h++) { const v = byHour[h] + byHour[(h + 1) % 24]; if (v > bestSum) { bestSum = v; best = h; } }
  const total = byHour.reduce((a, b) => a + b, 0) || 1;
  return { start: best, end: (best + 2) % 24, share: Math.min(1, bestSum / total), byHour, sessions: sessions.length };
}

/** Today at a glance for the evening review. */
export function dayReview(day) {
  const ss = day?.ss || [];
  const rated = ss.filter((s) => s.r);
  const goals = new Map();
  for (const s of ss) if (s.g) goals.set(s.g, (goals.get(s.g) || 0) + s.m);
  return {
    sessions: ss.length, completed: ss.filter((s) => s.c).length, minutes: ss.reduce((a, s) => a + s.m, 0),
    avgRating: rated.length ? rated.reduce((a, s) => a + s.r, 0) / rated.length : 0,
    top: [...goals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([goal, minutes]) => ({ goal, minutes })),
  };
}

/** Pause-page "why am I here" reasons summed over a range. */
export function pauseReasonTotals(entries) {
  const out = {};
  for (const [, day] of entries) for (const [k, n] of Object.entries(day?.pr || {})) out[k] = (out[k] || 0) + n;
  return out;
}

/**
 * The one gentle prompt Home should show right now (or null): celebrate the goal, review the day, plan the day, or lower the bar to start.
 * ctx: { now: Date, fsSec, goalMin, openTasks, starred, sessionsToday }
 */
export function nudge({ now = new Date(), fsSec = 0, goalMin = 0, openTasks = 0, starred = 0, sessionsToday = 0 }) {
  const hour = now.getHours();
  const g = goalProgress(fsSec, goalMin);
  if (g.reached) return 'goal';
  if (hour >= 18 && sessionsToday > 0) return 'review';
  if (hour < 14 && starred === 0 && openTasks > 0) return 'plan';
  if (fsSec === 0 && hour >= 7 && hour < 21) return 'start';
  return null;
}

export const MAX_PRIORITIES = 3;

/**
 * The next scheduled "time to focus" reminder after `now`: { reminder, at } (ms timestamp) or null.
 * reminder: { id, time: 'HH:MM', days: [0..6], minutes }
 */
export function nextReminder(reminders, now = new Date()) {
  let best = null;
  for (const r of reminders || []) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(r.time || '');
    if (!m || !(r.days || []).length) continue;
    for (let add = 0; add < 8; add++) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + add, Number(m[1]), Number(m[2]), 0, 0);
      if (at.getTime() <= now.getTime() + 1000 || !r.days.includes(at.getDay())) continue;
      if (!best || at.getTime() < best.at) best = { reminder: r, at: at.getTime() };
      break;
    }
  }
  return best;
}
