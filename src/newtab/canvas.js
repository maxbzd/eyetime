// Applies the user's free-form arrangement to the Home page (the editor itself is in canvas-edit.js and loads only when it is used).
// Each movable block gets its position and size as CSS variables; newtab.css / canvas.css do the rest.

import { $ } from '../ui/dom.js';
import { normalizeCanvas, clampCenter, blockMeta, CANVAS_IDS, CANVAS_MIN_WIDTH, canvasScale } from '../shared/canvas.js';
import { WIDGET_ID_RE } from '../shared/widgets.js';
import { alignClockFill } from './type-apply.js';

/** The element of a movable block (null if it is not on the page, e.g. a card switched off in settings). */
export function blockEl(id) {
  if (WIDGET_ID_RE.test(id) && id !== 'clock') return document.getElementById('wgt-' + id);
  if (id === 'clock') return $('#clock');
  if (id === 'greeting') return $('#greetBlock');
  if (id === 'quote') { const q = $('#quote'); return q && !q.hidden ? q : null; } // only while quotes are on for Home
  if (id === 'focus') return $('#focus');
  return document.getElementById('mod-' + id);
}
export const presentBlocks = () => [...CANVAS_IDS.filter((id) => blockEl(id)), ...[...document.querySelectorAll('.wgt:not(.wgt-preview)')].map((e) => e.id.slice(4))];

/** Is the free-form arrangement showing? (Off on narrow windows, where the stacked layout is used.) */
export function canvasActive(settings) {
  return normalizeCanvas(settings.newtab.canvas).on && window.innerWidth >= CANVAS_MIN_WIDTH;
}

const watched = new WeakSet();
let ro = null;

/** Place one block from its saved item and keep it on screen. */
export function placeBlock(id, item, k = canvasScale(window.innerWidth)) {
  const el = blockEl(id);
  if (!el) return;
  const b = blockMeta(id);
  el.classList.add('cv-item', b.kind === 'text' ? 'cv-text' : 'cv-card');
  el.classList.remove('cv-hidden');
  el.style.setProperty('--cx', String(item.x)); el.style.setProperty('--cy', String(item.y));
  if (b.kind === 'text') { el.style.setProperty('--cs', String(item.s ?? b.def)); el.style.setProperty('--csx', String(item.sx ?? item.s ?? b.def)); } else el.style.setProperty('--cw', String(item.w ?? b.def));
  if (item.z === undefined) el.style.removeProperty('--cz'); else el.style.setProperty('--cz', String(item.z));
  document.body.style.setProperty('--k', String(k));
  if (id === 'clock') alignClockFill(); // the glass / photo clock follows the clock when it is moved or scaled
  if (!watched.has(el) && window.ResizeObserver) { ro = ro || new window.ResizeObserver((es) => es.forEach((e) => keepOnScreen(/** @type {HTMLElement} */ (e.target)))); ro.observe(el); watched.add(el); }
}

/** A block whose content grew (a long task list) or a window that shrank must not leave the screen. */
function keepOnScreen(el) {
  if (!el.classList.contains('cv-item')) return;
  const view = { w: window.innerWidth, h: window.innerHeight };
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const cx = Number(el.style.getPropertyValue('--cx')), cy = Number(el.style.getPropertyValue('--cy'));
  const c = clampCenter({ x: cx, y: cy }, { w: r.width, h: r.height }, view);
  if (Math.abs(c.x - cx) > 0.05) el.style.setProperty('--cx', String(c.x));
  if (Math.abs(c.y - cy) > 0.05) el.style.setProperty('--cy', String(c.y));
}

export function applyCanvas(settings) {
  const active = canvasActive(settings), c = normalizeCanvas(settings.newtab.canvas);
  document.body.classList.toggle('cv-on', active);
  for (const id of presentBlocks()) {
    const el = blockEl(id);
    if (!el) continue;
    if (!active) { el.classList.remove('cv-item', 'cv-text', 'cv-card', 'cv-hidden'); for (const v of ['--cx', '--cy', '--cs', '--csx', '--cw', '--cz']) el.style.removeProperty(v); continue; }
    if (c.items[id]) placeBlock(id, c.items[id]);
    else el.classList.add('cv-hidden', 'cv-item');
  }
  if (active) window.requestAnimationFrame(() => presentBlocks().forEach((id) => { const el = blockEl(id); if (el && c.items[id]) keepOnScreen(el); }));
}

export { CANVAS_MIN_WIDTH };
