// The subject cut-out of a photo, the parts that need no browser (pure, so they can be tested): turning pixels into the model's input,
// turning its output into a clean mask, and judging whether a mask is usable.
// The model is U²-Net (small): input 1×3×320×320 (RGB, scaled to 0..1 by the brightest value, then normalised), output a saliency map of the same size.

export const MODEL_SIZE = 320;
const MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225];

/** RGBA bytes of a MODEL_SIZE × MODEL_SIZE picture → the Float32 tensor data (NCHW). */
export function toTensor(rgba, size = MODEL_SIZE) {
  const n = size * size, out = new Float32Array(3 * n);
  let max = 1;
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) if (rgba[i * 4 + c] > max) max = rgba[i * 4 + c];
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) out[c * n + i] = (rgba[i * 4 + c] / max - MEAN[c]) / STD[c];
  return out;
}

/** The model's output → values in 0..1 stretched over their own range (min-max). A flat output gives all zeros. */
export function normalizeMask(raw) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < raw.length; i++) { const v = raw[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
  const out = new Float32Array(raw.length), span = hi - lo;
  if (!(span > 1e-6)) return out;
  for (let i = 0; i < raw.length; i++) out[i] = (raw[i] - lo) / span;
  return out;
}

/** Smooth threshold: 0 below `lo`, 1 above `hi`, an S-curve between. Cleans up the soft edge of an upscaled mask. */
export function smoothstep(v, lo = 0.3, hi = 0.7) {
  const x = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
  return x * x * (3 - 2 * x);
}

/** How much of the picture is subject (0..1) and whether that is a believable cut-out: not (almost) nothing, not (almost) everything. */
export function maskCoverage(alpha) {
  let on = 0;
  for (let i = 0; i < alpha.length; i++) if (alpha[i] > 127) on++;
  const share = alpha.length ? on / alpha.length : 0;
  return { share, usable: share >= 0.02 && share <= 0.85 };
}

/** Size of the stored mask: the photo's width capped, the height following its aspect. */
export function maskSize(w, h, maxW = 960) {
  const k = Math.min(1, maxW / w);
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}
