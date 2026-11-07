// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The two gentle prompts under the hero: save a backup, and the day loop (plan · review · goal).

import { $, h, icon, clear } from '../../ui/dom.js';
import { t, fmtDuration } from '../../shared/i18n.js';
import { getRaw, setRaw, getDays, getCollection } from '../../shared/storage.js';
import { nudge as pickNudge, dayReview } from '../../shared/productivity.js';
import { dayKey } from '../../shared/time.js';
import { downloadBackup, needsBackup } from '../../ui/backup.js';
import { openShutdown } from '../shutdown.js';
import { askPlan, wantsToAsk, getShare, getUsage, justFinishedSession } from '../../shared/usage-store.js';
import { showUsageAsk } from './usage-ask.js';
import { questionCard, replyCard } from '../../ui/feedback-card.js';
import { feedbackEndpoint, getFb, pollAnswers, unreadAnswers, promptPlan } from '../../shared/feedback.js';
import { isFocusLive } from '../../shared/blocking.js';
import { listConnections } from '../../shared/connections.js';
import { normalizeTips, tipPlan } from '../../shared/tips.js';
import { showTip } from './tip-card.js';
import { state } from './state.js';

/** A gentle, snoozable reminder to save a backup file (history lives only on this device). */
export async function paintBackupNudge() {
  const el = $('#backupNudge');
  const { lastBackupAt = 0, backupSnoozedUntil = 0, meta } = await getRaw(['lastBackupAt', 'backupSnoozedUntil', 'meta']);
  const all = await chrome.storage.local.get(null);
  const daysStored = Object.keys(all).filter((k) => k.startsWith('d:')).length;
  if (!needsBackup({ now: Date.now(), installedAt: meta && meta.installedAt, lastBackupAt, daysStored, snoozedUntil: backupSnoozedUntil })) { el.hidden = true; return; }
  el.hidden = false;
  clear(el, icon('database'), h('span', { class: 'nudge-text', text: t('backup.title') + '. ' + t('backup.body') }),
    h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: async () => { await downloadBackup(); el.hidden = true; } }, icon('download'), t('backup.now')),
    h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => { await setRaw({ backupSnoozedUntil: Date.now() + 14 * 86_400_000 }); el.hidden = true; } }, t('backup.later')));
}

/* ---------- day-loop nudge: one gentle prompt (plan · review · goal) ---------- */

const nudgeOff = (kind) => { try { return localStorage.getItem('et-nudge-off') === dayKey() + ':' + kind; } catch { return false; } };
export async function paintNudge() {
  const el = $('#nudge');
  if (state.todayOn && state.settings.ritual && state.settings.ritual.on) { await paintAsks(); el.hidden = true; return; } // on Today the day's own card says what the nudge would
  const [[, day]] = await getDays([dayKey()]);
  const tasks = (await getCollection('tasks', [])).filter((x) => !x.done);
  const kind = pickNudge({ now: new Date(), fsSec: day?.fs || 0, goalMin: state.settings.focus.dailyGoal, openTasks: tasks.length, starred: tasks.filter((x) => x.starred).length, sessionsToday: (day?.ss || []).length });
  if (!kind || kind === 'start' || nudgeOff(kind)) { await paintAsks(); el.hidden = true; return; }
  const r = dayReview(day);
  const rated = r.avgRating ? t(r.avgRating >= 2.5 ? 'review.r3' : r.avgRating >= 1.75 ? 'review.r2' : 'review.r1').toLowerCase() : '';
  const msg = { plan: t('nudge.plan'), goal: t('nudge.goal'), review: r.sessions ? (rated ? t('nudge.review', { n: r.sessions, time: fmtDuration(r.minutes * 60) }).replace(/\.$/, '') + ' · ' + rated + '.' : t('nudge.review', { n: r.sessions, time: fmtDuration(r.minutes * 60) })) : t('nudge.reviewEmpty') }[kind];
  const ico = { plan: { icon: 'star' }, goal: { icon: 'trophy' }, review: { icon: 'moon' } }[kind].icon;
  clear(el, icon(ico), h('span', { class: 'nudge-text', text: msg }),
    kind === 'review' ? h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: openShutdown }, icon('moon'), t('nudge.closeDay')) : null,
    kind === 'review' ? h('a', { class: 'btn btn-sm', href: '../insights/insights.html' }, t('nudge.seeDay')) : null,
    h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': t('common.close'), onclick: () => { try { localStorage.setItem('et-nudge-off', dayKey() + ':' + kind); } catch { /* private mode */ } el.hidden = true; } }, icon('x')));
  el.hidden = false;
}

/**
 * The one-time question "share anonymous usage numbers?": only when there is nothing else to say, never during a session, only after a finished session and a second day,
 * and only once (any answer ends it). It is a card in the corner (usage-ask.js), not a strip: it says who is asking and why. Returns whether it is on the screen.
 */
async function paintAsks() { if (document.getElementById('fsCoach') || document.getElementById('fsDone') || document.getElementById('tour')) return true; return (await paintUsageAsk()) || (await paintFeedback()) || (await paintTip()); } // the first session's own cards go first

/**
 * The small questions and the author's answers, after the question about anonymous numbers (which has priority and counts toward the same 30-day budget). The author's answer comes first
 * and always: it is something the person asked for. Never mid-session; at most one card at a time; the rules are promptPlan in shared/feedback.js.
 */
async function paintFeedback() {
  if (document.querySelector('.fbc.float') || document.getElementById('usageAsk')) return true;
  if (state.runningFocus && isFocusLive(state.runningFocus)) return false;
  try { await pollAnswers(); } catch { /* offline */ }
  const fb = await getFb(), unread = unreadAnswers(fb);
  if (unread.length) { document.body.append(replyCard({ answer: unread[0] })); return true; }
  if (!feedbackEndpoint() || (await wantsToAsk())) return false; // no collector: nothing to send to; or the question about numbers is still to be asked, and it goes first
  const [share, usage, justFinished] = await Promise.all([getShare(), getUsage(), justFinishedSession()]);
  const consentAt = Math.max(share.askedAt || 0, share.deferredAt || 0, share.optInAt || 0) || null;
  const kind = promptPlan({ fb, endpoint: true, activeDays: usage.days.length, consentAt, justFinished });
  if (!kind) return false;
  document.body.append(questionCard({ kind, float: true }));
  return true;
}

async function paintUsageAsk() {
  if (state.runningFocus && isFocusLive(state.runningFocus)) return false;
  const plan = await askPlan(); // null unless this is a good moment: right after a finished session (or, failing that, once it has waited a week)
  return plan ? showUsageAsk(plan) : false;
}

/**
 * A quiet tip about a feature the person has not met, last in line: nothing else is asking, no session is running, and the rules in shared/tips.js say so (a week apart, never in the
 * first week, never about something already in use). Returns whether it is on the screen.
 */
async function paintTip() {
  if (document.querySelector('.fbc.float') || document.getElementById('usageAsk')) return true;
  if (state.runningFocus && isFocusLive(state.runningFocus)) return false;
  if (state.settings.tips && state.settings.tips.on === false) return false;
  const [{ tipState, meta }, usage, conns] = await Promise.all([getRaw(['tipState', 'meta']), getUsage(), listConnections()]);
  const id = tipPlan({ st: normalizeTips(tipState), now: Date.now(), installedAt: (meta && meta.installedAt) || 0, activeDays: usage.days.length, running: false, settings: state.settings, connected: Object.keys(conns).length > 0 });
  if (!id) return false;
  await showTip(id);
  return true;
}
