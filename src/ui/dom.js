// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Tiny DOM toolkit. No innerHTML with user data anywhere — build nodes with h() / textContent.

import { ICONS } from './icons.js';
import { faviconUrl } from '../shared/domains.js';
import { t } from '../shared/i18n.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const SVG_NS = 'http://www.w3.org/2000/svg';

/** <svg class="ico"> for a Lucide icon (static markup from icons.js). */
export function icon(name, cls = '') {
  const el = document.createElementNS(SVG_NS, 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('class', ('ico ' + cls).trim());
  el.setAttribute('aria-hidden', 'true');
  const nodes = ICONS[name];
  if (nodes) for (const [tag, attrs] of nodes) el.append(svg(tag, attrs));
  else console.error('[eyetime] icon missing from icons.js:', name, '— add icon(\'' + name + '\') / icon: \'' + name + '\' where it is used and run npm run icons');
  return el;
}

/** Replace <i data-icon="name"></i> placeholders under root with real icons. */
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    const glyph = icon(/** @type {HTMLElement} */ (el).dataset.icon, el.className);
    el.replaceWith(glyph);
  });
}

/**
 * h('div', { class: 'x', onclick: fn, dataset: { id: 1 }, aria: { label: 'a' } }, 'text', childNode, [more])
 * Props: class, text, html (avoid), dataset, aria, style (object), on* handlers, anything else is set as an attribute.
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'innerHTML' || k === 'outerHTML' || k === 'srcdoc') continue; // text goes in as text; there is no way to hand h() markup
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'aria') for (const [a, av] of Object.entries(v)) el.setAttribute('aria-' + a, av);
      else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k in el && k !== 'list' && k !== 'form') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

/**
 * Is this keydown an Enter that means "do it"? An Enter that confirms a character in an input method (Japanese, Chinese, Korean) arrives as a keydown with `key: 'Enter'`
 * and `isComposing: true`; acting on it sends half-typed text. Safari reports the confirming Enter after the composition has ended, but with `keyCode` 229.
 * @param {KeyboardEvent} e
 */
export const isEnter = (e) => e.key === 'Enter' && !e.isComposing && e.keyCode !== 229;

/** Create an SVG element (the HTML h() helper can't: wrong namespace). */
export function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
}

export function clear(el, ...children) { el.replaceChildren(); append(el, children); return el; }

/** Favicon with a letter fallback. */
export function favicon(host, cls = '') {
  const wrap = h('span', { class: ('fav ' + cls).trim(), text: (host || '?')[0].toUpperCase() });
  const src = faviconUrl(host);
  if (src) {
    const img = new Image();
    img.alt = ''; img.className = 'fav ' + cls;
    img.onload = () => wrap.replaceWith(img);
    img.src = src;
  }
  return wrap;
}

/* ---------- toast ---------- */
let toastHost;
/** A toast with an action (Undo) stays longer and does not close while the pointer or the keyboard is on it: a person needs time to reach the button. @param {string} message @param {{ action?: string, onAction?: () => void, ms?: number }} [o] */
export function toast(message, { action, onAction, ms = action ? 7000 : 3200 } = {}) {
  if (!toastHost) { toastHost = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); if ('showPopover' in toastHost) toastHost.setAttribute('popover', 'manual'); }
  const el = h('div', { class: 'toast' }, h('span', { text: message }), action ? h('button', { type: 'button', text: action, onclick: () => { onAction?.(); close(); } }) : null);
  let timer = 0, held = false;
  const close = () => { clearTimeout(timer); el.classList.add('out'); setTimeout(() => { el.remove(); if (toastHost && !toastHost.children.length && toastHost.hasAttribute('popover') && toastHost.matches(':popover-open')) toastHost.hidePopover(); }, 220); };
  const arm = (/** @type {number} */ wait = ms) => { clearTimeout(timer); timer = setTimeout(() => { if (held) arm(); else close(); }, wait); };
  if (action) {
    el.addEventListener('pointerenter', () => { held = true; });
    el.addEventListener('pointerleave', () => { held = false; arm(2500); }); // after the pointer goes, a few more seconds, not the whole time again
    el.addEventListener('focusin', () => { held = true; });
    el.addEventListener('focusout', () => { held = false; arm(2500); });
  }
  toastHost.append(el);
  placeToasts();
  arm();
}

/** The toasts live in the top layer (a `popover="manual"`), so a modal dialog does not cover them. A modal makes everything outside itself inert, so while one is open the toasts sit inside it,
 *  where an Undo can still be pressed. Called with every new toast (it also brings the stack back to the front) and when the last one goes. */
function placeToasts() {
  const host = toastHost; if (!host) return;
  const modal = document.querySelector('dialog:modal'), home = modal || document.body;
  const popover = host.hasAttribute('popover');
  if (popover && host.matches(':popover-open')) host.hidePopover();
  if (host.parentElement !== home) home.append(host);
  if (popover) host.showPopover();
}

/**
 * Open a <dialog> as a modal and let the platform do the rest: Esc and the back gesture close it, focus is kept inside and handed back, the page behind is inert.
 * `light`: a click on the backdrop closes it too (`closedby="any"`; where the browser does not know the attribute, the same click is told apart by position). Leave it off for a dialog
 * with something typed in: an accidental click outside must not throw that away.
 * @param {HTMLDialogElement} dlg @param {{ light?: boolean }} [o]
 */
export function openModal(dlg, { light = false } = {}) {
  if (light) {
    if ('closedBy' in /** @type {any} */ (dlg)) dlg.setAttribute('closedby', 'any');
    else dlg.addEventListener('click', (e) => {
      if (e.target !== dlg) return; // a click inside the dialog lands on a child; on the backdrop it lands on the dialog itself
      const r = dlg.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
    });
  }
  dlg.showModal();
}

/** Take a closed <dialog> out of the page once its closing transition is over (removed at once, the transition would have nothing to run on). */
export function retire(/** @type {HTMLElement} */ el) {
  const gone = () => el.remove();
  try { Promise.allSettled(el.getAnimations({ subtree: true }).map((a) => a.finished)).then(gone, gone); } catch { gone(); }
  setTimeout(gone, 600); // never later than this, whatever the browser says
}

/**
 * Promise-based confirm dialog using <dialog>. Resolves true / false.
 * @param {{ title: string, body?: string, extra?: Node | null, confirm?: string, cancel?: string, danger?: boolean }} o
 * @returns {Promise<boolean>}
 */
export function confirmDialog({ title, body, extra = null, confirm = t('common.confirm'), cancel = t('common.cancel'), danger = false }) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'dialog' },
      h('form', { method: 'dialog' },
        h('div', { class: 'dialog-body stack gap-3' }, h('h3', { text: title }), body ? h('p', { class: 'muted-2', text: body }) : null, extra),
        h('div', { class: 'dialog-actions' },
          h('button', { class: 'btn btn-ghost', value: 'no', text: cancel, autofocus: true }),
          h('button', { class: 'btn ' + (danger ? 'btn-danger-solid' : 'btn-primary'), value: 'yes', text: confirm }))));
    dlg.addEventListener('close', () => { resolve(dlg.returnValue === 'yes'); retire(dlg); });
    document.body.append(dlg);
    openModal(dlg, { light: true }); // a click outside is "no"
  });
}

/** Debounce helper. */
export function debounce(fn, ms = 250) { let id; return (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), ms); }; }
