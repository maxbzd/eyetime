// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// What the owner reads about the messages: not a bare inbox but the few numbers that say where to look. Plain functions from rows to one JSON object (no storage, no clock of
// its own), so the same code answers in the Worker, in a test and in the demo. Every share is a pair { k, n, pct, lo, hi } like everywhere on the dashboard.

import { wilson } from './stats.js';

const DAY = 86_400_000;
const r4 = (/** @type {number} */ x) => Math.round(x * 1e4) / 1e4;
const pair = (/** @type {number} */ k, /** @type {number} */ n) => { const w = wilson(k, n); return { k, n, pct: n > 0 ? k / n : null, lo: w ? r4(w[0]) : null, hi: w ? r4(w[1]) : null }; };
const avg = (/** @type {number[]} */ xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const tally = (/** @type {string[][]} */ lists) => { const m = new Map(); for (const l of lists) for (const t of l) m.set(t, (m.get(t) || 0) + 1); return [...m].map(([tag, k]) => ({ tag, k })).sort((a, b) => b.k - a.k || (a.tag < b.tag ? -1 : 1)); };
/** The Monday-based week number of a time (days since 1970 / 7 is Thursday-based; shifted by 3 so a week runs Monday to Sunday). */
const weekOf = (/** @type {number} */ ms) => Math.floor((Math.floor(ms / DAY) + 3) / 7);
const weekStart = (/** @type {number} */ w) => new Date((w * 7 - 3) * DAY).toISOString().slice(0, 10);

/**
 * @param {any[]} rows messages, newest first (see feedback-store.js)
 * @param {number} now
 * @param {{ weeks?: number }} [o]
 */
export function feedbackSummary(rows, now, { weeks = 12 } = {}) {
  const of = (/** @type {string} */ kind) => rows.filter((r) => r.kind === kind);
  const byKind = Object.fromEntries(['idea', 'problem', 'kudos', 'session', 'week', 'pmf', 'pause', 'leaving'].map((k) => [k, of(k).length]));
  const byStatus = Object.fromEntries(['new', 'read', 'starred', 'done', 'wont'].map((s) => [s, rows.filter((r) => r.status === s).length]));

  // the question of product-market fit: the share who would be very disappointed, and who they are
  const pmf = of('pmf'), very = pmf.filter((r) => r.rating === 2);
  const groups = (/** @type {string} */ key) => { const m = new Map(); for (const r of pmf) { const g = r.ctx && r.ctx[key]; if (!g) continue; if (!m.has(g)) m.set(g, []); m.get(g).push(r); } return [...m].map(([group, list]) => ({ group, n: list.length, score: pair(list.filter((r) => r.rating === 2).length, list.length) })).sort((a, b) => b.n - a.n); };
  const pmfBlock = {
    n: pmf.length, very: very.length, some: pmf.filter((r) => r.rating === 1).length, not: pmf.filter((r) => r.rating === 0).length,
    score: pair(very.length, pmf.length), target: 0.4,
    by_days: groups('days'), by_lang: groups('lang').slice(0, 6),
    benefits: tally(very.map((r) => r.tags)), // what the people who love it say is the main thing
    wishes: pmf.filter((r) => r.text).length,
  };

  // ratings by week: sessions (1–4), the week (1–5)
  const series = (/** @type {any[]} */ list) => {
    const last = weekOf(now), out = [];
    for (let w = last - weeks + 1; w <= last; w++) { const xs = list.filter((r) => weekOf(r.ts) === w).map((r) => r.rating).filter((x) => x != null); out.push({ from: weekStart(w), n: xs.length, avg: avg(xs) }); }
    return out;
  };
  const sess = of('session'), wk = of('week'), pause = of('pause');
  const session = {
    n: sess.length, avg: avg(sess.map((r) => r.rating)), positive: pair(sess.filter((r) => r.rating >= 3).length, sess.length), weekly: series(sess),
    why_bad: tally(sess.filter((r) => r.rating <= 2).map((r) => r.tags)), why_good: tally(sess.filter((r) => r.rating >= 3).map((r) => r.tags)), written: sess.filter((r) => r.text).length,
  };
  const week = { n: wk.length, avg: avg(wk.map((r) => r.rating)), positive: pair(wk.filter((r) => r.rating >= 4).length, wk.length), weekly: series(wk) };
  const pauseBlock = { n: pause.length, helped: pair(pause.filter((r) => r.rating === 1).length, pause.length) };

  // what people ask for and complain about: by the owner's theme when set, else by the first chip; how many are open and how many done
  const asks = (/** @type {string} */ kind) => {
    const m = new Map();
    for (const r of of(kind)) { const key = r.theme || (r.tags && r.tags[0]) || 'other'; const e = m.get(key) || { theme: key, k: 0, open: 0, done: 0, own: !!r.theme }; e.k++; if (r.status === 'done') e.done++; else if (r.status !== 'wont') e.open++; if (r.theme) e.own = true; m.set(key, e); }
    return [...m.values()].sort((a, b) => b.k - a.k || (a.theme < b.theme ? -1 : 1));
  };
  const leaving = of('leaving');
  // the people who left and wrote why: the reasons, and how many added words
  const leavingBlock = { n: leaving.length, reasons: tally(leaving.map((r) => r.tags)), written: leaving.filter((r) => r.text).length };
  const waiting = rows.filter((r) => ['idea', 'problem'].includes(r.kind) && (r.contact || r.can_reply) && !r.replied_at && r.status !== 'wont').length; // asked to be answered, by address or in the extension
  return {
    total: rows.length, new: byStatus.new, by_kind: byKind, by_status: byStatus, waiting_reply: waiting,
    pmf: pmfBlock, session, week, pause: pauseBlock, ideas: asks('idea'), problems: asks('problem'), leaving: leavingBlock,
    done: rows.filter((r) => r.status === 'done' && ['idea', 'problem'].includes(r.kind)).length,
  };
}

/** Filter the messages the inbox shows. `q` looks in the text, the theme and the note, case-insensitively. */
export function filterMessages(/** @type {any[]} */ rows, /** @type {{ kind?: string, status?: string, q?: string, written?: boolean }} */ f = {}) {
  const q = (f.q || '').trim().toLowerCase();
  return rows.filter((r) => (!f.kind || r.kind === f.kind) && (!f.status || r.status === f.status) && (!f.written || r.text) && (!q || [r.text, r.theme, r.note].some((x) => x && String(x).toLowerCase().includes(q))));
}
