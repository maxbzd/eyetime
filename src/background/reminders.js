// "Time to focus" reminders: one alarm for the soonest scheduled slot, re-armed after it fires.

import { getSettings, getRaw, getCollection } from '../shared/storage.js';
import { nextReminder, nextTaskSlot } from '../shared/productivity.js';
import { isFocusLive } from '../shared/blocking.js';
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
  if (isFocusLive(focus)) return;
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

/* ---------- tasks the user scheduled for a time today ("when" is half of an if-then plan) ---------- */

const SLOT = 'task-slot';

export async function scheduleTaskSlot() {
  await chrome.alarms.clear(SLOT);
  const next = nextTaskSlot(await getCollection('tasks', []));
  if (next) await chrome.alarms.create(SLOT, { when: next.at });
}

async function fireSlot() {
  const tasks = await getCollection('tasks', []);
  const due = nextTaskSlot(tasks, new Date(Date.now() - 90_000)); // the slot that just rang
  await scheduleTaskSlot();
  if (!due || due.at > Date.now() + 90_000) return;
  const { focus } = await getRaw('focus');
  const settings = await getSettings();
  setLocale(resolveLocale(settings.language));
  const x = due.task;
  if (isFocusLive(focus)) return;
  const opts = { type: 'basic', iconUrl: ICON, priority: 1, title: t('remind.taskTitle'), message: x.resume ? t('remind.taskResume', { task: x.text, resume: x.resume }) : x.text, buttons: [{ title: t('focus.start', { time: fmtDuration(settings.focus.minutes * 60) }) }] };
  try { await chrome.notifications.create('task-slot:' + x.id, opts); } catch { delete opts.buttons; await chrome.notifications.create('task-slot:' + x.id, opts); }
}

chrome.alarms.onAlarm.addListener((a) => { if (a.name === SLOT) fireSlot(); });
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.tasks) scheduleTaskSlot(); });
chrome.notifications.onButtonClicked?.addListener(async (id) => {
  if (!id.startsWith('task-slot:')) return;
  chrome.notifications.clear(id);
  const s = await getSettings();
  const taskId = id.slice('task-slot:'.length);
  const task = (await getCollection('tasks', [])).find((x) => x.id === taskId);
  await startFocus({ minutes: (task && task.est) || s.focus.minutes, strict: s.focus.strict, taskId }); // the task's planned length, like everywhere else
});
chrome.notifications.onClicked.addListener((id) => { if (id.startsWith('task-slot:')) { chrome.notifications.clear(id); chrome.tabs.create({ url: chrome.runtime.getURL('src/newtab/newtab.html') }); } });
