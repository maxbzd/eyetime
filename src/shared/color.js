// Small colour toolkit (pure): hex <-> RGB/HSL, mixing and WCAG contrast. Used by the theme engine so that
// *any* look or user-picked accent ends up with readable text — contrast is computed, not hoped for.

const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

/** '#abc' | 'abc' | '#aabbcc' -> '#aabbcc' (lower-case) or null. */
export function normalizeHex(input) {
  let s = String(input || '').trim().toLowerCase().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/.test(s)) s = s.split('').map((c) => c + c).join('');
  return /^[0-9a-f]{6}$/.test(s) ? '#' + s : null;
}

export const hexToRgb = (hex) => { const n = parseInt((normalizeHex(hex) || '#000000').slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const rgbToHex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
export const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r}, ${g}, ${b}, ${a})`; };

export function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
export function hslToRgb([h, s, l]) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return 255 * (t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p); };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}

/** Linear blend of two hex colours: t=0 -> a, t=1 -> b. */
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t));
}

export function luminance(hex) {
  return hexToRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
}
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
const minContrast = (fg, bgs) => Math.min(...bgs.map((b) => contrast(fg, b)));

/**
 * Nudge `fg` (keeping its hue) until it has at least `min` contrast against every colour in `bgs`.
 * `dir` 'dark' | 'light' | 'auto' (auto: away from the average background).
 */
export function ensureContrast(fg, bgs, min = 4.5, dir = 'auto') {
  if (minContrast(fg, bgs) >= min) return fg;
  const avg = bgs.reduce((a, b) => a + luminance(b), 0) / bgs.length;
  const goDark = dir === 'dark' || (dir === 'auto' && avg > 0.4);
  const [h, s, l] = rgbToHsl(hexToRgb(fg));
  for (let i = 1; i <= 100; i++) {
    const nl = clamp(l + (goDark ? -i : i) / 100);
    const c = rgbToHex(hslToRgb([h, s, nl]));
    if (minContrast(c, bgs) >= min) return c;
  }
  return goDark ? '#000000' : '#ffffff';
}

const INK = '#14100d';
/**
 * Fill colour + the foreground to put on it (white or near-black), with ≥ `min` contrast.
 * Keeps the user's colour when possible; only lightens/darkens when neither white nor ink is readable.
 */
export function readableFill(fill, min = 4.5) {
  const wc = contrast(fill, '#ffffff'), ic = contrast(fill, INK);
  if (wc >= min || ic >= min) return { fill, fg: wc >= ic ? '#ffffff' : INK };
  // mid-tone: pick the side that needs the smaller nudge
  const luma = luminance(fill);
  if (luma < 0.2) return { fill: ensureContrast(fill, ['#ffffff'], min, 'dark'), fg: '#ffffff' };
  return { fill: ensureContrast(fill, [INK], min, 'light'), fg: INK };
}
