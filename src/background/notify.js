// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The one place a system notification is made.
//
// Why it exists: the worker lives in src/background/, and the browser reads a relative `iconUrl` against the worker's own address, so 'icons/icon128.png' meant
// src/background/icons/icon128.png, which is not there. Chrome then refuses the whole notification ("Unable to download all specified images"), and the rejection
// used to end whatever was running with it (the eye-break state was never saved, the badge was not updated after a session). The address is now absolute, and a
// notification that cannot be shown is written to the error log and never stops the work around it.

import { logError } from '../shared/errorlog.js';

/** The icon of every notification, as an address the browser can load from any context. */
export const notifyIcon = () => chrome.runtime.getURL('icons/icon128.png');

/**
 * Show a notification. Buttons are dropped where the browser does not take them (Firefox). Never throws.
 * @param {string} id
 * @param {{ title: string, message: string, priority?: number, buttons?: { title: string }[], requireInteraction?: boolean }} opts
 * @returns {Promise<boolean>} whether the browser took it
 */
export async function notify(id, opts) {
  /** @type {any} */
  const full = { type: 'basic', iconUrl: notifyIcon(), ...opts };
  if (!full.buttons || !full.buttons.length) delete full.buttons;
  try { await chrome.notifications.create(id, full); return true; } catch (e) {
    if (!full.buttons) { logError('notify:' + String(id).split(/[:-]\d/)[0], e); return false; }
  }
  delete full.buttons;
  try { await chrome.notifications.create(id, full); return true; } catch (e) { logError('notify:' + String(id).split(/[:-]\d/)[0], e); return false; }
}
