// Applies the user's type design to the clock and the greeting: inline declarations, only for what was changed, removed again when reset.

import { $ } from '../ui/dom.js';
import { normalizeType, clockDecls, textDecls } from '../shared/typeface.js';

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
}

export const clockSeconds = (settings) => normalizeType(settings.newtab.type).clock.seconds;
