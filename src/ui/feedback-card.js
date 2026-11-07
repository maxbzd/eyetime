// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The small questions: a rating after a session, the question of fit, the mood of the week, and the card that says the author has answered. One card, one tap to answer, one optional line;
// closing it is free ("Not now" is quiet for 60 days, "Don't ask for ratings" is for good). Where it goes and what it holds: docs/FEEDBACK.md. Texts are put in with textContent only.
// It floats in a corner on the new tab (`float`), or sits in the flow on a page (Insights). It never takes focus away from what the person is doing.

import { h, icon } from './dom.js';
import { t } from '../shared/i18n.js';
import { track, getUsage } from '../shared/usage-store.js';
import { buildMessage, sendMessage, feedbackContext, fbShown, fbDismissed, fbAnswered, fbWeekDone, markAnswersSeen } from '../shared/feedback.js';

const FACES = { session: ['angry', 'frown', 'smile', 'laugh'], week: ['angry', 'frown', 'meh', 'smile', 'laugh'], pmf: ['frown', 'meh', 'laugh'] };
const RANGE = { session: [1, 4], week: [1, 5], pmf: [0, 2] };
const CHIPS = {
  sessionBad: [['slow', 'fb.t.slow'], ['hindered', 'fb.t.hindered'], ['unclear', 'fb.t.unclear'], ['timer', 'fb.t.timer'], ['other', 'fb.a.other']],
  sessionGood: [['timer', 'fb.t.timer'], ['blocking', 'fb.a.blocking'], ['stats', 'fb.a.stats'], ['design', 'fb.t.design'], ['other', 'fb.a.other']],
  week: [['focus', 'fb.a.focus'], ['blocking', 'fb.a.blocking'], ['eyes', 'fb.a.eyes'], ['stats', 'fb.a.stats'], ['look', 'fb.a.look'], ['other', 'fb.a.other']],
  pmf: [['timer', 'fb.t.timer'], ['blocking', 'fb.a.blocking'], ['eyes', 'fb.a.eyes'], ['stats', 'fb.a.stats'], ['newtab', 'fb.t.newtab'], ['other', 'fb.a.other']],
};
const TITLE = { session: 'fb.sesTitle', week: 'fb.wkTitle', pmf: 'fb.pmfTitle' };
const LABEL = (/** @type {string} */ kind, /** @type {number} */ v) => t(kind === 'session' ? 'fb.s.' + v : kind === 'week' ? 'fb.w.' + v : 'fb.p.' + v);
const chipsFor = (/** @type {string} */ kind, /** @type {number} */ v) => (kind === 'session' ? (v <= 2 ? CHIPS.sessionBad : CHIPS.sessionGood) : CHIPS[/** @type {'week'} */ (kind)]);

/**
 * A question card. `kind` is 'session', 'week' or 'pmf'. `float`: a corner card on the page (otherwise in the flow). `onGone` runs when the card has gone (answered or closed).
 * The caller decides that it may be shown (promptPlan / weekMoodDue); this records that it was shown.
 * @param {{ kind: 'session' | 'week' | 'pmf', float?: boolean, onGone?: () => void }} o
 */
export function questionCard({ kind, float = false, onGone }) {
  let rating = /** @type {number | null} */ (null), tags = /** @type {string[]} */ ([]), busy = false;
  const body = h('div', { class: 'fbc-body' });
  const card = h('aside', { class: 'fbc' + (float ? ' float' : ''), role: float ? 'dialog' : 'group', 'aria-modal': float ? 'false' : null, 'aria-label': t(TITLE[kind]) }, body);
  const gone = () => { card.classList.add('leaving'); setTimeout(() => { card.remove(); onGone && onGone(); }, 240); };
  const closeNow = async (/** @type {{ never?: boolean }} */ o = {}) => {
    await track('fb_dismissed');
    await fbDismissed(o); if (kind === 'week') await fbWeekDone(); // a closed card is quiet for 60 days, whatever it was
    gone();
  };
  const footer = () => h('div', { class: 'fbc-foot' }, h('button', { class: 'fbc-link', type: 'button', onclick: () => closeNow() }, t('fb.not')), h('button', { class: 'fbc-link', type: 'button', onclick: () => closeNow({ never: true }) }, t('fb.never')), h('span', { class: 'fbc-note', text: t('fb.cardNote') }));

  const step1 = () => {
    const [lo, hi] = RANGE[kind], faces = FACES[kind], opts = [];
    for (let v = lo; v <= hi; v++) opts.push(h('button', { class: 'fbc-face', type: 'button', 'aria-label': LABEL(kind, v), onclick: () => { rating = v; tags = []; step2(); } }, h('span', { class: 'fbc-ico' }, icon(faces[v - lo])), h('span', { text: LABEL(kind, v) })));
    body.replaceChildren(h('h2', { class: 'fbc-title', text: t(TITLE[kind]) }), h('div', { class: 'fbc-faces n' + opts.length, role: 'group' }, opts), footer());
  };
  const step2 = () => {
    const chips = h('div', { class: 'fbc-chips', role: 'group' }, chipsFor(kind, /** @type {number} */ (rating)).map(([id, key]) => h('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', onclick: (e) => { tags = tags.includes(id) ? tags.filter((x) => x !== id) : [...tags, id]; e.currentTarget.setAttribute('aria-pressed', String(tags.includes(id))); } }, t(key))));
    const why = kind === 'pmf' ? t('fb.pmfWhy') : kind === 'week' ? t('fb.wkLine') : null;
    const line = h('input', { class: 'input', type: 'text', maxlength: '300', placeholder: t('fb.line'), 'aria-label': t('fb.line') });
    const err = h('div', { class: 'fbc-err', role: 'alert', hidden: true, text: t('fb.err') });
    const send = h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
      if (busy) return; busy = true; send.disabled = true; err.hidden = true;
      const ctx = await feedbackContext(true, (await getUsage()).days.length);
      const built = buildMessage({ kind, rating: /** @type {number} */ (rating), tags, text: line.value, ctx });
      const res = built.ok ? await sendMessage(built.msg) : { ok: false };
      busy = false;
      if (!res.ok) { send.disabled = false; err.hidden = false; return; }
      await track('fb_answered');
      await fbAnswered(kind); if (kind === 'week') await fbWeekDone();
      thanks();
    } }, t('fb.cardSend'));
    const back = h('button', { class: 'fbc-link', type: 'button', onclick: step1 }, '←');
    body.replaceChildren(h('div', { class: 'fbc-picked' }, h('span', { class: 'fbc-ico on' }, icon(FACES[kind][/** @type {number} */ (rating) - RANGE[kind][0]])), h('b', { text: LABEL(kind, /** @type {number} */ (rating)) }), back),
      why ? h('div', { class: 'fbc-why', text: why }) : null, chips, line, err, h('div', { class: 'fbc-actions' }, send), footer());
  };
  const thanks = () => {
    body.replaceChildren(h('div', { class: 'fbc-thanks' }, h('span', { class: 'fbc-check' }, icon('check')), h('b', { text: t('fb.cardThanks') })));
    setTimeout(() => card.isConnected && gone(), 2600);
  };
  step1();
  track('fb_shown'); fbShown();
  return card;
}

/** "The author replied": the newest unread answer, with a way to read it (opens the page with the history) or to dismiss it. @param {{ answer: { id: number, text: string }, float?: boolean, onGone?: () => void }} o */
export function replyCard({ answer, float = true, onGone }) {
  const gone = () => { card.classList.add('leaving'); setTimeout(() => { card.remove(); onGone && onGone(); }, 240); };
  const read = h('a', { class: 'btn btn-primary btn-sm', href: chrome.runtime.getURL('src/feedback/feedback.html#history'), target: '_blank', rel: 'noopener', onclick: () => { markAnswersSeen([answer.id]); gone(); } }, t('fb.repOpen'));
  const card = h('aside', { class: 'fbc reply' + (float ? ' float' : ''), role: 'dialog', 'aria-modal': 'false', 'aria-label': t('fb.repTitle') },
    h('div', { class: 'fbc-reply-head' }, h('span', { class: 'fbc-ico on' }, icon('message-circle')), h('b', { text: t('fb.repTitle') })),
    h('p', { class: 'fbc-quote', text: answer.text }),
    h('div', { class: 'fbc-actions' }, read, h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => { await markAnswersSeen([answer.id]); gone(); } }, t('fb.repDone'))));
  return card;
}
