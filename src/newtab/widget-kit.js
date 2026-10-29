// Small helpers shared by the widget files: element shortcuts, a "keeps itself up to date" wrapper, number formatting.

import { h, clear } from '../ui/dom.js';
import { onChange } from '../shared/storage.js';
import { fmtNumber } from '../shared/i18n.js';

export const el = (tag, cls, ...kids) => h(tag, { class: cls }, ...kids);
export { h, clear, fmtNumber };
export const SVG_NS = 'http://www.w3.org/2000/svg';
export const deg = (n) => fmtNumber(n) + '°';

/**
 * Run `draw(isAlive)` now and again whenever one of the storage `watch` keys changes or every `every` ms; returns the { update, destroy } a widget build returns.
 * @param {(alive: () => boolean) => any} draw @param {{ watch?: string[], every?: number, align?: number }} [o] `align`: wait for the next multiple of this many ms first (minute-aligned clocks)
 */
export function live(draw, { watch = [], every = 0, align = 0 } = {}) {
  let alive = true, timer = 0, aligned = 0;
  const run = () => { try { const r = draw(() => alive); if (r && r.catch) r.catch(() => {}); } catch { /* a widget must never break the page */ } };
  run();
  const off = watch.length ? onChange(watch, run) : null;
  if (every) {
    if (align) { aligned = window.setTimeout(() => { run(); timer = window.setInterval(run, every); }, align - (Date.now() % align) + 20); } else timer = window.setInterval(run, every);
  }
  return { update: run, destroy: () => { alive = false; off?.(); clearInterval(timer); clearTimeout(aligned); } };
}

/** A segmented-looking row of small round dots, `on` of `total` filled. */
export const motionOk = () => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && document.documentElement.dataset.motion !== 'reduced';
