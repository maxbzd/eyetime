// Home module: quick links.

import { h, icon, favicon, clear } from '../ui/dom.js';
import { t } from '../shared/i18n.js';
import { updateSettings } from '../shared/storage.js';
import { parseUserDomain } from '../shared/domains.js';
import { card } from './mod-common.js';

/* ---------- quick links ---------- */
export function linksModule(settings) {
  const root = card('links', icon('link'), t('mod.links'));
  const body = h('div', {});
  root.append(body);

  function openAdd() {
    const urlIn = h('input', { class: 'input', placeholder: 'https://example.com', type: 'text', 'aria-label': 'URL', autofocus: true });
    const titleIn = h('input', { class: 'input', placeholder: t('links.titlePh'), maxlength: 24, 'aria-label': t('links.titlePh') });
    const err = h('div', { class: 'hint', style: { color: 'var(--distracting-text)' } });
    const dlg = h('dialog', { class: 'dialog' }, h('form', { method: 'dialog' },
      h('div', { class: 'dialog-body' }, h('h3', { text: t('links.add') }), h('div', { class: 'field' }, h('label', { text: 'URL' }), urlIn), h('div', { class: 'field' }, h('label', { text: t('links.title') }), titleIn), err),
      h('div', { class: 'dialog-actions' }, h('button', { class: 'btn btn-ghost', value: 'no', text: t('common.cancel'), formnovalidate: true }), h('button', { class: 'btn btn-primary', value: 'yes', text: t('common.add'), onclick: async (e) => {
        e.preventDefault();
        let u = urlIn.value.trim(); if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
        const host = parseUserDomain(u);
        if (!host) { err.textContent = t('links.invalid'); return; }
        await updateSettings((s) => { s.newtab.links.push({ url: new URL(u).href, title: (titleIn.value.trim() || host).slice(0, 24) }); });
        dlg.close();
      } }))));
    dlg.addEventListener('close', () => dlg.remove());
    document.body.append(dlg); dlg.showModal();
  }

  function render(s) {
    const links = s.newtab.links;
    clear(body, h('div', { class: 'links' },
      links.map((l, i) => {
        let host = ''; try { host = new URL(l.url).hostname; } catch { /* ignore */ }
        return h('a', { class: 'link', href: l.url }, favicon(host.replace(/^www\./, ''), 'fav'), h('span', { class: 't', text: l.title }),
          h('button', { class: 'x', type: 'button', 'aria-label': t('common.remove'), onclick: async (e) => { e.preventDefault(); e.stopPropagation(); await updateSettings((st) => { st.newtab.links.splice(i, 1); }); } }, icon('x')));
      }),
      h('button', { class: 'link add' + (links.length ? '' : ' alone'), type: 'button', onclick: openAdd }, h('span', { class: 'plus' }, icon('plus')), h('span', { class: 't', text: links.length ? t('links.addShort') : t('links.addFirst') }))));
  }
  render(settings);
  return { el: root, update: render };
}
