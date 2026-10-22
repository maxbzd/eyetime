// Eye care: 20-20-20 reminders counted in *active* screen time (not wall-clock), plus a bedtime nudge.
// State lives in storage.session: eye = { since: activeSecondsSinceBreak, due: bool, notifiedAt }

import { meetingQuiet } from './meetings.js';
import { getSettings, updateDay } from '../shared/storage.js';
import { dayKey, toMinutes } from '../shared/time.js';
import { resolveLocale, setLocale, t } from '../shared/i18n.js';

const session = () => chrome.storage.session;
const NATURAL_BREAK_SEC = 5 * 60; // being away this long counts as a rest
const ICON = 'icons/icon128.png';

export async function getEyeState() {
  const { eye } = await session().get('eye');
  return { since: 0, due: false, notifiedAt: 0, ...(eye || {}) };
}
const setEyeState = (eye) => session().set({ eye });

let chain = Promise.resolve();
const serial = (fn) => { chain = chain.then(fn).catch((e) => console.warn('[breaks]', e)); return chain; };

/** Called by the tracker every time it credits active seconds. */
export function onActiveTime(sec, now = Date.now()) {
  return serial(async () => {
    const settings = await getSettings();
    if (!settings.eye.enabled) return;
    const eye = await getEyeState();
    eye.since += sec;
    const limit = settings.eye.intervalMin * 60;
    if (eye.since >= limit && !eye.due && !(await meetingQuiet(settings))) {
      eye.due = true; eye.notifiedAt = now;
      if (settings.eye.notify) await notifyBreak(settings);
    }
    await setEyeState(eye);
  });
}

async function notifyBreak(settings) {
  setLocale(resolveLocale(settings.language));
  const opts = {
    type: 'basic', iconUrl: ICON, priority: 1,
    title: t('eye.notifTitle'),
    message: t('eye.notifBody', { n: settings.eye.intervalMin, s: settings.eye.breakSeconds }),
    buttons: [{ title: t('eye.startBreak') }, { title: t('eye.snooze') }],
  };
  try { await chrome.notifications.create('eye-break', opts); } catch { /* Firefox: no buttons */ delete opts.buttons; await chrome.notifications.create('eye-break', opts); }
}

export function openBreakPage() {
  return chrome.tabs.create({ url: chrome.runtime.getURL('src/break/break.html') });
}

/** The user finished the guided break. */
export function completeBreak() {
  return serial(async () => {
    await updateDay(dayKey(), (d) => { d.b = (d.b || 0) + 1; });
    await setEyeState({ since: 0, due: false, notifiedAt: 0 });
    chrome.notifications.clear('eye-break');
  });
}

/** Dismissed without doing it: remind again after a full interval. */
export function skipBreak() {
  return serial(async () => { await setEyeState({ since: 0, due: false, notifiedAt: 0 }); chrome.notifications.clear('eye-break'); });
}

export function snoozeBreak(minutes = 5) {
  return serial(async () => {
    const settings = await getSettings();
    await setEyeState({ since: Math.max(0, settings.eye.intervalMin - minutes) * 60, due: false, notifiedAt: 0 });
    chrome.notifications.clear('eye-break');
  });
}

chrome.notifications.onClicked.addListener((id) => { if (id === 'eye-break') { openBreakPage(); chrome.notifications.clear(id); } });
chrome.notifications.onButtonClicked?.addListener((id, i) => {
  if (id !== 'eye-break') return;
  if (i === 0) openBreakPage(); else snoozeBreak();
  chrome.notifications.clear(id);
});

// Being away for a few minutes is itself a break.
chrome.idle.onStateChanged.addListener((state) => serial(async () => {
  const { idleAt } = await session().get('idleAt');
  if (state !== 'active') { if (!idleAt) await session().set({ idleAt: Date.now() }); return; }
  await session().remove('idleAt');
  if (idleAt && Date.now() - idleAt >= NATURAL_BREAK_SEC * 1000) await setEyeState({ since: 0, due: false, notifiedAt: 0 });
}));

/* ---------- bedtime ---------- */

export async function scheduleBedtime() {
  const { eye } = await getSettings();
  await chrome.alarms.clear('bedtime');
  if (!eye.bedtime.enabled) return;
  const now = new Date();
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  at.setMinutes(toMinutes(eye.bedtime.time) - eye.bedtime.leadMin);
  if (at.getTime() <= now.getTime() + 1000) at.setDate(at.getDate() + 1);
  await chrome.alarms.create('bedtime', { when: at.getTime() });
}

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name !== 'bedtime') return;
  serial(async () => {
    const settings = await getSettings();
    if (!settings.eye.bedtime.enabled) return;
    setLocale(resolveLocale(settings.language));
    await chrome.notifications.create('bedtime', {
      type: 'basic', iconUrl: ICON,
      title: t('eye.bedtimeTitle'),
      message: t('eye.bedtimeBody', { n: settings.eye.bedtime.leadMin, time: settings.eye.bedtime.time }),
    });
    await scheduleBedtime();
  });
});
