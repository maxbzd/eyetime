// Focus sessions: start / stop / finish. The running session is stored under `focus`; an alarm ends it.

import { getSettings, getRaw, setRaw, updateDay, updateSettings } from '../shared/storage.js';
import { createSession, elapsedMs } from '../shared/focus.js';
import { isFocusActive } from '../shared/blocking.js';
import { dayKey } from '../shared/time.js';
import { resolveLocale, setLocale, t } from '../shared/i18n.js';
import { sweepTabs } from './blocker.js';
import { updateBadge } from './badge.js';
import { playChime } from './audio.js';

const ICON = 'icons/icon128.png';
const MIN_CREDIT_SEC = 120; // an early stop counts as focus time only after 2 minutes

export async function startFocus({ minutes, goal = '', strict = false }) {
  const settings = await getSettings();
  const session = createSession({ minutes, goal, strict });
  await setRaw({ focus: session });
  await chrome.alarms.create('focus-end', { when: session.endsAt });
  await updateSettings((s) => { s.focus.minutes = session.minutes; s.focus.strict = session.strict; });

  if (/^https?:\/\//.test(settings.focus.openUrl || '')) chrome.tabs.create({ url: settings.focus.openUrl, active: false }).catch(() => {});
  if (settings.focus.sound) playChime('start');
  await sweepTabs();
  await updateBadge(settings);
  return session;
}

/** Ends the session early. Strict sessions can only be ended by the owner of the browser via the extensions page. */
export async function stopFocus() {
  const { focus } = await getRaw('focus');
  if (!focus) return;
  await chrome.alarms.clear('focus-end');
  await setRaw({ focus: null });
  const sec = Math.round(elapsedMs(focus) / 1000);
  if (sec >= MIN_CREDIT_SEC) await updateDay(dayKey(), (d) => { d.fs = (d.fs || 0) + sec; });
  await updateBadge(await getSettings());
}

/** Alarm fired (or the worker woke up after the end time). */
export async function finishFocus() {
  const { focus } = await getRaw('focus');
  if (!focus || isFocusActive(focus)) return;
  await setRaw({ focus: null });
  await updateDay(dayKey(), (d) => { d.fs = (d.fs || 0) + focus.minutes * 60; d.fc = (d.fc || 0) + 1; });
  const settings = await getSettings();
  setLocale(resolveLocale(settings.language));
  if (settings.focus.sound) playChime('end');
  const opts = {
    type: 'basic', iconUrl: ICON, priority: 1,
    title: t('focus.doneTitle'),
    message: focus.goal ? t('focus.doneBodyGoal', { n: focus.minutes, goal: focus.goal }) : t('focus.doneBody', { n: focus.minutes }),
    buttons: settings.focus.suggestBreak ? [{ title: t('eye.startBreak') }, { title: t('focus.again') }] : undefined,
  };
  try { await chrome.notifications.create('focus-done', opts); } catch { delete opts.buttons; await chrome.notifications.create('focus-done', opts); }
  await updateBadge(settings);
}

chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'focus-end') finishFocus(); });

chrome.notifications.onButtonClicked?.addListener(async (id, i) => {
  if (id !== 'focus-done') return;
  chrome.notifications.clear(id);
  if (i === 0) chrome.tabs.create({ url: chrome.runtime.getURL('src/break/break.html') });
  else { const s = await getSettings(); startFocus({ minutes: s.focus.minutes, strict: s.focus.strict }); }
});
chrome.notifications.onClicked.addListener((id) => { if (id === 'focus-done') { chrome.notifications.clear(id); chrome.tabs.create({ url: chrome.runtime.getURL('src/insights/insights.html') }); } });
