// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// What the new tab should do about the first session, decided from plain values (src/newtab/home/first-session.js does the drawing). It is pure so that the odd moments can be held by tests:
// the session ends while the tab is open (the worker clears `focus` a moment BEFORE it writes the finished session to the day record, so "no session yet" at that instant is not "stopped early"),
// a session stopped early, one that never started, one that finished while the browser was closed.

export const GRACE_MS = 60_000;       // the worker needs a moment to start the session the onboarding asked for
export const SETTLE_MS = 20_000;      // after the planned end, the finished session is looked for this long before the matter is closed
export const END_SLACK_MS = 3_000;    // a stop within this of the planned end counts as the natural end

/** The first completed session that began at or after `since` (a few seconds before, for the worker taking its time), or null. With the id of the session the onboarding started (`sid`) it is that one and no other:
 *  a second session begun before the tab was opened must not stand in for the first. Pure over day records. */
export function sessionSince(/** @type {[string, any][]} */ days, /** @type {number} */ since, /** @type {string} */ sid = '') {
  let best = null;
  for (const [, d] of days) for (const x of (d && d.ss) || []) if (x && x.c && x.t >= since - 5_000 && (!sid || x.id === sid) && (!best || x.t < best.t)) best = x;
  return best;
}

/** Is this the session the onboarding started (its own dialog will speak at its end; no second question beside it)? Without an id (a state made before ids), any session while the matter is open. */
export const isFirstSession = (/** @type {any} */ obFirst, /** @type {any} */ focus) => !!obFirst && obFirst.stage === 'run' && !!focus && (!obFirst.sid || obFirst.sid === focus.id);

/**
 * @param {{ obFirst: any, live: boolean, ses: any, now: number, focusId?: string }} o   focusId: the session that is running now
 * @returns {'none' | 'coach' | 'celebrate' | 'wait' | 'close'}
 *   coach: it is running; celebrate: it finished and the record is there; wait: it has just ended, the record is on its way (look again shortly); close: nothing to say, ever.
 */
export function firstSessionPlan({ obFirst, live, ses, now, focusId = '' }) {
  if (!obFirst || obFirst.stage === 'closed') return 'none';
  if (live && obFirst.sid && focusId && focusId !== obFirst.sid) return 'close'; // another session is running: the first one is behind the person, and its moment has passed (the dialog never appears in the middle of the second)
  if (obFirst.stage === 'done') return 'celebrate';
  if (live) return 'coach';
  if (ses) return 'celebrate';
  if (obFirst.stopped) return 'close'; // the worker says it was a stop, whenever it happened: nothing to wait for
  if (obFirst.seen) {
    const end = Number(obFirst.endsAt) || 0;
    if (end && now >= end - END_SLACK_MS && now < end + SETTLE_MS) return 'wait'; // ran to its end: the record is being written
    return 'close';                                                               // stopped before its end: no celebration for nothing
  }
  // never seen running: the start may still be on its way (a browser that has just reopened, a worker still booting): wait out the first minute, and then the planned length of the session
  const planned = obFirst.at + (Number(obFirst.minutes) || 0) * 60_000;
  return now - obFirst.at > GRACE_MS && now > planned + SETTLE_MS ? 'close' : 'wait';
}
