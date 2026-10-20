// Shared appearance controls: look cards with live miniature previews, accent picker, scheme helpers.
// Used by Settings → Appearance and by the Home "Customize" drawer.

import { h, icon } from './dom.js';
import { t } from '../shared/i18n.js';
import { LOOKS, LOOK_IDS, ACCENTS, resolveVars, pickScheme } from '../shared/looks.js';
import { normalizeHex } from '../shared/color.js';

export const effectiveScheme = (ap) => pickScheme(ap, { prefersDark: window.matchMedia?.('(prefers-color-scheme: dark)').matches });

/** A miniature of the real UI rendered with a look's own variables (real components, so radii/fonts/shadows are honest). */
export function lookPreview(lookId, scheme, ap = {}) {
  const vars = resolveVars({ look: lookId, accent: ap.accent && ap.accent !== 'look' && ap.preview === 'accent' ? ap.accent : 'look', mode: scheme }, scheme);
  Object.assign(vars, { '--ctl-h': '24px', '--d': '0.6', '--fs-xs': '8px', '--fs-sm': '9px', '--fs-md': '10px', '--fs-lg': '11px', '--fs-xl': '14px', '--ui-scale': '1' });
  const bars = [[5, 2, 1], [6, 1, 2], [4, 2, 3], [7, 2, 1], [3, 1, 4], [5, 3, 2], [6, 1, 1]];
  const root = h('div', { class: 'lp', 'aria-hidden': 'true' },
    h('div', { class: 'lp-head' }, h('h4', { text: t('lp.title') }), h('span', { class: 'badge badge-accent', text: '25m' })),
    h('div', { class: 'card lp-card' },
      h('div', { class: 'lp-time num', text: '24:59' }),
      h('div', { class: 'row gap-2' }, h('span', { class: 'btn btn-primary btn-sm', text: t('lp.start') }), h('span', { class: 'chip', 'aria-pressed': 'true', text: '25m' }), h('span', { class: 'chip', text: '50m' }))),
    h('div', { class: 'lp-bars' }, bars.map((b) => h('span', { class: 'lp-col' }, ['productive', 'neutral', 'distracting'].map((c, i) => h('i', { class: 'seg ' + c, style: { flexGrow: b[i] } }))))),
    h('div', { class: 'row gap-1' }, h('span', { class: 'tag tag-productive', text: t('class.productive') }), h('span', { class: 'tag tag-distracting', text: t('class.distracting') })));
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.style.fontFamily = vars['--font'];
  return root;
}

/** Selectable card: preview + name + one-line description. */
export function lookCard(id, { scheme, selected, onPick, compact = false, ap = {} }) {
  return h('button', { type: 'button', class: 'look-card' + (compact ? ' compact' : ''), 'aria-pressed': String(selected), onclick: () => onPick(id) },
    // follow-the-system modes show both schemes of the look, split on a diagonal
    scheme === 'both'
      ? h('span', { class: 'lp-split' }, lookPreview(id, 'light', ap), h('span', { class: 'lp-dark' }, lookPreview(id, 'dark', ap)))
      : lookPreview(id, scheme, ap),
    h('span', { class: 'look-meta' }, h('span', { class: 'look-name', text: t('look.' + id) }), compact ? null : h('span', { class: 'look-desc', text: t('lookd.' + id) }), selected ? h('span', { class: 'look-check' }, icon('check')) : null));
}

export function looksGallery(ap, { onPick, compact = false }) {
  const scheme = ap.mode === 'light' || ap.mode === 'dark' ? ap.mode : 'both';
  return h('div', { class: 'looks' + (compact ? ' compact' : '') }, LOOK_IDS.map((id) => lookCard(id, { scheme, selected: ap.look === id, onPick, compact, ap })));
}

/** Accent: the look's own colour, ten presets and any custom colour. */
export function accentPicker(ap, onPick) {
  const scheme = effectiveScheme(ap);
  const look = LOOKS[ap.look] || LOOKS.calm;
  const sw = (id, color, label, extra = {}) => h('button', { type: 'button', class: 'swatch-btn', 'aria-pressed': String(ap.accent === id), 'aria-label': label, 'data-tip': label, style: { '--c': color }, onclick: () => onPick(id), ...extra });
  const isCustom = ap.accent && ap.accent !== 'look' && !ACCENTS[ap.accent];
  const customHex = isCustom ? ap.accent : '#7c5cff';
  const hex = h('input', { class: 'input input-sm token', style: { width: '104px' }, value: isCustom ? customHex : '', placeholder: '#rrggbb', maxlength: 7, spellcheck: false, 'aria-label': t('ap.customHex'),
    onchange: (e) => { const n = normalizeHex(e.target.value); if (n) onPick(n); else e.target.value = isCustom ? customHex : ''; } });
  const picker = h('input', { type: 'color', value: customHex, 'aria-label': t('ap.customColor'), onchange: (e) => onPick(normalizeHex(e.target.value)) });
  return h('div', { class: 'row gap-2 wrap', style: { alignItems: 'center' } },
    sw('look', look[scheme].accent, t('ap.lookAccent'), { class: 'swatch-btn look-own' }),
    Object.entries(ACCENTS).map(([id, pair]) => sw(id, pair[scheme === 'dark' ? 1 : 0], t('accent.' + id))),
    h('label', { class: 'swatch-btn custom', 'aria-pressed': String(isCustom), style: { '--c': customHex }, 'data-tip': t('ap.customColor') }, picker, icon('plus')),
    hex);
}
