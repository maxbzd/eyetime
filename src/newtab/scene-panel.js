// Side panels of the Home editor for what is behind and around the blocks: the scene ("Background": scenery, photo and its cut-out, depth)
// and the look ("Look": the look gallery, accent, clock format, greeting). They use the same controls as the customize drawer.

import { h, icon } from '../ui/dom.js';
import { t } from '../shared/i18n.js';
import { updateSettings } from '../shared/storage.js';
import { home, effectiveNow } from './home-config.js';
import { skinControls } from './skin-panel.js';
import { backgroundControls, depthControls, lookControls, accentControls, clockFormatControls } from './home-controls.js';

/**
 * @param {'scene' | 'look'} kind
 * @param {{ onClose: () => void }} o
 * @returns {Promise<HTMLElement>}
 */
export async function buildScenePanel(kind, { onClose }) {
  const root = h('section', { class: 'cv-panel', 'aria-label': kind === 'scene' ? t('home.background') : t('ap.looks') });
  const section = (title, ...kids) => h('div', { class: 'stack gap-2' }, h('div', { class: 'eyebrow', text: title }), ...kids);

  /** Draw from fresh settings; a change redraws the panel in place (keeping the scroll position). */
  async function draw() {
    const s = await effectiveNow(), n = s.newtab, top = root.scrollTop;
    const set = async (fn) => { await updateSettings((x) => { fn({ ...x, newtab: home(x) }); }); await draw(); };
    root.replaceChildren(...[
      h('div', { class: 'ty-head' }, h('h3', { text: kind === 'scene' ? t('home.background') : t('ap.looks') }),
        h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': t('common.close'), onclick: onClose }, icon('x'))),
      ...(kind === 'scene'
        ? [...backgroundControls(n, set), section(t('dp.title'), ...depthControls(n, set))]
        : [section(t('ap.looks'), ...lookControls(s, set)), section(t('sk.cards'), skinControls({ skin: n.dna, onChange: (v) => set((x) => { x.newtab.dna = v || { s: 'look' }; }) })), section(t('home.accent'), ...accentControls(s, set)), section(t('home.clock'), ...clockFormatControls(n, set))]),
    ].filter(Boolean));
    root.scrollTop = top;
  }
  await draw();
  return root;
}
