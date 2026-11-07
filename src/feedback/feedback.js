// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// "Write to the maker": an idea, a problem or a kind word, sent to the person who makes EyeTime, and the place where their answer shows up. Opened from the palette, the popup,
// Settings and the card on the new tab. Always available (writing is never counted against the rules of silence); the person chooses what goes with it:
//   - the answer can come back here, inside EyeTime (a random ticket made on this device, no account, no address), or by email, or not at all;
//   - the version and system are attached unless taken off, and the page shows exactly what they are.
// A build with no collector has no server to send to: the button then opens a draft on GitHub, in public, and says so. Texts are put in with textContent only.

import { bootPage } from '../ui/page.js';
import { $, h, icon, clear, toast } from '../ui/dom.js';
import { t } from '../shared/i18n.js';
import { track, getUsage } from '../shared/usage-store.js';
import { feedbackEndpoint, feedbackContext, buildMessage, sendMessage, deleteMessage, pollAnswers, getFb, markAnswersSeen, newTicket } from '../shared/feedback.js';
import { FB_LIMITS } from '../shared/feedback-schema.js';

const PRIVACY_URL = 'https://maxbzd.github.io/eyetime/privacy.html';
const KINDS = [['idea', 'lightbulb'], ['problem', 'bug'], ['kudos', 'smile']];
const AREAS = ['focus', 'blocking', 'eyes', 'stats', 'look', 'sync', 'other'];
const MAIL = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,200}\.[^\s@<>"']{2,24}$/;

const endpoint = feedbackEndpoint();
const form = { kind: (location.hash.replace('#', '').match(/^(idea|problem|kudos)$/) || ['idea'])[0], text: '', areas: /** @type {string[]} */ ([]), answerHere: false, mail: '', mailOpen: false, ctxOn: true, busy: false, error: '' };
let days = 0;

const ctxLine = async () => { const c = await feedbackContext(true, days); return [c.app && 'EyeTime ' + c.app, c.br, c.os, c.lang && c.lang.toUpperCase(), c.days && t('fb.days.' + c.days)].filter(Boolean).join(' · '); };

async function view() {
  const card = $('#card');
  const kindBtns = h('div', { class: 'kinds', role: 'group', 'aria-label': t('fb.title') }, KINDS.map(([k, ico]) => h('button', { class: 'kind', type: 'button', 'aria-pressed': String(form.kind === k), onclick: () => { form.kind = k; if (k === 'kudos') form.mailOpen = false; view(); } }, h('span', { class: 'ico' }, icon(ico)), t('fb.kind.' + k))));
  const ta = h('textarea', { class: 'textarea', maxlength: String(FB_LIMITS.text), placeholder: t('fb.ph.' + form.kind), 'aria-label': t('fb.kind.' + form.kind) }, form.text);
  const left = h('div', { class: 'count', 'aria-hidden': 'true' }, String(FB_LIMITS.text - form.text.length));
  const send = h('button', { class: 'btn btn-primary btn-lg', type: 'button', disabled: form.busy || form.text.trim().length < 3 }, form.busy ? t('fb.sending') : endpoint ? t('fb.send') : t('fb.github'));
  ta.addEventListener('input', () => { form.text = ta.value; left.textContent = String(FB_LIMITS.text - ta.value.length); send.disabled = form.busy || ta.value.trim().length < 3; });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !send.disabled) send.click(); });
  send.addEventListener('click', submit);

  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': t('fb.about') }, AREAS.map((a) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(form.areas.includes(a)), onclick: (e) => { form.areas = form.areas.includes(a) ? form.areas.filter((x) => x !== a) : [...form.areas, a]; e.currentTarget.setAttribute('aria-pressed', String(form.areas.includes(a))); } }, t('fb.a.' + a))));

  const kids = [h('div', null, h('h1', { text: t('fb.title') }), h('p', { class: 'lead', text: t('fb.intro') })), kindBtns, h('div', null, ta, left), h('div', null, h('span', { class: 'fb-label', text: t('fb.about') }), chips)];
  if (endpoint) {
    const ans = h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: form.answerHere, 'aria-label': t('fb.reply'), onchange: (e) => { form.answerHere = e.target.checked; } }), h('span', { class: 'track' }));
    const mail = h('input', { class: 'input', type: 'email', autocomplete: 'email', maxlength: String(FB_LIMITS.contact), placeholder: t('fb.mailPh'), 'aria-label': t('fb.mail'), value: form.mail });
    mail.addEventListener('input', () => { form.mail = mail.value; });
    kids.push(h('div', { class: 'opt' }, h('div', null, h('b', { text: t('fb.reply') }), h('span', { class: 'd', text: t('fb.replyHint') })), ans));
    if (form.kind !== 'kudos') kids.push(form.mailOpen ? h('div', null, h('span', { class: 'fb-label', text: t('fb.mail') }), mail) : h('button', { class: 'mail-link', type: 'button', onclick: () => { form.mailOpen = true; view().then(() => $('input[type=email]').focus()); } }, t('fb.mail')));
  } else kids.push(h('p', { class: 'note-gh', text: t('fb.githubNote') }));
  const ctxSw = h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: form.ctxOn, 'aria-label': t('fb.ctx'), onchange: (e) => { form.ctxOn = e.target.checked; view(); } }), h('span', { class: 'track' }));
  kids.push(h('div', { class: 'opt' }, h('div', null, h('b', { text: t('fb.ctx') }), h('span', { class: 'd', text: t('fb.ctxHint') }), form.ctxOn ? h('div', { class: 'ctx-line', text: await ctxLine() }) : null), ctxSw));
  if (endpoint) kids.push(h('p', { class: 'privacy' }, t('fb.privacy') + ' ', h('a', { href: PRIVACY_URL, target: '_blank', rel: 'noopener noreferrer', text: t('fb.privacyLink') })));
  kids.push(form.error ? h('div', { class: 'err', role: 'alert', text: form.error }) : null, h('div', { class: 'send-row' }, send));
  clear(card, ...kids);
  card.classList.remove('thanks');
}

async function submit() {
  const ctx = await feedbackContext(form.ctxOn, days);
  const tags = form.areas.filter((a) => AREAS.includes(a));
  if (!endpoint) { // no collector: a draft on GitHub, in public, with the same words
    const body = form.text.trim() + (form.ctxOn ? '\n\n— ' + (await ctxLine()) : '');
    const q = new URLSearchParams({ title: (form.kind === 'idea' ? 'Idea: ' : form.kind === 'problem' ? 'Bug: ' : 'Kind word: ') + form.text.trim().split('\n')[0].slice(0, 60), body });
    window.open('https://github.com/maxbzd/eyetime/issues/new?' + q.toString(), '_blank', 'noopener');
    await track('fb_written');
    return;
  }
  const mail = form.mailOpen && form.kind !== 'kudos' && form.mail.trim() ? form.mail.trim() : undefined;
  if (mail && !MAIL.test(mail)) { form.error = t('fb.mailBad'); return view(); }
  const ticket = form.answerHere ? newTicket() : undefined;
  const built = buildMessage({ kind: form.kind, text: form.text, tags, contact: mail, ticket, ctx });
  if (!built.ok) { form.error = t('fb.short'); return view(); }
  form.busy = true; form.error = ''; await view();
  const res = await sendMessage(built.msg);
  form.busy = false;
  if (!res.ok) { form.error = t('fb.err'); return view(); }
  await track('fb_written');
  thanks(!!ticket);
  await history();
}

function thanks(withAnswer) {
  const card = $('#card');
  clear(card, h('div', { class: 'badge-big', 'aria-hidden': 'true' }, icon('check')), h('h1', { text: t('fb.thanks') }), withAnswer ? h('p', { class: 'lead', text: t('fb.thanksReply') }) : null,
    h('button', { class: 'btn', type: 'button', onclick: () => { Object.assign(form, { text: '', areas: [], answerHere: false, mail: '', mailOpen: false, error: '' }); view(); } }, t('fb.again')));
  card.classList.add('thanks');
  const b = card.querySelector('button'); if (b) b.focus({ preventScroll: true });
}

const date = (/** @type {number} */ ms) => new Intl.DateTimeFormat(document.documentElement.lang || 'en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ms));

/** My messages and the author's answers, kept only on this device; an answer that has just arrived is marked, then counts as read. */
async function history() {
  const box = $('#history'), fb = await getFb();
  if (!fb.outbox.length) { clear(box); box.hidden = true; return; }
  const fresh = new Set(fb.outbox.flatMap((m) => m.answers.filter((a) => !a.seen).map((a) => a.id)));
  const items = [...fb.outbox].reverse().map((m) => h('article', { class: 'msg' },
    h('div', { class: 'head' }, h('span', { class: 'tag' }, t('fb.kind.' + m.kind)), h('span', { text: date(m.ts) }), h('span', { class: 'sp' }),
      h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: async () => { if (await deleteMessage(m.t)) { toast(t('fb.deleted')); history(); } else toast(t('fb.err')); } }, t('fb.forget'))),
    m.text ? h('div', { class: 'body', text: m.text }) : null,
    m.answers.length ? m.answers.map((a) => h('div', { class: 'bubble' + (fresh.has(a.id) ? ' fresh' : '') }, h('div', { class: 'who' }, icon('message-circle'), t('fb.answer'), h('span', { class: 'muted', text: a.ts ? date(a.ts) : '' })), h('div', { class: 'txt', text: a.text }))) : h('div', { class: 'wait', text: t('fb.waiting') })));
  clear(box, h('h2', { text: t('fb.history') }), ...items);
  box.hidden = false;
  if (fresh.size) await markAnswersSeen([...fresh]);
}

(async () => {
  await bootPage();
  document.title = t('fb.title');
  try { days = (await getUsage()).days.length; } catch { days = 0; }
  await view();
  if (location.hash === '#history') $('#history').scrollIntoView();
  await history();
  if (endpoint && (await getFb()).outbox.length) { try { if (await pollAnswers()) await history(); } catch { /* offline: the list stays as it was */ } }
})();
