// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Usage measurement, the part that touches the browser: the counters on the device, the person's consent, the preview, and the one weekly request.
// The rules (what may be counted and sent, when a report is due) are in usage.js and usage-schema.js; the promise is in PRIVACY.md and docs/MEASUREMENT.md.
//
//   track('focus_start')        count one use. Always local, never throws, costs one small write
//   previewReport()             the exact JSON that would be sent next (what Settings shows)
//   enableSharing() / disableSharing()
//   sendReport()                the worker calls it every few hours; it sends only when a report is due, sharing is on and a collector is configured

import { getRaw, setRaw, getSettings, withLock } from './storage.js';
import { USAGE_ENDPOINT } from './usage-config.js';
import { normalizeUsage, record, buildReport, subtractPeriod, reportDue, detectEnv, newId, modeOf, shouldAsk, flagsOf } from './usage.js';
import { validateReport } from './usage-schema.js';

export const haveEndpoint = (/** @type {string} */ e = USAGE_ENDPOINT) => /^https:\/\/[^\s]+$/.test(e);

const SEND_TIMEOUT_MS = 10_000;

/** Count one use of a feature (see FEATURES). Safe to call from any page or the worker; a failure is ignored: measuring must never get in the way. */
export async function track(/** @type {string} */ feature, now = Date.now()) {
  try {
    await withLock('usage', async () => {
      const { usage, meta } = await getRaw(['usage', 'meta']);
      await setRaw({ usage: record(normalizeUsage(usage, meta?.installedAt || now), feature, now) });
    });
  } catch { /* storage unavailable (private window, quota): nothing to do */ }
}

export async function getUsage(now = Date.now()) {
  const { usage, meta } = await getRaw(['usage', 'meta']);
  return normalizeUsage(usage, meta?.installedAt || now);
}

/** @typedef {{ on: boolean, id: string | null, optInAt: number | null, lastReportAt: number | null, lastTryAt: number | null, askedAt: number | null }} Share */

export async function getShare() {
  const { usageShare } = await getRaw('usageShare');
  const u = usageShare && typeof usageShare === 'object' ? usageShare : {};
  const n = (/** @type {any} */ v) => (Number.isFinite(v) ? v : null);
  return /** @type {Share} */ ({ on: u.on === true && typeof u.id === 'string', id: typeof u.id === 'string' ? u.id : null, optInAt: n(u.optInAt), lastReportAt: n(u.lastReportAt), lastTryAt: n(u.lastTryAt), askedAt: n(u.askedAt) });
}
const setShare = (/** @type {Partial<Share>} */ patch) => withLock('usageShare', async () => { await setRaw({ usageShare: { ...(await getShare()), ...patch } }); });

/** Everything a report says about the setup, read from the settings. */
async function context(/** @type {string} */ id) {
  const s = await getSettings();
  const raw = await getRaw(['syncSettings', 'syncTasks', 'syncEnc', 'tasks', 'habits', 'conns', 'calendarSubs']);
  const env = detectEnv(typeof navigator !== 'undefined' ? navigator.userAgent : '', typeof navigator !== 'undefined' ? /** @type {any} */ (navigator).userAgentData?.platform || navigator.platform : '');
  return { id, app: chrome.runtime.getManifest().version, ...env, lang: s.language, look: s.appearance.look, layout: s.newtab.layout || 'today', mode: modeOf(s.appearance.mode), flags: flagsOf(s, raw) };
}

/** The report that would be sent now, as the text Settings shows. Before sharing is on the id is a row of zeros (it is made when sharing is switched on). */
export async function previewReport(now = Date.now()) {
  const [usage, share] = await Promise.all([getUsage(now), getShare()]);
  const report = buildReport(usage, await context(share.id || '0'.repeat(32)), now);
  return { report, text: JSON.stringify(report, null, 2), valid: validateReport(report).ok, sharing: share.on, configured: haveEndpoint() };
}

const isFirefox = () => typeof navigator !== 'undefined' && /Firefox\//.test(navigator.userAgent);

/** Switch sharing on (from a click: Firefox shows its own permission for this and needs the click). Returns false when the browser said no. */
export async function enableSharing(now = Date.now()) {
  if (isFirefox() && chrome.permissions?.request) {
    try { if (!(await chrome.permissions.request(/** @type {any} */ ({ data_collection: ['technicalAndInteraction'] })))) return false; } catch { return false; }
  }
  await setShare({ on: true, id: newId(), optInAt: now, lastReportAt: null, lastTryAt: null, askedAt: now });
  return true;
}

/** Switch sharing off: ask the collector to forget the id (best effort), then forget it here. The question is never asked again. */
export async function disableSharing(now = Date.now(), fetchImpl = fetchWithTimeout, endpoint = USAGE_ENDPOINT) {
  const { id } = await getShare();
  if (id && haveEndpoint(endpoint)) { try { await fetchImpl(endpoint, post({ v: 1, op: 'forget', id })); } catch { /* the collector keeps nothing that names a person; the id is gone from here either way */ } }
  await setShare({ on: false, id: null, optInAt: null, lastReportAt: null, lastTryAt: null, askedAt: now });
}

/** "Delete all my data" also ends the sharing, and asks the collector to forget. Runs before the storage is cleared. */
export async function forgetOnReset() {
  const { id, on } = await getShare();
  if (on && id) await disableSharing();
}

/** The person answered the question on Home without switching it on. */
export async function declineAsk(now = Date.now()) { await setShare({ askedAt: now }); }

export async function wantsToAsk(now = Date.now()) {
  const [u, share] = await Promise.all([getUsage(now), getShare()]);
  return shouldAsk(u, share, haveEndpoint());
}

const post = (/** @type {any} */ body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: /** @type {RequestCredentials} */ ('omit'), referrerPolicy: /** @type {ReferrerPolicy} */ ('no-referrer'), cache: /** @type {RequestCache} */ ('no-store') });

function fetchWithTimeout(/** @type {string} */ url, /** @type {RequestInit} */ init) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), SEND_TIMEOUT_MS);
  return fetch(url, { ...init, signal: ctl.signal }).finally(() => clearTimeout(timer));
}

/**
 * Send the report when one is due. `fetchImpl` and `endpoint` can be given (a test does). Returns what happened, for the caller to log or ignore.
 * @returns {Promise<{ sent: boolean, why?: string }>}
 */
export async function sendReport({ now = Date.now(), fetchImpl = fetchWithTimeout, endpoint = USAGE_ENDPOINT, force = false } = {}) {
  const share = await getShare();
  if (!force && !reportDue(share, now, haveEndpoint(endpoint))) return { sent: false, why: 'not due' };
  if (!share.on || !share.id || !haveEndpoint(endpoint)) return { sent: false, why: 'sharing is off or there is no collector' };
  const usage = await getUsage(now), report = buildReport(usage, await context(share.id), now), ok = validateReport(report);
  if ('why' in ok) return { sent: false, why: 'the report is not valid: ' + ok.why }; // never send what the schema would not accept
  await setShare({ lastTryAt: now });
  let res;
  try { res = await fetchImpl(endpoint, post(report)); } catch { return { sent: false, why: 'network' }; }
  if (!res.ok && res.status !== 429) return { sent: false, why: 'status ' + res.status }; // 429: the collector has this week's report already
  await withLock('usage', async () => {
    const { usage: stored, meta } = await getRaw(['usage', 'meta']);
    await setRaw({ usage: res.ok ? subtractPeriod(normalizeUsage(stored, meta?.installedAt || now), report.ft) : normalizeUsage(stored, meta?.installedAt || now) });
  });
  await setShare({ lastReportAt: now });
  return { sent: true };
}
