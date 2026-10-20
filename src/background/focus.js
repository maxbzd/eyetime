// Focus sessions: start / stop / finish. The running session is stored under `focus`; an alarm ends it.

import { getSettings, getRaw, setRaw, updateDay, updateSettings, getCollection, setCollection } from '../shared/storage.js';
import { restFor, makeSessionEntry, addSession, rateSession } from '../shared/productivity.js';
import { createSession, createRest, elapsedMs } from '../shared/focus.js';
import { isFocusActive } from '../shared/blocking.js';
import { dayKey } from '../shared/time.js';
import { resolveLocale, setLocale, t, fmtDuration } from '../shared/i18n.js';
import { sweepTabs } from './blocker.js';
import { updateBadge } from './badge.js';
import { playChime, setAmbient } from './audio.js';

const ICON = 'icons/icon128.png';
const MIN_CREDIT_SEC = 120; // an early stop counts as focus time only after 2 minutes

export async function startFocus({ minutes, goal = '', strict = false, taskId = '', scope, mode = '' }) {
  const settings = await getSettings();
  let text = goal;
  if (taskId && !text) text = ((await getCollection('tasks', [])).find((x) => x.id === taskId) || {}).text || '';
  const modeCfg = (settings.focus.modes || []).find((m) => m.id === mode);
  const session = createSession({ minutes, goal: text, strict, taskId, scope: scope || modeCfg?.scope || settings.focus.scope, mode: modeCfg?.id || '', allow: modeCfg?.allow || [] });
  await setRaw({ focus: session, rest: null, review: null });
  await chrome.alarms.clear('rest-end');
  await chrome.alarms.create('focus-end', { when: session.endsAt });
  await updateSettings((s) => { s.focus.minutes = session.minutes; s.focus.strict = session.strict; s.focus.scope = session.scope; if (modeCfg) s.focus.mode = modeCfg.id; });

  if (/^https?:\/\//.test(settings.focus.openUrl || '')) chrome.tabs.create({ url: settings.focus.openUrl, active: false }).catch(() => {});
  if (settings.focus.sound) playChime('start');
  const ambient = modeCfg && modeCfg.ambient && modeCfg.ambient !== 'off' ? modeCfg.ambient : settings.focus.ambient;
  if (ambient && ambient !== 'off') setAmbient(ambient);
  await sweepTabs();
  await updateBadge(settings);
  return session;
}

/** +N minutes on the running session: finishing what you are in the middle of beats starting over. */
export async function extendFocus(minutes = 5) {
  const { focus } = await getRaw('focus');
  if (!focus || !isFocusActive(focus)) return { ok: false };
  const add = Math.min(60, Math.max(1, Math.round(minutes)));
  if ((focus.endsAt - focus.startedAt) / 60_000 + add > 12 * 60) return { ok: false };
  const next = { ...focus, endsAt: focus.endsAt + add * 60_000, minutes: focus.minutes + add };
  await setRaw({ focus: next });
  await chrome.alarms.create('focus-end', { when: next.endsAt });
  await updateBadge(await getSettings());
  return { ok: true };
}

/** Ends the session early. Strict sessions can only be ended by the owner of the browser via the extensions page. */
export async function stopFocus() {
  const { focus } = await getRaw('focus');
  if (!focus) return;
  await chrome.alarms.clear('focus-end');
  await setRaw({ focus: null });
  setAmbient('off');
  const sec = Math.round(elapsedMs(focus) / 1000);
  const settings = await getSettings();
  if (sec >= MIN_CREDIT_SEC) {
    await updateDay(dayKey(), (d) => { d.fs = (d.fs || 0) + sec; addSession(d, makeSessionEntry(focus, { sec, completed: false })); });
    await creditTask(focus, sec);
    if (settings.focus.review) await setRaw({ review: reviewOf(focus, sec, false) });
  }
  await updateBadge(settings);
}

/** What the "how did it go?" card needs. Lives under `review` until the user answers or dismisses it. */
const reviewOf = (focus, sec, completed) => ({ id: focus.id, day: dayKey(new Date(focus.startedAt)), goal: focus.goal, taskId: focus.taskId || '', minutes: Math.max(1, Math.round(sec / 60)), completed });

/** Time spent in a session is added to the task it was started for. */
async function creditTask(focus, sec) {
  if (!focus.taskId) return;
  const tasks = await getCollection('tasks', []);
  const task = tasks.find((x) => x.id === focus.taskId);
  if (!task) return;
  task.focusSec = (task.focusSec || 0) + sec;
  await setCollection('tasks', tasks);
}

/** The user's answer to the review card: rate the session, optionally tick the task off. */
export async function reviewSession({ id, rating, done, resume = '' }) {
  const { review } = await getRaw('review');
  if (!review || review.id !== id) return { ok: false };
  if (rating) await updateDay(review.day, (d) => { rateSession(d, id, rating); });
  if (review.taskId && (done || resume)) {
    const tasks = await getCollection('tasks', []);
    const task = tasks.find((x) => x.id === review.taskId);
    if (task && done && !task.done) { task.done = true; task.doneAt = Date.now(); delete task.resume; }
    // "ready to resume": where you left off, so the next start does not begin from zero (and the open loop stops nagging)
    else if (task && !done) task.resume = String(resume).trim().slice(0, 140) || task.resume;
    await setCollection('tasks', tasks);
  }
  await setRaw({ review: null });
  return { ok: true };
}

/** Alarm fired (or the worker woke up after the end time). */
export async function finishFocus() {
  const { focus } = await getRaw('focus');
  if (!focus || isFocusActive(focus)) return;
  await setRaw({ focus: null });
  setAmbient('off');
  let sessionsToday = 0;
  await updateDay(dayKey(), (d) => { d.fs = (d.fs || 0) + focus.minutes * 60; d.fc = (d.fc || 0) + 1; sessionsToday = d.fc; addSession(d, makeSessionEntry(focus, { sec: focus.minutes * 60, completed: true })); });
  await creditTask(focus, focus.minutes * 60);
  const settings = await getSettings();
  if (settings.focus.review) await setRaw({ review: reviewOf(focus, focus.minutes * 60, true) });
  setLocale(resolveLocale(settings.language));
  if (settings.focus.sound) playChime('end');
  const fresh = Date.now() - focus.endsAt < 2 * 60_000; // a session that ended long ago (browser was closed) gets no rest
  const next = restFor(settings.focus, sessionsToday);
  if (next.minutes > 0 && fresh) {
    const rest = { ...createRest({ minutes: next.minutes }), long: next.long };
    await setRaw({ rest });
    await chrome.alarms.create('rest-end', { when: rest.endsAt });
  }
  const opts = {
    type: 'basic', iconUrl: ICON, priority: 1,
    title: t('focus.doneTitle'),
    message: focus.goal ? t('focus.doneBodyGoal', { n: focus.minutes, goal: focus.goal }) : t('focus.doneBody', { n: focus.minutes }),
    buttons: settings.focus.suggestBreak ? [{ title: t('eye.startBreak') }, { title: t('focus.again') }] : undefined,
  };
  try { await chrome.notifications.create('focus-done', opts); } catch { delete opts.buttons; await chrome.notifications.create('focus-done', opts); }
  await updateBadge(settings);
}

/** Rest over (or skipped): clear it and, when it ran its course, say so. */
export async function endRest({ notify = true } = {}) {
  const { rest } = await getRaw('rest');
  await chrome.alarms.clear('rest-end');
  if (!rest) return;
  await setRaw({ rest: null });
  const settings = await getSettings();
  await updateBadge(settings);
  if (!notify) return;
  setLocale(resolveLocale(settings.language));
  const opts = { type: 'basic', iconUrl: ICON, priority: 0, title: t('rest.overTitle'), message: t('rest.overBody', { n: settings.focus.minutes }), buttons: [{ title: t('focus.start', { time: fmtDuration(settings.focus.minutes * 60) }) }] };
  try { await chrome.notifications.create('rest-over', opts); } catch { delete opts.buttons; await chrome.notifications.create('rest-over', opts); }
}

chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'focus-end') finishFocus(); if (a.name === 'rest-end') endRest(); });
chrome.notifications.onButtonClicked?.addListener(async (id) => {
  if (id !== 'rest-over') return;
  chrome.notifications.clear(id);
  const s = await getSettings(); startFocus({ minutes: s.focus.minutes, strict: s.focus.strict });
});

chrome.notifications.onButtonClicked?.addListener(async (id, i) => {
  if (id !== 'focus-done') return;
  chrome.notifications.clear(id);
  if (i === 0) chrome.tabs.create({ url: chrome.runtime.getURL('src/break/break.html') });
  else { const s = await getSettings(); startFocus({ minutes: s.focus.minutes, strict: s.focus.strict }); }
});
chrome.notifications.onClicked.addListener((id) => { if (id === 'focus-done') { chrome.notifications.clear(id); chrome.tabs.create({ url: chrome.runtime.getURL('src/insights/insights.html') }); } });
