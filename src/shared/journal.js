// Markdown journal: one section per day with focus time, sessions and the "what went well" line.
// Totals only — no site names or task titles beyond the goals the person typed for their own sessions.

import { t, fmtDuration, fmtDate, fmtTime } from './i18n.js';
import { parseKey } from './time.js';

const RATING = { 1: 'review.r1', 2: 'review.r2', 3: 'review.r3' };

/** entries: [[dayKey, day]] (any order). classify(host) → 'productive'|'neutral'|'distracting'. clock24: see fmtTime. Returns Markdown. */
/** @param {any[]} entries @param {{ classify?: (host: string) => string, clock24?: boolean }} [opts] */
export function buildJournal(entries, { classify = () => 'neutral', clock24 = undefined } = {}) {
  const days = entries.filter(([, d]) => d && ((d.fs || 0) > 0 || (d.ss || []).length || d.w || Object.keys(d.d || {}).length || Object.keys(d.a || {}).length)).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  if (!days.length) return `# ${t('journal.title')}\n\n${t('journal.empty')}\n`;
  const from = parseKey(days[days.length - 1][0]), to = parseKey(days[0][0]);
  /** @type {Intl.DateTimeFormatOptions} */
  const fmt = { day: 'numeric', month: 'short', year: 'numeric' };
  const out = [`# ${t('journal.title')}`, '', `${fmtDate(from, fmt)} – ${fmtDate(to, fmt)}`, ''];
  for (const [key, d] of days) {
    out.push(`## ${fmtDate(parseKey(key), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`, '');
    let total = 0, bad = 0;
    for (const [host, sec] of Object.entries(d.d || {})) { total += sec; if (classify(host) === 'distracting') bad += sec; }
    for (const sec of Object.values(d.a || {})) total += sec; // desktop apps (companion) count as neutral, like in Insights
    const bits = [`${t('journal.focus')}: ${fmtDuration(d.fs || 0)}${(d.ss || []).length ? ` (${t('insights.sessions', { n: (d.ss || []).length })})` : ''}`];
    if (total >= 60) bits.push(`${t('journal.screen')}: ${fmtDuration(total)}`, `${t('insights.distractionShare')}: ${Math.round((bad / total) * 100)}%`);
    if (d.b) bits.push(`${t('insights.eyeBreaks')}: ${d.b}`);
    out.push(`- ${bits.join(' · ')}`);
    for (const s of [...(d.ss || [])].sort((a, b) => a.t - b.t)) {
      out.push(`  - ${fmtTime(new Date(s.t), clock24)} · ${fmtDuration(s.m * 60)}${s.g ? ` · ${s.g}` : ''}${s.r ? ` — ${t(RATING[s.r])}` : ''}${s.c ? '' : ` (${t('prod.early')})`}`);
    }
    if (d.w) out.push(`- ${t('journal.wins')}: ${d.w}`);
    out.push('');
  }
  return out.join('\n');
}
