// What a scene can know about the day: the slow values (focus, goal, tasks, streak …) read from storage and kept fresh, the clock, the mouse.
// Everything is read-only; a scene never sees more than the names in shared/scene/schema.js BINDINGS.

import { getSettings, getRaw, getCollection, getDays, onChange } from '../../shared/storage.js';
import { dayKey, rangeKeys } from '../../shared/time.js';
import { isFocusLive } from '../../shared/blocking.js';
import { plannedMs, remainingMs, isPaused } from '../../shared/focus.js';
import { goalProgress } from '../../shared/productivity.js';
import { focusStreak } from '../../shared/stats.js';
import { sunTimes } from '../../shared/wgx.js';
import { normalizeWeather } from '../../shared/weather.js';

const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / ((b - a) || 1e-9))); return k * k * (3 - 2 * k); };

/** The share of daylight now (0 at night → 1 at midday) for a sunrise / sunset in hours; with a soft twilight. */
export function daylightAt(hourFloat, rise = 6.5, set = 19) {
  const x = (hourFloat - rise) / (set - rise);
  return smooth(-0.07, 0.07, x) * smooth(1.07, 0.93, x) * (0.3 + 0.7 * Math.sin(Math.PI * Math.min(1, Math.max(0, x))));
}

/** A source of slow data. `snapshot()` → the latest values; `onChange(cb)` fires when they change; `destroy()`. */
export function createSource() {
  let snap = { focus: 0, focusFrac: 0, paused: 0, goal: 0, goalMin: 0, focusToday: 0, sessionsToday: 0, tasksOpen: 0, tasksDone: 0, streak: 0, screenToday: 0, week: [0, 0, 0, 0, 0, 0, 0], days14: new Array(14).fill(0), tasks: [], rise: 6.5, set: 19 };
  const subs = new Set();
  let alive = true, timer = 0;
  async function load() {
    const [s, { focus }, tasks, days] = await Promise.all([getSettings(), getRaw('focus'), getCollection('tasks', []), getDays(rangeKeys(14))]);
    if (!alive) return;
    const today = days[days.length - 1][1] || {}, f = focus && isFocusLive(focus) ? focus : null;
    const g = goalProgress(today.fs || 0, s.focus.dailyGoal), open = tasks.filter((t) => !t.done), place = normalizeWeather(s.weather).place;
    let rise = 6.5, set = 19;
    if (place) { const st = sunTimes(new Date(), place.lat, place.lon); if (!('polar' in st)) { rise = st.rise.getHours() + st.rise.getMinutes() / 60; set = st.set.getHours() + st.set.getMinutes() / 60; } }
    const todayKey = dayKey();
    snap = {
      focus: f ? 1 : 0, focusFrac: f && plannedMs(f) ? 1 - Math.min(1, Math.max(0, remainingMs(f) / plannedMs(f))) : 0, paused: f && isPaused(f) ? 1 : 0,
      goal: g.goalMin ? g.pct : 0, goalMin: g.goalMin || 0, focusToday: Math.round((today.fs || 0) / 60), sessionsToday: today.fc || 0,
      tasksOpen: open.length, tasksDone: tasks.filter((t) => t.done && t.doneAt && dayKey(new Date(t.doneAt)) === todayKey).length, streak: focusStreak(days),
      screenToday: Math.round(Object.values(today.d || {}).reduce((a, b) => a + b, 0) / 60),
      week: days.slice(-7).map(([, d]) => Math.round(((d && d.fs) || 0) / 60)), days14: days.map(([, d]) => Math.round(((d && d.fs) || 0) / 60)),
      tasks: open.sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0)).slice(0, 12).map((t) => ({ id: t.id, text: String(t.text || '').slice(0, 80), starred: t.starred ? 1 : 0 })), rise, set,
    };
    subs.forEach((cb) => cb());
  }
  load();
  const off = onChange(['focus', 'tasks', 'settings', 'd:*'], load);
  timer = window.setInterval(load, 5000); // the focus fraction moves on its own
  return { snapshot: () => snap, onChange: (cb) => { subs.add(cb); return () => subs.delete(cb); }, destroy: () => { alive = false; off(); clearInterval(timer); subs.clear(); } };
}

/** The pointer, 0–1 across the window (eased a little so a scene moves smoothly). */
export function createPointer() {
  const p = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  const move = (e) => { p.tx = e.clientX / Math.max(1, window.innerWidth); p.ty = e.clientY / Math.max(1, window.innerHeight); };
  window.addEventListener('pointermove', move, { passive: true });
  return { p, step: (k = 0.12) => { p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; }, destroy: () => window.removeEventListener('pointermove', move) };
}
