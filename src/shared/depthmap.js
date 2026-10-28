// A depth map from one photo, the parts that need no browser (pure, so they can be tested): the size the model wants, the pixels it eats,
// what its answer is turned into (an 8-bit picture, bright = near) and whether that answer is believable.
// The model is Depth Anything V2 (Small, Apache-2.0), run locally: input 1×3×H×W (ImageNet-normalised, H and W multiples of 14), output 1×H×W of relative inverse depth (bigger = nearer).

export const DEPTH_MODEL_SIDE = 518;
const MEAN = [0.485, 0.456, 0.406], STD = [0.229, 0.224, 0.225];

/** The model input for a w×h picture: the long side 518, both sides multiples of 14 (a size the model accepts), the shape of the picture kept. */
export function depthInputSize(w, h) {
  if (!(w > 0 && h > 0)) return { w: DEPTH_MODEL_SIDE, h: DEPTH_MODEL_SIDE };
  const k = DEPTH_MODEL_SIDE / Math.max(1, w, h), snap = (v) => Math.max(14, Math.round(v * k / 14) * 14);
  return { w: snap(w), h: snap(h) };
}

/** RGBA bytes of a w×h picture → the Float32 tensor data (NCHW, ImageNet normalisation). */
export function toDepthTensor(rgba, w, h) {
  const n = w * h, out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) out[c * n + i] = (rgba[i * 4 + c] / 255 - MEAN[c]) / STD[c];
  return out;
}

/** The value at a fraction `q` (0..1) of the sorted values, taken from a histogram so no big array is sorted. */
function quantile(values, lo, hi, q) {
  const bins = new Uint32Array(1024), span = hi - lo || 1;
  for (let i = 0; i < values.length; i++) bins[Math.min(1023, Math.floor((values[i] - lo) / span * 1024))]++;
  let acc = 0; const goal = q * values.length;
  for (let b = 0; b < 1024; b++) { acc += bins[b]; if (acc >= goal) return lo + (b + 0.5) / 1024 * span; }
  return hi;
}

/**
 * The model's output → an 8-bit picture, bright = near. The extremes are cut (2 % and 98 %), so one stray pixel does not flatten the rest.
 * @param {Float32Array | number[]} raw
 */
export function depthToGray(raw) {
  const out = new Uint8ClampedArray(raw.length);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < raw.length; i++) { const v = raw[i]; if (!Number.isFinite(v)) return out; if (v < lo) lo = v; if (v > hi) hi = v; }
  if (!(hi - lo > 1e-6)) return out;
  const a = quantile(raw, lo, hi, 0.02), b = quantile(raw, lo, hi, 0.98), span = b - a;
  if (!(span > 1e-6)) return out;
  for (let i = 0; i < raw.length; i++) out[i] = Math.round(Math.min(1, Math.max(0, (raw[i] - a) / span)) * 255);
  return out;
}

/** Is it a believable depth map: some range between near and far, and not one flat grey. */
export function depthUsable(gray) {
  if (!gray.length) return false;
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const at = (q) => { let acc = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= q * gray.length) return v; } return 255; };
  return at(0.95) - at(0.05) >= 40;
}
