// The numbers of a research round, from the filled observation sheet (docs/research/observation-sheet.csv).
//   node scripts-dev/research/summarize.mjs docs/research/observation-sheet.csv
// The thresholds are the ones in docs/research/analysis.md.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** A small CSV reader: quoted fields, doubled quotes, commas and line breaks inside quotes. */
export function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

/** System Usability Scale: odd items (answer − 1), even items (5 − answer), summed, × 2.5. Null when an answer is missing or outside 1–5. */
export function sus(answers) {
  if (answers.length !== 10 || answers.some((a) => !Number.isInteger(a) || a < 1 || a > 5)) return null;
  return answers.reduce((s, a, i) => s + (i % 2 === 0 ? a - 1 : 5 - a), 0) * 2.5;
}

const yes = (v) => /^(yes|y|true|1)$/i.test(v);
const num = (v) => (v === '' || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (n, d) => (d ? Math.round((100 * n) / d) : null);

/** @param {Record<string, string>[]} rows the sessions (an example row with id P00 is ignored) */
export function summarize(rows) {
  const s = rows.filter((r) => r.id && r.id !== 'P00');
  const n = s.length;
  const started = s.filter((r) => yes(r.first_session_started)), unaided = started.filter((r) => yes(r.first_session_unaided) || r.hint_needed_at === 'none');
  const susScores = s.map((r) => sus(Array.from({ length: 10 }, (_, i) => num(r['sus_' + (i + 1)])))).filter((x) => x !== null);
  const changed = s.filter((r) => yes(r.found_theme_change));
  const out = {
    sessions: n,
    understoodFirstScreen: { median_s: median(s.map((r) => num(r.first_look_understood_s)).filter((x) => x !== null)) },
    firstSessionUnaided: { n: unaided.length, of: n, pct: pct(unaided.length, n) },
    timeToFirstSession: { median_s: median(started.map((r) => num(r.first_session_time_s)).filter((x) => x !== null)) },
    makeItMine: { changed: pct(changed.length, n), gotBack: pct(changed.filter((r) => yes(r.changed_look_back_ok)).length, changed.length) },
    settings: { foundEyeBreak: pct(s.filter((r) => yes(r.opened_settings)).length, n), medianLost: median(s.map((r) => num(r.settings_lost)).filter((x) => x !== null)) },
    eyeBreakUnderstood: pct(s.filter((r) => yes(r.eye_break_understood)).length, n),
    sus: { n: susScores.length, mean: susScores.length ? Math.round((susScores.reduce((a, b) => a + b, 0) / susScores.length) * 10) / 10 : null, median: median(susScores) },
    wouldKeep: pct(s.filter((r) => yes(r.would_keep_installed)).length, n),
    blockers: s.reduce((a, r) => a + (num(r.blockers) || 0), 0),
  };
  const flags = [];
  if (n < 15) flags.push(`only ${n} sessions: read the numbers as a direction (the plan is 15–20)`);
  if (out.firstSessionUnaided.pct !== null && out.firstSessionUnaided.pct < 50) flags.push('fewer than half started a first session unaided: the focus line does not read as an invitation');
  if (out.timeToFirstSession.median_s !== null && out.timeToFirstSession.median_s > 90) flags.push('the first session takes longer than 90 s (median)');
  if (out.makeItMine.gotBack !== null && out.makeItMine.gotBack < 90) flags.push('some people could not put the look back: a trust problem, fix first');
  if (out.settings.medianLost !== null && out.settings.medianLost >= 3) flags.push('people get lost in Settings (median ≥ 3)');
  if (out.sus.mean !== null && out.sus.mean < 68) flags.push(`SUS ${out.sus.mean} is below the average of 68`);
  const missing = s.filter((r) => !r.first_session_started || !r.sus_1).map((r) => r.id);
  if (missing.length) flags.push('sessions with missing values: ' + missing.join(', '));
  return { ...out, flags };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node scripts-dev/research/summarize.mjs docs/research/observation-sheet.csv'); process.exit(2); }
  const r = summarize(parseCsv(readFileSync(file, 'utf8')));
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.sessions ? 0 : 1);
}
