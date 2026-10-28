// Date helpers. All keys are *local* calendar days ("YYYY-MM-DD") so "today" matches the user's wall clock in any time zone.

const pad = (n) => String(n).padStart(2, '0');

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, n) {
  const x = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

/** Keys for the `n` days ending at `end` (inclusive), oldest first. */
export function rangeKeys(n, end = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(addDays(end, -i)));
  return out;
}

/** Monday (or `startsOn`, 0 = Sunday) of the week containing `d`. */
export function weekStart(d = new Date(), startsOn = 1) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() - startsOn + 7) % 7));
  return x;
}

/** "HH:MM" -> minutes after midnight. */
export function toMinutes(hhmm) {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export const MINUTE = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

/** Clamp a number into [lo, hi]. */
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** The span [from, to] (ms) cut at local midnight: one piece, or two when it crosses a day boundary — each piece belongs to its own day. */
export function splitAtMidnight(from, to) {
  if (!(to > from)) return [];
  const end = new Date(to); end.setHours(0, 0, 0, 0);
  const mid = end.getTime();
  if (mid > from && mid < to && dayKey(new Date(from)) !== dayKey(new Date(to))) return [{ from, to: mid }, { from: mid, to }];
  return [{ from, to }];
}
