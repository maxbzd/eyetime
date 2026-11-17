// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Eye care: 20-20-20 breaks counted in *active* screen time (not wall-clock), plus a bedtime nudge.
//
// When the time is up the break takes the whole screen by itself (a window of its own, so that closing it leaves every tab where it was), unless the person
// chose a notification only. It waits while they are in another program, in a film on the whole screen or in a call, and tries again as the time goes on.
// State lives in storage.session: eye = { since: activeSecondsSinceBreak, due, notifiedAt, remindAt, win, tab }

import { meetingQuiet } from './meetings.js';
import { getSettings, updateDay } from '../shared/storage.js';
import { dayKey, toMinutes } from '../shared/time.js';
import { resolveLocale, setLocale, t } from '../shared/i18n.js';
import { hostFromUrl, matchesAny } from '../shared/domains.js';
import { track } from '../shared/usage-store.js';
import { logError } from '../shared/errorlog.js';
import { notify } from './notify.js';
import { playChime } from './audio.js';

const session = () => chrome.storage.session;
const NATURAL_BREAK_SEC = 5 * 60; // being away this long counts as a rest
const SNOOZE_MIN = 5;
const BREAK_PAGE = 'src/break/break.html';
/** Sites where a window over the whole screen would land in the middle of a conversation: the break waits there. */
export const CALL_SITES = ['meet.google.com', 'zoom.us', 'teams.microsoft.com', 'teams.live.com', 'teams.cloud.microsoft', 'webex.com', 'whereby.com', 'meet.jit.si', 'telemost.yandex.ru', 'telemost.360.yandex.ru', 'app.goto.com', 'facetime.apple.com'];

const fresh = () => ({ since: 0, due: false, notifiedAt: 0, remindAt: 0, win: 0, tab: 0 });
export async function getEyeState() {
  const { eye } = await session().get('eye');
  return { ...fresh(), ...(eye || {}) };
}
const setEyeState = (eye) => session().set({ eye });

let chain = Promise.resolve();
const serial = (fn) => { chain = chain.then(fn).catch((e) => { logError('breaks', e); }); return chain; };

/**
 * Called by the tracker every time it credits active seconds.
 * @param {number} sec
 * @param {number} [now]
 * @param {{ watching?: boolean }} [how] watching: the seconds were counted with no key or mouse (a tab that plays sound). That is screen time, not a rest.
 */
export function onActiveTime(sec, now = Date.now(), { watching = false } = {}) {
  return serial(async () => {
    const settings = await getSettings();
    if (!settings.eye.enabled) return;
    const eye = await getEyeState();
    eye.since += sec;
    if (watching) { const { idleAt } = await session().get('idleAt'); if (idleAt) await session().set({ idleAt: now }); } // a film watched without touching anything does not turn into "was away for five minutes"
    if (eye.since >= settings.eye.intervalMin * 60 && !eye.due && !(await meetingQuiet(settings))) { eye.due = true; eye.notifiedAt = 0; eye.remindAt = 0; }
    await setEyeState(eye); // first of all: nothing that follows (a window that will not open, a notification the browser refuses) may lose the count
    if (!eye.due) return;
    try { await present(eye, settings, now); } catch (e) { logError('break:present', e); }
    await setEyeState(eye);
  });
}

/** Where the person is right now: 'here' (the break may take the screen), 'away' (another program has the keyboard: wait, say nothing), 'busy' (a film on the whole screen, a call: wait, a notification is enough). */
async function whereabouts() {
  try {
    const win = await chrome.windows.getLastFocused();
    if (!win || !win.focused) return 'away';
    if (win.state === 'fullscreen') return 'busy';
    const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
    const host = tab ? hostFromUrl(tab.url) : '';
    return host && matchesAny(host, CALL_SITES) ? 'busy' : 'here';
  } catch { return 'away'; }
}

/** The break is due: put it in front of the person in the way they chose. Called again with every credited stretch until it has been shown. */
async function present(eye, settings, now) {
  if (eye.win || eye.tab) { // it is on the screen
    if (await surfaceAlive(eye)) return;
    Object.assign(eye, fresh(), { since: Math.max(0, settings.eye.intervalMin - SNOOZE_MIN) * 60 }); // its window is gone and nobody told the worker: the same as closing it
    return;
  }
  const e = settings.eye;
  if (e.fullscreen) {
    const at = await whereabouts();
    if (at === 'away') return;
    if (at === 'here') {
      const shown = await openBreakWindow();
      if (shown) { Object.assign(eye, shown); eye.notifiedAt = now; chrome.notifications.clear('eye-break'); return; }
    }
  }
  // a notification: when the break comes due, and once more for every further interval that passes without a break (never a stream of them)
  if (e.notify && (!eye.notifiedAt || (eye.remindAt && eye.since >= eye.remindAt))) {
    await notifyBreak(settings);
    eye.notifiedAt = now; eye.remindAt = eye.since + e.intervalMin * 60;
  }
}

const surfaceAlive = async (eye) => { try { if (eye.win) await chrome.windows.get(eye.win); else await chrome.tabs.get(eye.tab); return true; } catch { return false; } };

/**
 * A window of its own over the whole screen; where the browser has no such window, a tab. Returns what to remember ({ win } or { tab }), or null.
 * Which state a new window may start in depends on the system (macOS refuses some for a popup), so the order is: a popup on the whole screen, a popup maximised,
 * an ordinary window on the whole screen, one maximised, a tab. A window that came up in a smaller state is asked once more for the bigger one.
 */
async function openBreakWindow() {
  const url = chrome.runtime.getURL(BREAK_PAGE + '?auto=1');
  if (chrome.windows && chrome.windows.create) {
    for (const [type, state] of [['popup', 'fullscreen'], ['popup', 'maximized'], ['normal', 'fullscreen'], ['normal', 'maximized']]) {
      try {
        const w = await chrome.windows.create({ url, type, state, focused: true });
        if (!w || w.id == null) continue;
        if (w.state !== state) { try { await chrome.windows.update(w.id, { state, focused: true }); } catch { /* it stays as it is: still a window in front of the person */ } }
        return { win: w.id };
      } catch (e) { logError('break:window', e); }
    }
  }
  try { const tab = await chrome.tabs.create({ url }); return tab && tab.id != null ? { tab: tab.id } : null; } catch (e) { logError('break:open', e); return null; }
}

async function notifyBreak(settings) {
  await setLocale(resolveLocale(settings.language));
  await notify('eye-break', {
    priority: 1,
    title: t('eye.notifTitle'),
    message: t('eye.notifBody', { n: settings.eye.intervalMin, s: settings.eye.breakSeconds }),
    buttons: [{ title: t('eye.startBreak') }, { title: t('eye.snooze') }],
  });
}

export async function openBreakPage() {
  try { return await chrome.tabs.create({ url: chrome.runtime.getURL(BREAK_PAGE) }); } catch (e) { logError('break:open', e); return null; } // a window that cannot open is no reason for an unhandled rejection
}

/** The user finished the guided break. */
export function completeBreak() {
  return serial(async () => {
    await updateDay(dayKey(), (d) => { d.b = (d.b || 0) + 1; });
    track('eye_break_done');
    await setEyeState(fresh());
    chrome.notifications.clear('eye-break');
    const settings = await getSettings();
    if (settings.eye.sound) playChime('rest'); // the eyes are on something far away: the ear is told that the twenty seconds are over
  });
}

/** Dismissed without doing it: remind again after a full interval. */
export function skipBreak() {
  return serial(async () => { track('eye_break_skip'); await setEyeState(fresh()); chrome.notifications.clear('eye-break'); });
}

export function snoozeBreak(minutes = SNOOZE_MIN) {
  return serial(async () => {
    const settings = await getSettings();
    await setEyeState({ ...fresh(), since: Math.max(0, settings.eye.intervalMin - minutes) * 60 });
    chrome.notifications.clear('eye-break');
  });
}

/** The break was on the screen and its window (or tab) was closed without an answer: the same as "in five minutes". An answered break has already cleared the state. */
function onSurfaceClosed(key, id) {
  return serial(async () => {
    const eye = await getEyeState();
    if (!eye[key] || eye[key] !== id) return;
    const settings = await getSettings();
    await setEyeState({ ...fresh(), since: Math.max(0, settings.eye.intervalMin - SNOOZE_MIN) * 60 });
  });
}
chrome.windows.onRemoved?.addListener((id) => { onSurfaceClosed('win', id); });
chrome.tabs.onRemoved.addListener((id) => { onSurfaceClosed('tab', id); });

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
  if (idleAt && Date.now() - idleAt >= NATURAL_BREAK_SEC * 1000) {
    const eye = await getEyeState();
    await setEyeState({ ...fresh(), win: eye.win, tab: eye.tab }); // a break that is on the screen stays known as such (its window is still there)
  }
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
    await setLocale(resolveLocale(settings.language));
    await notify('bedtime', {
      title: t('eye.bedtimeTitle'),
      message: t('eye.bedtimeBody', { n: settings.eye.bedtime.leadMin, time: settings.eye.bedtime.time }),
    });
    await scheduleBedtime();
  });
});
