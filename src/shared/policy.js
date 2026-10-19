// Reads storage and answers "what should happen if the user opens this URL right now?".
// Used by the service worker (to redirect) and by the block page (to stay in sync / auto-release).

import { getRaw, dayStorageKey } from './storage.js';
import { DEFAULT_SETTINGS, deepMerge } from './defaults.js';
import { hostFromUrl, matches } from './domains.js';
import { makeClassifier } from './classify.js';
import { decide, isFocusActive } from './blocking.js';
import { emptyDay } from './stats.js';
import { dayKey } from './time.js';

export function usageOf(day, domain) {
  let sec = 0;
  for (const [host, s] of Object.entries(day.d || {})) if (matches(host, domain)) sec += s;
  return sec;
}

export async function loadContext(now = Date.now()) {
  const dk = dayStorageKey(dayKey(new Date(now)));
  const raw = await getRaw(['settings', 'focus', 'passes', dk]);
  const settings = deepMerge(DEFAULT_SETTINGS, raw.settings || {});
  const day = raw[dk] || emptyDay();
  return {
    settings,
    classifier: makeClassifier(settings),
    focus: isFocusActive(raw.focus, now) ? raw.focus : null,
    passes: raw.passes || {},
    usageOf: (domain) => usageOf(day, domain),
    now,
  };
}

/** Decision for a URL. Non-web URLs and empty hosts are always allowed. */
export async function evaluate(url, now = Date.now()) {
  const host = hostFromUrl(url);
  if (!host) return { action: 'allow', host: null };
  const ctx = await loadContext(now);
  return { ...decide(host, ctx), host, focus: ctx.focus };
}

export function blockedPageUrl(url, decision) {
  const q = new URLSearchParams({ u: url, r: decision.reason || '', a: decision.action });
  return chrome.runtime.getURL('src/blocked/blocked.html?' + q.toString());
}
