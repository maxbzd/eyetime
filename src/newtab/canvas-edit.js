// The Home arrangement editor: frames over every block to drag and resize, snapping guides, a keyboard way to do the same,
// undo / redo, a tray of blocks that are not on the screen and a reset. Loaded only when the user opens it.

import { h, icon, $ } from '../ui/dom.js';
import { dropdown } from '../ui/dropdown.js';
import { t } from '../shared/i18n.js';
import { updateSettings } from '../shared/storage.js';
import { blockMeta, normalizeCanvas, clampCenter, snapRect, nudge, resizeStep, seedItems, canvasScale } from '../shared/canvas.js';
import { WIDGET_ID_RE, WIDGET_KINDS, defaultCfg, newWidgetId } from '../shared/widgets.js';
import { blockEl, presentBlocks, placeBlock, applyCanvas } from './canvas.js';
import { widgetName } from './widgets.js';
import { home, effectiveNow, setEditId, editingLayoutId, activeLayoutId, homeId } from './home-config.js';
import { normalizeLayouts } from '../shared/layouts.js';

const isWidget = (id) => WIDGET_ID_RE.test(id) && id !== 'clock';
const blockName = (id) => (id === 'clock' ? t('cv.clock') : id === 'greeting' ? t('cv.greeting') : id === 'focus' ? t('cv.focus') : isWidget(id) ? widgetName(blockEl(id)?.dataset.kind || 'sticky') : t('mod.' + id));
const clone = (o) => JSON.parse(JSON.stringify(o));
const view = () => ({ w: window.innerWidth, h: window.innerHeight });

let active = null;

/** Open the editor. `settings` is the current settings object; `onExit` runs after it closes. */
/** @param {any} settings @param {{ onExit?: () => void }} [opts] */
export async function startEditing(settings, { onExit } = /** @type {{ onExit?: () => void }} */ ({})) {
  if (active) return;
  if (editingLayoutId() == null) setEditId(activeLayoutId()); // edits go to the layout that is on, and the page stays on it while editing
  const layoutName = (() => { const l = normalizeLayouts(settings.newtab.layouts).find((x) => x.id === homeId()); return l ? l.name : t('ly.default'); })();
  let present = presentBlocks();
  let items = normalizeCanvas(settings.newtab.canvas).items;
  if (!Object.keys(items).length) items = seedItems(present);
  const undo = [], redo = [];

  const layer = h('div', { class: 'cv-layer', role: 'region', 'aria-label': t('cv.edit') });
  const live = h('div', { class: 'cv-live', role: 'status', 'aria-live': 'polite' });
  const guides = [];
  const frames = new Map();

  /* ----- persistence ----- */
  const persist = () => updateSettings((s) => { home(s).canvas = { on: true, items: clone(items) }; });
  const apply = () => { for (const id of present) { if (items[id]) placeBlock(id, items[id]); else { const el = blockEl(id); el?.classList.add('cv-hidden', 'cv-item'); } } };
  const commit = (before) => {
    undo.push(before); if (undo.length > 60) undo.shift(); redo.length = 0;
    persist(); syncBar();
  };

  /* ----- frames ----- */
  const rectOf = (id) => blockEl(id).getBoundingClientRect();
  function syncFrames() {
    for (const [id, f] of frames) {
      const el = blockEl(id);
      if (!items[id] || !el) { f.hidden = true; continue; }
      f.hidden = false;
      const r = el.getBoundingClientRect();
      Object.assign(f.style, { left: r.left - 6 + 'px', top: r.top - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' });
    }
  }
  const raf = () => window.requestAnimationFrame(syncFrames);
  const say = (msg) => { live.textContent = ''; live.textContent = msg; };

  /* ----- the side panel: the type designer (clock, greeting), a widget's settings, or the widget gallery ----- */
  let panel = null, panelKey = null, panelOff = false, panelSeq = 0;
  const closePanel = () => { panel?.destroy?.(); panel?.el.remove(); panel = null; panelKey = null; };
  async function showPanel(key, build) {
    if (key === panelKey && panel) return;
    const seq = ++panelSeq;
    closePanel(); panelKey = key;
    if (!key) return;
    const made = await build();
    if (seq !== panelSeq || !active) { made.destroy?.(); return; } // the selection moved on while the panel was loading
    panel = made; layer.append(made.el);
  }
  const forSelection = (id) => {
    if (id === 'clock' || id === 'greeting') {
      if (panelOff) return showPanel(null);
      const kind = id === 'clock' ? 'clock' : 'text';
      return showPanel('type:' + kind, async () => { const { buildTypePanel } = await import('./type-panel.js'); return { el: await buildTypePanel(kind, { onClose: () => { panelOff = true; closePanel(); } }) }; });
    }
    if (isWidget(id) && blockEl(id)) {
      const kind = blockEl(id).dataset.kind;
      return showPanel('wgt:' + id, async () => { const { buildWidgetPanel } = await import('./widget-panel.js'); return { el: await buildWidgetPanel(id, kind, { onClose: () => closePanel(), onDelete: () => removeBlock(id) }) }; });
    }
    return showPanel(null);
  };
  const openLayouts = () => showPanel('layouts', async () => { const { buildLayoutPanel } = await import('./layout-panel.js'); return { el: await buildLayoutPanel({ onEdit: (id) => switchTo(id), onClose: () => closePanel() }) }; });
  const openGallery = () => showPanel('gallery', async () => { const { buildGallery } = await import('./widget-panel.js'); const g = buildGallery({ onAdd: addWidget, onClose: () => closePanel() }); return g; });

  function select(id) {
    for (const [k, f] of frames) { f.classList.toggle('is-sel', k === id); const el = blockEl(k); if (el) el.style.zIndex = k === id ? '3' : ''; }
    forSelection(id);
  }

  function setItem(id, next, before) {
    items[id] = next; placeBlock(id, next); raf();
    if (before) commit(before);
  }

  function clampItem(id) {
    const r = rectOf(id), c = clampCenter({ x: items[id].x, y: items[id].y }, { w: r.width, h: r.height }, view());
    items[id] = { ...items[id], x: c.x, y: c.y };
  }

  function showGuides(gs) {
    guides.splice(0).forEach((g) => g.remove());
    for (const g of gs) { const el = h('div', { class: 'cv-guide ' + g.axis, style: g.axis === 'x' ? { left: g.at + 'px' } : { top: g.at + 'px' } }); layer.append(el); guides.push(el); }
  }

  function buildFrame(id) {
    const b = blockMeta(id);
    const f = h('div', { class: 'cv-frame', tabindex: 0, role: 'group', 'aria-roledescription': t('cv.movable'), 'aria-label': blockName(id), 'data-block': id },
      h('div', { class: 'cv-tag' }, h('span', { text: blockName(id) }),
        h('button', { class: 'cv-x', type: 'button', 'aria-label': t('cv.remove') + ': ' + blockName(id), onclick: (e) => { e.stopPropagation(); removeBlock(id); } }, icon('x'))),
      h('div', { class: 'cv-handle', role: 'presentation', 'data-tip': t('cv.resize') }));
    f.addEventListener('focus', () => select(id));

    /* drag */
    f.addEventListener('pointerdown', (e) => {
      if (/** @type {Element} */ (e.target).closest('.cv-handle, .cv-x') || e.button !== 0) return;
      e.preventDefault(); f.setPointerCapture(e.pointerId); f.classList.add('is-drag'); select(id); f.focus({ preventScroll: true });
      const r0 = rectOf(id), v = view(), start = { x: e.clientX, y: e.clientY }, base = clone(items[id]), before = clone(items);
      const others = [...frames.keys()].filter((k) => k !== id && items[k]).map((k) => { const r = rectOf(k); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
      const move = (ev) => {
        let x = r0.left + ev.clientX - start.x, y = r0.top + ev.clientY - start.y;
        const snap = ev.altKey ? { dx: 0, dy: 0, guides: [] } : snapRect({ x, y, w: r0.width, h: r0.height }, others, v);
        x += snap.dx; y += snap.dy;
        const c = clampCenter({ x: (x + r0.width / 2) / v.w * 100, y: (y + r0.height / 2) / v.h * 100 }, { w: r0.width, h: r0.height }, v);
        items[id] = { ...base, x: Math.round(c.x * 100) / 100, y: Math.round(c.y * 100) / 100 };
        placeBlock(id, items[id]); showGuides(snap.guides); syncFrames();
      };
      const up = () => {
        f.removeEventListener('pointermove', move); f.removeEventListener('pointerup', up); f.removeEventListener('pointercancel', up);
        f.classList.remove('is-drag'); showGuides([]);
        if (items[id].x !== base.x || items[id].y !== base.y) commit(before);
      };
      f.addEventListener('pointermove', move); f.addEventListener('pointerup', up); f.addEventListener('pointercancel', up);
    });

    /* resize: the distance (text) or the half-width (card) from the block's centre sets the new size */
    const handle = f.querySelector('.cv-handle');
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation(); handle.setPointerCapture(e.pointerId); select(id);
      const r0 = rectOf(id), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2, base = clone(items[id]), before = clone(items);
      const d0 = Math.max(10, Math.hypot(e.clientX - cx, e.clientY - cy)), dx0 = Math.max(10, Math.abs(e.clientX - cx));
      const move = (ev) => {
        const next = { ...base };
        if (b.kind === 'text') next.s = Math.min(b.max, Math.max(b.min, Math.round((base.s ?? b.def) * Math.hypot(ev.clientX - cx, ev.clientY - cy) / d0 * 100) / 100));
        else next.w = Math.round(Math.min(b.max, Math.max(b.min, (base.w ?? b.def) * Math.max(10, Math.abs(ev.clientX - cx)) / dx0)));
        items[id] = next; placeBlock(id, next); clampItem(id); placeBlock(id, items[id]); syncFrames();
      };
      const up = () => {
        handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up);
        commit(before);
      };
      handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
    });

    /* keyboard */
    f.addEventListener('keydown', (e) => {
      const k = e.key, before = clone(items), big = e.shiftKey;
      const dirs = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
      if (dirs[k]) { e.preventDefault(); items[id] = nudge(items[id], dirs[k], big); clampItem(id); setItem(id, items[id], before); say(blockName(id) + ': ' + Math.round(items[id].x) + '%, ' + Math.round(items[id].y) + '%'); }
      else if (k === '+' || k === '=' || k === '-' || k === '_') { e.preventDefault(); setItem(id, resizeStep(id, items[id], k === '+' || k === '=' ? 1 : -1, big), before); clampItem(id); placeBlock(id, items[id]); persist(); }
      else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); removeBlock(id); }
    });
    return f;
  }

  function removeBlock(id) {
    if (isWidget(id)) { removeWidget(id); return; }
    const before = clone(items); delete items[id]; apply(); syncFrames(); commit(before); syncTray(); say(blockName(id) + ': ' + t('cv.remove'));
    $('.cv-bar select, .cv-bar .dd', layer)?.focus();
  }
  /** A widget is deleted for good (its settings go with it); the other blocks only leave the screen. */
  async function removeWidget(id) {
    const name = blockName(id);
    delete items[id]; frames.get(id)?.remove(); frames.delete(id); present = present.filter((x) => x !== id);
    if (panelKey === 'wgt:' + id) closePanel();
    await updateSettings((s) => { const hv = home(s); hv.widgets = (hv.widgets || []).filter((w) => w.id !== id); hv.canvas = { on: true, items: clone(items) }; });
    syncTray(); say(name + ': ' + t('wg.delete')); $('.cv-bar .dd', layer)?.focus();
  }
  async function addWidget(kind) {
    const b = WIDGET_KINDS[kind];
    const id = newWidgetId((await effectiveNow()).newtab.widgets);
    items[id] = normalizeCanvas({ on: true, items: { [id]: { x: 50, y: 50, w: b.w[2] } } }).items[id];
    await updateSettings((s) => { const hv = home(s); hv.widgets = [...(hv.widgets || []), { id, kind, cfg: defaultCfg(kind) }]; hv.canvas = { on: true, items: clone(items) }; });
    for (let i = 0; i < 40 && !blockEl(id); i++) await new Promise((r) => setTimeout(r, 50)); // the page builds the card when the settings arrive
    if (!blockEl(id) || !active) return;
    present = presentBlocks(); placeBlock(id, items[id]); clampItem(id); placeBlock(id, items[id]);
    const f = buildFrame(id); frames.set(id, f); layer.append(f); syncFrames(); raf();
    closePanel(); f.focus({ preventScroll: true }); persist();
  }
  function addBlock(id) {
    if (items[id]) return;
    const before = clone(items), b = blockMeta(id);
    items[id] = normalizeCanvas({ on: true, items: { [id]: { x: 50, y: 50, [b.kind === 'text' ? 's' : 'w']: b.def } } }).items[id];
    apply(); clampItem(id); placeBlock(id, items[id]); raf(); commit(before); syncTray();
    frames.get(id)?.focus({ preventScroll: true });
  }

  /* ----- toolbar ----- */
  const btnUndo = h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': t('cv.undo'), 'data-tip': t('cv.undo'), onclick: () => step(undo, redo) }, icon('undo-2'));
  const btnRedo = h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': t('cv.redo'), 'data-tip': t('cv.redo'), onclick: () => step(redo, undo) }, icon('redo-2'));
  const addHolder = h('span', {});
  const bar = h('div', { class: 'cv-bar', role: 'toolbar', 'aria-label': t('cv.edit') },
    h('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'data-tip': t('ly.title'), onclick: openLayouts }, icon('layers'), h('span', { class: 'cv-layername', text: layoutName })), h('span', { class: 'sep' }),
    btnUndo, btnRedo, h('span', { class: 'sep' }), addHolder,
    h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: openGallery }, icon('shapes'), t('wg.title')), h('span', { class: 'sep' }),
    h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { panelOff = false; closePanel(); const sel = frames.get('clock')?.classList.contains('is-sel') ? 'clock' : frames.get('greeting')?.classList.contains('is-sel') ? 'greeting' : 'clock'; select(sel); frames.get(sel)?.focus({ preventScroll: true }); } }, icon('type'), t('ty.title')),
    h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: reset }, icon('rotate-ccw'), t('cv.reset')),
    h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: useLook }, icon('layout-grid'), t('cv.off')),
    h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => stop() }, icon('check'), t('cv.done')));

  function syncBar() { btnUndo.disabled = !undo.length; btnRedo.disabled = !redo.length; }
  function syncTray() {
    const tray = present.filter((id) => !items[id]);
    const opts = /** @type {Array<[string, string]>} */ ([['', tray.length ? t('cv.add') : t('cv.trayEmpty')], ...tray.map((id) => [id, blockName(id)])]);
    const dd = dropdown(opts, '', (v) => { if (v) addBlock(v); }, { label: t('cv.add'), cls: 'select-sm' });
    if (!tray.length) dd.disabled = true;
    addHolder.replaceChildren(dd);
  }
  function step(from, to) {
    const prev = from.pop(); if (!prev) return;
    to.push(clone(items)); items = prev; apply(); raf(); persist(); syncBar(); syncTray();
  }
  function reset() {
    const before = clone(items); const keep = Object.fromEntries(Object.entries(items).filter(([id]) => isWidget(id))); items = { ...seedItems(present), ...keep }; apply(); raf(); commit(before); syncTray();
  }
  async function useLook() {
    await updateSettings((s) => { home(s).canvas = { on: false, items: clone(items) }; });
    stop(true);
  }

  /* ----- start / stop ----- */
  const onResize = () => { applyLayout(); raf(); };
  const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.dd-pop:popover-open')) { e.preventDefault(); stop(); } };
  function applyLayout() {
    for (const id of present) if (items[id]) { placeBlock(id, items[id], canvasScale(window.innerWidth)); }
  }
  /** Work on another layout: close this editor and open a new one on it (the page shows that layout meanwhile). */
  async function switchTo(id) {
    setEditId(id);
    const next = await effectiveNow();
    await stop(true, true);
    await startEditing(next, { onExit });
  }
  async function stop(skipSave, keepTarget) {
    if (!active) return;
    window.removeEventListener('resize', onResize); document.removeEventListener('keydown', onKey, true);
    closePanel(); layer.remove();
    document.body.classList.remove('cv-editing'); $('main.nt')?.removeAttribute('inert');
    for (const id of present) { const el = blockEl(id); if (el) el.style.zIndex = ''; }
    active = null;
    if (!skipSave) await persist();
    if (!keepTarget) setEditId(null); // the page follows the triggers again
    onExit?.();
  }

  const hint = h('div', { class: 'cv-hint', text: t('cv.hint') });
  setTimeout(() => { hint.style.transition = 'opacity .6s'; hint.style.opacity = '0'; hint.style.pointerEvents = 'none'; }, 9000);
  document.body.classList.add('cv-editing');
  $('main.nt')?.setAttribute('inert', '');
  await persist(); // turns the arrangement on (page code re-applies it) and keeps the first seed
  apply();
  for (const id of present) { const f = buildFrame(id); frames.set(id, f); layer.append(f); }
  layer.append(hint, bar, live);
  document.body.append(layer);
  syncBar(); syncTray(); syncFrames();
  window.addEventListener('resize', onResize); document.addEventListener('keydown', onKey, true);
  active = { stop };
  const first = [...frames.values()].find((f) => !f.hidden);
  first?.focus({ preventScroll: true });
  window.requestAnimationFrame(() => window.requestAnimationFrame(syncFrames));
}

export const isEditing = () => !!active;
export { applyCanvas };
