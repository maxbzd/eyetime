// Everything the worker must redo when settings change: context menus, bedtime/reminder alarms, open tabs, tracking.
// Used after the page sends `settings:changed` and after a sync pull brings in settings from another browser.

import { buildMenus } from './menus.js';
import { scheduleBedtime } from './breaks.js';
import { scheduleReminders, scheduleTaskSlot } from './reminders.js';
import { sweepTabs } from './blocker.js';
import { sync } from './tracker.js';
import { updateBadge } from './badge.js';
import { getSettings } from '../shared/storage.js';
import { syncDock } from './dock.js';

export async function applySettings() {
  await syncDock(); await buildMenus(); await scheduleBedtime(); await scheduleReminders(); await scheduleTaskSlot(); await sweepTabs(); await sync('settings');
  await updateBadge(await getSettings());
}
