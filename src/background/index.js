// EyeTime service worker (ES module). Event-driven: every listener is registered synchronously at load;
// there are no setInterval / setTimeout loops — only chrome.alarms and browser events.

import { captureErrors } from '../shared/errorlog.js';
import { ensureSchema, getSettings, getRaw, setRaw, pruneOldDays } from '../shared/storage.js';
import { isMinorUpdate } from '../shared/whatsnew.js';
import { isFocusActive } from '../shared/blocking.js';
import { initTracker } from './tracker.js';
import { startFocus, stopFocus, finishFocus, endRest } from './focus.js';
import { scheduleBedtime } from './breaks.js';
import { scheduleReminders, scheduleTaskSlot } from './reminders.js';
import { updateBadge } from './badge.js';
import { setAmbient } from './audio.js';
import './blocker.js';
import './weekly.js';
import './meetings.js';
import { syncNow } from './sync.js';
import { syncTasksNow } from './tasksync.js';
import { syncDock } from './dock.js';
import { checkStorage } from './storagewatch.js';
import { rolloverTasks } from './rollover.js';
import { armCalendar } from './calendar.js';
import './messages.js';
import './companion.js';
import { buildMenus } from './menus.js';

captureErrors('worker');

async function boot() {
  const { migrated } = await ensureSchema();
  const { focus } = await getRaw('focus');
  if (focus && !isFocusActive(focus)) await finishFocus(); // the end alarm may have been missed while the browser was closed
  else if (focus) { await chrome.alarms.create('focus-end', { when: focus.endsAt }); const { focus: f } = await getSettings(); const mode = (f.modes || []).find((m) => m.id === focus.mode); const amb = mode && mode.ambient && mode.ambient !== 'off' ? mode.ambient : f.ambient; if (amb !== 'off') setAmbient(amb); }
  const { rest } = await getRaw('rest');
  if (rest && Date.now() >= rest.endsAt) await endRest({ notify: false });
  else if (rest) await chrome.alarms.create('rest-end', { when: rest.endsAt });
  await initTracker();
  await buildMenus();
  await scheduleBedtime();
  await scheduleReminders();
  await scheduleTaskSlot();
  await updateBadge(await getSettings());
  syncNow();
  syncTasksNow();
  syncDock();
  rolloverTasks();
  armCalendar({ refresh: true });
  return migrated;
}

chrome.runtime.onInstalled.addListener(async (details) => {
  await boot();
  const settings = await getSettings();
  if (details.reason === 'update' && isMinorUpdate(details.previousVersion, chrome.runtime.getManifest().version)) await setRaw({ whatsNew: { version: chrome.runtime.getManifest().version, from: details.previousVersion } });
  if (details.reason === 'install' && !settings.onboarded) chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/onboarding.html') });
  chrome.alarms.create('prune', { periodInMinutes: 60 * 24 });
});

chrome.runtime.onStartup.addListener(boot);
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'prune') pruneOldDays().then(checkStorage); });

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'toggle-focus') return;
  const { focus } = await getRaw('focus');
  if (isFocusActive(focus)) { if (!focus.strict) await stopFocus(); return; }
  const s = await getSettings();
  await startFocus({ minutes: s.focus.minutes, strict: s.focus.strict });
});

// Every cold start of the worker (it is suspended when idle) must leave state consistent.
boot();
