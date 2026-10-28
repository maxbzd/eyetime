// The widget panels of the Home editor: the gallery (pick a widget to add) and the settings of one widget.

import { h, icon } from '../ui/dom.js';
import { dropdown } from '../ui/dropdown.js';
import { t } from '../shared/i18n.js';
import { updateSettings } from '../shared/storage.js';
import { WIDGET_KIND_IDS, WIDGET_KINDS, WORLD_ZONES, BIG_METRICS, PERIODS, STACK_WHEN, STACKABLE, MAX_STACK, normalizeCfg, zoneCity } from '../shared/widgets.js';
import { widgetName, previewWidget } from './widgets.js';
import { home, effectiveNow } from './home-config.js';

const head = (title, onClose) => h('div', { class: 'ty-head' }, h('h3', { text: title }),
  onClose ? h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': t('common.close'), onclick: onClose }, icon('x')) : null);

/** The gallery: every kind as a live miniature; choosing one calls `onAdd(kind)`. Returns { el, destroy }. */
export function buildGallery({ onAdd, onClose }) {
  const previews = [];
  const tiles = WIDGET_KIND_IDS.map((kind) => {
    const p = previewWidget(kind); previews.push(p);
    return h('button', { class: 'wg-tile', type: 'button', onclick: () => onAdd(kind) },
      h('span', { class: 'wg-prev' }, h('span', { class: 'wg-prev-in', style: { width: WIDGET_KINDS[kind].w[2] + 'px' } }, p.el)),
      h('span', { class: 'wg-tname' }, icon(WIDGET_KINDS[kind].icon), h('span', { text: widgetName(kind) })));
  });
  const root = h('section', { class: 'cv-panel', 'aria-label': t('wg.title') }, head(t('wg.title'), onClose), h('p', { class: 'muted', style: { fontSize: 'var(--fs-sm)' }, text: t('wg.hint') }), h('div', { class: 'wg-tiles' }, tiles));
  return { el: root, destroy: () => previews.forEach((p) => p.destroy()) };
}

/** The settings of one widget (for kinds that have any), plus a delete button. */
export async function buildWidgetPanel(id, kind, { onClose, onDelete }) {
  const w0 = (await effectiveNow()).newtab.widgets.find((x) => x.id === id);
  let cfg = normalizeCfg(kind, w0 && w0.cfg);
  const save = (patch) => { cfg = normalizeCfg(kind, { ...cfg, ...patch }); return updateSettings((s) => { const w = home(s).widgets.find((x) => x.id === id); if (w) w.cfg = cfg; }); };
  const root = h('section', { class: 'cv-panel', 'aria-label': widgetName(kind) });
  const row = (label, control) => h('label', { class: 'wg-field' }, h('span', { class: 'ty-lbl', text: label }), control);
  const zones = () => /** @type {Array<[string, string]>} */ (WORLD_ZONES.map((z) => [z, zoneCity(z)]));

  function draw() {
    const fields = [];
    if (kind === 'countdown') {
      fields.push(row(t('wg.f.title'), h('input', { class: 'input', maxlength: 60, value: cfg.title, placeholder: t('wg.cd.default'), oninput: (e) => save({ title: e.target.value }) })),
        row(t('wg.f.date'), h('input', { class: 'input', type: 'date', value: cfg.date, onchange: (e) => { if (e.target.value) save({ date: e.target.value }); } })),
        row(t('wg.f.time'), h('input', { class: 'input', type: 'time', value: cfg.time, onchange: (e) => save({ time: e.target.value }) })));
    } else if (kind === 'worldclock') {
      cfg.zones.forEach((z, i) => fields.push(h('div', { class: 'wg-zone' },
        dropdown(zones(), z, (v) => { const next = [...cfg.zones]; next[i] = v; save({ zones: next }); }, { label: t('wg.f.zone') + ' ' + (i + 1) }),
        cfg.zones.length > 1 ? h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': t('common.remove'), onclick: () => { save({ zones: cfg.zones.filter((_, j) => j !== i) }).then(draw); } }, icon('x')) : null)));
      if (cfg.zones.length < 4) fields.push(h('button', { class: 'btn btn-sm', type: 'button', onclick: () => { const free = WORLD_ZONES.find((z) => !cfg.zones.includes(z)); save({ zones: [...cfg.zones, free] }).then(draw); } }, icon('plus'), t('wg.f.addZone')));
    } else if (kind === 'percent') {
      for (const p of PERIODS) fields.push(h('label', { class: 'ty-row' }, h('span', { class: 'ty-lbl', text: t('wg.p.' + p) }),
        h('span', { class: 'switch', style: { gridColumn: 3, justifySelf: 'end' } }, h('input', { type: 'checkbox', checked: cfg.periods.includes(p), 'aria-label': t('wg.p.' + p), onchange: (e) => { const on = e.target.checked; const next = on ? [...cfg.periods, p] : cfg.periods.filter((x) => x !== p); if (!next.length) { e.target.checked = true; return; } save({ periods: next }); } }), h('span', { class: 'track' }), h('span', { class: 'thumb' }))));
    } else if (kind === 'mantra') {
      fields.push(row(t('wg.f.text'), h('textarea', { class: 'textarea', rows: 4, maxlength: 200, placeholder: t('wg.mantra.ph'), oninput: (e) => save({ text: e.target.value }) }, cfg.text)));
    } else if (kind === 'bignumber') {
      fields.push(row(t('wg.f.metric'), dropdown(/** @type {Array<[string, string]>} */ (BIG_METRICS.map((m) => [m, t('wg.m.' + m)])), cfg.metric, (v) => save({ metric: v }), { label: t('wg.f.metric') })));
    } else if (kind === 'stack') {
      const items = cfg.items, set = (next) => save({ items: next }).then(draw);
      fields.push(row(t('wg.stack.mode'), dropdown([['auto', t('wg.stack.auto')], ['manual', t('wg.stack.manual')]], cfg.pick, (v) => save({ pick: v }).then(draw), { label: t('wg.stack.mode') })));
      items.forEach((it, i) => fields.push(h('div', { class: 'ws-member' },
        h('div', { class: 'ws-mhead' }, icon(WIDGET_KINDS[it.kind].icon), h('b', { text: widgetName(it.kind) }), h('span', { class: 'grow' }),
          h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', disabled: i === 0, 'aria-label': t('common.up') + ': ' + widgetName(it.kind), onclick: () => { const n = [...items]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; set(n); } }, icon('chevron-up')),
          h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', disabled: i === items.length - 1, 'aria-label': t('common.down') + ': ' + widgetName(it.kind), onclick: () => { const n = [...items]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; set(n); } }, icon('chevron-down')),
          items.length > 1 ? h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': t('common.remove') + ': ' + widgetName(it.kind), onclick: () => set(items.filter((_, j) => j !== i)) }, icon('x')) : null),
        cfg.pick === 'auto' ? row(t('wg.stack.when'), dropdown(/** @type {Array<[string, string]>} */ (STACK_WHEN.map((w) => [w, t('wg.stack.' + w)])), it.when, (v) => set(items.map((x, j) => (j === i ? { ...x, when: v } : x))), { label: t('wg.stack.when') + ': ' + widgetName(it.kind) })) : null)));
      fields.push(items.length < MAX_STACK
        ? row(t('wg.stack.add'), dropdown(/** @type {Array<[string, string]>} */ ([['', '+']].concat(STACKABLE.map((k) => [k, widgetName(k)]))), '', (v) => { if (v) set([...items, { kind: v, when: 'any', cfg: normalizeCfg(v, {}) }]); }, { label: t('wg.stack.add') }))
        : h('p', { class: 'muted', style: { fontSize: 'var(--fs-sm)' }, text: t('wg.stack.full') }));
    } else fields.push(h('p', { class: 'muted', style: { fontSize: 'var(--fs-sm)' }, text: t('wg.noConfig') }));
    root.replaceChildren(head(widgetName(kind), onClose), ...fields,
      h('button', { class: 'btn btn-sm wg-del', type: 'button', onclick: onDelete }, icon('trash-2'), t('wg.delete')));
  }
  draw();
  return root;
}
