// "Ready themes": a picture of each starter and a Surprise me button. One tap changes the look, the background, the clock type, the card style and the widgets of Home
// (the person's photo, links, tasks and data stay); a toast takes it back.

import { h, icon, toast } from '../ui/dom.js';
import { t } from '../shared/i18n.js';
import { STARTERS, starterData, applyStarter, restoreHome, surprise } from '../shared/starters.js';

/** Put a starter on Home and offer to take it back. */
export async function applyStarterWith(set, starter, label) {
  let before = null;
  await set((s) => { before = applyStarter(s, s.newtab, starterData(starter)); });
  toast(t('st.applied', { name: label }), { action: t('common.undo'), onAction: () => set((s) => { restoreHome(s, s.newtab, before); }) });
}

/**
 * @param {{ set: (fn: (s: any) => void) => Promise<any> }} o `set` changes the settings of the Home in use (fn gets `{ ...settings, newtab }`)
 * @returns {HTMLElement}
 */
export function starterGallery({ set }) {
  const apply = (starter, label) => applyStarterWith(set, starter, label);
  const tiles = STARTERS.map((s) => {
    const name = t('st.n.' + s.id);
    return h('button', { class: 'st-tile', type: 'button', 'aria-label': t('st.use', { name }), onclick: () => apply(s, name) },
      h('img', { src: chrome.runtime.getURL(`src/newtab/starters/${s.id}.jpg`), alt: '', width: 480, height: 300 }),
      h('span', { class: 'st-name', text: name }));
  });
  return h('div', { class: 'stack gap-3' },
    h('p', { class: 'muted', style: { fontSize: 'var(--fs-sm)' }, text: t('st.hint') }),
    h('div', { class: 'st-grid' }, tiles),
    h('button', { class: 'btn', type: 'button', onclick: () => apply(surprise(), t('st.surprise')) }, icon('dices'), t('st.surprise')));
}
