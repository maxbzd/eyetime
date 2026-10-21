// "What's new" card on Home: three short lines about the release you just got. Set by the worker on a minor update; one click dismisses it for good.

import { h, icon, clear } from '../ui/dom.js';
import { t } from '../shared/i18n.js';
import { getRaw, setRaw, onChange } from '../shared/storage.js';
import { WN_ITEMS, RELEASES_URL } from '../shared/whatsnew.js';

export async function mountWhatsNew(el) {
  async function paint() {
    const { whatsNew } = await getRaw('whatsNew');
    if (!whatsNew || !whatsNew.version) { el.hidden = true; return; }
    el.hidden = false;
    clear(el,
      h('div', { class: 'wn-head' }, icon('sparkles'), h('h2', { id: 'wnTitle', text: t('wn.title', { v: whatsNew.version }) }),
        h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': t('wn.ok'), 'data-tip': t('wn.ok'), onclick: async () => { await setRaw({ whatsNew: null }); el.hidden = true; } }, icon('x'))),
      h('ul', { class: 'wn-list' }, WN_ITEMS.map((k) => h('li', { text: t(k) }))),
      h('div', { class: 'row gap-2' },
        h('a', { class: 'btn btn-sm', href: `${RELEASES_URL}/tag/v${whatsNew.version}`, target: '_blank', rel: 'noopener', text: t('wn.more') }),
        h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: async () => { await setRaw({ whatsNew: null }); el.hidden = true; }, text: t('wn.ok') })));
  }
  await paint();
  onChange('whatsNew', paint);
}
