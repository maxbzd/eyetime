// Small checks for what crosses a boundary (a message from a page to the worker): a number is brought into its range, a name is a plain name.
// The senders are EyeTime's own pages, so this is not about trust; it is that one bad value (a NaN, a year of minutes) must never become stored state.

/** A whole number inside [min, max]; `fallback` when `v` is not a number at all (NaN, undefined, an object). */
export function intIn(v, min, max, fallback) {
  const n = typeof v === 'string' && v.trim() === '' ? NaN : Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** A key of the temporary "continue" permissions: a domain, or the redirect window of one tab. A non-empty string with no spaces or control characters. */
export const isPassKey = (v) => typeof v === 'string' && v.length > 0 && v.length <= 253 && !/[\s\u0000-\u001f\u007f]/.test(v);

/** how long a "continue" may last, in minutes */
export const PASS_MINUTES = { min: 1, max: 8 * 60, fallback: 10 };
/** how long tracking may be paused at once, in minutes (0 ends a pause) */
export const TRACKING_PAUSE_MINUTES = { min: 1, max: 24 * 60 };
