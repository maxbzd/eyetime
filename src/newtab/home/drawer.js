// The customize drawer (ready themes, the rows of Home, a way to the editor) and the arrangement editor it opens.

import { $, h, icon, clear, toast } from '../../ui/dom.js';
import { t } from '../../shared/i18n.js';
import { updateSettings } from '../../shared/storage.js';
import { starterGallery } from '../starter-panel.js';
import { homeRows } from '../home-rows.js';
import { home } from '../home-config.js';
import { checkLayout } from './layout-watch.js';
import { state } from './state.js';

export function openDrawer() {
  $('#drawer').hidden = false; $('#scrim').hidden = false; drawDrawer(); $('#drawerClose').focus();
}
/** The arrangement editor (loaded on demand): drag, resize and hide the blocks of Home. */
export async function openEditor() {
  if (window.innerWidth < 1100) { toast(t('cv.tooNarrow')); return; }
  $('#drawer').hidden = true; $('#scrim').hidden = true;
  if (state.todayOn) { // the editor arranges the classic blocks: Today hands over to "Centered" first
    await updateSettings((s) => { home(s).layout = 'center'; });
    for (let i = 0; i < 80 && state.todayOn; i++) await new Promise((r) => setTimeout(r, 50)); // the page switches in place
    if (state.todayOn) return;
  }
  const { startEditing } = await import('../canvas-edit.js');
  await startEditing(state.settings, { onExit: () => { checkLayout(); $('#customize').focus(); } });
}
export function closeDrawer() { $('#drawer').hidden = true; $('#scrim').hidden = true; $('#customize').focus(); }

export function drawDrawer() {
  const body = $('#drawerBody'), n = state.settings.newtab;
  const set = (fn) => updateSettings((s) => { fn({ ...s, newtab: home(s) }); }); // edits go to the layout in use
  const section = (title, ...kids) => h('div', {}, h('h4', { text: title }), ...kids);
  const top = body.scrollTop;
  clear(body,
    section(t('st.title'), starterGallery({ set })),
    h('button', { class: 'btn btn-primary', type: 'button', onclick: openEditor }, icon('move'), t('cv.edit')),
    section(t('hr.title'), homeRows({ settings: state.settings, n, set, redraw: drawDrawer, openEditor })),
    h('a', { class: 'btn', href: chrome.runtime.getURL('src/options/options.html#appearance') }, icon('palette'), t('home.moreAppearance')));
  body.scrollTop = top;
}

/** Escape closes the drawer and Tab stays inside it while it is open (called once, when the page boots). */
export function installDrawer() {
  $('#customize').addEventListener('click', openDrawer);
  $('#drawerClose').addEventListener('click', closeDrawer);
  $('#scrim').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => {
    if ($('#drawer').hidden) return;
    if (e.key === 'Escape') { closeDrawer(); return; }
    if (e.key !== 'Tab') return; // keep keyboard focus inside the open drawer
    const f = [...$('#drawer').querySelectorAll('button, input, a[href], select')].filter((el) => !el.disabled && el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}
