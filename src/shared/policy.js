// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Reads storage and answers "what should happen if the user opens this URL right now?".
// Used by the service worker (to redirect) and by the block page (to stay in sync / auto-release).

import { getRaw, dayStorageKey } from './storage.js';
import { DEFAULT_SETTINGS, deepMerge } from './defaults.js';
import { hostFromUrl, matches } from './domains.js';
import { makeClassifier } from './classify.js';
import { decide, isFocusActive } from './blocking.js';
import { strictView } from './strict.js';
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
  const stored = deepMerge(DEFAULT_SETTINGS, raw.settings);
  const strict = strictView(stored, raw.focus, now); // a strict session runs on the rules it started with, or stricter (shared/strict.js)
  const settings = strict ? strict.settings : stored;
  const day = raw[dk] || emptyDay();
  const classifier = strict ? strict.classifier : makeClassifier(settings);
  const distractingSec = Object.entries(day.d || {}).reduce((a, [host, sec]) => (classifier.classify(host) === 'distracting' ? a + sec : a), 0);
  return {
    settings,
    classifier,
    distractingSec,
    focus: isFocusActive(raw.focus, now) ? raw.focus : null,
    passes: raw.passes || {},
    usageOf: (domain) => usageOf(day, domain),
    now,
  };
}

/** Decision for a URL. Non-web URLs and empty hosts are always allowed. */
export async function evaluate(url, now = Date.now(), tabId = null) {
  const host = hostFromUrl(url);
  if (!host) return { action: 'allow', host: null };
  const ctx = await loadContext(now);
  return { ...decide(host, { ...ctx, tabId }), host, focus: ctx.focus };
}

export function blockedPageUrl(url, decision) {
  const q = new URLSearchParams({ u: url, r: decision.reason || '', a: decision.action });
  return chrome.runtime.getURL('src/blocked/blocked.html?' + q.toString());
}
