// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The question "may I share anonymous numbers?" It is the only time EyeTime asks for anything, so it is written like a note from a person and not like a consent banner: who asks,
// what for, a few plain promises, the exact report one click away, the privacy details one click away, and an honest "no" that is as easy to give as the "yes" and is kept.
//
// What it will not do, on purpose (consent has to be free, specific and informed; see docs/COMPLIANCE.md): no pre-ticked anything, no guilt in the words of a refusal, no timer, no
// false scarcity, no hidden or disguised refusal, no second layer to say no. "Yes" is the filled button and wider (a hierarchy of look); every way of saying no is a real,
// bordered, readable button of the same height, in the same place, one click.
// It sits in a corner and never takes the focus, so it cannot interrupt typing or a session (the caller does not show it during one).

import { h, icon } from '../../ui/dom.js';
import { t } from '../../shared/i18n.js';
import { enableSharing, declineAsk, deferAsk, previewReport } from '../../shared/usage-store.js';

const ID = 'usageAsk';
const PRIVACY_URL = 'https://maxbzd.github.io/eyetime/privacy.html';

/** "Never sold. Not to advertisers." → the first sentence in bold, the rest plain. */
function promise(/** @type {string} */ ico, /** @type {string} */ text) {
  const m = /^(.+?[.。])\s*(.*)$/s.exec(text);
  return h('li', null, h('span', { class: 'ask-ico', 'aria-hidden': 'true' }, icon(ico)), h('span', null, m && m[2] ? [h('strong', { text: m[1] }), ' ' + m[2]] : text));
}

/**
 * Put the question on the page. `final` is the second and last time (no "Not now"); `variant` is the wording ("long" or "short").
 * Returns false when it is already there.
 */
export function showUsageAsk({ final = false, variant = 'long' } = {}) {
  if (document.getElementById(ID)) return true;
  const short = variant === 'short';
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
  const policy = h('a', { class: 'ask-show', href: PRIVACY_URL, target: '_blank', rel: 'noopener noreferrer' }, icon('shield-check'), h('span', { text: t('us.askPolicy') }));

  const yes = h('button', { class: 'btn btn-primary ask-yes', type: 'button', onclick: async () => {
    const ok = await enableSharing();
    if (!ok) { await declineAsk(); leave(card); return; }
    // the thank-you stays a few seconds and says where the switch is: withdrawing must be as easy as agreeing
    card.replaceChildren(
      h('div', { class: 'ask-badge', 'aria-hidden': 'true' }, icon('check')),
      h('h2', { class: 'ask-title', text: t('us.askThanksT') }),
      h('p', { class: 'ask-lead', text: t('us.thanks') }),
      h('div', { class: 'ask-refuse' }, h('a', { class: 'btn', href: chrome.runtime.getURL('src/options/options.html#data'), target: '_blank', rel: 'noopener' }, t('us.title')), h('button', { class: 'btn', type: 'button', onclick: () => leave(card) }, t('common.close'))));
    setTimeout(() => card.isConnected && leave(card), 9000);
  } }, t('us.askYes'));
  const refuse = h('div', { class: 'ask-refuse' },
    final ? null : h('button', { class: 'btn', type: 'button', onclick: async () => { await deferAsk(); leave(card); } }, t('us.askLater')),
    h('button', { class: 'btn', type: 'button', onclick: async () => { await declineAsk(); leave(card); } }, t('us.askNo')));

  const card = h('aside', { id: ID, class: 'ask', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'usageAskTitle', 'aria-describedby': 'usageAskLead' },
    h('div', { class: 'ask-badge', 'aria-hidden': 'true' }, icon('sprout')),
    h('h2', { id: 'usageAskTitle', class: 'ask-title', text: t('us.askTitle') }),
    h('p', { id: 'usageAskLead', class: 'ask-lead', text: t(short ? 'us.askLeadS' : 'us.askLead') }),
    h('ul', { class: 'ask-promises' }, short ? [promise('ban', t('us.askP1S')), promise('lock', t('us.askP2S'))] : [promise('ban', t('us.askP1')), promise('sprout', t('us.askP2')), promise('lock', t('us.askP3'))]),
    h('p', { class: 'ask-fine', text: t('us.askNote') }),
    h('div', { class: 'ask-actions' }, yes, refuse),
    final && h('p', { class: 'ask-fine ask-last', text: t('us.askLast') }),
    h('div', { class: 'ask-links' }, show, policy), previewNote, preview,
    h('p', { class: 'ask-sign', text: t('us.askSign') }));
  document.body.append(card);
  return true;
}
