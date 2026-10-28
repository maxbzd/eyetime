// The free-form Home: where every block sits when the user arranges the new tab by hand.
// Pure functions only (no DOM), so the geometry can be unit-tested: validation, keeping a block on screen, snapping to guides, nudging.
//
// A block is placed by its centre in percent of the window (x, y) and sized either by a scale (text blocks: the clock, the greeting)
// or by a width in px (cards: they reflow inside it); `z` is its place in the stack when blocks overlap (higher is in front). A text block can also be stretched: `s` is its height scale, `sx` its width scale (absent = the same as `s`). Percent positions keep the arrangement sensible at any window size.

/** @typedef {{ x: number, y: number, s?: number, sx?: number, w?: number, z?: number }} CanvasItem */
/** @typedef {{ on: boolean, items: Record<string, CanvasItem> }} Canvas */
/** @typedef {{ x: number, y: number, w: number, h: number }} Rect */

/** The blocks that can be moved. `text` blocks scale, `card` blocks change width. */
export const CANVAS_BLOCKS = {
  clock:    { kind: 'text', min: 0.4, max: 3, def: 1 },
  greeting: { kind: 'text', min: 0.5, max: 2.5, def: 1 },
  quote:    { kind: 'text', min: 0.5, max: 2, def: 1 },
  focus:    { kind: 'card', min: 320, max: 1000, def: 760 },
  today:    { kind: 'card', min: 260, max: 640, def: 340 },
  tasks:    { kind: 'card', min: 300, max: 900, def: 480 },
  habits:   { kind: 'card', min: 260, max: 640, def: 340 },
  notes:    { kind: 'card', min: 260, max: 640, def: 340 },
  links:    { kind: 'card', min: 260, max: 760, def: 340 },
};
export const CANVAS_IDS = Object.keys(CANVAS_BLOCKS);
/** Widgets (shared/widgets.js) are cards with ids like `w3k9x0a`; their limits are generic here, the widget catalogue gives each its own default width. */
const WIDGET_ID = /^w[0-9a-z]{4,10}$/;
const WIDGET_BLOCK = { kind: 'card', min: 160, max: 900, def: 300 };
export const blockMeta = (id) => CANVAS_BLOCKS[id] || (WIDGET_ID.test(id) ? WIDGET_BLOCK : null);
/** Below this window width the arrangement is not applied (the normal stacked layout is used). */
export const CANVAS_MIN_WIDTH = 1100;

export const Z_DEFAULT = 2, Z_MAX = 99;
const num = (v, lo, hi, fallback) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
const r2 = (n) => Math.round(n * 100) / 100;
/** The range of the horizontal scale of a text block: wider than its height range, so a time can be pulled long or squeezed narrow. */
export const stretchRange = (b) => [r2(b.min * 0.4), r2(b.max * 2.5)];

/** Validate a saved canvas: unknown blocks are dropped, numbers are clamped, nothing can break the page. */
export function normalizeCanvas(c) {
  const out = { on: false, items: {} };
  if (!c || typeof c !== 'object') return out;
  out.on = c.on === true;
  const items = c.items && typeof c.items === 'object' ? c.items : {};
  for (const id of Object.keys(items)) {
    const it = items[id], b = blockMeta(id);
    if (!b || !it || typeof it !== 'object') continue;
    const x = num(it.x, 0, 100, null), y = num(it.y, 0, 100, null);
    if (x === null || y === null) continue;
    const item = { x: r2(x), y: r2(y) };
    if (b.kind === 'text') {
      item.s = r2(num(it.s, b.min, b.max, b.def));
      const [lo, hi] = stretchRange(b), sx = r2(num(it.sx, lo, hi, item.s));
      if (Math.abs(sx - item.s) > 0.005) item.sx = sx;
    } else item.w = Math.round(num(it.w, b.min, b.max, b.def));
    if (typeof it.z === 'number' && Number.isFinite(it.z)) item.z = Math.round(Math.min(Z_MAX, Math.max(0, it.z)));
    out.items[id] = item;
  }
  return out;
}

/** Keep a block's centre (percent) so the whole block stays inside the window with a margin (px). A block larger than the window is centred. */
export function clampCenter(center, size, view, margin = 12) {
  const fit = (c, s, v) => {
    const lo = (s / 2 + margin) / v * 100, hi = 100 - lo;
    return lo > hi ? 50 : Math.min(hi, Math.max(lo, c));
  };
  return { x: fit(center.x, size.w, view.w), y: fit(center.y, size.h, view.h) };
}

/**
 * Snap a dragged block (px rect) to the window's centre lines and to the edges / centres of other blocks.
 * Returns how far to move it and the guide lines to draw.
 * @param {Rect} rect @param {Rect[]} others @param {{ w: number, h: number }} view
 */
export function snapRect(rect, others, view, threshold = 8) {
  const xs = [0, view.w / 2, view.w], ys = [0, view.h / 2, view.h];
  for (const o of others) { xs.push(o.x, o.x + o.w / 2, o.x + o.w); ys.push(o.y, o.y + o.h / 2, o.y + o.h); }
  const best = (edges, targets) => {
    let pick = null;
    for (const e of edges) for (const t of targets) {
      const d = t - e;
      if (Math.abs(d) <= threshold && (!pick || Math.abs(d) < Math.abs(pick.d))) pick = { d, at: t };
    }
    return pick;
  };
  const bx = best([rect.x, rect.x + rect.w / 2, rect.x + rect.w], xs);
  const by = best([rect.y, rect.y + rect.h / 2, rect.y + rect.h], ys);
  const guides = [];
  if (bx) guides.push({ axis: 'x', at: bx.at });
  if (by) guides.push({ axis: 'y', at: by.at });
  return { dx: bx ? bx.d : 0, dy: by ? by.d : 0, guides };
}

/** Move by a step (percent) in a direction ('left' | 'right' | 'up' | 'down'); `big` moves five times as far. */
export function nudge(item, dir, big = false) {
  const step = big ? 5 : 1;
  const d = { left: [-step, 0], right: [step, 0], up: [0, -step], down: [0, step] }[dir];
  if (!d) return item;
  return { ...item, x: r2(Math.min(100, Math.max(0, item.x + d[0]))), y: r2(Math.min(100, Math.max(0, item.y + d[1]))) };
}

/** Change the size by one step: a scale (text blocks) or a width (cards). `dir` is +1 or -1. */
export function resizeStep(id, item, dir, big = false) {
  const b = blockMeta(id);
  if (!b) return item;
  if (b.kind === 'text') {
    const s0 = item.s ?? b.def, s = r2(num(s0 + dir * (big ? 0.2 : 0.05), b.min, b.max, b.def));
    const out = { ...item, s };
    if (item.sx) out.sx = r2(num(item.sx * s / s0, ...stretchRange(b), s)); // a stretched block keeps its proportions
    return out;
  }
  return { ...item, w: Math.round(num((item.w ?? b.def) + dir * (big ? 80 : 20), b.min, b.max, b.def)) };
}

/** Stretch a text block along one axis with the arrow keys (`axis` 'x' = width, 'y' = height). */
export function stretchStep(id, item, axis, dir, big = false) {
  const b = blockMeta(id);
  if (!b || b.kind !== 'text') return item;
  const d = dir * (big ? 0.2 : 0.05), [lo, hi] = stretchRange(b);
  if (axis === 'x') { const sx = r2(num((item.sx ?? item.s ?? b.def) + d, lo, hi, b.def)); const out = { ...item, sx }; if (Math.abs(sx - (item.s ?? b.def)) <= 0.005) delete out.sx; return out; }
  const s = r2(num((item.s ?? b.def) + d, b.min, b.max, b.def)), out = { ...item, s };
  if (!item.sx) out.sx = item.s ?? b.def; // keep the width where it was
  if (Math.abs(out.sx - s) <= 0.005) delete out.sx;
  return out;
}

/**
 * Pull one handle of a text block (like resizing a picture): the opposite edge or corner stays put, the pointer decides the new size.
 * `h` = { dx, dy } says which side the handle is on (-1 left/top, 0 middle, 1 right/bottom); `rect` is the block as drawn now (px), `item` its saved values,
 * `k` the window factor, `p` the pointer (px). A corner stretches both ways unless `keep` holds the proportions.
 * Returns the new item (x/y as percent of `view`).
 */
export function stretchDrag(id, item, h, rect, k, p, view, keep = false) {
  const b = blockMeta(id), [lo, hi] = stretchRange(b);
  const sx0 = item.sx ?? item.s ?? b.def, sy0 = item.s ?? b.def;
  const nat = { w: rect.w / (sx0 * k), h: rect.h / (sy0 * k) };
  const ax = h.dx > 0 ? rect.x : h.dx < 0 ? rect.x + rect.w : rect.x + rect.w / 2;
  const ay = h.dy > 0 ? rect.y : h.dy < 0 ? rect.y + rect.h : rect.y + rect.h / 2;
  let w = h.dx ? Math.max(8, (p.x - ax) * h.dx) : rect.w, hh = h.dy ? Math.max(8, (p.y - ay) * h.dy) : rect.h;
  if (keep && h.dx && h.dy) { const f = Math.max(w / rect.w, hh / rect.h); w = rect.w * f; hh = rect.h * f; }
  const sx = num(w / (nat.w * k), lo, hi, sx0), s = num(hh / (nat.h * k), b.min, b.max, sy0);
  const W = nat.w * sx * k, H = nat.h * s * k;
  const cx = h.dx ? ax + h.dx * W / 2 : ax, cy = h.dy ? ay + h.dy * H / 2 : ay;
  const out = { x: r2(cx / view.w * 100), y: r2(cy / view.h * 100), s: r2(s) };
  if (Math.abs(sx - s) > 0.005) out.sx = r2(sx);
  return out;
}

/** Convert a measured rect (px) of a block into a saved item, given the window size. */
export function itemFromRect(id, rect, view, scale = 1) {
  const b = blockMeta(id);
  const item = { x: r2((rect.x + rect.w / 2) / view.w * 100), y: r2((rect.y + rect.h / 2) / view.h * 100) };
  if (b.kind === 'text') item.s = r2(num(scale, b.min, b.max, b.def));
  else item.w = Math.round(num(rect.w, b.min, b.max, b.def));
  return item;
}

/** Window width the stored sizes refer to; on other widths sizes are scaled so an arrangement looks the same everywhere. */
export const CANVAS_REF_WIDTH = 1440;
export const canvasScale = (viewWidth) => r2(Math.min(1.35, Math.max(0.8, viewWidth / CANVAS_REF_WIDTH)));

/** A sensible first arrangement for the blocks that exist: the clock and greeting on top, focus in the middle, today and tasks beside it. */
export function seedItems(present) {
  const all = {
    clock: { x: 50, y: 17, s: 1 }, greeting: { x: 50, y: 31, s: 1 }, focus: { x: 50, y: 63, w: 640 },
    today: { x: 14, y: 58, w: 290 }, tasks: { x: 86, y: 58, w: 330 },
  };
  const items = {};
  for (const id of Object.keys(all)) if (!present || present.includes(id)) items[id] = all[id];
  return normalizeCanvas({ on: true, items }).items;
}

/** Put one block in front of or behind all the others. Every block gets an explicit place, in the order it had (ties follow `tie`). */
export function reorder(items, id, where, tie = []) {
  const pos = (k) => { const i = tie.indexOf(k); return i < 0 ? tie.length : i; }; // blocks without an explicit place stack as they do on the page (`tie` lists them back to front)
  const ids = Object.keys(items).sort((a, b) => (items[a].z ?? Z_DEFAULT) - (items[b].z ?? Z_DEFAULT) || pos(a) - pos(b));
  const rest = ids.filter((k) => k !== id);
  const order = where === 'front' ? [...rest, id] : [id, ...rest];
  const out = {};
  for (const k of Object.keys(items)) out[k] = { ...items[k], z: Math.min(Z_MAX, Z_DEFAULT + order.indexOf(k)) };
  return out;
}

/** Flush a block with an edge of the window or centre it. `size` is the block as drawn (px), `how` is left | hcenter | right | top | vcenter | bottom. */
export function alignItem(item, how, size, view, margin = 16) {
  const lo = (s, v) => r2((s / 2 + margin) / v * 100);
  switch (how) {
    case 'left': return { ...item, x: lo(size.w, view.w) };
    case 'right': return { ...item, x: r2(100 - lo(size.w, view.w)) };
    case 'hcenter': return { ...item, x: 50 };
    case 'top': return { ...item, y: lo(size.h, view.h) };
    case 'bottom': return { ...item, y: r2(100 - lo(size.h, view.h)) };
    case 'vcenter': return { ...item, y: 50 };
    default: return item;
  }
}

/** The size a person types: a text block's scale in percent (100 = normal), a card's width in px. */
export function sizeValue(id, item) {
  const b = blockMeta(id);
  return b.kind === 'text' ? Math.round((item.s ?? b.def) * 100) : Math.round(item.w ?? b.def);
}
/** Set that size (the same units) keeping a stretched block's proportions; out-of-range values are clamped. */
export function withSize(id, item, value) {
  const b = blockMeta(id);
  if (!Number.isFinite(value)) return item;
  if (b.kind === 'text') {
    const s0 = item.s ?? b.def, s = r2(num(value / 100, b.min, b.max, b.def)), out = { ...item, s };
    if (item.sx) out.sx = r2(num(item.sx * s / s0, ...stretchRange(b), s));
    return out;
  }
  return { ...item, w: Math.round(num(value, b.min, b.max, b.def)) };
}
