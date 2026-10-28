// Makes the depth map of the background photo, on this device: picture -> model input -> depth -> an 8-bit picture (bright = near, a PNG).
// It is stored next to the photo (newtabDepth, with the photo's key so a map never outlives its photo); the page then draws the photo in 3D (gl3d.js).

import { depthInputSize, toDepthTensor, depthToGray, depthUsable } from '../shared/depthmap.js';

const loadImage = (src) => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('image')); img.src = src; });

function infer(data, w, h) {
  return new Promise((resolve, reject) => {
    const worker = new window.Worker(chrome.runtime.getURL('src/newtab/ml/depth-worker.js'), { type: 'module' });
    const done = (fn, v) => { clearTimeout(timer); worker.terminate(); fn(v); }; // the model is released as soon as it has answered
    const timer = setTimeout(() => done(reject, new Error('timeout')), 180_000);
    worker.onmessage = (e) => (e.data.error ? done(reject, new Error(e.data.error)) : done(resolve, e.data.depth));
    worker.onerror = (e) => done(reject, new Error(e.message || 'worker'));
    worker.postMessage({ id: 1, data, w, h }, [data.buffer]);
  });
}

/**
 * @param {string} src the photo (a data URL)
 * @param {(stage: 'prepare' | 'model' | 'finish') => void} [onStage]
 * @returns {Promise<{ dataUrl: string, w: number, h: number, usable: boolean }>}
 */
export async function makeDepth(src, onStage = () => {}) {
  onStage('prepare');
  const img = await loadImage(src);
  const { w, h } = depthInputSize(img.naturalWidth || img.width, img.naturalHeight || img.height);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);
  const input = toDepthTensor(g.getImageData(0, 0, w, h).data, w, h);
  onStage('model');
  const gray = depthToGray(await infer(input, w, h));
  onStage('finish');
  const usable = depthUsable(gray);
  const out = g.createImageData(w, h);
  for (let i = 0; i < gray.length; i++) { out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = gray[i]; out.data[i * 4 + 3] = 255; }
  g.putImageData(out, 0, 0);
  return { dataUrl: c.toDataURL('image/png'), w, h, usable };
}
