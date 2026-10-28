// The layouts panel of the Home editor: the default plus named layouts that switch on by themselves (during focus, or at certain hours).
// Choosing "Edit" makes the editor work on that layout; "Show now" pins one until it is unpinned.

import { h, icon } from '../ui/dom.js';
import { dropdown } from '../ui/dropdown.js';
import { t } from '../shared/i18n.js';
import { getSettings, updateSettings } from '../shared/storage.js';
import { normalizeLayouts, newLayoutId, copyHome, DEFAULT_ID, MAX_LAYOUTS } from '../shared/layouts.js';
import { homeId, wantedLayout, effectiveNow } from './home-config.js';

/**
 * @param {{ onEdit: (id: string) => void, onClose: () => void }} o
 * @returns {Promise<HTMLElement>}
 */
export async function buildLayoutPanel({ onEdit, onClose }) {
  const root = h('section', { class: 'cv-panel', 'aria-label': t('ly.title') });
  const save = (fn) => updateSettings((s) => { const list = normalizeLayouts(s.newtab.layouts); fn(list, s.newtab); s.newtab.layouts = list; });

  async function draw() {
    const raw = await getSettings(), layouts = normalizeLayouts(raw.newtab.layouts), pin = raw.newtab.layoutPin, editing = homeId(), on = wantedLayout(raw);
    const whenOpts = /** @type {Array<[string, string]>} */ ([['manual', t('ly.whenManual')], ['focus', t('ly.whenFocus')], ['time', t('ly.whenTime')]]);
    const row = (id, name, body) => h('div', { class: 'ly-row' + (editing === id ? ' is-edit' : ''), 'data-layout': id },
      h('div', { class: 'ly-top' }, name, on === id ? h('span', { class: 'badge badge-accent', text: t('ly.on') }) : null, pin === id ? icon('pin') : null), body);
    const editBtn = (id) => h('button', { class: 'btn btn-sm' + (editing === id ? '' : ' btn-primary'), type: 'button', disabled: editing === id, onclick: () => onEdit(id) }, icon('pencil'), editing === id ? t('ly.editing') : t('ly.edit'));

    const rows = [row(DEFAULT_ID, h('strong', { text: t('ly.default') }),
      h('div', { class: 'ly-body' }, h('p', { class: 'muted', style: { fontSize: 'var(--fs-sm)' }, text: t('ly.defaultHint') }), h('div', { class: 'row gap-2' }, editBtn(DEFAULT_ID))))];
    for (const l of layouts) {
      const nameIn = h('input', { class: 'input input-sm', maxlength: 30, value: l.name, 'aria-label': t('ly.name'), onchange: (e) => { const v = e.target.value.trim().slice(0, 30) || l.name; save((list) => { const x = list.find((y) => y.id === l.id); if (x) x.name = v; }).then(draw); } });
      const time = l.when.kind === 'time'
        ? h('div', { class: 'row gap-2', style: { alignItems: 'center' } },
          h('label', { class: 'ly-time' }, h('span', { class: 'muted', text: t('ly.from') }), h('input', { class: 'input input-sm', type: 'time', value: l.when.from, onchange: (e) => e.target.value && save((list) => { list.find((y) => y.id === l.id).when.from = e.target.value; }).then(draw) })),
          h('label', { class: 'ly-time' }, h('span', { class: 'muted', text: t('ly.to') }), h('input', { class: 'input input-sm', type: 'time', value: l.when.to, onchange: (e) => e.target.value && save((list) => { list.find((y) => y.id === l.id).when.to = e.target.value; }).then(draw) })))
        : null;
      rows.push(row(l.id, nameIn, h('div', { class: 'ly-body' },
        dropdown(whenOpts, l.when.kind, (v) => save((list) => { list.find((y) => y.id === l.id).when.kind = v; }).then(draw), { label: t('ly.when') }),
        time,
        h('div', { class: 'row gap-2' }, editBtn(l.id),
          h('button', { class: 'btn btn-sm', type: 'button', onclick: () => updateSettings((s) => { s.newtab.layoutPin = pin === l.id ? null : l.id; }).then(draw) }, icon('pin'), pin === l.id ? t('ly.unpin') : t('ly.pin')),
          h('button', { class: 'btn btn-sm btn-ghost', type: 'button', 'aria-label': t('ly.delete') + ': ' + l.name, 'data-tip': t('ly.delete'), onclick: async () => { const wasEditing = editing === l.id; await updateSettings((s) => { s.newtab.layouts = normalizeLayouts(s.newtab.layouts).filter((y) => y.id !== l.id); if (s.newtab.layoutPin === l.id) s.newtab.layoutPin = null; }); if (wasEditing) onEdit(DEFAULT_ID); else draw(); } }, icon('trash-2')))))); 
    }
    const full = layouts.length >= MAX_LAYOUTS;
    root.replaceChildren(...[
      h('div', { class: 'ty-head' }, h('h3', { text: t('ly.title') }), h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': t('common.close'), onclick: onClose }, icon('x'))),
      h('p', { class: 'muted', style: { fontSize: 'var(--fs-sm)' }, text: t('ly.hint') }),
      ...rows,
      h('button', { class: 'btn btn-sm', type: 'button', disabled: full, onclick: async () => {
        const eff = (await effectiveNow()).newtab;
        let id = '';
        await updateSettings((s) => { const list = normalizeLayouts(s.newtab.layouts); id = newLayoutId(list); list.push({ id, name: t('ly.newName', { n: list.length + 1 }), when: { kind: 'manual', from: '20:00', to: '06:00' }, data: copyHome(eff) }); s.newtab.layouts = list; });
        onEdit(id);
      } }, icon('plus'), t('ly.add')),
      full ? h('p', { class: 'muted', style: { fontSize: 'var(--fs-xs)' }, text: t('ly.full', { n: MAX_LAYOUTS }) }) : null].filter(Boolean));
  }
  await draw();
  return root;
}
