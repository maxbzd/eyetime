// The widget panels of the Home editor: the gallery (pick a widget to add) and the settings of one widget.

import { h, icon } from '../ui/dom.js';
import { dropdown } from '../ui/dropdown.js';
import { t } from '../shared/i18n.js';
import { updateSettings } from '../shared/storage.js';
import { WIDGET_KIND_IDS, WIDGET_KINDS, WORLD_ZONES, BIG_METRICS, PERIODS, STACK_WHEN, STACKABLE, MAX_STACK, normalizeCfg, zoneCity } from '../shared/widgets.js';
import { widgetName, previewWidget } from './widgets.js';
import { home, effectiveNow } from './home-config.js';
import { skinControls } from './skin-panel.js';
import { WIDGET_FIELDS } from './widget-fields.js';
import { WIDGET_CATS } from '../shared/widgets-more.js';
import { normalizeSkin } from '../shared/skins.js';

const head = (title, onClose) => h('div', { class: 'ty-head' }, h('h3', { text: title }),
  onClose ? h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': t('common.close'), onclick: onClose }, icon('x')) : null);

/** The gallery: every kind as a live miniature, in categories; choosing one calls `onAdd(kind)`. Returns { el, destroy }. */
export function buildGallery({ onAdd, onClose }) {
  let previews = [], cat = WIDGET_CATS[0];
  const grid = h('div', { class: 'wg-tiles' });
  const chips = h('div', { class: 'wg-cats', role: 'group', 'aria-label': t('wg.title') });
  function fill() {
    previews.forEach((p) => p.destroy()); previews = [];
    const kinds = WIDGET_KIND_IDS.filter((k) => cat === 'all' || WIDGET_KINDS[k].cat === cat);
    grid.replaceChildren(...kinds.map((kind) => {
      const p = previewWidget(kind); previews.push(p);
      return h('button', { class: 'wg-tile', type: 'button', onclick: () => onAdd(kind) },
        h('span', { class: 'wg-prev' }, h('span', { class: 'wg-prev-in', style: { width: WIDGET_KINDS[kind].w[2] + 'px' } }, p.el)),
        h('span', { class: 'wg-tname' }, icon(WIDGET_KINDS[kind].icon), h('span', { text: widgetName(kind) })));
    }));
    chips.replaceChildren(...['all', ...WIDGET_CATS].map((c) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(c === cat), onclick: () => { cat = c; fill(); } }, t('wg.cat.' + c))));
  }
  fill();
  const root = h('section', { class: 'cv-panel', 'aria-label': t('wg.title') }, head(t('wg.title'), onClose), chips, grid);
  return { el: root, destroy: () => previews.forEach((p) => p.destroy()) };
}

/** The settings of one widget (for kinds that have any), plus a delete button. */
export async function buildWidgetPanel(id, kind, { onClose, onDelete }) {
  const w0 = (await effectiveNow()).newtab.widgets.find((x) => x.id === id);
  let effectiveWidth = ((await effectiveNow()).newtab.canvas.items[id] || {}).w || WIDGET_KINDS[kind].w[2];
  let cfg = normalizeCfg(kind, w0 && w0.cfg), skin = normalizeSkin(w0 && w0.skin);
  const saveSkin = (v) => { skin = normalizeSkin(v); return updateSkin(); };
  const updateSkin = () => updateSettings((s) => { const w = home(s).widgets.find((x) => x.id === id); if (w) { if (skin) w.skin = skin; else delete w.skin; } }).then(draw);
  const save = (patch) => { cfg = normalizeCfg(kind, { ...cfg, ...patch }); return updateSettings((s) => { const w = home(s).widgets.find((x) => x.id === id); if (w) w.cfg = cfg; }); };
  const root = h('section', { class: 'cv-panel', 'aria-label': widgetName(kind) });
  const row = (label, control) => h('label', { class: 'wg-field' }, h('span', { class: 'ty-lbl', text: label }), control);
  const zones = () => /** @type {Array<[string, string]>} */ (WORLD_ZONES.map((z) => [z, zoneCity(z)]));

  const redraw = () => draw();
  /** One field of the data table: a dropdown, a switch, a number or a text. */
  function fieldRow(f) {
    const label = f.label(), v = cfg[f.key];
    if (f.type === 'choice') return row(label, dropdown(/** @type {Array<[string, string]>} */ (f.options.map((o) => [o, (f.labels && f.labels[o]) || t('wg.v.' + o)])), v, (x) => save({ [f.key]: x }).then(redraw), { label }));
    if (f.type === 'toggle') return h('label', { class: 'ty-row' }, h('span', { class: 'ty-lbl', text: label }), h('span', { class: 'switch', style: { gridColumn: 3, justifySelf: 'end' } }, h('input', { type: 'checkbox', checked: !!v, 'aria-label': label, onchange: (e) => save({ [f.key]: e.target.checked }) }), h('span', { class: 'track' }), h('span', { class: 'thumb' })));
    if (f.type === 'number') return row(label, h('input', { class: 'input', type: 'number', min: f.min, max: f.max, value: v, onchange: (e) => { const n = Math.round(Number(e.target.value)); if (Number.isFinite(n)) save({ [f.key]: n }); } }));
    if (f.type === 'text') return row(label, h('input', { class: 'input', maxlength: f.max, value: v, oninput: (e) => save({ [f.key]: e.target.value }) }));
    if (f.type === 'zone') return row(label, dropdown(/** @type {Array<[string, string]>} */ ([['', t('wg.f.localZone')], ...zones()]), v, (x) => save({ [f.key]: x }), { label }));
    return null;
  }
  /** S / M / L: three ready widths for this widget (it adapts to whichever it gets). */
  function sizeRow() {
    const sizes = WIDGET_KINDS[kind].sizes, cur = effectiveWidth;
    const idx = sizes.reduce((best, w, i) => (Math.abs(w - cur) < Math.abs(sizes[best] - cur) ? i : best), 0);
    return h('div', { class: 'sk-row' }, h('span', { class: 'ty-lbl', text: t('wg.f.size') }),
      h('div', { class: 'segmented', role: 'group', 'aria-label': t('wg.f.size') }, ['S', 'M', 'L'].map((l, i) => h('button', { type: 'button', 'aria-pressed': String(i === idx), onclick: () => setWidth(sizes[i]) }, l))));
  }
  async function setWidth(w) { await updateSettings((s) => { const c = home(s).canvas; if (c && c.items && c.items[id]) c.items[id] = { ...c.items[id], w }; }); effectiveWidth = w; draw(); }

  function draw() {
    const fields = [];
    for (const f of WIDGET_FIELDS[kind] || []) { if (f.when && !f.when(cfg)) continue; fields.push(fieldRow(f)); }
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
    } else if (!(WIDGET_FIELDS[kind] || []).length) fields.push(h('p', { class: 'muted', style: { fontSize: 'var(--fs-sm)' }, text: t('wg.noConfig') }));
    root.replaceChildren(head(widgetName(kind), onClose), sizeRow(), ...fields,
      h('div', { class: 'stack gap-2' }, h('div', { class: 'eyebrow', text: t('sk.title') }), skinControls({ skin, inherit: true, onChange: saveSkin })),
      h('button', { class: 'btn btn-sm wg-del', type: 'button', onclick: onDelete }, icon('trash-2'), t('wg.delete')));
  }
  draw();
  return root;
}
