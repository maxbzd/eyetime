// The strip above the editor's toolbar for the selected block: exact position and size, flush-to-the-edge alignment, front / back, duplicate, remove.
// It only draws and reports what was typed or pressed; canvas-edit.js applies it (so undo, saving and clamping stay in one place).

import { h, icon } from '../ui/dom.js';
import { t } from '../shared/i18n.js';
import { blockMeta, sizeValue } from '../shared/canvas.js';

const ALIGN = [{ how: 'left', ico: 'align-start-vertical' }, { how: 'hcenter', ico: 'align-center-vertical' }, { how: 'right', ico: 'align-end-vertical' }, { how: 'top', ico: 'align-start-horizontal' }, { how: 'vcenter', ico: 'align-center-horizontal' }, { how: 'bottom', ico: 'align-end-horizontal' }];

/**
 * @param {{ id: string, name: string, getItem: () => any, canDuplicate: boolean,
 *   onPosition: (axis: 'x' | 'y', value: number) => void, onSize: (value: number) => void, onAlign: (how: string) => void,
 *   onOrder: (where: 'front' | 'back') => void, onDuplicate: () => void, onRemove: () => void }} o
 */
export function buildInspector(o) {
  const b = blockMeta(o.id), text = b.kind === 'text';
  const num = (label, unit, props, onChange) => {
    const input = h('input', { class: 'input input-sm cv-num', type: 'number', inputmode: 'numeric', 'aria-label': label, ...props,
      onchange: (e) => { const v = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(v)) onChange(v); else sync(); },
      onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); e.stopPropagation(); } });
    return { input, el: h('label', { class: 'cv-field' }, h('span', { class: 'cv-fl', text: label }), input, h('span', { class: 'cv-fu', text: unit })) };
  };
  const fx = num('X', '%', { min: 0, max: 100, step: 1 }, (v) => o.onPosition('x', v));
  const fy = num('Y', '%', { min: 0, max: 100, step: 1 }, (v) => o.onPosition('y', v));
  const fs = num(text ? t('cv.ins.size') : t('cv.ins.width'), text ? '%' : 'px', { min: text ? Math.round(b.min * 100) : b.min, max: text ? Math.round(b.max * 100) : b.max, step: text ? 5 : 10 }, o.onSize);
  const btn = (ico, tip, fn, extra = {}) => h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': tip, 'data-tip': tip, onclick: fn, ...extra }, ico);
  const el = h('div', { class: 'cv-insp', role: 'group', 'aria-label': t('cv.ins.title') + ': ' + o.name },
    h('span', { class: 'cv-iname', text: o.name }),
    h('span', { class: 'cv-fields' }, fx.el, fy.el, fs.el),
    h('span', { class: 'sep' }),
    h('span', { class: 'cv-btns' }, ALIGN.map(({ how, ico }) => btn(icon(ico), t('cv.al.' + how), () => o.onAlign(how)))),
    h('span', { class: 'sep' }),
    h('span', { class: 'cv-btns' },
      btn(icon('bring-to-front'), t('cv.front'), () => o.onOrder('front')), btn(icon('send-to-back'), t('cv.back'), () => o.onOrder('back')),
      o.canDuplicate ? btn(icon('copy'), t('cv.dup'), o.onDuplicate) : null,
      btn(icon('trash-2'), t('cv.remove') + ': ' + o.name, o.onRemove)));
  /** Show the block's current numbers (not while one of the fields is being typed in). */
  function sync() {
    const it = o.getItem();
    if (!it) return;
    for (const [f, v] of [[fx, it.x], [fy, it.y], [fs, sizeValue(o.id, it)]]) if (document.activeElement !== f.input) f.input.value = String(Math.round(v * 10) / 10);
  }
  sync();
  return { el, sync };
}
