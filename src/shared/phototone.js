// Which text colour reads on a photo: light or dark (pure; the picture is sampled in the page).
// The clock is big text, but the greeting and buttons are small, so the stricter 4.5:1 is the bar: a sample cell "carries" white text when its
// luminance is at most ~0.18 and black text when it is at least ~0.18 (the two thresholds meet, so every cell favours one of them).

export const PHOTO_TEXT = ['auto', 'light', 'dark'];
const CONTRAST_AA = 4.5;

/** Relative luminance 0..1 of an sRGB colour (0..255 channels). */
export function relLuminance(r, g, b) {
  const lin = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export const contrastWith = (lum, textLum) => (Math.max(lum, textLum) + 0.05) / (Math.min(lum, textLum) + 0.05);

/**
 * The text tone for a picture whose sampled cells have the luminances `lums`: 'light' text (for a dark picture) or 'dark' text (for a light one).
 * White is the default; black wins only when clearly more cells (or the picture as a whole) call for it.
 * @param {number[]} lums
 * @returns {'light' | 'dark'}
 */
export function pickTextTone(lums) {
  if (!Array.isArray(lums) || !lums.length) return 'light';
  const n = lums.length;
  const white = lums.filter((l) => contrastWith(l, 1) >= CONTRAST_AA).length / n;
  const black = lums.filter((l) => contrastWith(l, 0) >= CONTRAST_AA).length / n;
  const mean = lums.reduce((a, b) => a + b, 0) / n;
  if (black > white + 0.1) return 'dark';
  if (white > black + 0.1) return 'light';
  return mean > 0.3 ? 'dark' : 'light'; // too close to call by cells: the brightness of the whole picture decides
}

/** The tone to draw: the person's choice, or the picture's own (`autoTone`, 'light' | 'dark'). Returns the text tone. */
export function resolveTextTone(mode, autoTone) {
  if (mode === 'light' || mode === 'dark') return mode;
  return autoTone === 'dark' ? 'dark' : 'light';
}
