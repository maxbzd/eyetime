// Cuts the subject out of the background photo, on this device: picture -> 320 px model input -> saliency map -> a clean alpha mask (PNG).
// The mask is stored next to the photo (newtabFg); the page shows the photo again, masked, in front of the clock (see depth.js / newtab.css).

import { toTensor, normalizeMask, smoothstep, maskCoverage, maskSize, MODEL_SIZE } from '../shared/cutout.js';

const loadImage = (src) => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('image')); img.src = src; });
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function infer(data) {
  return new Promise((resolve, reject) => {
    const worker = new window.Worker(chrome.runtime.getURL('src/newtab/ml/segment-worker.js'), { type: 'module' });
    const done = (fn, v) => { clearTimeout(timer); worker.terminate(); fn(v); }; // the model is released as soon as it has answered
    const timer = setTimeout(() => done(reject, new Error('timeout')), 90_000);
    worker.onmessage = (e) => (e.data.error ? done(reject, new Error(e.data.error)) : done(resolve, e.data.mask));
    worker.onerror = (e) => done(reject, new Error(e.message || 'worker'));
    worker.postMessage({ id: 1, data, size: MODEL_SIZE }, [data.buffer]);
  });
}

/**
 * @param {string} src the photo (a data URL)
 * @param {(stage: 'prepare' | 'model' | 'finish') => void} [onStage]
 * @returns {Promise<{ dataUrl: string, share: number, usable: boolean }>} an alpha mask the size of the photo (capped at 960 px wide)
 */
export async function cutOut(src, onStage = () => {}) {
  onStage('prepare');
  const img = await loadImage(src);
  const small = canvas(MODEL_SIZE, MODEL_SIZE).getContext('2d', { willReadFrequently: true });
  small.drawImage(img, 0, 0, MODEL_SIZE, MODEL_SIZE);
  const input = toTensor(small.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE).data);
  onStage('model');
  const mask = normalizeMask(await infer(input));
  onStage('finish');
  // the map becomes the alpha of a small black picture, which is scaled up smoothly and then sharpened into a clean edge
  const low = canvas(MODEL_SIZE, MODEL_SIZE), lctx = low.getContext('2d');
  const px = lctx.createImageData(MODEL_SIZE, MODEL_SIZE);
  for (let i = 0; i < mask.length; i++) px.data[i * 4 + 3] = Math.round(mask[i] * 255);
  lctx.putImageData(px, 0, 0);
  const { w, h } = maskSize(img.naturalWidth || img.width, img.naturalHeight || img.height);
  const big = canvas(w, h), bctx = big.getContext('2d', { willReadFrequently: true });
  bctx.imageSmoothingEnabled = true; bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(low, 0, 0, w, h);
  const out = bctx.getImageData(0, 0, w, h), alpha = new Uint8ClampedArray(w * h);
  for (let i = 0; i < alpha.length; i++) { const a = Math.round(smoothstep(out.data[i * 4 + 3] / 255, 0.35, 0.65) * 255); out.data[i * 4 + 3] = a; alpha[i] = a; }
  bctx.putImageData(out, 0, 0);
  const { share, usable } = maskCoverage(alpha);
  return { dataUrl: big.toDataURL('image/png'), share, usable };
}
