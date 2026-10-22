// "Plan my day": turns the open priorities into a few focus blocks at sensible times.
// Uses what EyeTime already knows — your best focus hours, how long things really take you (estimate calibration), your daily goal,
// times already fixed (scheduled tasks, calendar events) — and nothing it has to guess blindly.

const MAX_BLOCKS = 4;
const pad = (n) => String(n).padStart(2, '0');
export const hhmm = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
export const toMin = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
const up5 = (n) => Math.ceil(n / 5) * 5;

/** Planned minutes for a task: its estimate scaled by the person's own calibration (clamped to 15–90), else the default. */
export function blockMinutes(task, { calibration = null, defaultMinutes = 25 } = {}) {
  if (!(task.est > 0)) return defaultMinutes;
  const scale = calibration && (calibration > 1.15 || calibration < 0.85) ? Math.min(2, Math.max(0.5, calibration)) : 1;
  return Math.min(90, Math.max(15, up5(task.est * scale)));
}

/**
 * tasks: open tasks (already filtered). nowMin: minutes since midnight. bestStart: best focus hour (0–23) or null.
 * busy: [{ start, end }] in minutes (calendar events, fixed tasks). workEnd: 'HH:MM'. today: 'YYYY-MM-DD' (for task.at/atDay).
 * Returns { blocks: [{ taskId, text, start:'HH:MM', minutes, fixed }], calibrated: boolean }.
 */
export function planDay({ tasks, nowMin, bestStart = null, calibration = null, busy = [], defaultMinutes = 25, goalMinutes = 0, workEnd = '18:00', today, maxBlocks = MAX_BLOCKS }) {
  let end = toMin(workEnd);
  if (end < 6 * 60) end = 24 * 60; // an overnight end such as 02:00 means "until midnight" for a day plan
  const fixed = tasks.filter((x) => x.at && x.atDay === today).map((x) => ({ taskId: x.id, text: x.text, start: x.at, minutes: blockMinutes(x, { calibration, defaultMinutes }), fixed: true }));
  const taken = [...busy.map((b) => ({ start: b.start, end: b.end })), ...fixed.map((f) => ({ start: toMin(f.start), end: toMin(f.start) + f.minutes }))];
  const flexible = tasks.filter((x) => !(x.at && x.atDay && x.atDay >= today) && !(x.due && x.due > today)) // fixed today, or booked for another day: not ours to move
    .sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0) || (b.planFor === today ? 1 : 0) - (a.planFor === today ? 1 : 0) || (a.createdAt || 0) - (b.createdAt || 0));
  const blocks = [];
  let cursor = up5(nowMin + 5);
  if (bestStart !== null && bestStart * 60 > cursor && bestStart * 60 + 30 <= end) cursor = bestStart * 60; // prefer the best window when it is still ahead
  let planned = fixed.reduce((a, f) => a + f.minutes, 0);
  for (const task of flexible) {
    if (blocks.length >= maxBlocks || (goalMinutes > 0 && planned >= goalMinutes && blocks.length >= 1)) break;
    const minutes = blockMinutes(task, { calibration, defaultMinutes });
    let start = cursor;
    for (let guard = 0; guard < 20; guard++) { // slide past anything already booked
      const clash = taken.find((b) => start < b.end + 5 && start + minutes > b.start - 0);
      if (!clash) break;
      start = up5(clash.end + 5);
    }
    if (start + minutes > end) break;
    blocks.push({ taskId: task.id, text: task.text, start: hhmm(start), minutes, fixed: false });
    taken.push({ start, end: start + minutes });
    planned += minutes;
    cursor = start + minutes + (blocks.length % 2 === 0 ? 15 : 10); // a short break after each block, a longer one after every second
  }
  const all = [...fixed, ...blocks].sort((a, b) => toMin(a.start) - toMin(b.start));
  return { blocks: all, calibrated: !!calibration && (calibration > 1.15 || calibration < 0.85) };
}
