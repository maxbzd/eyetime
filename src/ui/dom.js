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
    const svg = icon(el.dataset.icon, el.className);
    el.replaceWith(svg);
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
export function toast(message, { action, onAction, ms = 3200 } = {}) {
  if (!toastHost) { toastHost = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(toastHost); }
  const el = h('div', { class: 'toast' }, h('span', { text: message }), action ? h('button', { type: 'button', text: action, onclick: () => { onAction?.(); close(); } }) : null);
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 220); };
  toastHost.append(el);
  setTimeout(close, ms);
}

/** Promise-based confirm dialog using <dialog>. Resolves true / false. */
export function confirmDialog({ title, body, extra = null, confirm = t('common.confirm'), cancel = t('common.cancel'), danger = false }) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'dialog' },
      h('form', { method: 'dialog' },
        h('div', { class: 'dialog-body stack gap-3' }, h('h3', { text: title }), body ? h('p', { class: 'muted-2', text: body }) : null, extra),
        h('div', { class: 'dialog-actions' },
          h('button', { class: 'btn btn-ghost', value: 'no', text: cancel, autofocus: true }),
          h('button', { class: 'btn ' + (danger ? 'btn-danger-solid' : 'btn-primary'), value: 'yes', text: confirm }))));
    dlg.addEventListener('close', () => { resolve(dlg.returnValue === 'yes'); dlg.remove(); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

/** Debounce helper. */
export function debounce(fn, ms = 250) { let id; return (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), ms); }; }
