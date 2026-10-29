// The customize drawer as a short list of rows. Each row shows what is chosen now and opens (one at a time) to all of its options:
// nothing was taken away, the options are only folded until you want them. The same controls as the arrangement editor uses.

import { h, icon } from '../ui/dom.js';
import { t } from '../shared/i18n.js';
import { skinControls } from './skin-panel.js';
import { CLOCKS, LAYOUTS, backgroundControls, depthControls, lookControls, accentControls, clockFormatControls } from './home-controls.js';
import { themeBlock } from './theme-io.js';

export const MODULES = ['today', 'tasks', 'habits', 'notes', 'links'];
/** Saved order, completed with any module it does not mention (new modules, hand-edited backups). */
export const moduleOrder = (n) => [...new Set([...(n.order || []).filter((m) => MODULES.includes(m)), ...MODULES])];

let openId = null; // the row that is open (kept while the drawer redraws after a change)

/**
 * @param {{ settings: any, n: any, set: (fn: (s: any) => void) => Promise<any>, redraw: () => void, openEditor: () => void }} o
 * `settings`: the settings in effect, `n`: the Home settings in effect, `set`: change them, `redraw`: draw the drawer again
 * @returns {HTMLElement}
 */
export function homeRows({ settings, n, set, redraw, openEditor }) {
  const seg = (label, list, value, key, keyPrefix) => h('div', { class: 'segmented wrap-seg', role: 'group', 'aria-label': label },
    list.map((v) => h('button', { type: 'button', 'aria-pressed': String(v === value), text: t(keyPrefix + v), onclick: () => set((s) => { s.newtab[key] = v; }) })));

  const order = moduleOrder(n);
  const move = (m, d) => set((s) => { const o = moduleOrder(s.newtab); const i = o.indexOf(m), j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; s.newtab.order = o; });
  const modRows = order.map((m, i) => h('div', { class: 'toggle-row mod-row' },
    h('span', { class: 'grow', text: t('mod.' + m) }),
    h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', disabled: i === 0, 'aria-label': t('home.moveUp') + ': ' + t('mod.' + m), onclick: () => move(m, -1) }, icon('arrow-up')),
    h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', disabled: i === order.length - 1, 'aria-label': t('home.moveDown') + ': ' + t('mod.' + m), onclick: () => move(m, 1) }, icon('arrow-down')),
    h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked: !!n.modules[m], 'aria-label': t('mod.' + m), onchange: (e) => set((s) => { s.newtab.modules[m] = e.target.checked; }) }), h('span', { class: 'track' }), h('span', { class: 'thumb' }))));
  const sub = (title, ...kids) => h('div', { class: 'stack gap-2' }, h('div', { class: 'eyebrow', text: title }), ...kids);
  const [clockSeg, greeting] = clockFormatControls(n, set);
  const ap = settings.appearance, skinName = t('sk.' + ((n.dna && n.dna.s) || 'look'));
  const accent = ap.accent && ap.accent !== 'look' ? (/^#/.test(ap.accent) ? ap.accent : ap.accent) : t('ap.fromLook');

  /** [id, icon, title, what is chosen now, content] */
  const rows = [
    ['bg', icon('image'), t('home.background'), t('bg.' + n.background), () => [...backgroundControls(n, set), sub(t('dp.title'), ...depthControls(n, set))]],
    ['clock', icon('clock'), t('home.clock'), t('clock.' + n.clockStyle), () => [seg(t('home.clockStyle'), CLOCKS, n.clockStyle, 'clockStyle', 'clock.'), clockSeg, greeting,
      h('button', { class: 'btn btn-sm', type: 'button', onclick: openEditor }, icon('type'), t('hr.designDigits'))]],
    ['cards', icon('layers'), t('sk.cards'), skinName, () => [skinControls({ skin: n.dna, onChange: (v) => set((s) => { s.newtab.dna = v || { s: 'look' }; }) })]],
    ['color', icon('palette'), t('hr.color'), t('look.' + ap.look) + ' · ' + accent, () => [sub(t('ap.looks'), ...lookControls(settings, set)), sub(t('home.accent'), ...accentControls(settings, set))]],
    ['arrange', icon('layout-grid'), t('hr.arrange'), t(n.canvas && n.canvas.on ? 'hr.free' : 'layout.' + n.layout), () => [
      h('button', { class: 'btn btn-primary', type: 'button', onclick: openEditor }, icon('move'), t('cv.edit')),
      sub(t('home.layout'), seg(t('home.layout'), LAYOUTS, n.layout, 'layout', 'layout.')), sub(t('home.modules'), ...modRows)]],
    ['share', icon('share-2'), t('th.title'), '', () => [themeBlock()]],
  ];
  return h('div', { class: 'hr-list' }, rows.map(([id, ico, title, value, build]) => {
    const open = openId === id;
    return h('section', { class: 'hr' + (open ? ' open' : '') },
      h('button', { class: 'hr-head', type: 'button', 'aria-expanded': String(open), onclick: () => { openId = open ? null : id; redraw(); } }, ico, h('span', { class: 'hr-t', text: title }), h('span', { class: 'hr-v', text: value }), icon('chevron-down')),
      open ? h('div', { class: 'hr-body stack gap-3' }, ...build()) : null);
  }));
}
