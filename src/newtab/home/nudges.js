// The two gentle prompts under the hero: save a backup, and the day loop (plan · review · goal).

import { $, h, icon, clear, toast } from '../../ui/dom.js';
import { t, fmtDuration } from '../../shared/i18n.js';
import { getRaw, setRaw, getDays, getCollection } from '../../shared/storage.js';
import { nudge as pickNudge, dayReview } from '../../shared/productivity.js';
import { dayKey } from '../../shared/time.js';
import { downloadBackup, needsBackup } from '../../ui/backup.js';
import { openShutdown } from '../shutdown.js';
import { enableSharing, declineAsk, wantsToAsk } from '../../shared/usage-store.js';
import { isFocusLive } from '../../shared/blocking.js';
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
  if (state.todayOn && state.settings.ritual && state.settings.ritual.on) { if (!(await paintUsageAsk(el))) el.hidden = true; return; } // on Today the day's own card says what the nudge would
  const [[, day]] = await getDays([dayKey()]);
  const tasks = (await getCollection('tasks', [])).filter((x) => !x.done);
  const kind = pickNudge({ now: new Date(), fsSec: day?.fs || 0, goalMin: state.settings.focus.dailyGoal, openTasks: tasks.length, starred: tasks.filter((x) => x.starred).length, sessionsToday: (day?.ss || []).length });
  if (!kind || kind === 'start' || nudgeOff(kind)) { if (!(await paintUsageAsk(el))) el.hidden = true; return; }
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
 * and only once (any answer ends it). Says plainly what is sent and where to read it. Returns whether it is on the screen.
 */
async function paintUsageAsk(el) {
  if ((state.runningFocus && isFocusLive(state.runningFocus)) || !(await wantsToAsk())) return false;
  const done = () => { el.hidden = true; };
  clear(el, icon('shield-check'), h('span', { class: 'nudge-text', text: t('us.ask') }),
    h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: async () => { const ok = await enableSharing(); done(); if (ok) toast(t('us.thanks')); else await declineAsk(); } }, t('us.askYes')),
    h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => { await declineAsk(); done(); } }, t('us.askNo')),
    h('a', { class: 'btn btn-sm btn-ghost', href: chrome.runtime.getURL('src/options/options.html#data') }, t('us.askMore')));
  el.hidden = false;
  return true;
}
