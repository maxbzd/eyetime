// "Time to focus" reminders: one alarm for the soonest scheduled slot, re-armed after it fires.

import { getSettings, getRaw } from '../shared/storage.js';
import { nextReminder } from '../shared/productivity.js';
import { isFocusActive } from '../shared/blocking.js';
import { resolveLocale, setLocale, t, fmtDuration } from '../shared/i18n.js';
import { startFocus } from './focus.js';

const ICON = 'icons/icon128.png';
const ALARM = 'focus-reminder';

export async function scheduleReminders() {
  const { focus } = await getSettings();
  await chrome.alarms.clear(ALARM);
  const next = nextReminder(focus.reminders);
  if (next) await chrome.alarms.create(ALARM, { when: next.at });
}

async function fire() {
  const settings = await getSettings();
  const due = nextReminder(settings.focus.reminders, new Date(Date.now() - 90_000)); // the slot that just rang (the alarm may be a little late)
  await scheduleReminders();
  if (!due || due.at > Date.now() + 90_000) return;
  const { focus } = await getRaw('focus');
  if (isFocusActive(focus)) return;
  setLocale(resolveLocale(settings.language));
  const r = due.reminder;
  const opts = { type: 'basic', iconUrl: ICON, priority: 1, title: t('remind.title'), message: t('remind.body', { time: fmtDuration(r.minutes * 60) }), buttons: [{ title: t('focus.start', { time: fmtDuration(r.minutes * 60) }) }] };
  try { await chrome.notifications.create('focus-reminder:' + r.id, opts); } catch { delete opts.buttons; await chrome.notifications.create('focus-reminder:' + r.id, opts); }
}

chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) fire(); });
chrome.notifications.onButtonClicked?.addListener(async (id) => {
  if (!id.startsWith('focus-reminder:')) return;
  chrome.notifications.clear(id);
  const s = await getSettings();
  const r = s.focus.reminders.find((x) => 'focus-reminder:' + x.id === id);
  await startFocus({ minutes: r ? r.minutes : s.focus.minutes, strict: s.focus.strict });
});
chrome.notifications.onClicked.addListener((id) => { if (id.startsWith('focus-reminder:')) { chrome.notifications.clear(id); chrome.tabs.create({ url: chrome.runtime.getURL('src/newtab/newtab.html') }); } });
