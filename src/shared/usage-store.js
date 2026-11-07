// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Usage measurement, the part that touches the browser: the counters on the device, the person's consent, the preview, and the one weekly request.
// The rules (what may be counted and sent, when a report is due) are in usage.js and usage-schema.js; the promise is in PRIVACY.md and docs/MEASUREMENT.md.
//
//   track('focus_start')        count one use. Always local, never throws, costs one small write
//   previewReport()             the exact JSON that would be sent next (what Settings shows)
//   enableSharing() / disableSharing()
//   sendReport()                the worker calls it every few hours; it sends only when a report is due, sharing is on and a collector is configured

import { getRaw, setRaw, getSettings, withLock, getDays } from './storage.js';
import { USAGE_ENDPOINT } from './usage-config.js';
import { normalizeUsage, record, buildReport, subtractPeriod, reportDue, detectEnv, newId, modeOf, shouldAsk, goodMoment, flagsOf, assignArms, CONSENT_VERSION, ASK_TIMING } from './usage.js';
import { dayKey, addDays } from './time.js';
import { validateReport, EXPERIMENTS } from './usage-schema.js';

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

/** @typedef {{ on: boolean, id: string | null, optInAt: number | null, lastReportAt: number | null, lastTryAt: number | null, askedAt: number | null, deferredAt: number | null, deferrals: number, eligibleAt: number | null, consentV: number }} Share */

export async function getShare() {
  const { usageShare } = await getRaw('usageShare');
  const u = usageShare && typeof usageShare === 'object' ? usageShare : {};
  const n = (/** @type {any} */ v) => (Number.isFinite(v) ? v : null);
  return /** @type {Share} */ ({ on: u.on === true && typeof u.id === 'string', id: typeof u.id === 'string' ? u.id : null, optInAt: n(u.optInAt), lastReportAt: n(u.lastReportAt), lastTryAt: n(u.lastTryAt), askedAt: n(u.askedAt), deferredAt: n(u.deferredAt), deferrals: Number.isInteger(u.deferrals) ? u.deferrals : 0, eligibleAt: n(u.eligibleAt), consentV: Number.isInteger(u.consentV) ? u.consentV : 1 });
}
const setShare = (/** @type {Partial<Share>} */ patch) => withLock('usageShare', async () => { await setRaw({ usageShare: { ...(await getShare()), ...patch } }); });

/** The random number that decides the arms of experiments. Made the first time it is needed (so never when no experiment is running), kept on this device only, never sent. */
async function experimentSeed() {
  const { expSeed } = await getRaw('expSeed');
  if (typeof expSeed === 'string' && /^[0-9a-f]{32}$/.test(expSeed)) return expSeed;
  const seed = newId();
  await setRaw({ expSeed: seed });
  return seed;
}

/** The arm this device is in for an experiment (a name from EXPERIMENTS), or null when there is no such experiment. For the product code that behaves differently per arm. */
export async function armOf(/** @type {string} */ experimentId) {
  const e = EXPERIMENTS.find((x) => x.id === experimentId);
  return e ? (assignArms(await experimentSeed(), [e])[0] || ':').split(':')[1] : null;
}

/** Everything a report says about the setup, read from the settings. */
async function context(/** @type {string} */ id) {
  const s = await getSettings();
  const raw = await getRaw(['syncSettings', 'syncTasks', 'syncEnc', 'tasks', 'habits', 'conns', 'calendarSubs']);
  const env = detectEnv(typeof navigator !== 'undefined' ? navigator.userAgent : '', typeof navigator !== 'undefined' ? /** @type {any} */ (navigator).userAgentData?.platform || navigator.platform : '');
  return { id, app: chrome.runtime.getManifest().version, ...env, lang: s.language, look: s.appearance.look, layout: s.newtab.layout || 'today', mode: modeOf(s.appearance.mode), flags: flagsOf(s, raw), experiments: EXPERIMENTS.length ? assignArms(await experimentSeed()) : [] };
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
  const old = await getShare();
  // a consent that is only out of date keeps its identifier (it is the same person saying yes to a changed scope); a first yes makes a new one
  await setShare({ on: true, id: old.on && old.id ? old.id : newId(), optInAt: old.on && old.optInAt ? old.optInAt : now, lastReportAt: old.on ? old.lastReportAt : null, lastTryAt: null, askedAt: now, deferredAt: null, eligibleAt: null, consentV: CONSENT_VERSION });
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
/** "No, thanks": final. The question is never asked again. */
export async function declineAsk(now = Date.now()) { await setShare({ askedAt: now, deferredAt: null, eligibleAt: null }); }

/** "Maybe later": the question comes back, with other words, after three weeks, at a good moment; the third ask is the last, so a third "later" cannot happen and would be a "no". */
export async function deferAsk(now = Date.now()) {
  const share = await getShare();
  if (share.deferrals >= ASK_TIMING.maxDeferrals) { await declineAsk(now); return; }
  await setShare({ deferredAt: now, deferrals: share.deferrals + 1, eligibleAt: null });
}

export async function wantsToAsk(now = Date.now()) {
  const [u, share] = await Promise.all([getUsage(now), getShare()]);
  return shouldAsk(u, share, haveEndpoint(), now);
}

/** Did a focus session end (completed) in the last half hour? Then the person has just got something out of EyeTime. */
async function justFinishedSession(now) {
  try {
    const keys = [dayKey(new Date(now)), dayKey(addDays(new Date(now), -1))];
    for (const [, day] of await getDays(keys)) for (const s of (day && day.ss) || []) if (s && s.c && s.t + (s.m || 0) * 60_000 > now - ASK_TIMING.peakMs && s.t <= now) return true;
  } catch { /* no days: no peak */ }
  return false;
}

/**
 * The plan for the question now: null (do not show), or `{ n, final, variant }`. `n` is which ask this is (1 to 3), `final` is the last one (no "Maybe later" any more); `variant` is the
 * voice this device was put in for the first ask ("personal" or "practical", an experiment whose result is how the people who agreed split between the arms). Shown at a good moment only;
 * the caller never asks mid-session.
 * @returns {Promise<{ n: number, final: boolean, variant: string } | null>}
 */
export async function askPlan(now = Date.now()) {
  if (!(await wantsToAsk(now))) return null;
  // China's law asks for a separate consent to a transfer abroad, which this card does not carry: the question is not put to a Chinese-language interface until that has been reviewed
  // (the switch in Settings stays, and says where the numbers are kept). See docs/COMPLIANCE.md.
  if ((await getSettings()).language === 'zh') return null;
  let share = await getShare();
  if (!share.eligibleAt) { await setShare({ eligibleAt: now }); share = { ...share, eligibleAt: now }; }
  if (!goodMoment(share, now, await justFinishedSession(now))) return null;
  return { n: share.deferrals + 1, final: share.deferrals >= ASK_TIMING.maxDeferrals, variant: (await armOf('ask-copy')) || 'personal' };
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
