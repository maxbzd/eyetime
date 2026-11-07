// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Messages to the maker, the part that touches the browser: the rules of silence (when a small question may appear), writing and sending a message, and the author's answers coming back.
// What a message may hold is in feedback-schema.js (shared with the collector). The design and the reasons are in docs/FEEDBACK.md; the promise is in PRIVACY.md.
//
// The rules, in one line each (the person is never asked in a way that costs them something):
//   - a small question needs a collector to send to, and never appears in the first 7 days of use, during a focus session, or after "Don't ask for ratings";
//   - in all, at most one question (of any kind, the consent question included) in 30 days; "Not now" and a closed card silence everything for 60 days;
//   - the question of fit: once after 7 days of use, then every 90 days; otherwise a rating right after a finished session;
//   - writing a message is always possible and never counted against those rules (the person chose it).
// A message that asks for an answer carries a random ticket made on this device; the collector keeps only its hash, and the device asks for answers with the ticket (no account, no address).

import { getRaw, setRaw, withLock, getSettings } from './storage.js';
import { USAGE_ENDPOINT } from './usage-config.js';
import { validateFeedback, validatePoll, newTicket, daysBucket, FB_LIMITS, FB_REPLY_KINDS } from './feedback-schema.js';
import { resolveLocale } from './i18n.js';
import { detectEnv } from './usage.js';

const DAY = 86_400_000, HOUR = 3_600_000;
export const FB_TIMING = { budgetMs: 30 * DAY, snoozeMs: 60 * DAY, minActiveDays: 7, pmfEveryMs: 90 * DAY, keepAnswersMs: 180 * DAY, pollEveryMs: 6 * HOUR, maxOutbox: 30, sendTimeoutMs: 10_000 };

/** Where messages go: the collector of the usage report has them at /v1/feedback. Empty when this build has no collector (then writing goes to GitHub, in public, and no question is ever asked). */
export const feedbackEndpoint = (/** @type {string} */ usageEndpoint = USAGE_ENDPOINT) => (/^https:\/\/[^\s]+\/v1\/usage$/.test(usageEndpoint) ? usageEndpoint.replace(/\/v1\/usage$/, '/v1/feedback') : '');

/** @typedef {{ id: number, ts: number, text: string, seen: boolean }} Answer */
/** @typedef {{ t: string, ts: number, kind: string, text: string, answers: Answer[] }} Sent */
/** @typedef {{ lastAt: number | null, snoozeUntil: number | null, pmfAt: number | null, weekDone: string, never: boolean, polledAt: number | null, outbox: Sent[] }} FbState */

const num = (/** @type {any} */ v) => (Number.isFinite(v) ? v : null);
/** The stored state, made safe: anything unexpected becomes the default. */
export function normalizeFb(/** @type {any} */ raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const outbox = (Array.isArray(r.outbox) ? r.outbox : []).filter((x) => x && typeof x.t === 'string' && /^[A-Za-z0-9_-]{22,43}$/.test(x.t) && Number.isFinite(x.ts)).slice(-FB_TIMING.maxOutbox).map((x) => ({
    t: x.t, ts: x.ts, kind: FB_REPLY_KINDS.includes(x.kind) ? x.kind : 'idea', text: typeof x.text === 'string' ? x.text.slice(0, FB_LIMITS.text) : '',
    answers: (Array.isArray(x.answers) ? x.answers : []).filter((a) => a && Number.isFinite(a.id) && typeof a.text === 'string').map((a) => ({ id: a.id, ts: num(a.ts) || 0, text: a.text.slice(0, FB_LIMITS.reply), seen: a.seen === true })),
  }));
  return /** @type {FbState} */ ({ lastAt: num(r.lastAt), snoozeUntil: num(r.snoozeUntil), pmfAt: num(r.pmfAt), weekDone: typeof r.weekDone === 'string' ? r.weekDone : '', never: r.never === true, polledAt: num(r.polledAt), outbox });
}

/** The week of a time as "YYYY-Www" (Monday-based), to remember that this week's mood was answered. */
export function weekKey(/** @type {number} */ ms) {
  const d = new Date(ms), day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const thu = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const y = thu.getUTCFullYear(), first = new Date(Date.UTC(y, 0, 4)), wk = 1 + Math.round(((thu.getTime() - first.getTime()) / DAY - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  return `${y}-W${String(wk).padStart(2, '0')}`;
}

/**
 * Which small question, if any, may appear now. `o`: fb (the state), endpoint (is there a collector), activeDays, consentAt (when the consent question was last put or answered),
 * midSession (a focus session is on), justFinished (one has just ended). Returns 'pmf', 'session' or null.
 * @param {{ fb: FbState, endpoint: boolean, activeDays: number, consentAt?: number | null, midSession?: boolean, justFinished?: boolean, now?: number }} o
 */
export function promptPlan({ fb, endpoint, activeDays, consentAt = null, midSession = false, justFinished = false, now = Date.now() }) {
  if (!endpoint || fb.never || midSession || !justFinished || activeDays < FB_TIMING.minActiveDays) return null;
  if (fb.snoozeUntil && now < fb.snoozeUntil) return null;
  if (fb.lastAt && now - fb.lastAt < FB_TIMING.budgetMs) return null;
  if (consentAt && now - consentAt < FB_TIMING.budgetMs) return null; // the question about anonymous numbers counts as a question too, and it comes first
  return !fb.pmfAt || now - fb.pmfAt >= FB_TIMING.pmfEveryMs ? 'pmf' : 'session';
}

/** The quiet every small question keeps: one question of any kind in 30 days (the consent question counts), nothing for 60 days after "Not now". */
const quiet = (/** @type {FbState} */ fb, /** @type {number | null} */ consentAt, /** @type {number} */ now) =>
  !(fb.snoozeUntil && now < fb.snoozeUntil) && !(fb.lastAt && now - fb.lastAt < FB_TIMING.budgetMs) && !(consentAt && now - consentAt < FB_TIMING.budgetMs);

/** May the week's mood be asked inside Insights? Once a week at most, after the first 7 days, only with a collector, not after "Don't ask for ratings", and **inside the same budget as every other question**:
 *  one in 30 days, none for 60 days after "Not now", none soon after the question about anonymous numbers. */
export const weekMoodDue = (/** @type {FbState} */ fb, /** @type {boolean} */ endpoint, /** @type {number} */ activeDays, now = Date.now(), /** @type {number | null} */ consentAt = null, midSession = false) =>
  endpoint && !fb.never && !midSession && activeDays >= FB_TIMING.minActiveDays && fb.weekDone !== weekKey(now) && quiet(fb, consentAt, now);

/** May "Did this pause help?" be shown on the pause page? The same quiet as the other questions (collector, a week of use, one question in 30 days, 60 days after "Not now", never after "Don't ask",
 *  not soon after the question about numbers) and never while a focus session is on. */
// (the week's mood above is held to the same: not in a session, even when it is Insights that is open)
export const pauseThumbsDue = (/** @type {FbState} */ fb, /** @type {boolean} */ endpoint, /** @type {number} */ activeDays, now = Date.now(), /** @type {number | null} */ consentAt = null, midSession = false) =>
  endpoint && !fb.never && !midSession && activeDays >= FB_TIMING.minActiveDays && quiet(fb, consentAt, now);

/* ---------- the state in storage ---------- */
export async function getFb() { const { fbState } = await getRaw('fbState'); return normalizeFb(fbState); }
/** Change the state under a lock; `fn` gets a copy and returns the new one (or nothing to keep the copy it changed). */
export function updateFb(/** @type {(s: FbState) => FbState | void} */ fn) {
  return withLock('fb', async () => { const cur = await getFb(); const next = normalizeFb(fn(cur) || cur); await setRaw({ fbState: next }); return next; });
}
export const fbShown = (now = Date.now()) => updateFb((s) => { s.lastAt = now; });
/** A closed card or "Not now": quiet for 60 days; `never` is "Don't ask for ratings" (the door to write stays open). */
export const fbDismissed = (/** @type {{ never?: boolean, kind?: string }} */ o = {}, now = Date.now()) => updateFb((s) => { s.lastAt = now; s.snoozeUntil = now + FB_TIMING.snoozeMs; if (o.never) s.never = true; if (o.kind === 'pmf') s.pmfAt = now; }); // a question of fit that was closed was asked: the next is a rating, the question of fit comes back in 90 days (otherwise whoever always says "Not now" is asked it again and again, and never the rating)
export const fbAnswered = (/** @type {string} */ kind, now = Date.now()) => updateFb((s) => { s.lastAt = now; if (kind === 'pmf') s.pmfAt = now; });
export const fbWeekDone = (now = Date.now()) => updateFb((s) => { s.weekDone = weekKey(now); });

/* ---------- a message ---------- */
/** What is attached to a message when the person leaves "Attach version and system" on: the app, browser, system, language and how long they have used it, in coarse steps; nothing else. */
export async function feedbackContext(/** @type {boolean} */ full = true, activeDays = 0) {
  const app = chrome.runtime.getManifest().version;
  if (!full) return { app };
  const env = detectEnv(typeof navigator !== 'undefined' ? navigator.userAgent : '', typeof navigator !== 'undefined' ? /** @type {any} */ (navigator).userAgentData?.platform || navigator.platform : '');
  const lang = resolveLocale((await getSettings()).language); // "auto" is a setting, not a language: say the one in use
  return { app, ...env, ...(/^[a-z0-9-]{1,24}$/.test(lang) ? { lang } : {}), pr: /** @type {'ext'} */ ('ext'), days: daysBucket(activeDays) };
}

/**
 * Build a message and check it with the same schema the collector uses. `via` follows from the kind.
 * @param {{ kind: string, via?: string, text?: string, tags?: string[], rating?: number, contact?: string, ticket?: string, ctx: any }} o
 * @returns {{ ok: true, msg: any } | { ok: false, why: string }}
 */
export function buildMessage({ kind, via, text, tags, rating, contact, ticket, ctx }) {
  const VIA = /** @type {Record<string, string>} */ ({ idea: 'door', problem: 'door', kudos: 'door', session: 'after_session', week: 'week_review', pmf: 'pmf', pause: 'pause_page' });
  const msg = { v: 1, kind, via: via || VIA[kind], ...(rating !== undefined ? { rating } : {}), ...(tags && tags.length ? { tags } : {}), ...(text && text.trim() ? { text: text.trim() } : {}), ...(contact ? { contact: contact.trim() } : {}), ...(ticket ? { ticket } : {}), ctx };
  const ok = validateFeedback(msg);
  return 'why' in ok ? { ok: false, why: ok.why } : { ok: true, msg };
}

const post = (/** @type {any} */ body) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: /** @type {RequestCredentials} */ ('omit'), referrerPolicy: /** @type {ReferrerPolicy} */ ('no-referrer'), cache: /** @type {RequestCache} */ ('no-store') });
function fetchWithTimeout(/** @type {string} */ url, /** @type {RequestInit} */ init) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), FB_TIMING.sendTimeoutMs);
  return fetch(url, { ...init, signal: ctl.signal }).finally(() => clearTimeout(timer));
}

/**
 * Send a message. When it asks for an answer (a ticket) and was accepted, it is remembered in the outbox so the answer can be found and the message deleted again.
 * @returns {Promise<{ ok: boolean, why?: string }>}
 */
export async function sendMessage(/** @type {any} */ msg, { endpoint = feedbackEndpoint(), fetchImpl = fetchWithTimeout, now = Date.now() } = {}) {
  if (!endpoint) return { ok: false, why: 'no collector' };
  const ok = validateFeedback(msg); if ('why' in ok) return { ok: false, why: ok.why };
  let res;
  try { res = await fetchImpl(endpoint, post(msg)); } catch { return { ok: false, why: 'network' }; }
  if (!res.ok) return { ok: false, why: res.status === 429 ? 'busy' : 'status ' + res.status };
  if (msg.ticket) await updateFb((s) => { s.outbox.push({ t: msg.ticket, ts: now, kind: msg.kind, text: msg.text || '', answers: [] }); });
  return { ok: true };
}

/** Delete a message of mine: on the collector (with the ticket only this device holds) and from the list here. Returns false when the collector could not be reached, and then keeps the entry. */
export async function deleteMessage(/** @type {string} */ ticket, { endpoint = feedbackEndpoint(), fetchImpl = fetchWithTimeout } = {}) {
  if (endpoint) {
    try { const res = await fetchImpl(endpoint + '/forget', post({ v: 1, t: [ticket] })); if (!res.ok) return false; } catch { return false; }
  }
  await updateFb((s) => { s.outbox = s.outbox.filter((x) => x.t !== ticket); });
  return true;
}

/* ---------- the author's answers ---------- */
/** The tickets to ask about: my most recent messages that are not too old (at most FB_LIMITS.polls). */
export const pollTickets = (/** @type {FbState} */ fb, now = Date.now()) => fb.outbox.filter((x) => now - x.ts < FB_TIMING.keepAnswersMs).sort((a, b) => b.ts - a.ts).slice(0, FB_LIMITS.polls).map((x) => x.t);
/** Put answers (as the collector returns them: { t, id, ts, text }) into the outbox. Returns how many are new. */
export function applyAnswers(/** @type {FbState} */ fb, /** @type {any[]} */ found) {
  let n = 0;
  for (const a of found || []) {
    const m = fb.outbox.find((x) => x.t === a.t); if (!m || !Number.isFinite(a.id) || typeof a.text !== 'string' || m.answers.some((x) => x.id === a.id)) continue;
    m.answers.push({ id: a.id, ts: num(a.ts) || 0, text: a.text.slice(0, FB_LIMITS.reply), seen: false }); n++;
  }
  return n;
}
/** Answers not yet read, newest first, each with the message it answers. */
export const unreadAnswers = (/** @type {FbState} */ fb) => fb.outbox.flatMap((m) => m.answers.filter((a) => !a.seen).map((a) => ({ ...a, message: m }))).sort((a, b) => b.ts - a.ts);
export const markAnswersSeen = (/** @type {number[]} */ ids) => updateFb((s) => { for (const m of s.outbox) for (const a of m.answers) if (ids.includes(a.id)) a.seen = true; });

/**
 * Ask the collector whether the author has answered, at most every six hours and only when there is something to ask about. Returns how many new answers came.
 * @returns {Promise<number>}
 */
export async function pollAnswers({ endpoint = feedbackEndpoint(), fetchImpl = fetchWithTimeout, now = Date.now() } = {}) {
  if (!endpoint) return 0;
  const fb = await getFb(), t = pollTickets(fb, now);
  if (!t.length || (fb.polledAt && now - fb.polledAt < FB_TIMING.pollEveryMs)) return 0;
  const body = { v: 1, t };
  if (!validatePoll(body)) return 0;
  let res;
  try { res = await fetchImpl(endpoint + '/replies', post(body)); } catch { return 0; }
  await updateFb((s) => { s.polledAt = now; });
  if (!res.ok) return 0;
  let data; try { data = await res.json(); } catch { return 0; }
  let n = 0;
  await updateFb((s) => { n = applyAnswers(s, data && Array.isArray(data.r) ? data.r : []); });
  return n;
}

export { newTicket, FB_REPLY_KINDS };
