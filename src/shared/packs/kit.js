// Small helpers for writing theme packs (data only): they return plain nodes of the scene language.

export const text = (x, y, size, t, o = {}) => ({ t: 'text', x, y, size, text: t, ...o });
export const rect = (x, y, w, h, fill, o = {}) => ({ t: 'rect', x, y, w, h, fill, ...o });
export const ellipse = (x, y, w, h, fill, o = {}) => ({ t: 'ellipse', x, y, w, h, fill, ...o });
export const group = (children, o = {}) => ({ t: 'group', children, ...o });
export const full = (fill, o = {}) => rect(0, 0, '=W', '=H', fill, o);
export const grad = (a, ...stops) => ({ g: 'linear', a, stops });
export const radial = (cx, cy, r, ...stops) => ({ g: 'radial', cx, cy, r, stops });
/** Widgets of a pack: { id, kind: 'custom', cfg: { ui } } and where they sit. */
let seq = 0;
export const customWidget = (ui, params = {}) => ({ id: 'wpk' + String(++seq).padStart(3, '0'), kind: 'custom', cfg: { ui, params } });
