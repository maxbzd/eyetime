// Minimal, dependency-free iCalendar (.ics) reader: events for a date window, with the common recurrence rules.
// Local-only: the file is read in the browser and only { day, start, end, title } of the next two weeks is kept.

const pad = (n) => String(n).padStart(2, '0');
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function unfold(text) { return String(text || '').replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/); }
const unescapeText = (s) => String(s || '').replace(/\\([nN,;\\])/g, (m, c) => (c === 'n' || c === 'N' ? ' ' : c)).trim();

const offsetAt = (t, tz) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(t));
  const g = (k) => Number(parts.find((p) => p.type === k).value);
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) - Math.floor(t / 60000) * 60000;
};

/** Instant for a wall-clock time in an IANA zone (no tz database needed: Intl tells us the zone's offset; two passes settle DST edges). */
function inZone(y, mo, d, h, mi, tz) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  try {
    let t = guess - offsetAt(guess, tz);
    t = guess - offsetAt(t, tz);
    return new Date(t);
  } catch { return new Date(y, mo - 1, d, h, mi); } // unknown zone name: treat as local
}

/** Parses DTSTART/DTEND-like values: { date, allDay, kind: 'utc'|'zone'|'local', tz, wall:{y,mo,d,h,mi} } */
function parseDate(value, params) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(String(value || '').trim());
  if (!m) return null;
  const wall = { y: +m[1], mo: +m[2], d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0) };
  if (m[4] === undefined) return { date: new Date(wall.y, wall.mo - 1, wall.d), allDay: true, kind: 'local', wall };
  if (m[7]) return { date: new Date(Date.UTC(wall.y, wall.mo - 1, wall.d, wall.h, wall.mi)), allDay: false, kind: 'utc', wall };
  const tz = /TZID=([^;:]+)/i.exec(params || '');
  if (tz) { const name = tz[1].replace(/"/g, ''); return { date: inZone(wall.y, wall.mo, wall.d, wall.h, wall.mi, name), allDay: false, kind: 'zone', tz: name, wall }; }
  return { date: new Date(wall.y, wall.mo - 1, wall.d, wall.h, wall.mi), allDay: false, kind: 'local', wall };
}

/** The instant of a wall-clock time on a calendar day, in the event's own zone (so DST changes keep "10:00" at 10:00). */
function instantOn(st, y, mo, d) {
  const { h, mi } = st.wall;
  if (st.kind === 'utc') return new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (st.kind === 'zone') return inZone(y, mo, d, h, mi, st.tz);
  return new Date(y, mo - 1, d, h, mi);
}

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const DAY_MS = 86_400_000;

/**
 * Occurrence start instants of a recurring event inside [from, to). DAILY / WEEKLY (+BYDAY, WKST) / MONTHLY (day of month or "3rd Tuesday") /
 * YEARLY, with INTERVAL, COUNT, UNTIL. Walks the calendar of the event's own zone; skips straight to the window when there is no COUNT.
 */
function occurrences(st, rule, from, to) {
  const r = Object.fromEntries(String(rule).split(';').map((p) => p.split('=')));
  const interval = Math.max(1, Number(r.INTERVAL) || 1), limit = r.COUNT ? Number(r.COUNT) : Infinity;
  let until = r.UNTIL ? parseDate(r.UNTIL, '') : null;
  if (until && until.allDay) until = { date: new Date(until.wall.y, until.wall.mo - 1, until.wall.d, 23, 59, 59) };
  const wkst = Math.max(0, DAYS.indexOf(r.WKST || 'MO'));
  const by = r.BYDAY ? r.BYDAY.split(',').map((x) => { const m = /^([+-]?\d+)?([A-Z]{2})$/.exec(x.trim()); return m ? { n: m[1] ? Number(m[1]) : 0, dow: DAYS.indexOf(m[2]) } : null; }).filter((x) => x && x.dow >= 0) : [];
  const byMonthDay = r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number) : [];
  const { y: y0, mo: mo0, d: d0 } = st.wall;
  const base = Date.UTC(y0, mo0 - 1, d0), dow0 = new Date(base).getUTCDay(), offset = (dow0 - wkst + 7) % 7;
  let i = limit === Infinity ? Math.max(0, Math.floor((Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()) - base) / DAY_MS) - 2) : 0;
  const out = []; let count = 0;
  for (; i < 366 * 60; i++) {
    const c = new Date(base + i * DAY_MS), y = c.getUTCFullYear(), mo = c.getUTCMonth() + 1, d = c.getUTCDate(), dow = c.getUTCDay();
    const at = instantOn(st, y, mo, d);
    if (at >= to || (until && at > until.date)) break;
    const monthsDiff = (y - y0) * 12 + (mo - mo0);
    let hit = false;
    if (r.FREQ === 'DAILY') hit = i % interval === 0;
    else if (r.FREQ === 'WEEKLY') hit = Math.floor((i + offset) / 7) % interval === 0 && (by.length ? by.some((b) => b.dow === dow) : dow === dow0);
    else if (r.FREQ === 'MONTHLY') {
      const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      const dayOk = by.length ? by.some((b) => b.dow === dow && (!b.n || (b.n > 0 ? Math.ceil(d / 7) === b.n : d + 7 * -b.n > dim && d + 7 * (-b.n - 1) <= dim))) : byMonthDay.length ? byMonthDay.some((x) => (x > 0 ? x === d : dim + x + 1 === d)) : d === d0;
      hit = monthsDiff % interval === 0 && dayOk;
    } else if (r.FREQ === 'YEARLY') hit = mo === mo0 && d === d0 && (y - y0) % interval === 0;
    if (!hit) continue;
    count++;
    if (count > limit) break;
    if (at >= from) out.push(at);
  }
  return out;
}

const minute = (d) => Math.floor(d.getTime() / 60000);

/** → [{ id, title, day, start:'HH:MM', end:'HH:MM' }] for events starting in [from, to), sorted. All-day and cancelled events are skipped; moved occurrences replace the original. */
export function parseIcs(text, { from = new Date(), days = 14, max = 500 } = {}) {
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  const start0 = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const raw = [];
  let cur = null, sub = 0;
  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') { cur = { ex: [], exDays: [] }; sub = 0; continue; }
    if (!cur) continue;
    if (line === 'END:VEVENT') { raw.push(cur); cur = null; continue; }
    if (/^BEGIN:/i.test(line)) { sub++; continue; }   // VALARM etc.: its SUMMARY / TRIGGER are not the event's
    if (/^END:/i.test(line)) { sub = Math.max(0, sub - 1); continue; }
    if (sub) continue;
    const i = line.indexOf(':'); if (i < 0) continue;
    const head = line.slice(0, i), value = line.slice(i + 1), name = head.split(';')[0].toUpperCase(), params = head.slice(name.length);
    if (name === 'DTSTART') cur.start = parseDate(value, params);
    else if (name === 'DTEND') cur.end = parseDate(value, params);
    else if (name === 'SUMMARY') cur.title = unescapeText(value).slice(0, 80);
    else if (name === 'UID') cur.uid = value.trim();
    else if (name === 'RRULE') cur.rrule = value.trim();
    else if (name === 'STATUS') cur.cancelled = /^CANCELLED$/i.test(value.trim());
    else if (name === 'RECURRENCE-ID') cur.recId = parseDate(value, params);
    else if (name === 'EXDATE') for (const v of value.split(',')) { const p = parseDate(v, params); if (!p) continue; if (p.allDay) cur.exDays.push(key(p.date)); else cur.ex.push(minute(p.date)); }
  }
  // occurrences replaced by a moved/cancelled instance of the same series
  const replaced = new Map();
  for (const ev of raw) if (ev.recId && ev.uid) { if (!replaced.has(ev.uid)) replaced.set(ev.uid, { t: new Set(), d: new Set() }); const set = replaced.get(ev.uid); if (ev.recId.allDay) set.d.add(key(ev.recId.date)); else set.t.add(minute(ev.recId.date)); }
  const events = [];
  for (const ev of raw) {
    if (!ev.start || ev.start.allDay || ev.cancelled) continue;
    const len = ev.end && !ev.end.allDay ? Math.max(0, ev.end.date - ev.start.date) : 30 * 60000;
    const gone = ev.recId ? null : replaced.get(ev.uid);
    const starts = ev.rrule && !ev.recId ? occurrences(ev.start, ev.rrule, start0, to) : (ev.start.date >= start0 && ev.start.date < to ? [ev.start.date] : []);
    for (const s of starts) {
      if (ev.ex.includes(minute(s)) || ev.exDays.includes(key(s))) continue;
      if (gone && (gone.t.has(minute(s)) || gone.d.has(key(s)))) continue;
      const e = new Date(s.getTime() + len);
      events.push({ id: `${ev.uid || events.length}@${key(s)}`, title: ev.title || '', day: key(s), start: hm(s), end: key(e) === key(s) ? hm(e) : '23:59' });
    }
  }
  return events.sort((a, b) => (a.day + a.start < b.day + b.start ? -1 : 1)).slice(0, max);
}

/** Next event today after `nowMin` (minutes since midnight) → { title, start, end, inMin } or null. */
export function nextEvent(events, today, nowMin) {
  const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const e = (events || []).filter((x) => x.day === today && toMin(x.end) > nowMin).sort((a, b) => toMin(a.start) - toMin(b.start))[0];
  return e ? { ...e, inMin: Math.max(0, toMin(e.start) - nowMin), ongoing: toMin(e.start) <= nowMin } : null;
}
