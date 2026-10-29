// The calculations behind the new widgets (pure, so they can be tested): the moon, sunrise and sunset, clock hands, calendar grids, the focus heat map.
// Nothing here knows about the page or about the network; all of it is arithmetic on a date.

const DAY_MS = 86_400_000, RAD = Math.PI / 180;

/* ---------- the moon ---------- */

const SYNODIC = 29.530588853;
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14); // a known new moon
export const MOON_PHASES = ['new', 'waxingCrescent', 'firstQuarter', 'waxingGibbous', 'full', 'waningGibbous', 'lastQuarter', 'waningCrescent'];

/** The phase of the moon on a date: where it is in its month (0..1), how much is lit (0..1), a name, days to the next full / new moon. Accurate to about half a day. */
export function moonInfo(date = new Date()) {
  const age = (((date.getTime() - NEW_MOON_REF) / DAY_MS) % SYNODIC + SYNODIC) % SYNODIC, frac = age / SYNODIC;
  const name = frac < 0.03 || frac >= 0.97 ? 'new' : frac < 0.22 ? 'waxingCrescent' : frac < 0.28 ? 'firstQuarter' : frac < 0.47 ? 'waxingGibbous' : frac < 0.53 ? 'full' : frac < 0.72 ? 'waningGibbous' : frac < 0.78 ? 'lastQuarter' : 'waningCrescent';
  const toFull = ((0.5 - frac) * SYNODIC + SYNODIC) % SYNODIC, toNew = ((1 - frac) * SYNODIC) % SYNODIC;
  return { age, frac, illum: (1 - Math.cos(2 * Math.PI * frac)) / 2, name, toFull, toNew };
}

/** The lit part of the moon's disc as an SVG path in a circle of radius r centred on 0,0; `flip` mirrors it (a waning moon is lit on the left). */
export function moonPath(frac, r = 50) {
  const waxing = frac < 0.5, f = waxing ? frac : 1 - frac, k = Math.cos(2 * Math.PI * f), rx = Math.abs(k) * r;
  if (f < 0.012) return { d: '', flip: !waxing };
  if (f > 0.488) return { d: `M0,${-r} A${r},${r} 0 1 1 0,${r} A${r},${r} 0 1 1 0,${-r} Z`, flip: !waxing };
  return { d: `M0,${-r} A${r},${r} 0 0 1 0,${r} A${rx.toFixed(2)},${r} 0 0 ${k > 0 ? 0 : 1} 0,${-r} Z`, flip: !waxing };
}

/* ---------- the sun ---------- */

const julian = (ms) => ms / DAY_MS + 2440587.5;
const fromJulian = (jd) => new Date((jd - 2440587.5) * DAY_MS);

/**
 * Sunrise and sunset on the calendar day of `date` (local day) at a place, from the "sunrise equation". Good to a couple of minutes.
 * @returns {{ rise: Date, set: Date, noon: Date } | { polar: 'day' | 'night' }}
 */
export function sunTimes(date, lat, lon) {
  const noonUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const n = Math.round(julian(noonUtc) - 2451545.0 + 0.0008), Js = n - lon / 360;
  const M = (357.5291 + 0.98560028 * Js) % 360, Mr = M * RAD;
  const C = 1.9148 * Math.sin(Mr) + 0.02 * Math.sin(2 * Mr) + 0.0003 * Math.sin(3 * Mr);
  const L = ((M + C + 180 + 102.9372) % 360) * RAD;
  const Jt = 2451545.0 + Js + 0.0053 * Math.sin(Mr) - 0.0069 * Math.sin(2 * L);
  const sinD = Math.sin(L) * Math.sin(23.4397 * RAD), cosD = Math.cos(Math.asin(sinD));
  const cosW = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * sinD) / (Math.cos(lat * RAD) * cosD);
  if (cosW > 1) return { polar: 'night' };
  if (cosW < -1) return { polar: 'day' };
  const w = Math.acos(cosW) / (2 * Math.PI);
  return { rise: fromJulian(Jt - w), set: fromJulian(Jt + w), noon: fromJulian(Jt) };
}

/** Where the sun is on its day arc: 0 at sunrise, 1 at sunset (negative / above 1 outside daylight). */
export const sunProgress = (now, rise, set) => (now.getTime() - rise.getTime()) / (set.getTime() - rise.getTime());

/* ---------- clocks ---------- */

/** Angles (degrees clockwise from 12) of the three hands; `smooth` lets the seconds hand glide. */
export function handAngles(date, smooth = false) {
  const s = date.getSeconds() + (smooth ? date.getMilliseconds() / 1000 : 0), m = date.getMinutes() + s / 60, h = (date.getHours() % 12) + m / 60;
  return { h: h * 30, m: m * 6, s: s * 6 };
}
/** The hour and minute (and seconds) of a date as they would be read in a time zone ('' = this computer's). */
export function zonedParts(date, zone = '') {
  if (!zone) return { h: date.getHours(), m: date.getMinutes(), s: date.getSeconds() };
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(date).filter((x) => x.type !== 'literal').map((x) => [x.type, Number(x.value)]));
    return { h: p.hour % 24, m: p.minute, s: p.second };
  } catch { return { h: date.getHours(), m: date.getMinutes(), s: date.getSeconds() }; }
}

/* ---------- calendars ---------- */

const pad = (n) => String(n).padStart(2, '0');
export const keyOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** The weeks of a month for a grid: rows of 7 cells { key, day, inMonth }, starting on `weekStart` (0 Sunday … 6). Always 6 rows only when needed (4–6). */
export function monthGrid(year, month, weekStart = 1) {
  const first = new Date(year, month, 1), lead = (first.getDay() - weekStart + 7) % 7, days = new Date(year, month + 1, 0).getDate();
  const rows = Math.ceil((lead + days) / 7), out = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < 7; c++) { const d = new Date(year, month, 1 - lead + r * 7 + c); row.push({ key: keyOf(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), inMonth: d.getMonth() === month }); }
    out.push(row);
  }
  return out;
}

/** The year as a row of days: how many there are, which one is today (0-based) and how many are left. */
export function yearInfo(date = new Date()) {
  const y = date.getFullYear(), start = new Date(y, 0, 1), end = new Date(y + 1, 0, 1), total = Math.round((end - start) / DAY_MS);
  const index = Math.floor((new Date(y, date.getMonth(), date.getDate()) - start) / DAY_MS);
  return { year: y, total, index, left: total - index - 1, frac: (index + 1) / total };
}

/**
 * The heat map: `weeks` columns of 7 rows ending with the week of `today`, each cell { key, sec, level 0-4, future }.
 * @param {(key: string) => number} secOf focus seconds of a day key
 */
export function heatGrid(secOf, weeks = 12, today = new Date(), weekStart = 1) {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate()), lead = (end.getDay() - weekStart + 7) % 7;
  const first = new Date(end); first.setDate(end.getDate() - lead - (weeks - 1) * 7);
  const cells = [];
  let max = 0;
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let r = 0; r < 7; r++) { const d = new Date(first); d.setDate(first.getDate() + w * 7 + r); const key = keyOf(d.getFullYear(), d.getMonth(), d.getDate()), future = d > end, sec = future ? 0 : Math.max(0, secOf(key) || 0); max = Math.max(max, sec); col.push({ key, sec, level: 0, future }); }
    cells.push(col);
  }
  for (const col of cells) for (const c of col) { const r = max ? c.sec / max : 0; c.level = !c.sec ? 0 : r > 0.75 ? 4 : r > 0.5 ? 3 : r > 0.25 ? 2 : 1; }
  return cells;
}

/** 24 hourly bars (0..1) from sessions { t (ms), m (minutes) }; null when there is too little to say anything. */
export function hourBars(sessions, minSessions = 4) {
  const rows = (sessions || []).filter((s) => s && s.m >= 5 && Number.isFinite(s.t));
  if (rows.length < minSessions) return null;
  const by = Array(24).fill(0);
  for (const s of rows) by[new Date(s.t).getHours()] += s.m;
  const max = Math.max(...by) || 1;
  return by.map((v) => v / max);
}

/* ---------- breathing ---------- */

/** Patterns: [inhale, hold, exhale, hold] in seconds. */
export const BREATH = { box: [4, 4, 4, 4], calm: [4, 0, 6, 0], relax: [4, 7, 8, 0] };
/** Where a breathing cycle is at `t` seconds: the phase ('in' | 'hold' | 'out' | 'rest'), how far into it, and the circle's size 0..1. */
export function breathAt(pattern, t) {
  const p = BREATH[pattern] || BREATH.box, total = p.reduce((a, b) => a + b, 0);
  let x = ((t % total) + total) % total;
  const names = ['in', 'hold', 'out', 'rest'];
  for (let i = 0; i < 4; i++) {
    if (x < p[i] || (i === 3 && p[3] === 0)) {
      const f = p[i] ? x / p[i] : 1, ease = (v) => (1 - Math.cos(Math.PI * v)) / 2;
      const size = i === 0 ? ease(f) : i === 1 ? 1 : i === 2 ? 1 - ease(f) : 0;
      return { phase: names[i], f, size, left: Math.ceil(p[i] - x) || 1 };
    }
    x -= p[i];
  }
  return { phase: 'rest', f: 0, size: 0, left: 0 };
}
