// Minimal, dependency-free iCalendar (.ics) reader: events for a date window, with the common recurrence rules.
// Local-only: the file is read in the browser and only { day, start, end, title } of the next two weeks is kept.

const pad = (n) => String(n).padStart(2, '0');
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function unfold(text) { return String(text || '').replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/); }
const unescapeText = (s) => String(s || '').replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();

/** Local-time Date for a wall-clock time in an IANA zone (no tz database needed: Intl tells us the zone's offset at that moment). */
function inZone(y, mo, d, h, mi, tz) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(guess));
    const g = (t) => Number(parts.find((p) => p.type === t).value);
    const asZone = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'));
    return new Date(guess - (asZone - guess));
  } catch { return new Date(y, mo - 1, d, h, mi); } // unknown zone name: treat as local
}

/** Parses DTSTART/DTEND-like values: { date: Date|null, allDay } */
function parseDate(value, params) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(String(value || '').trim());
  if (!m) return null;
  if (m[4] === undefined) return { date: new Date(+m[1], +m[2] - 1, +m[3]), allDay: true };
  if (m[7]) return { date: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])), allDay: false };
  const tz = /TZID=([^;:]+)/i.exec(params || '');
  return { date: tz ? inZone(+m[1], +m[2], +m[3], +m[4], +m[5], tz[1].replace(/"/g, '')) : new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]), allDay: false };
}

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** Occurrence start dates of a recurring event inside [from, to). Supports DAILY / WEEKLY (+BYDAY) / MONTHLY (same day) with INTERVAL, COUNT, UNTIL. */
function occurrences(start, rule, from, to) {
  const r = Object.fromEntries(String(rule).split(';').map((p) => p.split('=')));
  const interval = Math.max(1, Number(r.INTERVAL) || 1), until = r.UNTIL ? parseDate(r.UNTIL, '') : null, limit = r.COUNT ? Number(r.COUNT) : Infinity;
  const out = []; let count = 0;
  const by = r.BYDAY ? r.BYDAY.split(',').map((x) => DAYS.indexOf(x.slice(-2))).filter((i) => i >= 0) : [];
  const day0 = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  for (let i = 0; i < 800; i++) { // generous upper bound on days scanned from the first occurrence
    const d = new Date(day0.getFullYear(), day0.getMonth(), day0.getDate() + i);
    const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), start.getHours(), start.getMinutes());
    if (until && until.date && at > until.date) break;
    if (at >= to) break;
    let hit = false;
    if (r.FREQ === 'DAILY') hit = i % interval === 0;
    else if (r.FREQ === 'WEEKLY') { const weeks = Math.floor(i / 7); hit = weeks % interval === 0 && (by.length ? by.includes(d.getDay()) : i % 7 === 0); }
    else if (r.FREQ === 'MONTHLY') hit = d.getDate() === start.getDate() && ((d.getFullYear() * 12 + d.getMonth()) - (start.getFullYear() * 12 + start.getMonth())) % interval === 0;
    if (!hit) continue;
    count++;
    if (count > limit) break;
    if (at >= from) out.push(at);
  }
  return out;
}

/** → [{ id, title, day, start:'HH:MM', end:'HH:MM' }] for events starting in [from, to), sorted. All-day events are skipped. */
export function parseIcs(text, { from = new Date(), days = 14, max = 500 } = {}) {
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  const start0 = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const events = [];
  let cur = null;
  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') { cur = { ex: [] }; continue; }
    if (line === 'END:VEVENT') {
      if (cur && cur.start && !cur.start.allDay) {
        const len = cur.end && !cur.end.allDay ? Math.max(0, cur.end.date - cur.start.date) : 30 * 60000;
        const starts = cur.rrule ? occurrences(cur.start.date, cur.rrule, start0, to) : (cur.start.date >= start0 && cur.start.date < to ? [cur.start.date] : []);
        for (const s of starts) {
          if (cur.ex.includes(key(s) + hm(s))) continue;
          const e = new Date(s.getTime() + len);
          events.push({ id: `${cur.uid || events.length}@${key(s)}`, title: cur.title || '', day: key(s), start: hm(s), end: key(e) === key(s) ? hm(e) : '23:59' });
        }
      }
      cur = null; continue;
    }
    if (!cur) continue;
    const i = line.indexOf(':'); if (i < 0) continue;
    const head = line.slice(0, i), value = line.slice(i + 1), name = head.split(';')[0].toUpperCase(), params = head.slice(name.length);
    if (name === 'DTSTART') cur.start = parseDate(value, params);
    else if (name === 'DTEND') cur.end = parseDate(value, params);
    else if (name === 'SUMMARY') cur.title = unescapeText(value).slice(0, 80);
    else if (name === 'UID') cur.uid = value.trim();
    else if (name === 'RRULE') cur.rrule = value.trim();
    else if (name === 'EXDATE') for (const v of value.split(',')) { const p = parseDate(v, params); if (p && p.date) cur.ex.push(key(p.date) + hm(p.date)); }
  }
  return events.sort((a, b) => (a.day + a.start < b.day + b.start ? -1 : 1)).slice(0, max);
}

/** Next event today after `nowMin` (minutes since midnight) → { title, start, end, inMin } or null. */
export function nextEvent(events, today, nowMin) {
  const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const e = (events || []).filter((x) => x.day === today && toMin(x.end) > nowMin).sort((a, b) => toMin(a.start) - toMin(b.start))[0];
  return e ? { ...e, inMin: Math.max(0, toMin(e.start) - nowMin), ongoing: toMin(e.start) <= nowMin } : null;
}
