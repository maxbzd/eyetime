// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// A strict session is a promise made at its start: while it runs, the rules that close sites may get stricter, never looser.
// At the start the session keeps a copy of those rules (its `lock`); while it runs, what is in force is the stricter of the copy and the settings as they are now.
// A change that would open a site (allow it, mark it useful, switch a category off, delete it from the list) is accepted and kept, and takes effect when the session ends. Pure.
import { makeClassifier } from './classify.js';
import { isFocusActive } from './blocking.js';

const uniq = (a) => [...new Set(a)];
const live = (focus, now) => !!(focus && focus.strict && focus.lock && isFocusActive(focus, now));

/** The rules a strict session stands on: what closes sites and what is exempt, as they are now. */
export function lockOf(settings) {
  const b = settings.blocking;
  return { allow: [...b.allow], always: [...b.always], custom: [...b.custom], presets: { ...b.presets }, sites: { ...(settings.sites || {}) } };
}

/**
 * The rules in force now, when a strict session is running: `{ settings, classifier }`; `null` when none is (use the settings as they are).
 * Allowed sites: only those that were allowed at the start (taking one off the list counts at once); closed lists and categories: the start plus anything added since.
 * A site is a distraction when the copy or the present settings say so.
 */
export function strictView(settings, focus, now = Date.now()) {
  if (!live(focus, now)) return null;
  const lock = focus.lock, b = settings.blocking;
  const presets = { ...b.presets };
  for (const [id, on] of Object.entries(lock.presets || {})) if (on) presets[id] = true;
  const blocking = { ...b, allow: b.allow.filter((d) => (lock.allow || []).includes(d)), always: uniq([...b.always, ...(lock.always || [])]), custom: uniq([...b.custom, ...(lock.custom || [])]), presets };
  const eff = { ...settings, blocking };
  const was = makeClassifier({ ...settings, blocking: { ...blocking, allow: blocking.allow, always: lock.always || [], custom: lock.custom || [], presets: lock.presets || {} }, sites: lock.sites || {} });
  const now_ = makeClassifier(eff);
  const classifier = { ...now_, classify: (host) => (was.classify(host) === 'distracting' || now_.classify(host) === 'distracting' ? 'distracting' : now_.classify(host)) };
  return { settings: eff, classifier };
}

/** Would the present settings open something the running strict session closed? (to say so, kindly, when the person has just done it) */
export function softens(settings, focus, now = Date.now()) {
  if (!live(focus, now)) return false;
  const lock = focus.lock, b = settings.blocking;
  if (b.allow.some((d) => !(lock.allow || []).includes(d))) return true;
  if ((lock.always || []).some((d) => !b.always.includes(d)) || (lock.custom || []).some((d) => !b.custom.includes(d))) return true;
  if (Object.entries(lock.presets || {}).some(([id, on]) => on && !b.presets[id])) return true;
  const was = makeClassifier({ ...settings, blocking: { ...b, allow: lock.allow || [], always: lock.always || [], custom: lock.custom || [], presets: lock.presets || {} }, sites: lock.sites || {} });
  const here = makeClassifier(settings);
  const hosts = uniq([...Object.keys(settings.sites || {}), ...Object.keys(lock.sites || {}), ...b.allow]);
  return hosts.some((h) => was.classify(h) === 'distracting' && here.classify(h) !== 'distracting');
}
