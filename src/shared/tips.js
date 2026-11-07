// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Quiet tips about features the person has not met yet (docs/ONBOARDING.md, "Finding the rest"). The rules are written down here, once, and are pure so that tests can hold them:
//   - never in the first week (the first session has its own cards), never before four active days, never during a focus session;
//   - at most one tip a week, one card at a time, and never when something else is asking (the question about numbers, a small question, an answer from the maker);
//   - a tip about something the person already uses is never shown;
//   - each tip is shown once; "Not now" brings it back a single time after 45 days; "Show me" ends it; "No more tips" ends all of them, for good.
// No counters, no "3 of 8", nothing that makes a person feel behind. A tip opens the guided set-up at its own step, where the setting can be changed on the spot.

/** The tips, in the order they are offered. Each is a step of the guided set-up (src/newtab/home/tour.js). */
export const TIP_IDS = ['limits', 'rhythm', 'home', 'night', 'tools'];

export const TIP_EVERY_DAYS = 7;
export const TIP_AGAIN_DAYS = 45;
export const TIP_MIN_ACTIVE_DAYS = 4;
export const TIP_FIRST_WEEK_DAYS = 7;
const DAY = 86_400_000;

/** @typedef {{ off: boolean, last: number, seen: Record<string, { at: number, n: number, done: boolean }> }} TipState */

/** A stored value that is not what it should be becomes an empty state, never an error. */
export function normalizeTips(/** @type {any} */ v) {
  /** @type {TipState} */
  const out = { off: false, last: 0, seen: {} };
  if (!v || typeof v !== 'object') return out;
  out.off = v.off === true;
  out.last = Number.isFinite(v.last) && v.last > 0 ? v.last : 0;
  if (v.seen && typeof v.seen === 'object') {
    for (const id of TIP_IDS) {
      const s = v.seen[id];
      if (s && typeof s === 'object' && Number.isFinite(s.at)) out.seen[id] = { at: s.at, n: Math.max(1, Math.min(9, Math.floor(s.n) || 1)), done: s.done === true };
    }
  }
  return out;
}

/**
 * Does the person already use what the tip is about? Then the tip would tell them nothing.
 * @param {string} id
 * @param {any} s the settings
 * @param {{ connected?: boolean }} [ctx] connected services are kept apart from the settings
 */
export function tipUsed(id, s, ctx = {}) {
  const b = (s && s.blocking) || {}, n = (s && s.newtab) || {};
  switch (id) {
    case 'limits': return !!(b.budget && b.budget.enabled) || Object.keys(b.limits || {}).length > 0;
    case 'rhythm': return !!(s && s.focus && s.focus.ambient && s.focus.ambient !== 'off');
    case 'home': return (n.widgets || []).length > 0 || !!(n.canvas && n.canvas.on);
    case 'night': return !!(s && s.standby && s.standby.on);
    case 'tools': return !!ctx.connected || !!(s && s.dock && s.dock.enabled) || !!b.instant;
    default: return true;
  }
}

/**
 * The tip to show now, or null. Everything the decision needs is passed in.
 * @param {{ st: TipState, now: number, installedAt: number, activeDays: number, running: boolean, busy?: boolean, settings: any, connected?: boolean }} o
 * @returns {string | null}
 */
export function tipPlan(o) {
  const { st, now } = o;
  if (st.off || o.running || o.busy) return null;
  if (!o.installedAt || now - o.installedAt < TIP_FIRST_WEEK_DAYS * DAY) return null;
  if (o.activeDays < TIP_MIN_ACTIVE_DAYS) return null;
  if (st.last && now - st.last < TIP_EVERY_DAYS * DAY) return null;
  for (const id of TIP_IDS) {
    const seen = st.seen[id];
    if (seen && (seen.done || seen.n >= 2 || now - seen.at < TIP_AGAIN_DAYS * DAY)) continue;
    if (tipUsed(id, o.settings, { connected: o.connected })) continue;
    return id;
  }
  return null;
}

/** @param {TipState} st @param {string} id @param {'shown' | 'show' | 'later' | 'off'} action */
export function recordTip(st, id, action, now = Date.now()) {
  const next = normalizeTips(JSON.parse(JSON.stringify(st)));
  if (action === 'off') { next.off = true; return next; }
  if (!TIP_IDS.includes(id)) return next;
  const prev = next.seen[id];
  if (action === 'shown') { next.last = now; next.seen[id] = { at: now, n: (prev ? prev.n : 0) + 1, done: false }; }
  else if (prev) prev.done = action === 'show';
  return next;
}
