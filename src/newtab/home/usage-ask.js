// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The one-time question "may I share anonymous usage numbers?" It is the only time EyeTime asks for anything, so it is written like a note from a person and not like a
// consent banner: what is asked, three plain promises, the exact report one click away, and an honest "no" that is never asked about again.
// It sits in a corner and never takes the focus, so it cannot interrupt typing or a session (the caller does not show it during one).

import { h, icon, toast } from '../../ui/dom.js';
import { t } from '../../shared/i18n.js';
import { enableSharing, declineAsk, previewReport } from '../../shared/usage-store.js';

const ID = 'usageAsk';

/** "Never sold. Not to advertisers." → the first sentence in bold, the rest plain. */
function promise(/** @type {string} */ ico, /** @type {string} */ text) {
  const m = /^(.+?[.。])\s*(.*)$/s.exec(text);
  return h('li', null, h('span', { class: 'ask-ico', 'aria-hidden': 'true' }, icon(ico)), h('span', null, m ? [h('strong', { text: m[1] }), ' ' + m[2]] : text));
}

/** Put the question on the page. Returns false when it is already there. */
export function showUsageAsk() {
  if (document.getElementById(ID)) return true;
  const leave = (/** @type {HTMLElement} */ el) => { el.classList.add('leaving'); setTimeout(() => el.remove(), 260); };
  const preview = h('pre', { class: 'ask-preview', hidden: true, tabindex: '0', 'aria-label': t('us.previewNote') });
  const previewNote = h('p', { class: 'ask-fine', hidden: true, text: t('us.previewNote') });
  const show = h('button', { class: 'ask-show', type: 'button', 'aria-expanded': 'false' }, icon('eye'), h('span', { text: t('us.askShow') }), icon('chevron-down'));
  show.addEventListener('click', async () => {
    const open = show.getAttribute('aria-expanded') !== 'true';
    show.setAttribute('aria-expanded', String(open));
    show.querySelector('span').textContent = t(open ? 'us.askHide' : 'us.askShow');
    if (open && !preview.textContent) preview.textContent = (await previewReport()).text;
    preview.hidden = previewNote.hidden = !open;
  });
  const card = h('aside', { id: ID, class: 'ask', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'usageAskTitle', 'aria-describedby': 'usageAskLead' },
    h('div', { class: 'ask-badge', 'aria-hidden': 'true' }, icon('sprout')),
    h('h2', { id: 'usageAskTitle', class: 'ask-title', text: t('us.askTitle') }),
    h('p', { id: 'usageAskLead', class: 'ask-lead', text: t('us.askLead') }),
    h('ul', { class: 'ask-promises' }, promise('ban', t('us.askP1')), promise('sprout', t('us.askP2')), promise('lock', t('us.askP3'))),
    h('p', { class: 'ask-fine', text: t('us.askNote') }),
    h('div', { class: 'ask-actions' },
      h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => { const ok = await enableSharing(); leave(card); if (ok) toast(t('us.thanks')); else await declineAsk(); } }, t('us.askYes')),
      h('button', { class: 'btn', type: 'button', onclick: async () => { await declineAsk(); leave(card); toast(t('us.askBye')); } }, t('us.askNo'))),
    show, previewNote, preview,
    h('p', { class: 'ask-sign', text: t('us.askSign') }));
  document.body.append(card);
  return true;
}
