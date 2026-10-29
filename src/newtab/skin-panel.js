// The controls of a card's skin: a row of ready styles first (one tap), then a colour, and the sliders folded away under "Fine-tune".
// Used for the theme's cards (Look panel) and for one widget (its own settings), where the first tile is "Same as the theme".

import { h, icon } from '../ui/dom.js';
import { t } from '../shared/i18n.js';
import { SKIN_STYLES, SKIN_PRESETS, SKIN_SWATCHES, normalizeSkin, skinTokens } from '../shared/skins.js';
import { skinEnv, supportsLiquid } from './skin-apply.js';

/**
 * @param {{ skin: any, inherit?: boolean, onChange: (skin: any) => void }} o `inherit`: offer "Same as the theme" (a widget); onChange(null) then means inherit
 */
export function skinControls({ skin, inherit = false, onChange }) {
  const cur = normalizeSkin(skin), env = skinEnv();
  const pick = (s) => onChange(s === null ? null : { ...(cur && cur.s !== 'look' ? { ...cur, s } : { s }) });
  const tile = (id, label) => {
    const active = id === null ? !cur : cur && cur.s === id;
    const style = id && id !== 'look' ? skinTokens({ s: id, a: cur && cur.a }, { ...env, ink: 'light' }).vars : {};
    const prev = h('span', { class: 'sk-prev', style: id && id !== 'look' ? style : {} }, h('i', {}), h('i', {}));
    return h('button', { class: 'sk-tile', type: 'button', 'aria-pressed': String(!!active), onclick: () => pick(id) }, h('span', { class: 'sk-mock' }, prev), h('span', { class: 'sk-name', text: label }));
  };
  const tiles = h('div', { class: 'sk-tiles', role: 'group', 'aria-label': t('sk.title') },
    inherit ? tile(null, t('sk.theme')) : null,
    ...SKIN_STYLES.map((s) => tile(s, s === 'look' ? t('sk.look') : t('sk.' + s))));
  const body = [tiles];
  if (cur && cur.s !== 'look') {
    const sw = (hex) => h('button', { class: 'swatch-btn', type: 'button', 'aria-pressed': String((cur.a || '') === (hex || '')), 'aria-label': hex || t('sk.look'), style: { '--c': hex || 'transparent' }, onclick: () => { const n = { ...cur }; if (hex) n.a = hex; else delete n.a; onChange(n); } }, hex ? null : icon('x'));
    body.push(h('div', { class: 'sk-row' }, h('span', { class: 'ty-lbl', text: t('sk.accent') }), h('span', { class: 'row gap-2 wrap' }, sw(''), SKIN_SWATCHES.map(sw))));
    if (cur.s === 'liquid' && !supportsLiquid()) body.push(h('p', { class: 'muted', style: { fontSize: 'var(--fs-xs)' }, text: t('sk.liquidNote') }));
    const P = SKIN_PRESETS[cur.s];
    const slider = (key, max) => h('label', { class: 'ty-row' }, h('span', { class: 'ty-lbl', text: t('sk.' + key) }),
      h('input', { type: 'range', min: 0, max, step: 1, value: cur[key] ?? P[key], 'aria-label': t('sk.' + key), onchange: (e) => onChange({ ...cur, [key]: Number(e.target.value) }) }), h('span', { class: 'ty-out', text: String(cur[key] ?? P[key]) }));
    const ink = h('div', { class: 'segmented', role: 'group', 'aria-label': t('sk.ink') }, [['auto', t('sk.inkAuto')], ['light', t('sk.inkLight')], ['dark', t('sk.inkDark')]].map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String((cur.ink || 'auto') === v), disabled: !!P.ink, onclick: () => { const n = { ...cur }; if (v === 'auto') delete n.ink; else n.ink = v; onChange(n); } }, l)));
    body.push(h('details', { class: 'sk-fine' }, h('summary', { text: t('sk.fine') }),
      h('div', { class: 'stack gap-2', style: { marginTop: 'var(--s-2)' } }, slider('r', 44), slider('b', 44), slider('o', 100), slider('bw', 4), slider('sh', 100),
        h('div', { class: 'sk-row' }, h('span', { class: 'ty-lbl', text: t('sk.ink') }), ink),
        h('button', { class: 'btn btn-sm btn-ghost', type: 'button', style: { alignSelf: 'flex-start' }, onclick: () => onChange({ s: cur.s }) }, icon('rotate-ccw'), t('sk.reset')))));
  }
  return h('div', { class: 'stack gap-2' }, ...body);
}
