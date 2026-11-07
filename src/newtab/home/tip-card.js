// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// A quiet tip about a feature (the rules of when are in shared/tips.js). It looks like the other small cards in the corner and says one thing: what it is and what it does.
// Three ways out, all of the same weight: look at it, not now, or no more tips at all.

import { h, icon } from '../../ui/dom.js';
import { t } from '../../shared/i18n.js';
import { getRaw, setRaw } from '../../shared/storage.js';
import { normalizeTips, recordTip } from '../../shared/tips.js';
import { openTour } from './tour.js';

const writeTips = async (/** @type {string} */ id, /** @type {'shown' | 'show' | 'later' | 'off'} */ action) => {
  const { tipState } = await getRaw('tipState');
  await setRaw({ tipState: recordTip(normalizeTips(tipState), id, action) });
};

/** Put the tip on the page, and remember that it was shown (so that a closed tab does not bring it back the next day). */
export async function showTip(/** @type {string} */ id) {
  await writeTips(id, 'shown');
  const gone = () => { card.classList.add('leaving'); setTimeout(() => card.remove(), 240); };
  const card = h('aside', { class: 'fbc float tip-card', role: 'dialog', 'aria-modal': 'false', 'aria-label': t('tour.' + id + '.t') },
    h('div', { class: 'fbc-reply-head' }, h('span', { class: 'fbc-ico on' }, icon('lightbulb')), h('div', { class: 'tip-head' }, h('small', { text: t('tip.label') }), h('b', { text: t('tour.' + id + '.t') }))),
    h('p', { class: 'fbc-quote', text: t('tour.' + id + '.d') }),
    h('div', { class: 'fbc-actions' },
      h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: async () => { await writeTips(id, 'show'); gone(); openTour({ at: id }); } }, t('tip.show')),
      h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => { await writeTips(id, 'later'); gone(); } }, t('tip.later'))),
    h('button', { class: 'tip-off', type: 'button', onclick: async () => { await writeTips(id, 'off'); gone(); } }, t('tip.off')));
  document.body.append(card);
}
