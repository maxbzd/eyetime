// Building blocks for the settings page.
import { h, icon, clear } from '../ui/dom.js';
import { t } from '../shared/i18n.js';
import { dropdown } from '../ui/dropdown.js';
import { parseUserDomain } from '../shared/domains.js';

/**
 * A settings row: title + optional description on the left, control on the right.
 * @param {{ title: string, desc?: string, control?: Node | null, stack?: boolean, id?: string, warn?: boolean }} o
 */
export function row({ title, desc, control, stack = false, id, warn = false }) {
  return h('div', { class: 'setting' + (stack ? ' setting-stack' : ''), id },
    h('div', { class: 'setting-text' }, h('div', { class: 'setting-title', text: title }), desc ? h('div', { class: 'setting-desc' + (warn ? ' warn' : ''), text: desc, role: warn ? 'alert' : undefined }) : null),
    control ? h('div', { class: 'setting-ctl' }, control) : null);
}

export function group(title, ...rows) {
  return h('div', {}, title ? h('h3', { class: 'group-title', text: title }) : null, h('div', { class: 'card list' }, rows.flat().filter(Boolean)));
}

/** A group that stays folded until opened (the choice is remembered): the same rows as `group`, out of the way of the ones people need first. */
export function foldGroup(title, ...rows) {
  const key = 'et-fold-' + title;
  let open = false;
  try { open = localStorage.getItem(key) === '1'; } catch { /* no storage: folded */ }
  const d = h('details', { class: 'fold', open }, h('summary', { class: 'group-title fold-head' }, title, icon('chevron-down')), h('div', { class: 'card list' }, rows.flat().filter(Boolean)));
  d.addEventListener('toggle', () => { try { localStorage.setItem(key, d.open ? '1' : '0'); } catch { /* ignore */ } });
  return d;
}

export function toggle(checked, onChange, label) {
  return h('label', { class: 'switch' },
    h('input', { type: 'checkbox', checked, 'aria-label': label, onchange: (e) => onChange(e.target.checked) }), h('span', { class: 'track' }), h('span', { class: 'thumb' }));
}

/** @param {any[]} options @param {any} value @param {(v: string) => void} onChange @param {{ label?: string, cls?: string }} [o] */
export function select(options, value, onChange, { label, cls = '' } = {}) {
  return dropdown(options, value, onChange, { label, cls: ('select-auto ' + cls).trim() });
}

export function segmented(options, value, onChange, label) {
  return h('div', { class: 'segmented', role: 'group', 'aria-label': label },
    options.map(([v, text, ico]) => h('button', { type: 'button', 'aria-pressed': String(v === value), onclick: () => onChange(v) }, ico ? icon(ico) : null, text)));
}

/** Editable list of domains shown as removable chips with an add field. */
/** @param {{ items: string[], onAdd: (d: string) => any, onRemove: (d: string) => any, placeholder: string, empty?: string }} o */
export function domainEditor({ items, onAdd, onRemove, placeholder, empty }) {
  const err = h('div', { class: 'hint', style: { color: 'var(--distracting-text)', minHeight: '0' } });
  const input = h('input', { class: 'input', placeholder, 'aria-label': placeholder, spellcheck: false, autocapitalize: 'off',
    onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } } });
  function add() {
    const parts = input.value.split(/[\s,;]+/).filter(Boolean);
    if (!parts.length) return;
    const bad = [];
    for (const p of parts) { const d = parseUserDomain(p); if (d) onAdd(d); else bad.push(p); }
    err.textContent = bad.length ? t('domains.invalid', { v: bad.join(', ') }) : '';
    if (!bad.length) input.value = '';
  }
  return h('div', { class: 'stack gap-3' },
    h('div', { class: 'row gap-2' }, input, h('button', { class: 'btn', type: 'button', onclick: add }, icon('plus'), t('common.add'))), err,
    items.length
      ? h('div', { class: 'row gap-2 wrap' }, items.map((d) => h('span', { class: 'chip chip-x' }, h('span', { class: 'chip-t', text: d }), h('button', { type: 'button', 'aria-label': t('common.remove') + ' ' + d, onclick: () => onRemove(d) }, icon('x')))))
      : (empty ? h('div', { class: 'hint', text: empty }) : null));
}

export function sectionHead(title, desc) {
  return h('div', { class: 'sec-head' }, h('h2', { text: title }), desc ? h('p', { text: desc }) : null);
}

export { clear };
