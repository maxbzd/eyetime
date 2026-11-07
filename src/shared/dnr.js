// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// "Instant" blocking: the same decisions as the blocker, written as rules the BROWSER applies before a request is sent (declarativeNetRequest), so that not even the
// first request of a page reaches a distracting site (without this one request leaves in the 15–40 ms between the navigation starting and the worker answering).
//
// Pure functions (they run in Node for the tests); the part that talks to the browser is background/instant.js.
//
// The rules are an accelerator, never the only guard: the tab-based blocker keeps running and catches everything these rules cannot say (daily limits and the budget depend
// on usage, "only my sites" is not a list of domains). The one property that must hold is SOUNDNESS: a rule may only send a page to the block page when the blocker, asked
// the same question at the same moment, would also not let it through. Otherwise the block page would send the person straight back to the site and the rule would send them
// to the block page again. The tests check this for thousands of random hosts and settings.

import { decide, isFocusActive, isScheduleActive, REDIRECT_GRACE } from './blocking.js';
import { listedDomains, makeClassifier } from './classify.js';
import { matchesAny } from './domains.js';

export const DNR = Object.freeze({
  MAX_REGEX_RULES: 900,         // the browser allows 1000 rules with a regular expression; the rest is left to the tab-based blocker
  PRIORITY_ALLOW_LIST: 1000,    // the person's own "never block" list beats every rule
  PRIORITY_GRACE: 5000,         // the 30 s after "continue" in one tab
  GRACE_BASE_ID: 1_000_000,     // session rule ids: GRACE_BASE_ID + tab id
  SCAN_DAYS: 8,                 // how far ahead the next change of the work-hours schedule is looked for
});

const labels = (/** @type {string} */ d) => d.split('.').length;
const escapeDot = (/** @type {string} */ d) => d.replace(/[.]/g, '\\.');

/** The address of a page on `domain` or any of its subdomains, any port, any path: group 1 is the whole address (RE2 syntax). */
export const domainRegex = (/** @type {string} */ domain) => `^(https?://(?:[^/?#@:]*\\.)?${escapeDot(domain)}(?::\\d+)?(?:[/?#].*)?)$`;

/** @param {string} blockedBase the block page address without a query @param {string} reason @param {string} action */
const target = (blockedBase, reason, action) => `${blockedBase}?d=1&r=${encodeURIComponent(reason)}&a=${encodeURIComponent(action)}&u=\\1`; // `u` is last: its value is the raw address

/**
 * The rules for the moment `ctx.now`.
 * @param {{ settings: any, focus: any, passes: Record<string, number>, now?: number }} ctx  as policy.loadContext gives
 * @param {string} blockedBase  chrome.runtime.getURL('src/blocked/blocked.html')
 * @returns {{ dynamic: any[], session: any[], truncated: number }}
 */
export function buildRules(ctx, blockedBase) {
  const { settings, focus, passes = {} } = ctx;
  const now = ctx.now ?? Date.now();
  const b = settings.blocking;
  const classifier = makeClassifier(settings);
  const base = { settings, classifier, focus, passes, now, usageOf: () => 0, distractingSec: 0 }; // usage-dependent limits are the tab blocker's

  const domains = new Set(listedDomains(settings));
  if (isFocusActive(focus, now)) for (const d of focus.allow || []) domains.add(d); // a mode's own allowed sites need their own allow rule under a blocked parent
  for (const d of b.allow) domains.add(d);

  /** @type {Map<string, { reason: string, action: string }>} */
  const redirects = new Map();
  for (const d of [...domains].sort()) {
    if (matchesAny(d, b.allow)) continue;
    const r = decide(d, base);
    if (r.action !== 'allow') redirects.set(d, { reason: r.reason || '', action: r.action });
  }

  // The rules that let a site through come FIRST: when there are more domains than the browser takes, it is the redirects that are left to the tab blocker, never the exceptions
  // (an allowed subdomain under a blocked parent would otherwise be sent to the block page).
  const redirectKeys = [...redirects.keys()];
  const hasBlockedParent = (/** @type {string} */ d) => { const parts = d.split('.'); for (let i = 1; i < parts.length; i++) if (redirects.has(parts.slice(i).join('.'))) return true; return false; }; // the parents of a domain are its own suffixes: no scan over every rule
  const allows = [];
  for (const d of [...domains].sort()) {
    const listed = matchesAny(d, b.allow);
    const underBlocked = !redirects.has(d) && hasBlockedParent(d);
    if (!listed && !underBlocked) continue;
    allows.push({ priority: (listed ? DNR.PRIORITY_ALLOW_LIST : 10) + labels(d), action: { type: 'allow' }, condition: { regexFilter: domainRegex(d), resourceTypes: ['main_frame', 'sub_frame'] } });
  }
  const dynamic = [];
  let id = 1, truncated = 0;
  for (const r of allows.slice(0, DNR.MAX_REGEX_RULES)) dynamic.push({ id: id++, ...r });
  for (const [d, { reason, action }] of redirects) {
    if (dynamic.length >= DNR.MAX_REGEX_RULES) { truncated++; continue; }
    dynamic.push({ id: id++, priority: 10 + labels(d), action: { type: 'redirect', redirect: { regexSubstitution: target(blockedBase, reason, action) } }, condition: { regexFilter: domainRegex(d), resourceTypes: ['main_frame'] } });
  }
  // A blocked site put in a frame of an allowed page loads all the same, and a frame cannot be sent to the block page (it is not an address the web may open), so it is simply not loaded.
  // One rule for all the domains (`requestDomains` also covers their subdomains, and costs nothing of the budget of expressions); the allow rules above are of higher priority.
  if (redirectKeys.length) dynamic.push({ id: id++, priority: 1, action: { type: 'block' }, condition: { requestDomains: redirectKeys, resourceTypes: ['sub_frame'] } });

  // "continue" also opens 30 seconds for the redirect chain in that one tab (youtu.be → youtube.com)
  const session = [];
  for (const [k, until] of Object.entries(passes)) {
    if (!k.startsWith(REDIRECT_GRACE + ':') || !(until > now)) continue;
    const tabId = Number(k.slice(REDIRECT_GRACE.length + 1));
    if (Number.isInteger(tabId) && tabId >= 0) session.push({ id: DNR.GRACE_BASE_ID + tabId, priority: DNR.PRIORITY_GRACE, action: { type: 'allow' }, condition: { tabIds: [tabId], resourceTypes: ['main_frame', 'sub_frame'] } });
  }
  return { dynamic, session, truncated };
}

/**
 * When the rules next have to change by themselves (a session ends, a pass runs out, the work hours begin or end): a time in ms, or null.
 * The schedule is read minute by minute, because that is exactly how isScheduleActive reads it.
 */
export function nextChange(/** @type {{ settings: any, focus: any, passes: Record<string, number>, now?: number }} */ ctx) {
  const { settings, focus, passes = {} } = ctx;
  const now = ctx.now ?? Date.now();
  let next = Infinity;
  if (isFocusActive(focus, now)) next = Math.min(next, focus.endsAt);
  for (const until of Object.values(passes)) if (until > now) next = Math.min(next, until);
  const sch = settings.blocking.schedule;
  if (sch && sch.enabled && sch.days.length) {
    const first = Math.floor(now / 60_000) * 60_000;
    const was = isScheduleActive(sch, new Date(now));
    for (let m = 1; m <= DNR.SCAN_DAYS * 1440; m++) {
      const at = first + m * 60_000;
      if (at >= next) break;
      if (isScheduleActive(sch, new Date(at)) !== was) { next = at; break; }
    }
  }
  return Number.isFinite(next) ? next : null;
}

/** Which rule would the browser apply to this address: the one with the highest priority among those that match (for the tests; the browser does this itself). */
export function applyRules(/** @type {any[]} */ rules, /** @type {string} */ url, /** @type {number | null} */ tabId = null, /** @type {string} */ type = 'main_frame') {
  let best = null;
  for (const r of rules) {
    const c = r.condition;
    if (c.resourceTypes && !c.resourceTypes.includes(type)) continue;
    if (c.tabIds && !c.tabIds.includes(tabId)) continue;
    if (c.requestDomains) { let host = ''; try { host = new URL(url).hostname; } catch { /* no address */ } if (!c.requestDomains.some((d) => host === d || host.endsWith('.' + d))) continue; }
    if (c.regexFilter && !new RegExp(c.regexFilter).test(url)) continue;
    if (!best || r.priority > best.priority) best = r;
  }
  return best;
}
