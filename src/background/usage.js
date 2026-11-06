// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The weekly usage report, from the worker: an alarm wakes it every few hours and it sends only when a report is due (sharing on, a week since the last one).
// Nothing else here: the counting is done where things happen (shared/usage-store.js `track`), and with sharing off this does nothing at all.

import { sendReport } from '../shared/usage-store.js';
import { logError } from '../shared/errorlog.js';

const ALARM = 'usage-report';

/** Make sure the alarm exists (alarms survive restarts of the browser; creating it again would move it). */
export async function armUsage() {
  if (!(await chrome.alarms.get(ALARM))) await chrome.alarms.create(ALARM, { delayInMinutes: 30, periodInMinutes: 6 * 60 });
}

/** @param {{ name: string }} a */
export async function onUsageAlarm(a) {
  if (a.name !== ALARM) return;
  try { await sendReport(); } catch (e) { logError('usage:send', e); }
}
