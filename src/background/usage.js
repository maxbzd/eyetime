// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The weekly usage report, from the worker: an alarm wakes it every few hours and it sends only when a report is due (sharing on, a week since the last one).
// Nothing else here: the counting is done where things happen (shared/usage-store.js `track`), and with sharing off this does nothing at all.

import { sendReport, haveEndpoint } from '../shared/usage-store.js';
import { USAGE_ENDPOINT } from '../shared/usage-config.js';
import { logError } from '../shared/errorlog.js';

const ALARM = 'usage-report';

/** The page the browser opens after EyeTime is removed: one question with seven answers, counted by day with no identifier; the optional words that may follow are a message to the maker, sent only on Send (site/uninstall.html). It carries the version and nothing else. */
export const UNINSTALL_PAGE = 'https://maxbzd.github.io/eyetime/uninstall.html';

/**
 * Ask the browser to open that page after removal, but only when there is a collector to count the answer (a build without one sets nothing, so nothing opens).
 * The extension itself makes no request: the browser opens the page, and only a click on it sends anything (a count, to the collector).
 */
export async function armUninstall(endpoint = USAGE_ENDPOINT) {
  if (!haveEndpoint(endpoint)) return false;
  try { await chrome.runtime.setUninstallURL(`${UNINSTALL_PAGE}?v=${encodeURIComponent(chrome.runtime.getManifest().version)}`); return true; } catch { return false; }
}

/** Make sure the alarm exists (alarms survive restarts of the browser; creating it again would move it). */
export async function armUsage() {
  await armUninstall();
  if (!(await chrome.alarms.get(ALARM))) await chrome.alarms.create(ALARM, { delayInMinutes: 30, periodInMinutes: 6 * 60 });
}

/** @param {{ name: string }} a */
export async function onUsageAlarm(a) {
  if (a.name !== ALARM) return;
  try { await sendReport(); } catch (e) { logError('usage:send', e); }
}
