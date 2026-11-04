// What "plan my day" knows: the person's best hours, how long things really take them, the calendar, the working hours.
// Read once, then `proposeBlocks` turns a set of tasks into focus blocks at sensible times (shared/dayplan.js does the placing).

import { getSettings, getCollection, getDays } from '../shared/storage.js';
import { planDay, toMin } from '../shared/dayplan.js';
import { bestHours } from '../shared/productivity.js';
import { estimateAccuracy } from '../shared/quickadd.js';
import { accuracyInput } from '../shared/tasks.js';
import { dayKey, rangeKeys } from '../shared/time.js';

export async function loadPlanContext(now = new Date()) {
  const [settings, tasks, estLog, days, events, allDayEvents] = await Promise.all([getSettings(), getCollection('tasks', []), getCollection('estLog', []), getDays(rangeKeys(112)), getCollection('calendar', []), getCollection('calendarDays', [])]);
  const today = dayKey(now);
  const best = bestHours(days);
  const acc = estimateAccuracy(accuracyInput(tasks, estLog));
  const busy = events.filter((e) => e.day === today).map((e) => ({ start: toMin(e.start), end: toMin(e.end) }));
  const busyDay = (allDayEvents || []).some((e) => e.day === today); // an all-day event (trip, conference): plan lighter
  return { settings, tasks, today, now, best, acc, busy, busyDay };
}

/** @param {Awaited<ReturnType<typeof loadPlanContext>>} ctx @param {any[]} open the tasks to place */
export function proposeBlocks(ctx, open) {
  const { settings, today, now, best, acc, busy, busyDay } = ctx;
  const sch = settings.blocking.schedule;
  const plan = planDay({
    maxBlocks: busyDay ? 2 : undefined, tasks: open, nowMin: now.getHours() * 60 + now.getMinutes(), bestStart: best ? best.start : null, calibration: acc ? acc.median : null, busy,
    defaultMinutes: settings.focus.minutes, goalMinutes: settings.focus.dailyGoal, workEnd: (sch && sch.enabled && sch.end) || '18:00', today,
  });
  const notes = [best ? ['plan.bestNote', { time: `${String(best.start).padStart(2, '0')}:00` }] : null, plan.calibrated && acc ? ['plan.calibNote', { x: (Math.round(acc.median * 10) / 10).toString() }] : null, busy.length ? ['plan.calNote', {}] : null, busyDay ? ['plan.allDayNote', {}] : null].filter(Boolean);
  return { ...plan, notes };
}
