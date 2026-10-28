// What the page needs to know about the photo background: which text colour reads on it, its size, and a soft (blurred) copy for the glass clock.

import { relLuminance, pickTextTone } from '../shared/phototone.js';

/** @type {{ key: string, info: { tone: 'light' | 'dark', w: number, h: number, soft: string } | null }} */
let cache = { key: '', info: null };

/** The photo as measured now (null until a photo has been looked at). */
export const currentPhotoInfo = () => cache.info;
/** Forget the photo (the background is no longer one). */
export const clearPhotoInfo = () => { cache = { key: '', info: null }; };

/** A short name for a photo (enough to tell one from another), so what was made from it can be matched with it. */
export const photoKey = (src) => src.length + ':' + src.slice(-48);

/** Look at the photo once (a small copy of it) and keep what was learned. */
export async function getPhotoInfo(src) {
  const key = photoKey(src);
  if (cache.key === key && cache.info) return cache.info;
  let info = { tone: /** @type {'light' | 'dark'} */ ('light'), w: 0, h: 0, soft: '' };
  try {
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
    const W = 48, H = 27, c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, W, H);
    const px = ctx.getImageData(0, 0, W, H).data, lums = [];
    for (let y = 2; y < H - 2; y++) for (let x = 3; x < W - 3; x++) { const o = (y * W + x) * 4; lums.push(relLuminance(px[o], px[o + 1], px[o + 2])); } // the middle of the picture, where the clock and cards sit
    const sw = 160, sh = Math.max(1, Math.round(sw * img.naturalHeight / img.naturalWidth)), sc = document.createElement('canvas'); sc.width = sw; sc.height = sh;
    const sx = sc.getContext('2d'); sx.filter = 'blur(2.5px)'; sx.drawImage(img, -6, -6, sw + 12, sh + 12);
    info = { tone: pickTextTone(lums), w: img.naturalWidth, h: img.naturalHeight, soft: sc.toDataURL('image/jpeg', 0.82) };
  } catch { /* an unreadable photo: white text, no glass copy */ }
  cache = { key, info };
  return info;
}
