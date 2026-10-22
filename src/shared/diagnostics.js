// The text a person can copy into a bug report: versions, counts and recent errors — no site names, tasks, notes or goals.
// It is built on demand and shown before anything leaves the page; EyeTime never sends it by itself.
import { LANGUAGES } from './locales/index.js';


const pick = (v, allowed) => (allowed.includes(v) ? v : 'other');

/** Pure. info: { version, userAgent, platform, language, settings, counts:{days,tasks,notes,habits}, bytes, errors:[{src,msg,at,n}], now } */
export function buildReport(info) {
  const s = info.settings || {};
  const f = s.focus || {}, b = s.blocking || {}, ap = s.appearance || {}, nt = s.newtab || {};
  const on = (v) => (v ? 'on' : 'off');
  const lines = [
    `EyeTime ${info.version}`,
    `Browser: ${String(info.userAgent || '').replace(/^Mozilla\/5\.0 /, '').slice(0, 160)}`,
    `Platform: ${info.platform || '?'}`,
    `Language: ${pick(s.language, ['auto', ...Object.keys(LANGUAGES)])} (browser ${info.language || '?'})`,
    `Look: ${ap.look || '?'} · mode ${ap.mode || '?'} · scale ${ap.scale || 100}% · density ${ap.density || '?'} · custom CSS ${on(ap.customCss)}`,
    `Home: layout ${nt.layout || '?'} · clock ${nt.clockStyle || '?'} · background ${nt.background || '?'}`,
    `Focus: default ${f.minutes || '?'} min · strict ${on(f.strict)} · scope ${f.scope || '?'} · goal ${f.dailyGoal || 0} min · modes ${(f.modes || []).length} · reminders ${(f.reminders || []).length} · ambient ${f.ambient || 'off'}`,
    `Blocking: friction ${on(b.friction && b.friction.enabled)} · schedule ${on(b.schedule && b.schedule.enabled)} · budget ${on(b.budget && b.budget.enabled)} · lists custom ${(b.custom || []).length} / allow ${(b.allow || []).length} / always ${(b.always || []).length} / limits ${Object.keys(b.limits || {}).length}`,
    `Data: ${info.counts ? `${info.counts.days} days · ${info.counts.tasks} tasks · ${info.counts.notes} notes · ${info.counts.habits} habits` : '?'} · storage ${info.bytes != null ? `${Math.round(info.bytes / 1024)} KB` : '?'}`,
    `Sync: ${on(info.sync)}`,
    '',
    `Recent errors (${(info.errors || []).length}):`,
  ];
  if (!(info.errors || []).length) lines.push('  none');
  for (const e of info.errors || []) lines.push(`  [${e.src}] ${new Date(e.at).toISOString()}${e.n > 1 ? ` ×${e.n}` : ''}\n    ${String(e.msg).replace(/\n/g, '\n    ')}`);
  return lines.join('\n');
}

/** Link to a prefilled GitHub issue (the URL has a length limit, so only the head of the report goes in; the full text is copied to the clipboard). */
export function issueUrl(report, title = 'Bug: ') {
  const body = `**What happened?**\n\n\n**Steps to reproduce**\n1. \n\n<details><summary>Diagnostic report</summary>\n\n\`\`\`\n${report.slice(0, 1400)}\n\`\`\`\n\n</details>\n`;
  const q = new URLSearchParams({ template: 'bug_report.md', title, body });
  return `https://github.com/maxbzd/eyetime/issues/new?${q.toString()}`;
}

