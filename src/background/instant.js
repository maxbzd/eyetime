// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// "Instant" blocking: keeps the browser's own request rules (declarativeNetRequest) equal to what the blocker would decide, so a distracting page is sent to the pause page
// before a single request is made. The rules are built by shared/dnr.js (pure, tested); this file is the glue: when to rebuild, and how to put them in place.
//
// Off by default. On when `blocking.instant` is set AND the browser has given access to websites (a redirect needs it). Anything that goes wrong leaves NO rules
// (the tab-based blocker in blocker.js does not depend on this file and keeps working).

import { loadContext } from '../shared/policy.js';
import { buildRules, nextChange } from '../shared/dnr.js';
import { getSettings, setRaw } from '../shared/storage.js';
import { logError } from '../shared/errorlog.js';

const ALARM = 'instant-sync';
export const WEB_ORIGINS = ['http://*/*', 'https://*/*'];
export const blockedBase = () => chrome.runtime.getURL('src/blocked/blocked.html');

const api = () => (typeof chrome !== 'undefined' && chrome.declarativeNetRequest) || null;

/** Is instant blocking switched on and able to work (the setting, and access to websites)? */
export async function instantOn() {
  if (!api()) return false;
  try {
    const s = await getSettings();
    if (!s.blocking.instant) return false;
    return await chrome.permissions.contains({ origins: WEB_ORIGINS });
  } catch { return false; }
}

async function clearAll() {
  const dnr = api(); if (!dnr) return;
  const [dyn, ses] = await Promise.all([dnr.getDynamicRules(), dnr.getSessionRules()]);
  if (dyn.length) await dnr.updateDynamicRules({ removeRuleIds: dyn.map((r) => r.id) });
  if (ses.length) await dnr.updateSessionRules({ removeRuleIds: ses.map((r) => r.id) });
  await chrome.alarms.clear(ALARM);
}

async function run() {
  const dnr = api(); if (!dnr) return;
  try {
    if (!(await instantOn())) { await clearAll(); return; }
    const ctx = await loadContext();
    const { dynamic, session, truncated } = buildRules(ctx, blockedBase());
    const [dyn, ses] = await Promise.all([dnr.getDynamicRules(), dnr.getSessionRules()]);
    // one call each: the browser swaps the whole set at once, so there is no moment with half of the rules
    await dnr.updateDynamicRules({ removeRuleIds: dyn.map((r) => r.id), addRules: dynamic });
    await dnr.updateSessionRules({ removeRuleIds: ses.map((r) => r.id), addRules: session });
    const at = nextChange(ctx);
    if (at) await chrome.alarms.create(ALARM, { when: at + 500 }); else await chrome.alarms.clear(ALARM);
    await setRaw({ instantTruncated: truncated || 0 });
    if (truncated) logError('instant:rules', new Error(`${truncated} domain(s) are left to the tab blocker (the browser takes ${dynamic.length} rules with an expression)`));
  } catch (e) {
    logError('instant:sync', e);
    try { await clearAll(); } catch { /* the tab blocker is still there */ }
  }
}

let current = null, pending = null;
/** Make the rules equal to the current state. Calls that arrive while a run is going are merged into one more run, started after it. Resolves when the rules are in place. */
export function syncInstant() {
  if (!current) { current = run().finally(() => { current = null; }); return current; }
  if (!pending) pending = current.then(() => { pending = null; return syncInstant(); });
  return pending;
}

/** The block page is about to send the person back to the site: take every rule away so that a rule that is out of date can never send them here again. */
export async function dropRules() { try { await clearAll(); } catch (e) { logError('instant:drop', e); } }

if (typeof chrome !== 'undefined' && chrome.storage && chrome.alarms) {
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && (changes.settings || changes.focus || changes.passes)) syncInstant(); });
  chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) syncInstant(); });
  if (chrome.permissions && chrome.permissions.onAdded) { chrome.permissions.onAdded.addListener(() => syncInstant()); chrome.permissions.onRemoved.addListener(() => syncInstant()); }
}
