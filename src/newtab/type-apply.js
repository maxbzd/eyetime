// Applies the user's type design to the clock and the greeting: inline declarations, only for what was changed, removed again when reset.

import { $ } from '../ui/dom.js';
import { normalizeType, clockDecls, textDecls } from '../shared/typeface.js';
import { currentPhotoInfo } from './photo-info.js';

const owned = new WeakMap();

function setDecls(el, decls) {
  if (!el) return;
  const prev = owned.get(el) || [];
  for (const p of prev) if (!(p in decls)) el.style.removeProperty(p);
  for (const [p, v] of Object.entries(decls)) el.style.setProperty(p, v, 'important');
  owned.set(el, Object.keys(decls));
}

/** @param {any} settings @param {ReturnType<typeof normalizeType>} [live] a style being edited, not saved yet */
export function applyType(settings, live) {
  const t = live || normalizeType(settings.newtab.type);
  setDecls($('#clock'), clockDecls(t.clock));
  setDecls($('#greeting'), textDecls(t.text));
  setDecls($('#date'), textDecls(t.text));
  usesPhoto = t.clock.fill === 'photo' || t.clock.fill === 'glass';
  alignClockFill();
}

let usesPhoto = false, scrollBound = false;
/**
 * The glass / photo clock shows the photo through its digits, so the picture must sit exactly where the page's own photo sits: the same size (cover) and place,
 * worked out in the clock's own coordinates (it may be scaled or stretched by the editor).
 */
export function alignClockFill() {
  const el = $('#clock'), info = currentPhotoInfo();
  if (!el) return;
  if (!usesPhoto || !info || !info.w) { el.style.removeProperty('--clk-bgs'); el.style.removeProperty('--clk-bgp'); return; }
  const r = el.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
  const sx = el.offsetWidth ? r.width / el.offsetWidth : 1, sy = el.offsetHeight ? r.height / el.offsetHeight : 1;
  if (!sx || !sy) return;
  const z = document.body.classList.contains('has-depth') ? 1.06 : 1; // the depth effect draws the photo a little larger
  const k = Math.max(vw / info.w, vh / info.h) * z, dw = info.w * k, dh = info.h * k, ox = (vw - dw) / 2, oy = (vh - dh) / 2;
  el.style.setProperty('--clk-bgs', `${(dw / sx).toFixed(1)}px ${(dh / sy).toFixed(1)}px`);
  el.style.setProperty('--clk-bgp', `${((ox - r.left) / sx).toFixed(1)}px ${((oy - r.top) / sy).toFixed(1)}px`);
  if (!scrollBound) { scrollBound = true; let raf = 0; const again = () => { if (!raf) raf = window.requestAnimationFrame(() => { raf = 0; if (usesPhoto) alignClockFill(); }); }; window.addEventListener('scroll', again, { passive: true }); window.addEventListener('resize', again); }
}

export const clockSeconds = (settings) => normalizeType(settings.newtab.type).clock.seconds;
