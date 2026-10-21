// "Where did my focus go?": focus time per project. A project is the first #tag of the task a session was started for (or a #tag in the goal text).
// Pure and unit-tested; Insights only draws the rows.

import { sessionsOf } from './productivity.js';

const TAG_RE = /(?:^|\s)#([\p{L}\p{N}_-]{1,24})(?=\s|$)/u;

export const tagFromGoal = (goal) => { const m = TAG_RE.exec(String(goal || '')); return m ? m[1].toLowerCase() : ''; };

/** The project a logged session belongs to ('' = none). */
export const sessionTag = (s) => s.tg || tagFromGoal(s.g) || '';

/** [[dayKey, day]] → [{ tag, sec, sessions }] sorted by time; '' is "no project". */
export function projectTotals(entries) {
  const acc = new Map();
  for (const s of sessionsOf(entries || [])) {
    const tag = sessionTag(s);
    const a = acc.get(tag) || { tag, sec: 0, sessions: 0 };
    a.sec += (s.m || 0) * 60; a.sessions += 1;
    acc.set(tag, a);
  }
  return [...acc.values()].sort((a, b) => b.sec - a.sec);
}

/**
 * Rows for the Insights card: projects with their change against the previous period (`delta` is a fraction, null when there was nothing before),
 * plus how much focus had no project at all. `share` is the project's part of the tagged time.
 */
export function projectRows(cur, prev) {
  const before = new Map(projectTotals(prev).map((r) => [r.tag, r]));
  const now = projectTotals(cur);
  const rows = now.filter((r) => r.tag);
  const taggedSec = rows.reduce((a, r) => a + r.sec, 0);
  const untaggedSec = (now.find((r) => !r.tag) || { sec: 0 }).sec;
  return {
    rows: rows.map((r) => { const p = before.get(r.tag); return { ...r, prevSec: p ? p.sec : 0, delta: p && p.sec > 0 ? (r.sec - p.sec) / p.sec : null, share: taggedSec ? r.sec / taggedSec : 0 }; }),
    taggedSec, untaggedSec,
  };
}
