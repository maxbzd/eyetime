// Small helpers for the generative sound: pitch, a seedable random generator and weighted picks. Pure.

/** MIDI note number -> Hz (A4 = 69 = 440 Hz). */
export const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

/** A small seedable generator (mulberry32). Tests use it to replay a run; the app seeds it from Math.random() so every start is new. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const between = (rng, a, b) => a + (b - a) * rng();
export const pick = (rng, list) => list[Math.floor(rng() * list.length)];

/** items: [[value, weight], ...] -> one value. */
export function weighted(rng, items) {
  let sum = 0; for (const [, w] of items) sum += w;
  let r = rng() * sum;
  for (const [v, w] of items) { r -= w; if (r < 0) return v; }
  return items[items.length - 1][0];
}

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
/** Smooth 0..1 -> 0..1 (no corners at either end). */
export const smooth = (k) => { const x = clamp(k, 0, 1); return x * x * (3 - 2 * x); };
