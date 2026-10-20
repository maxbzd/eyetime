// Pieces of the plan → focus → review loop shared by the popup and the new tab.

import { h, icon } from './dom.js';
import { send } from './api.js';
import { t, fmtDuration } from '../shared/i18n.js';
import { goalProgress, RATINGS } from '../shared/productivity.js';

/** Daily-goal progress bar with the goal streak. `compact` shrinks it for the popup. */
export function goalStrip({ fsSec, goalMin, streak = 0 }) {
  if (!goalMin) return null;
  const g = goalProgress(fsSec, goalMin);
  return h('div', { class: 'goal-strip' + (g.reached ? ' reached' : ''), role: 'group', 'aria-label': t('goal.label') },
    h('div', { class: 'goal-top' },
      h('span', { class: 'goal-lbl' }, icon(g.reached ? 'circle-check' : 'target'), g.reached ? t('goal.reached') : t('goal.progress', { done: g.doneMin ? fmtDuration(g.doneMin * 60) : '0', goal: fmtDuration(goalMin * 60) })),
      streak >= 2 ? h('span', { class: 'goal-streak' }, icon('flame'), t('goal.streak', { n: streak })) : null),
    h('div', { class: 'goal-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': goalMin, 'aria-valuenow': g.doneMin }, h('i', { style: { width: Math.round(g.pct * 100) + '%' } })));
}

/** "How did it go?" after a session: rate it, and tick the task off if it was one. */
export function reviewCard(review, { onDone }) {
  let done = false, rating = 0;
  const resume = h('input', { class: 'input input-sm', maxlength: 140, placeholder: t('review.resumePh'), 'aria-label': t('review.resume') });
  const save = async (r) => { await send('session:review', { id: review.id, rating: r, done, resume: done ? '' : resume.value }); onDone?.(); };
  const labels = { 1: { icon: 'frown', key: 'review.r1' }, 2: { icon: 'meh', key: 'review.r2' }, 3: { icon: 'zap', key: 'review.r3' } };
  const rate = h('div', { class: 'review-rate', role: 'group', 'aria-label': t('review.q') }, RATINGS.map((r) => h('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', onclick: (e) => {
    rating = rating === r ? 0 : r;
    e.currentTarget.parentNode.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-pressed', String(rating === RATINGS[k])));
  } }, icon(labels[r].icon), t(labels[r].key))));
  return h('div', { class: 'review-card' },
    h('div', { class: 'review-head' }, h('div', {}, h('div', { class: 'review-title', text: review.completed ? t('review.done') : t('review.stopped') }), h('div', { class: 'review-sub', text: (review.goal ? review.goal + ' · ' : '') + fmtDuration(review.minutes * 60) }))),
    h('div', { class: 'review-q', text: t('review.q') }), rate,
    review.taskId ? h('div', { class: 'review-resume' }, h('div', { class: 'review-q', text: t('review.resume') }), resume) : null,
    review.taskId ? h('label', { class: 'review-task' }, h('input', { type: 'checkbox', onchange: (e) => { done = e.target.checked; } }), t('review.markDone')) : null,
    h('div', { class: 'review-actions' }, h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => save(0) }, t('review.skip')), h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => save(rating) }, t('review.save'))));
}
