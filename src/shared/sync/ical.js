// iCalendar (RFC 5545) for the CalDAV connection: reading and writing the few properties of a to-do (VTODO) and of the focus blocks EyeTime makes (VEVENT).
// Reading is tolerant (folded lines, parameters, UTC / floating / zoned times, all-day dates); writing keeps everything it does not understand: a to-do edited here is
// the same to-do with a few lines changed, not a new one (alarms, notes, recurrence and the other app's own properties survive).

const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');

export const unfold = (/** @type {string} */ t) => t.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
export const unescapeText = (/** @type {string} */ s) => s.replace(/\\([nN,;\\])/g, (_m, c) => (c === 'n' || c === 'N' ? '\n' : c));
export const escapeText = (/** @type {string} */ s) => String(s).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\;');
/** Lines longer than 75 bytes are folded (the continuation starts with a space). */
export function fold(/** @type {string} */ line) {
  const out = []; let rest = line;
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = ' ' + rest.slice(74); }
  out.push(rest); return out.join('\r\n');
}

/** @typedef {{ name: string, params: Record<string, string>, value: string, i: number }} Prop */

/** The properties of the first component of a kind (VTODO / VEVENT) with their position in the unfolded lines. */
export function component(/** @type {string} */ text, /** @type {string} */ kind) {
  const lines = unfold(text), props = /** @type {Prop[]} */ ([]);
  let inside = false, depth = 0, start = -1, end = -1;
  lines.forEach((l, i) => {
    const up = l.toUpperCase();
    if (up === 'BEGIN:' + kind && !inside) { inside = true; depth = 0; start = i; return; }
    if (!inside) return;
    if (up.startsWith('BEGIN:')) { depth++; return; }
    if (up === 'END:' + kind && depth === 0) { inside = false; end = i; return; }
    if (up.startsWith('END:')) { depth--; return; }
    if (depth > 0 || !l) return;
    const c = l.indexOf(':'); if (c < 1) return;
    const head = l.slice(0, c).split(';'), params = /** @type {Record<string, string>} */ ({});
    for (const p of head.slice(1)) { const [k, ...v] = p.split('='); params[k.toUpperCase()] = v.join('=').replace(/^"|"$/g, ''); }
    props.push({ name: head[0].toUpperCase(), params, value: l.slice(c + 1), i });
  });
  return { lines, props, start, end, found: start >= 0 && end > start };
}
const get = (/** @type {Prop[]} */ props, /** @type {string} */ n) => props.find((p) => p.name === n);

/** Offset of a time zone from UTC at an instant, in ms (positive east). */
export function tzOffsetMs(/** @type {number} */ at, /** @type {string} */ tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(at));
    const v = Object.fromEntries(parts.map((p) => [p.type, Number(p.value)]));
    return Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second) - Math.floor(at / 1000) * 1000;
  } catch { return 0; }
}

/**
 * A DTSTART / DTEND / DUE value as { day, min } in the local time of this computer (or { day, min: null } for a date without a time).
 * @param {Prop | undefined} p
 */
export function localTime(p) {
  if (!p) return null;
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(p.value.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  if (m[4] === undefined) return { day: `${m[1]}-${m[2]}-${m[3]}`, min: /** @type {number | null} */ (null) };
  const [hh, mi, ss] = [Number(m[4]), Number(m[5]), Number(m[6] || 0)];
  let ms;
  if (m[7]) ms = Date.UTC(y, mo, d, hh, mi, ss);
  else if (p.params.TZID) { const guess = Date.UTC(y, mo, d, hh, mi, ss); ms = guess - tzOffsetMs(guess - tzOffsetMs(guess, p.params.TZID), p.params.TZID); }
  else return { day: `${m[1]}-${m[2]}-${m[3]}`, min: hh * 60 + mi }; // floating: already local
  const t = new Date(ms);
  return { day: `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`, min: t.getHours() * 60 + t.getMinutes() };
}

/** Local day + minutes → an iCalendar UTC time. */
export function utcStamp(/** @type {string} */ day, /** @type {number} */ min) {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(y, m - 1, d, Math.floor(min / 60), min % 60, 0);
  return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}00Z`;
}
export const dateValue = (/** @type {string} */ day) => day.replace(/-/g, '');

/* ---------- VTODO ---------- */

/** @returns {{ text: string, done: boolean, due: string | null, starred: boolean, recurring: boolean, uid: string, updatedAt: number } | null} */
export function parseVtodo(/** @type {string} */ text) {
  const c = component(text, 'VTODO');
  if (!c.found) return null;
  const status = (get(c.props, 'STATUS')?.value || '').toUpperCase(), prio = Number(get(c.props, 'PRIORITY')?.value || 0);
  const due = localTime(get(c.props, 'DUE')), mod = get(c.props, 'LAST-MODIFIED') || get(c.props, 'DTSTAMP');
  const modT = mod ? /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(mod.value) : null;
  return {
    text: unescapeText(get(c.props, 'SUMMARY')?.value || '').trim(), uid: get(c.props, 'UID')?.value || '',
    done: status === 'COMPLETED' || !!get(c.props, 'COMPLETED'), due: due ? due.day : null, starred: prio >= 1 && prio <= 4,
    recurring: !!get(c.props, 'RRULE'), updatedAt: modT ? Date.UTC(Number(modT[1]), Number(modT[2]) - 1, Number(modT[3]), Number(modT[4]), Number(modT[5]), Number(modT[6])) : 0,
  };
}

/** A new to-do. */
export function buildVtodo(/** @type {{ uid: string, text: string, done: boolean, due: string | null, starred: boolean }} */ it, /** @type {number} */ now) {
  const stamp = utcStampMs(now);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EyeTime//CalDAV sync//EN', 'BEGIN:VTODO', 'UID:' + it.uid, 'DTSTAMP:' + stamp, 'CREATED:' + stamp, 'LAST-MODIFIED:' + stamp, 'SUMMARY:' + escapeText(it.text),
    'STATUS:' + (it.done ? 'COMPLETED' : 'NEEDS-ACTION')];
  if (it.done) lines.push('COMPLETED:' + stamp, 'PERCENT-COMPLETE:100');
  if (it.due) lines.push('DUE;VALUE=DATE:' + dateValue(it.due));
  if (it.starred) lines.push('PRIORITY:1');
  lines.push('END:VTODO', 'END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
export const utcStampMs = (/** @type {number} */ ms) => { const t = new Date(ms); return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}${pad(t.getUTCSeconds())}Z`; };

/** The same to-do with the changed fields rewritten and every other line kept. */
export function patchVtodo(/** @type {string} */ raw, /** @type {Record<string, any>} */ patch, /** @type {number} */ now) {
  const c = component(raw, 'VTODO');
  if (!c.found) throw new Error('no VTODO to change');
  const lines = [...c.lines], drop = new Set(), add = /** @type {string[]} */ ([]);
  const set = (/** @type {string} */ name, /** @type {string | null} */ line) => { for (const p of c.props) if (p.name === name) drop.add(p.i); if (line) add.push(line); };
  if ('text' in patch) set('SUMMARY', 'SUMMARY:' + escapeText(patch.text));
  if ('due' in patch) set('DUE', patch.due ? 'DUE;VALUE=DATE:' + dateValue(patch.due) : null);
  if ('starred' in patch) set('PRIORITY', patch.starred ? 'PRIORITY:1' : null);
  if ('done' in patch) {
    set('STATUS', 'STATUS:' + (patch.done ? 'COMPLETED' : 'NEEDS-ACTION'));
    set('COMPLETED', patch.done ? 'COMPLETED:' + utcStampMs(now) : null);
    set('PERCENT-COMPLETE', patch.done ? 'PERCENT-COMPLETE:100' : null);
  }
  set('LAST-MODIFIED', 'LAST-MODIFIED:' + utcStampMs(now));
  set('SEQUENCE', 'SEQUENCE:' + (Number(get(c.props, 'SEQUENCE')?.value || 0) + 1));
  const out = lines.filter((_l, i) => !drop.has(i));
  const endAt = out.findIndex((l, i) => i > c.start && l.toUpperCase() === 'END:VTODO');
  out.splice(endAt, 0, ...add);
  return out.map(fold).join('\r\n') + (raw.endsWith('\n') ? '\r\n' : '');
}

/* ---------- VEVENT (the blocks EyeTime makes, and nothing else) ---------- */

export const UID_PREFIX = 'eyetime-';

export function buildVevent(/** @type {{ uid: string, taskId: string, title: string, day: string, start: number, end: number }} */ b, /** @type {number} */ now, /** @type {number} */ seq = 0) {
  const stamp = utcStampMs(now);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EyeTime//CalDAV sync//EN', 'BEGIN:VEVENT', 'UID:' + b.uid, 'DTSTAMP:' + stamp, 'LAST-MODIFIED:' + stamp, 'SEQUENCE:' + seq,
    'SUMMARY:' + escapeText(b.title), 'DTSTART:' + utcStamp(b.day, b.start), 'DTEND:' + utcStamp(b.day, b.end), 'X-EYETIME-TASK:' + b.taskId,
    'DESCRIPTION:' + escapeText('Planned in EyeTime'), 'TRANSP:OPAQUE', 'END:VEVENT', 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
}

/** One of our events as { taskId, title, day, start, end, updatedAt, uid, seq }, or null when it is not ours or not a timed event. */
export function parseOurEvent(/** @type {string} */ text) {
  const c = component(text, 'VEVENT');
  if (!c.found) return null;
  const uid = get(c.props, 'UID')?.value || '';
  if (!uid.startsWith(UID_PREFIX)) return null;
  const s = localTime(get(c.props, 'DTSTART')), e = localTime(get(c.props, 'DTEND'));
  if (!s || !e || s.min === null || e.min === null || s.day !== e.day) return null; // moved to another day at both ends is handled as a move; an all-day or multi-day event is no longer a block
  const mod = get(c.props, 'LAST-MODIFIED')?.value || '', t = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(mod);
  return { uid, taskId: get(c.props, 'X-EYETIME-TASK')?.value || '', title: unescapeText(get(c.props, 'SUMMARY')?.value || '').trim(), day: s.day, start: s.min, end: e.min,
    updatedAt: t ? Date.UTC(Number(t[1]), Number(t[2]) - 1, Number(t[3]), Number(t[4]), Number(t[5]), Number(t[6])) : 0, seq: Number(get(c.props, 'SEQUENCE')?.value || 0) };
}
