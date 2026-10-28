// The type designer panel of the Home editor: faces as live samples, weight and spacing, fills (solid / gradient / outline), glow and shadow,
// seconds. It edits the clock or the greeting + date, shows the result on the real page at once and saves a moment after the last change.

import { h, icon } from '../ui/dom.js';
import { t } from '../shared/i18n.js';
import { getSettings, updateSettings } from '../shared/storage.js';
import { TYPEFACES, TYPEFACE_IDS, CLOCK_DEFAULT, TEXT_DEFAULT, normalizeType } from '../shared/typeface.js';
import { applyType } from './type-apply.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const CYR_LANGS = ['ru', 'uk'];

/**
 * @param {'clock' | 'text'} kind which style is edited
 * @param {{ onClose?: () => void }} [opts]
 * @returns {Promise<HTMLElement>} the panel (the caller appends it)
 */
export async function buildTypePanel(kind, { onClose } = {}) {
  let st = normalizeType((await getSettings()).newtab.type);
  const isClock = kind === 'clock';
  const base = isClock ? CLOCK_DEFAULT : TEXT_DEFAULT;
  let timer = 0;
  const lang = document.documentElement.lang || 'en';
  const faces = TYPEFACE_IDS.filter((id) => isClock || TYPEFACES[id].cyr || !CYR_LANGS.includes(lang));

  const persist = () => { clearTimeout(timer); timer = setTimeout(() => updateSettings((s) => { s.newtab.type = clone(st); }), 250); };
  const set = (patch, redraw = false) => {
    st = normalizeType({ ...st, [kind]: { ...st[kind], ...patch } });
    applyType(null, st); persist();
    if (redraw) draw();
  };
  const cur = () => st[kind];

  const root = h('section', { class: 'cv-panel', 'aria-label': t('ty.title') });

  const row = (label, control, out) => h('label', { class: 'ty-row' }, h('span', { class: 'ty-lbl', text: label }), control, out || null);
  const slider = (label, min, max, step, value, onInput, fmt) => {
    const out = h('output', { class: 'ty-out num', text: fmt(value) });
    const input = h('input', { type: 'range', min, max, step, value, 'aria-label': label, oninput: (e) => { const v = Number(e.target.value); out.textContent = fmt(v); onInput(v); } });
    return row(label, input, out);
  };
  const color = (label, value, onPick, fallback) => h('div', { class: 'ty-row' }, h('span', { class: 'ty-lbl', text: label }),
    h('span', { class: 'ty-color' },
      h('input', { type: 'color', value: value || fallback, 'aria-label': label, oninput: (e) => onPick(e.target.value) }),
      value ? h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': t('ty.lookDefault') + ': ' + label, 'data-tip': t('ty.lookDefault'), onclick: () => { onPick(null); } }, icon('x')) : h('span', { class: 'muted ty-auto', text: t('ty.lookDefault') })));
  const toggle = (label, checked, onChange) => h('label', { class: 'ty-row' }, h('span', { class: 'ty-lbl', text: label }),
    h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked, 'aria-label': label, onchange: (e) => onChange(e.target.checked) }), h('span', { class: 'track' }), h('span', { class: 'thumb' })));

  function draw() {
    const c = cur(), face = TYPEFACES[c.font] || null;
    const [wlo, whi] = (face || TYPEFACES.inter).w;
    const tiles = [['look', null], ...faces.map((id) => [id, TYPEFACES[id]])].map(([id, f]) =>
      h('button', { class: 'ty-tile', type: 'button', 'aria-pressed': String(c.font === id), onclick: () => set({ font: id, weight: null }, true) },
        h('span', { class: 'ty-sample num', 'aria-hidden': 'true', style: f ? { fontFamily: f.stack, fontWeight: String(f.def) } : {}, text: isClock ? '09:41' : 'Aa' }),
        h('span', { class: 'ty-name', text: f ? f.label : t('ty.lookDefault') })));
    const ctl = [
      h('div', { class: 'ty-head' }, h('h3', { text: isClock ? t('cv.clock') : t('cv.greeting') }),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { st = normalizeType({ ...st, [kind]: clone(base) }); applyType(null, st); persist(); draw(); } }, icon('rotate-ccw'), t('ty.reset')),
        onClose ? h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': t('common.close'), onclick: onClose }, icon('x')) : null),
      h('div', { class: 'ty-sec' }, h('div', { class: 'eyebrow', text: t('ty.font') }), h('div', { class: 'ty-tiles', role: 'group', 'aria-label': t('ty.font') }, tiles)),
      wlo === whi ? null : slider(t('ty.weight'), wlo, whi, 1, c.weight ?? (face ? face.def : 300), (v) => set({ weight: v }), (v) => String(Math.round(v))),
      slider(t('ty.tracking'), isClock ? -0.12 : -0.05, 0.3, 0.005, c.tracking ?? 0, (v) => set({ tracking: v }), (v) => (v > 0 ? '+' : '') + v.toFixed(2)),
    ];
    if (isClock) {
      ctl.push(
        h('div', { class: 'ty-sec' }, h('div', { class: 'eyebrow', text: t('ty.fill') }),
          h('div', { class: 'segmented', role: 'group', 'aria-label': t('ty.fill') }, ['solid', 'gradient', 'outline'].map((f) => h('button', { type: 'button', 'aria-pressed': String(c.fill === f), text: t('ty.' + f), onclick: () => set({ fill: f }, true) })))),
        color(c.fill === 'gradient' ? t('ty.color1') : t('ty.color'), c.color, (v) => set({ color: v }, v === null), '#ffffff'),
        c.fill === 'gradient' ? color(t('ty.color2'), c.color2, (v) => set({ color2: v }, v === null), '#8b5cf6') : null,
        c.fill === 'gradient' ? slider(t('ty.angle'), 0, 360, 1, c.angle, (v) => set({ angle: v }), (v) => Math.round(v) + '°') : null,
        c.fill === 'outline' ? slider(t('ty.stroke'), 0.5, 6, 0.5, c.stroke, (v) => set({ stroke: v }), (v) => v.toFixed(1)) : null,
        slider(t('ty.glow'), 0, 1, 0.05, c.glow, (v) => set({ glow: v }), (v) => Math.round(v * 100) + '%'),
        slider(t('ty.shadow'), 0, 1, 0.05, c.shadow, (v) => set({ shadow: v }), (v) => Math.round(v * 100) + '%'),
        toggle(t('ty.seconds'), c.seconds, (v) => set({ seconds: v })),
        toggle(t('ty.tabular'), c.tabular, (v) => set({ tabular: v })));
    } else {
      ctl.push(color(t('ty.color'), c.color, (v) => set({ color: v }, v === null), '#ffffff'), toggle(t('ty.upper'), c.upper, (v) => set({ upper: v })));
    }
    const keep = root.scrollTop;
    root.replaceChildren(...ctl.filter(Boolean));
    root.scrollTop = keep;
  }
  draw();
  return root;
}
