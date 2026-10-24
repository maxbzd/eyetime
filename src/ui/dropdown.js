// A styled dropdown in place of the browser's own <select> list (the grey system menu does not follow the look, the dark mode or the dock).
// A button (the ARIA "select-only combobox") opens a listbox in the top layer, so it is never clipped by a card or a dialog.
// Keyboard: ↓ ↑ Enter Space open; inside: ↑ ↓ Home End move, Enter / Space choose, Esc closes, typing jumps to a match, Tab closes.

import { h, icon } from './dom.js';

let uid = 0;
const chev = () => { const el = icon('chevron-down'); el.classList.add('dd-chev'); return el; };
let current = null; // the one open dropdown: { close }

/**
 * @param {Array<[string|number, string]>} options value / text pairs
 * @param {string|number} value the chosen value
 * @param {(value: string) => any} onChange called with the new value (a string, like a <select>'s)
 * @param {{ label?: string, cls?: string, bare?: boolean, chevron?: boolean }} [o] `bare`: no `.select` look (the caller styles the button itself); `chevron: false`: the caller draws its own arrow
 * @returns {HTMLButtonElement & { value: string }}
 */
export function dropdown(options, value, onChange, { label, cls = '', bare = false, chevron = true } = {}) {
  const items = options.map(([v, text]) => ({ v: String(v), text: String(text) }));
  let cur = Math.max(0, items.findIndex((i) => i.v === String(value)));
  const id = 'dd' + (++uid);
  const text = h('span', { class: 'dd-text', text: items[cur] ? items[cur].text : '' });
  const btn = /** @type {any} */ (h('button', { type: 'button', class: ((bare ? 'dd ' : 'select dd ') + cls).trim(), role: 'combobox', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-label': label || undefined }, text, chevron ? chev() : null));
  if (!items.length) btn.disabled = true;
  Object.defineProperty(btn, 'value', {
    get: () => (items[cur] ? items[cur].v : ''),
    set: (v) => { const i = items.findIndex((x) => x.v === String(v)); if (i >= 0) { cur = i; text.textContent = items[i].text; } },
  });

  let pop = null, active = 0, typed = '', typedAt = 0, watch = null;
  const optEls = () => (pop ? [...pop.children] : []);

  function setActive(i, scroll = true) {
    const els = optEls(); if (!els.length) return;
    active = Math.max(0, Math.min(els.length - 1, i));
    els.forEach((el, k) => { if (k === active) el.setAttribute('data-active', ''); else el.removeAttribute('data-active'); });
    pop.setAttribute('aria-activedescendant', els[active].id);
    if (scroll) els[active].scrollIntoView({ block: 'nearest' });
  }

  function place() {
    const r = btn.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight, gap = 6, edge = 8;
    pop.style.minWidth = Math.max(r.width, 150) + 'px';
    pop.style.maxHeight = 'none'; pop.style.maxWidth = (vw - 2 * edge) + 'px';
    const pr = pop.getBoundingClientRect();
    const below = vh - r.bottom - gap - edge, above = r.top - gap - edge;
    const up = pr.height > below && above > below;
    const room = Math.max(120, up ? above : below);
    pop.style.maxHeight = Math.min(room, 340) + 'px';
    const hgt = Math.min(pr.height, room, 340);
    pop.style.top = Math.round(up ? r.top - gap - hgt : r.bottom + gap) + 'px';
    pop.style.left = Math.round(Math.max(edge, Math.min(r.left, vw - pr.width - edge))) + 'px';
    pop.dataset.side = up ? 'up' : 'down';
  }

  function open(startAt) {
    if (current && current.btn !== btn) current.close(false);
    if (pop || !items.length) return;
    pop = h('div', { class: 'dd-pop', id, role: 'listbox', tabindex: '-1', popover: 'manual', 'aria-label': label || undefined },
      items.map((it, i) => h('div', { class: 'dd-opt', id: id + '-' + i, role: 'option', 'aria-selected': String(i === cur), onpointermove: () => { if (active !== i) setActive(i, false); }, onclick: () => choose(i) },
        h('span', { class: 'dd-label', text: it.text }), i === cur ? icon('check') : null)));
    pop.addEventListener('keydown', onKey);
    pop.addEventListener('focusout', (e) => { if (!e.relatedTarget || !pop.contains(/** @type {Node} */ (e.relatedTarget))) close(false); });
    (btn.closest('dialog[open]') || document.body).append(pop); // inside an open modal dialog, anything outside it is inert
    pop.showPopover();
    btn.setAttribute('aria-expanded', 'true'); btn.setAttribute('aria-controls', id);
    place(); setActive(startAt == null ? cur : startAt);
    pop.focus({ preventScroll: true });
    document.addEventListener('pointerdown', onOutside, true);
    window.addEventListener('resize', onGone); window.addEventListener('scroll', onScroll, true); window.addEventListener('blur', onGone);
    watch = new MutationObserver(() => { if (!btn.isConnected) close(false); }); watch.observe(document.body, { childList: true, subtree: true });
    current = { btn, close };
  }

  function close(refocus = true) {
    if (!pop) return;
    document.removeEventListener('pointerdown', onOutside, true);
    window.removeEventListener('resize', onGone); window.removeEventListener('scroll', onScroll, true); window.removeEventListener('blur', onGone);
    if (watch) watch.disconnect(); watch = null;
    const p = pop; pop = null;
    try { p.hidePopover(); } catch { /* already hidden */ }
    p.remove();
    btn.setAttribute('aria-expanded', 'false'); btn.removeAttribute('aria-controls');
    if (current && current.btn === btn) current = null;
    if (refocus && btn.isConnected) btn.focus({ preventScroll: true });
  }

  function choose(i) {
    const changed = i !== cur;
    close();
    if (!changed) return;
    cur = i; text.textContent = items[i].text;
    onChange(items[i].v);
  }

  function onOutside(e) { if (pop && !pop.contains(/** @type {Node} */ (e.target)) && !btn.contains(/** @type {Node} */ (e.target))) close(false); }
  function onGone() { close(false); }
  function onScroll(e) { if (pop && !pop.contains(/** @type {Node} */ (e.target))) close(false); } // scrolling the page moves the button away from the list

  function onKey(e) {
    const n = items.length, k = e.key;
    if (k === 'ArrowDown') setActive(active + 1);
    else if (k === 'ArrowUp') setActive(active - 1);
    else if (k === 'Home') setActive(0);
    else if (k === 'End') setActive(n - 1);
    else if (k === 'PageDown') setActive(active + 6);
    else if (k === 'PageUp') setActive(active - 6);
    else if (k === 'Enter' || k === ' ') choose(active);
    else if (k === 'Escape') { close(); }
    else if (k === 'Tab') { close(false); return; }
    else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { // typeahead
      const now = Date.now(); typed = now - typedAt > 600 ? k.toLowerCase() : typed + k.toLowerCase(); typedAt = now;
      const from = typed.length === 1 ? active + 1 : active;
      const hit = [...items.keys()].map((x) => (x + from) % n).find((x) => items[x].text.toLowerCase().startsWith(typed));
      if (hit != null) setActive(hit);
    } else return;
    e.preventDefault(); e.stopPropagation(); // a page's own Esc / arrow handlers (the dock, a dialog) must not also react
  }

  btn.addEventListener('click', () => { if (pop) close(); else open(); });
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!pop) open(); }
  });
  return btn;
}
