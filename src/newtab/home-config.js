// Which layout of Home is on, and the helpers every part of the page shares: reading the settings the way the page should see them (the active
// layout over the default) and writing to the right place (the layout being edited, else the active one, else the default).

import { getSettings } from '../shared/storage.js';
import { normalizeLayouts, pickLayout, effectiveHome, homeView, DEFAULT_ID } from '../shared/layouts.js';

let activeId = DEFAULT_ID, editId = null, focusing = false;

export const homeId = () => editId ?? activeId;
export const activeLayoutId = () => activeId;
export const editingLayoutId = () => editId;
/** The layout the editor works on (null = follow whichever is on). Also what the page shows while editing. */
export const setEditId = (id) => { editId = id; };
export const setFocusing = (on) => { focusing = !!on; };

const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

/** The layout that should be on now (ignoring the editor). */
export const wantedLayout = (raw) => pickLayout(normalizeLayouts(raw.newtab.layouts), { focus: focusing, minutes: nowMinutes(), pin: raw.newtab.layoutPin });

/** The settings as the page should see them: `newtab` is the on layout's Home settings over the default's. Remembers which layout that was. */
export function resolveSettings(raw, record = true) {
  const layouts = normalizeLayouts(raw.newtab.layouts);
  const wanted = editId && (editId === DEFAULT_ID || layouts.some((l) => l.id === editId)) ? editId : wantedLayout(raw);
  if (record) activeId = wanted;
  return { ...raw, newtab: effectiveHome(raw.newtab, layouts.find((l) => l.id === wanted)) };
}

/** Use inside updateSettings((s) => …): the Home settings of the layout in use, as an object to read and write. */
export const home = (s) => homeView(s, homeId());

/** Fresh settings, resolved (without changing which layout the page counts as showing). */
export async function effectiveNow() { return resolveSettings(await getSettings(), false); }
