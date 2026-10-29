// Small helpers shared by the widget files: element shortcuts, a "keeps itself up to date" wrapper, number formatting.

import { h, clear } from '../ui/dom.js';
import { onChange } from '../shared/storage.js';
import { fmtNumber } from '../shared/i18n.js';

/** An element with a class and children; a plain object among the children is taken as more attributes (style, title …). */
export function el(tag, cls, ...kids) {
  const props = { class: cls }, rest = [];
  for (const k of kids) { if (k && typeof k === 'object' && !k.nodeType && !Array.isArray(k)) Object.assign(props, k); else rest.push(k); }
  return h(tag, props, ...rest);
}
export { h, clear, fmtNumber };
/** `clear(root, …kids)` that gives the keyboard focus back to the same control (matched by tag and label) when the widget redraws itself under it. */
export function clearKeep(root, ...kids) {
  const a = document.activeElement, key = a && root.contains(a) && a !== root ? [a.tagName, a.getAttribute('aria-label') || a.className] : null;
  clear(root, ...kids);
  if (!key) return;
  for (const c of root.querySelectorAll(key[0])) if ((c.getAttribute('aria-label') || c.className) === key[1]) { c.focus({ preventScroll: true }); break; }
}
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
