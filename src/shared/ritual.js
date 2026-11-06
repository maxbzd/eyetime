// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The daily ritual, the pure part: which part of the day it is, what to offer in the morning, what the evening says, and the small record of the day (`day.rt`).
//
//   morning  — "what matters today?": up to three things, with times that fit the calendar; or "not today"
//   work     — just focus; a quiet line says how many of the three are done and what is next
//   evening  — "close the day": the numbers, one win, notes to resume, tomorrow's three
//   closed   — the day is closed until tomorrow; it can be reopened
//
// The record lives in the day's own entry (`d:YYYY-MM-DD`, field `rt`): { p: planned at, s: skipped at, c: closed at, top: ids of today's three, next: ids chosen for tomorrow }.
// Nothing here touches the browser: the pages read and write, and ask this module what to do.

import { MAX_PRIORITIES, dayReview } from './productivity.js';
import { toMin } from './dayplan.js';

export const MORNING_FROM = 5 * 60; // not before 05:00: a new day that starts at midnight is not a morning
export const MORNING_LEAD = 2 * 60; // the morning prompt stops this long before the evening begins
export const CANDIDATES = 5;

/** @typedef {{ p?: number, s?: number, c?: number, top?: string[], next?: string[] }} Rt */
/** @typedef {'off' | 'morning' | 'work' | 'evening' | 'closed'} Phase */

export const rtOf = (/** @type {any} */ day) => /** @type {Rt} */ ((day && day.rt && typeof day.rt === 'object') ? day.rt : {});

/** Minutes since midnight at which the evening starts (the setting, or 18:00 when it is damaged). */
export function eveningMinutes(/** @type {any} */ settings) {
  const v = settings && settings.ritual && settings.ritual.eveningAt;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? toMin(v) : 18 * 60;
}

/**
 * Which part of the day it is.
 * @param {{ now: Date, day: any, settings: any }} o `day` is today's record (or null); `settings.ritual` says whether the ritual is on and when the evening starts
 * @returns {Phase}
 */
export function phase({ now, day, settings }) {
  if (!settings || !settings.ritual || settings.ritual.on === false) return 'off';
  const rt = rtOf(day), min = now.getHours() * 60 + now.getMinutes(), evening = eveningMinutes(settings);
  if (rt.c) return 'closed';
  if (min >= evening) return 'evening';
  const started = ((day && day.fs) || 0) > 0 || ((day && day.fc) || 0) > 0; // someone who is already working does not need to be asked what to work on
  if (!rt.p && !rt.s && !started && min >= MORNING_FROM && min < evening - MORNING_LEAD) return 'morning';
  return 'work';
}

/**
 * The open tasks to choose from in the morning, most relevant first, each with the reason it is there.
 * @param {any[]} tasks @param {string} today 'YYYY-MM-DD'
 * @returns {{ task: any, why: '' | 'priority' | 'planned' | 'overdue' | 'due' | 'scheduled', pre: boolean }[]}
 */
export function candidates(tasks, today, max = CANDIDATES) {
  const score = (/** @type {any} */ x) => (x.starred ? 8 : 0) + (x.planFor === today ? 6 : 0) + (x.due && x.due < today ? 5 : 0) + (x.due === today ? 4 : 0) + (x.atDay === today ? 3 : 0);
  const why = (/** @type {any} */ x) => (x.starred ? 'priority' : x.planFor === today ? 'planned' : x.due && x.due < today ? 'overdue' : x.due === today ? 'due' : x.atDay === today ? 'scheduled' : '');
  const list = (tasks || []).filter((x) => x && !x.done).map((task) => ({ task, why: /** @type {any} */ (why(task)), s: score(task) }))
    .sort((a, b) => b.s - a.s || (b.task.createdAt || 0) - (a.task.createdAt || 0)).slice(0, max);
  let chosen = 0;
  return list.map(({ task, why: reason }) => ({ task, why: reason, pre: reason !== '' && chosen < MAX_PRIORITIES && !!++chosen })); // what was already planned, starred or due is pre-selected, up to three
}

/** Exactly `ids` (at most three open tasks) are today's priorities; every other open task is not, and an earlier plan for a day is spent. Returns a new list. */
export function setPriorities(/** @type {any[]} */ tasks, /** @type {string[]} */ ids) {
  const pick = new Set(ids.slice(0, MAX_PRIORITIES));
  return tasks.map((x) => {
    if (x.done) return x;
    const y = { ...x }; delete y.planFor;
    y.starred = pick.has(x.id);
    return y;
  });
}

/** Put the suggested times on the chosen tasks (so the reminder at the task's time can fire). Tasks that already have a time keep it. Returns a new list. */
export function applyTimes(/** @type {any[]} */ tasks, /** @type {{ taskId: string, start: string, minutes: number, fixed: boolean }[]} */ blocks, /** @type {string} */ today) {
  const by = new Map(blocks.filter((b) => !b.fixed).map((b) => [b.taskId, b]));
  return tasks.map((x) => {
    const b = by.get(x.id);
    if (!b || x.done || (x.at && x.atDay === today)) return x;
    return { ...x, at: b.start, atDay: today, est: x.est || b.minutes };
  });
}

/** Today's three for the quiet line: the tasks chosen this morning (done or not), else the open priorities. */
export function todaysThree(/** @type {any[]} */ tasks, /** @type {any} */ day) {
  const rt = rtOf(day), byId = new Map((tasks || []).map((x) => [x.id, x]));
  const list = rt.top && rt.top.length ? rt.top.map((id) => byId.get(id)).filter(Boolean) : (tasks || []).filter((x) => x.starred && !x.done);
  return list.slice(0, MAX_PRIORITIES).map((task) => ({ task, done: !!task.done }));
}

/** What to do next: the first of today's three that is not done (null when all are, or there are none). */
export const nextUp = (/** @type {any[]} */ tasks, /** @type {any} */ day) => todaysThree(tasks, day).find((x) => !x.done)?.task || null;

/** The evening, in numbers: focus, sessions, tasks finished today, what was held back, the day's win, what is still open. */
export function closing(/** @type {{ day: any, tasks: any[], today: string, dayKeyOf: (ms: number) => string }} */ { day, tasks, today, dayKeyOf }) {
  const review = dayReview(day);
  const doneToday = (tasks || []).filter((x) => x.done && x.doneAt && dayKeyOf(x.doneAt) === today);
  const open = (tasks || []).filter((x) => !x.done);
  return { minutes: review.minutes, sessions: review.sessions, avgRating: review.avgRating, done: doneToday.length, held: (day && day.fa) || 0, win: (day && day.w) || '', open: open.length };
}

/** Tomorrow's three as they stand: the ones already chosen, else the open priorities. */
export function tomorrowPicks(/** @type {any[]} */ tasks, /** @type {string} */ tomorrow) {
  const open = (tasks || []).filter((x) => !x.done);
  const planned = open.filter((x) => x.planFor === tomorrow);
  return (planned.length ? planned : open.filter((x) => x.starred)).slice(0, MAX_PRIORITIES);
}
