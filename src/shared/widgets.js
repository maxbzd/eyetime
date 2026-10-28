// The widget catalogue (pure): which widgets exist, how a saved widget is validated, and the small calculations they share.
// A widget instance is { id, kind, cfg }; where it sits on Home is kept with the other blocks in newtab.canvas.items under the same id.

/** `w`: [min, max, default] width in px on the 1440 px reference window; `icon`: a Lucide name (literals, so the icon builder finds them). */
export const WIDGET_KINDS = {
  mainfocus: { icon: 'target', w: [260, 760, 460] },
  rings: { icon: 'circle-dot', w: [300, 640, 420] },
  countdown: { icon: 'timer', w: [200, 520, 280] },
  worldclock: { icon: 'globe', w: [220, 520, 300] },
  percent: { icon: 'percent', w: [240, 560, 320] },
  mantra: { icon: 'quote', w: [240, 760, 420] },
  nextevent: { icon: 'calendar-clock', w: [240, 560, 320] },
  week: { icon: 'chart-column', w: [260, 560, 340] },
  bignumber: { icon: 'hash', w: [160, 480, 240] },
  eyebreak: { icon: 'eye', w: [220, 520, 300] },
  sticky: { icon: 'sticky-note', w: [200, 560, 280] },
  plan: { icon: 'list-checks', w: [260, 560, 340] },
  recap: { icon: 'moon', w: [260, 560, 340] },
  stack: { icon: 'layers', w: [280, 640, 400] },
};
export const WIDGET_KIND_IDS = Object.keys(WIDGET_KINDS);
export const WIDGET_ID_RE = /^w[0-9a-z]{4,10}$/;
export const MAX_WIDGETS = 24;

export const WORLD_ZONES = ['UTC', 'Europe/London', 'Europe/Lisbon', 'Europe/Paris', 'Europe/Madrid', 'Europe/Rome', 'Europe/Berlin', 'Europe/Warsaw', 'Europe/Kyiv', 'Europe/Istanbul', 'Europe/Moscow',
  'Asia/Tbilisi', 'Asia/Yerevan', 'Asia/Dubai', 'Asia/Tehran', 'Asia/Jerusalem', 'Asia/Almaty', 'Asia/Kolkata', 'Asia/Bangkok', 'Asia/Jakarta', 'Asia/Singapore', 'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Manila', 'Asia/Seoul', 'Asia/Tokyo',
  'Australia/Sydney', 'Pacific/Auckland', 'Africa/Cairo', 'Africa/Lagos', 'Africa/Johannesburg',
  'America/Vancouver', 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/Mexico_City', 'America/Toronto', 'America/New_York', 'America/Sao_Paulo', 'America/Argentina/Buenos_Aires'];
export const BIG_METRICS = ['focusToday', 'sessionsToday', 'streak', 'tasksLeft', 'screenToday'];
export const PERIODS = ['day', 'week', 'month', 'year'];
export const MANTRA_COUNT = 6;

/* ---------- stacks: several widgets in one place, the right one on top for the hour ---------- */

export const STACK_WHEN = ['any', 'morning', 'day', 'evening', 'night'];
export const MAX_STACK = 5;
/** The part of the day: morning 5–11, day 12–17, evening 18–22, night 23–4. */
export const partOfDay = (hour) => (hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'day' : hour >= 18 && hour < 23 ? 'evening' : 'night');
/** The widget kinds a stack can hold (everything but a stack). */
export const STACKABLE = Object.keys(WIDGET_KINDS).filter((k) => k !== 'stack');
/** What a new stack holds: the day's plan in the morning, the main focus by day, the recap in the evening. */
export const defaultStack = () => ({ items: [{ kind: 'plan', when: 'morning', cfg: {} }, { kind: 'mainfocus', when: 'day', cfg: { text: '', day: '', done: false } }, { kind: 'recap', when: 'evening', cfg: {} }], pick: 'auto', i: 0 });
/**
 * Which member of a stack is on top: in `auto` the first whose part of the day matches (else the first "any"), in `manual` the one the person chose.
 * @param {{ items: Array<{ when: string }>, pick: string, i: number }} cfg
 */
export function stackIndex(cfg, hour) {
  const n = cfg.items.length;
  if (!n) return 0;
  if (cfg.pick === 'manual') return Math.min(n - 1, Math.max(0, cfg.i | 0));
  const part = partOfDay(hour);
  let i = cfg.items.findIndex((x) => x.when === part);
  if (i < 0) i = cfg.items.findIndex((x) => x.when === 'any');
  return i < 0 ? Math.min(n - 1, Math.max(0, cfg.i | 0)) : i;
}

const str = (v, max, fallback = '') => (typeof v === 'string' ? v.slice(0, max) : fallback);
const dateStr = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00')) ? v : '');
const timeStr = (v) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : '');

/** The first 1 January that is still ahead, as YYYY-MM-DD (the default countdown). */
export function nextNewYear(now = new Date()) { return `${now.getFullYear() + 1}-01-01`; }

/** Defaults of a new widget's settings. */
export function defaultCfg(kind, now = new Date()) {
  switch (kind) {
    case 'mainfocus': return { text: '', day: '', done: false };
    case 'countdown': return { title: '', date: nextNewYear(now), time: '' };
    case 'worldclock': return { zones: ['Europe/London', 'America/New_York', 'Asia/Tokyo'] };
    case 'percent': return { periods: ['day', 'week', 'year'] };
    case 'mantra': return { text: '' };
    case 'bignumber': return { metric: 'focusToday' };
    case 'sticky': return { text: '' };
    case 'stack': return defaultStack();
    default: return {};
  }
}

/** Validate one widget's settings for its kind; anything odd falls back to the default. */
export function normalizeCfg(kind, cfg, now = new Date()) {
  const c = cfg && typeof cfg === 'object' ? cfg : {};
  const d = defaultCfg(kind, now);
  switch (kind) {
    case 'mainfocus': return { text: str(c.text, 140), day: dateStr(c.day), done: c.done === true };
    case 'countdown': return { title: str(c.title, 60), date: dateStr(c.date) || d.date, time: timeStr(c.time) };
    case 'worldclock': { const z = Array.isArray(c.zones) ? c.zones.filter((x) => WORLD_ZONES.includes(x)).slice(0, 4) : null; return { zones: z && z.length ? [...new Set(z)] : d.zones }; }
    case 'percent': { const p = Array.isArray(c.periods) ? PERIODS.filter((x) => c.periods.includes(x)) : null; return { periods: p && p.length ? p : d.periods }; }
    case 'mantra': return { text: str(c.text, 200) };
    case 'bignumber': return { metric: BIG_METRICS.includes(c.metric) ? c.metric : d.metric };
    case 'sticky': return { text: str(c.text, 2000) };
    case 'stack': {
      const items = (Array.isArray(c.items) ? c.items : []).filter((x) => x && typeof x === 'object' && STACKABLE.includes(x.kind)).slice(0, MAX_STACK)
        .map((x) => ({ kind: x.kind, when: STACK_WHEN.includes(x.when) ? x.when : 'any', cfg: normalizeCfg(x.kind, x.cfg, now) }));
      return items.length ? { items, pick: c.pick === 'manual' ? 'manual' : 'auto', i: Math.min(items.length - 1, Math.max(0, Number.isInteger(c.i) ? c.i : 0)) } : d;
    }
    default: return {};
  }
}

/** Validate the saved list: known kinds, well-formed unique ids, a sane count. */
export function normalizeWidgets(list, now = new Date()) {
  const out = [], seen = new Set();
  for (const w of Array.isArray(list) ? list : []) {
    if (!w || typeof w !== 'object' || !WIDGET_KINDS[w.kind] || typeof w.id !== 'string' || !WIDGET_ID_RE.test(w.id) || seen.has(w.id)) continue;
    seen.add(w.id); out.push({ id: w.id, kind: w.kind, cfg: normalizeCfg(w.kind, w.cfg, now) });
    if (out.length >= MAX_WIDGETS) break;
  }
  return out;
}

/** A fresh id that no widget uses. */
export function newWidgetId(list, rand = Math.random) {
  const used = new Set((list || []).map((w) => w.id));
  for (;;) { const id = 'w' + Math.floor(rand() * 36 ** 6).toString(36).padStart(6, '0'); if (!used.has(id)) return id; }
}

/* ---------- calculations ---------- */

/** Time left until a date (and optional HH:MM), counted in the user's local time. */
export function countdownLeft(date, time, now = new Date()) {
  const target = new Date(`${date}T${time || '00:00'}:00`);
  const ms = target.getTime() - now.getTime();
  const abs = Math.abs(ms);
  const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const calDays = Math.round((dayStart(target) - dayStart(now)) / 86_400_000);
  return { ms, past: ms < 0, days: Math.floor(abs / 86_400_000), hours: Math.floor(abs / 3_600_000) % 24, minutes: Math.floor(abs / 60_000) % 60, calDays, sameDay: calDays === 0 };
}

/** How far through a day / week (Monday first) / month / year we are, 0..1. */
export function periodProgress(period, now = new Date()) {
  // counted in calendar days and wall-clock time, not in elapsed milliseconds: a daylight-saving change makes a day 23 or 25 hours long
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const dayFrac = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000) / 86_400;
  const utcDay = (yy, mm, dd) => Date.UTC(yy, mm, dd) / 86_400_000;
  let done, total;
  if (period === 'day') { done = dayFrac; total = 1; }
  else if (period === 'week') { done = (now.getDay() + 6) % 7 + dayFrac; total = 7; }
  else if (period === 'month') { done = d - 1 + dayFrac; total = utcDay(y, m + 1, 1) - utcDay(y, m, 1); }
  else { done = utcDay(y, m, d) - utcDay(y, 0, 1) + dayFrac; total = utcDay(y + 1, 0, 1) - utcDay(y, 0, 1); }
  return Math.min(1, Math.max(0, done / total));
}

/** "New_York" from "America/New_York". */
export const zoneCity = (tz) => (tz === 'UTC' ? 'UTC' : tz.split('/').pop().replace(/_/g, ' '));

/** Local time in a zone as { time, dayShift }, where dayShift is -1 / 0 / +1 against the local date. */
export function zoneClock(tz, now, lang, clock24) {
  const fmt = (o) => new Intl.DateTimeFormat(lang, { timeZone: tz, ...o });
  const hc = clock24 === null || clock24 === undefined ? {} : clock24 ? { hourCycle: 'h23' } : { hour12: true };
  const time = fmt({ hour: 'numeric', minute: '2-digit', ...hc }).format(now);
  const ymd = (d, zone) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const there = ymd(now, tz), here = ymd(now, Intl.DateTimeFormat().resolvedOptions().timeZone);
  const dayShift = there === here ? 0 : there > here ? 1 : -1;
  return { time, dayShift };
}
