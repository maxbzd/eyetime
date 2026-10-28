// Settings → General → Unknown sites (experimental): turn on the on-device model for sites that are in no list; shows whether this browser can run it.

import { h, icon } from '../ui/dom.js';
import { row, group, toggle } from './ui.js';
import { t } from '../shared/i18n.js';
import { modelState, prepareModel } from '../ui/siteai.js';
import { loadGuess, forgetGuess } from '../shared/guessstore.js';

export function siteAiGroup(s, save, refresh) {
  const on = !!(s.smartSites && s.smartSites.on);
  const status = h('div', { class: 'setting-desc', role: 'status', 'aria-live': 'polite' });
  const action = h('div', { class: 'row gap-2 wrap' });
  async function paint() {
    const st = await modelState();
    action.replaceChildren();
    if (st === 'available') {
      const n = Object.keys(await loadGuess()).length;
      status.textContent = t('sg.ready') + (n ? ' ' + t('sg.count', { n }) : '');
      if (n) action.append(h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: async () => { await forgetGuess(); paint(); } }, icon('x'), t('sg.forget')));
    } else if (st === 'downloadable') {
      status.textContent = t('sg.downloadable');
      action.append(h('button', { class: 'btn btn-sm', type: 'button', onclick: async (e) => {
        const btn = e.currentTarget; btn.disabled = true;
        try { await prepareModel((f) => { status.textContent = t('sg.downloading', { n: Math.round(f * 100) }); }); } catch { status.textContent = t('sg.err'); btn.disabled = false; return; }
        paint();
      } }, icon('download'), t('sg.prepare')));
    } else if (st === 'downloading') { status.textContent = t('sg.downloading', { n: '…' }); setTimeout(paint, 3000); }
    else status.textContent = st === 'unavailable' ? t('sg.unavailable') : t('sg.none');
  }
  if (on) paint();
  return group(t('sg.title'),
    row({ title: t('sg.on'), desc: t('sg.desc'), control: toggle(on, (v) => save((x) => { x.smartSites = { on: v }; }, true), t('sg.on')) }),
    on ? row({ title: '', stack: true, control: h('div', { class: 'stack gap-2' }, status, action) }) : null);
}
