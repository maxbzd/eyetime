// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The question "may EyeTime send anonymous numbers?" It is the only time EyeTime asks for anything, so it is written like a note from a person and not like a consent banner: who asks,
// what for, two plain promises, that after a yes it goes on its own, the exact report one click away, the privacy details one click away.
//
// It can be asked up to three times. Each time has its own words (the first in one of two voices, an experiment), the first two offer "Maybe later" (which says it will ask again) and a
// quiet but readable "Don't ask again" link, the third says it is the last and offers "No, thanks", which is final.
//
// What it will not do, on purpose (consent has to be free, specific and informed; see docs/COMPLIANCE.md): no pre-ticked anything, no guilt in the words of a refusal, no timer, no false
// scarcity, no refusal that is secretly not a refusal (a button called "No" that is asked about again is the "continuous prompting" the EDPB lists as a dark pattern), no hidden refusal, no
// second layer to say no. "Yes" is the filled button and wider (a hierarchy of look); the refusal is a real, bordered, readable button of the same height, in the same place, one click.
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

/** The words of each ask: [title, lead]. The first ask has two voices (an experiment); the second and third have one. */
export function askWords(/** @type {number} */ n, /** @type {string} */ variant) {
  if (n >= 3) return ['us.askTitle3', 'us.askLead3'];
  if (n === 2) return ['us.askTitle2', 'us.askLead2'];
  return variant === 'practical' ? ['us.askTitleB', 'us.askLeadB'] : ['us.askTitle', 'us.askLead'];
}

/**
 * Put the question on the page. `n` is which ask this is (1 to 3), `final` the last one, `variant` the voice of the first ask ("personal" or "practical").
 * Returns false when it is already there.
 */
export function showUsageAsk({ n = 1, final = false, variant = 'personal' } = {}) {
  if (document.getElementById(ID)) return true;
  const [titleKey, leadKey] = askWords(n, variant);
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
  // an honest way to stop the questions for good, in plain sight (the last ask has the final "No, thanks" instead)
  const never = final ? null : h('button', { class: 'ask-show', type: 'button', onclick: async () => { await declineAsk(); leave(card); } }, icon('x'), h('span', { text: t('us.askNever') }));

  const yes = h('button', { class: 'btn btn-primary ask-yes', type: 'button', onclick: async () => {
    const ok = await enableSharing();
    if (!ok) { await declineAsk(); leave(card); return; }
    // the thank-you stays a few seconds and says that it goes on its own and where the switch is: withdrawing must be as easy as agreeing
    card.replaceChildren(
      h('div', { class: 'ask-badge', 'aria-hidden': 'true' }, icon('check')),
      h('h2', { class: 'ask-title', text: t('us.askThanksT') }),
      h('p', { class: 'ask-lead', text: t('us.thanks') }),
      h('div', { class: 'ask-refuse' }, h('a', { class: 'btn', href: chrome.runtime.getURL('src/options/options.html#data'), target: '_blank', rel: 'noopener' }, t('us.title')), h('button', { class: 'btn', type: 'button', onclick: () => leave(card) }, t('common.close'))));
    setTimeout(() => card.isConnected && leave(card), 9000);
  } }, t('us.askYes'));
  const refuse = h('div', { class: 'ask-refuse' }, final
    ? h('button', { class: 'btn', type: 'button', onclick: async () => { await declineAsk(); leave(card); } }, t('us.askNo'))
    : h('button', { class: 'btn', type: 'button', onclick: async () => { await deferAsk(); leave(card); } }, t('us.askLater')));

  const card = h('aside', { id: ID, class: 'ask', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'usageAskTitle', 'aria-describedby': 'usageAskLead' },
    h('div', { class: 'ask-badge', 'aria-hidden': 'true' }, icon('sprout')),
    h('h2', { id: 'usageAskTitle', class: 'ask-title', text: t(titleKey) }),
    h('p', { id: 'usageAskLead', class: 'ask-lead', text: t(leadKey) }),
    h('ul', { class: 'ask-promises' }, promise('ban', t('us.askP1S')), promise('lock', t('us.askP2S'))),
    h('p', { class: 'ask-fine', text: t('us.askNote') }),
    h('div', { class: 'ask-actions' }, yes, refuse),
    final ? null : h('p', { class: 'ask-fine ask-again', text: t('us.askAgain') }),
    h('div', { class: 'ask-links' }, show, policy, never), previewNote, preview,
    h('p', { class: 'ask-sign', text: t('us.askSign') }));
  document.body.append(card);
  return true;
}
