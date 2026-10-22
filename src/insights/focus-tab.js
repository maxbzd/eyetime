// Insights → Focus: how the focus sessions went — goal, quality, best hours, weekdays, sessions, tasks, temptations, wins.
// Every block is its own card; blocks without data say what they need instead of disappearing.

import { h, icon, favicon, toast } from '../ui/dom.js';
import { send } from '../ui/api.js';
import { updateSettings } from '../shared/storage.js';
import { t, fmtDuration, fmtDate, fmtTime, weekdayName } from '../shared/i18n.js';
import { parseKey } from '../shared/time.js';
import { estimateAccuracy } from '../shared/quickadd.js';
import { projectRows } from '../shared/projects.js';
import { goalStreak, bestHours, sessionsOf, pauseReasonTotals, PAUSE_REASONS, switchRate, topTemptations, recentWins, weekdayPattern, suggestMinutes } from '../shared/productivity.js';

const card = (title, sub, scope, ...body) => h('section', { class: 'card pcard' }, h('div', { class: 'card-head' }, h('div', {}, h('h3', { text: title }), sub ? h('p', { text: sub }) : null), scope ? h('span', { class: 'scope', text: t('scope.' + scope) }) : null), h('div', { class: 'card-body' }, body));
const kpi = ({ ico, label, value, sub }) => h('div', { class: 'card kpi' }, h('div', { class: 'label' }, icon(ico), label), h('div', { class: 'value num', text: value }), h('div', { class: 'sub', text: sub || '' }));
const lock = (text, ico = 'lock') => h('div', { class: 'locked-hint' }, icon(ico), h('span', { text }));

function bars({ values, best = new Set(), label, tip, axis, cls = '' }) {
  const max = Math.max(...values, 1);
  return h('div', { class: 'bars ' + cls, role: 'img', 'aria-label': label },
    h('div', { class: 'bars-plot' }, values.map((v, i) => h('div', { class: 'bar-col' }, h('i', { class: 'bar' + (best.has(i) ? ' best' : '') + (v ? '' : ' zero'), style: { height: (v ? Math.max(6, (v / max) * 100) : 3) + '%' }, 'data-tip': tip(i, v), tabindex: 0 })))),
    h('div', { class: 'bars-axis' }, axis));
}

export function focusTab({ cur, prev = [], heat, tasks, estTasks, settings }) {
  const goal = settings.focus.dailyGoal;
  const clock24 = settings.newtab.clock24 ?? undefined;
  const hourLabel = (i) => fmtTime(new Date(2000, 0, 1, i), clock24);
  const sessions = sessionsOf(cur).sort((a, b) => b.t - a.t);
  const all = sessionsOf(heat);
  const rated = sessions.filter((s) => s.r);
  const avgR = rated.length ? rated.reduce((a, s) => a + s.r, 0) / rated.length : 0;
  const rates = cur.map(([, d]) => switchRate(d)).filter((r) => r !== null);
  const swPerHour = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
  const daysHit = goal ? cur.filter(([, d]) => (d?.fs || 0) >= goal * 60).length : 0;
  const streak = goalStreak(heat, goal, settings.focus.goalDays, { grace: settings.focus.streakGrace });

  const kpis = h('div', { class: 'kpis kpis-auto' },
    goal ? kpi({ ico: 'target', label: t('prod.goalDays'), value: `${daysHit}/${cur.length}`, sub: t('prod.goalIs', { time: fmtDuration(goal * 60) }) }) : null,
    goal ? kpi({ ico: 'flame', label: t('prod.goalStreak'), value: String(streak), sub: t('prod.days') }) : null,
    kpi({ ico: 'timer', label: t('prod.avgSession'), value: sessions.length ? fmtDuration(Math.round(sessions.reduce((a, s) => a + s.m, 0) / sessions.length) * 60) : '–', sub: t('insights.sessions', { n: sessions.length }) }),
    kpi({ ico: 'zap', label: t('prod.quality'), value: avgR ? (avgR >= 2.5 ? t('review.r3') : avgR >= 1.75 ? t('review.r2') : t('review.r1')) : '–', sub: rated.length ? t('prod.rated', { n: rated.length }) : t('prod.rateHint') }),
    kpi({ ico: 'shuffle', label: t('prod.switches'), value: swPerHour === null ? '–' : String(Math.round(swPerHour)), sub: t('prod.switchesSub') }));

  /* best hours */
  const best = bestHours(heat);
  const hoursCard = card(t('prod.best'), best ? t('prod.bestBody', { from: hourLabel(best.start), to: hourLabel(best.end), pct: Math.round(best.share * 100) }) : t('prod.bestLocked'), 'weeks16',
    best
      ? h('div', {}, bars({ values: best.byHour, best: new Set([best.start, (best.start + 1) % 24]), label: t('prod.bestAria', { from: hourLabel(best.start), to: hourLabel(best.end) }), cls: 'h24',
          tip: (i, v) => `${hourLabel(i)} · ${fmtDuration(Math.round(v) * 60)}`,
          axis: Array.from({ length: 24 }, (_, i) => h('span', { text: i % 6 === 0 ? String(i).padStart(2, '0') : '' })) }), h('p', { class: 'chart-note', text: t('prod.bestLegend') }), (() => {
          const time = `${String(best.start).padStart(2, '0')}:00`;
          const near = (r) => { const d = Math.abs(Number(r.time.slice(0, 2)) - best.start); return Math.min(d, 24 - d) <= 1; }; // around midnight 23:00 and 00:00 are neighbours
          const have = (settings.focus.reminders || []).some(near);
          return have ? h('p', { class: 'chart-note', text: t('prod.remindHave', { time: hourLabel(best.start) }) })
            : h('button', { class: 'btn btn-sm', type: 'button', style: { marginTop: 'var(--s-3)' }, onclick: async () => {
              if ((settings.focus.reminders || []).length >= 5) { toast(t('prod.remindFull')); return; }
              await updateSettings((x) => { x.focus.reminders = [...x.focus.reminders, { id: Date.now().toString(36), time, days: [1, 2, 3, 4, 5], minutes: x.focus.minutes }].slice(0, 5); });
              await send('settings:changed'); toast(t('prod.remindSet', { time: hourLabel(best.start) }));
            } }, icon('alarm-clock'), t('prod.remindBest', { time: hourLabel(best.start) }));
        })())
      : lock(t('prod.bestNeed', { n: all.length, total: 6 }), 'clock'));

  /* weekday pattern */
  const wk = weekdayPattern(heat, goal);
  const wkOk = wk.reduce((a, d) => a + d.days, 0) >= 10 && wk.some((d) => d.avgMin > 0);
  const order = [1, 2, 3, 4, 5, 6, 0];
  const wkMax = Math.max(...wk.map((d) => d.avgMin));
  const weekCard = card(t('prod.weekdays'), t('prod.weekdaysSub'), 'weeks16',
    wkOk ? bars({ values: order.map((w) => wk[w].avgMin), best: new Set(order.map((w, i) => (wk[w].avgMin === wkMax ? i : -1)).filter((i) => i >= 0)), label: t('prod.weekdays'), cls: 'wk',
      tip: (i, v) => `${weekdayName(order[i], 'long')} · ${fmtDuration(v * 60)}`,
      axis: order.map((w) => h('span', {}, weekdayName(w), h('b', { class: 'num', text: wk[w].avgMin ? fmtDuration(wk[w].avgMin * 60) : '–' }))) })
      : lock(t('prod.weekdaysNeed')));

  /* recent sessions */
  const ratingIcon = (r) => (r ? h('span', { class: 'rating r' + r, 'data-tip': t('review.r' + r) }, icon(r === 3 ? 'zap' : r === 2 ? 'meh' : 'frown')) : h('span', { class: 'muted', text: '–' }));
  const sessionsCard = card(t('prod.recent'), null, 'period',
    sessions.length
      ? h('table', { class: 'sites' }, h('tbody', {}, sessions.slice(0, 7).map((s) => h('tr', {},
          h('td', { class: 'time', style: { textAlign: 'left', width: '1%' }, text: fmtDate(new Date(s.t), { weekday: 'short' }) + ' ' + fmtTime(new Date(s.t), clock24) }),
          h('td', { class: 'name' }, h('span', { class: 'truncate', text: s.g || t('prod.noGoal'), title: s.g || '' })),
          h('td', { class: 'time', text: fmtDuration(s.m * 60) + (s.c ? '' : ' · ' + t('prod.early')) }),
          h('td', { class: 'time', style: { width: '32px' } }, ratingIcon(s.r))))))
      : lock(t('prod.noSessions'), 'target'));

  /* by task + best length */
  const topTasks = tasks.filter((x) => x.focusSec >= 60).sort((a, b) => b.focusSec - a.focusSec).slice(0, 5);
  const tMax = topTasks[0]?.focusSec || 1;
  const len = suggestMinutes(heat, settings.focus.presets);
  const taskCard = card(t('prod.byTask'), null, 'allTime',
    topTasks.length
      ? h('div', { class: 'meter-list' }, topTasks.map((x) => h('div', { class: 'meter-row' }, h('span', { class: 'truncate', text: x.text }), h('span', { class: 'num muted-2', text: fmtDuration(x.focusSec) }), h('div', { class: 'progress' }, h('i', { class: 'productive', style: { width: Math.max(3, (x.focusSec / tMax) * 100) + '%' } })))))
      : lock(t('prod.noTaskTime'), 'list-checks'),
    len ? h('div', { class: 'len-block' }, h('h4', { text: t('prod.length') }), h('p', { class: 'muted-2', text: t('prod.lengthBody', { n: len.minutes }) }),
      h('div', { class: 'row gap-2 wrap' }, len.lengths.map((l) => h('span', { class: 'chip' + (l.minutes === len.minutes ? ' good' : ''), text: `${fmtDuration(l.minutes * 60)} · ${l.mean.toFixed(1)}/3 · ${l.n}×` })))) : null);

  /* temptations, wins, pause page */
  const tempt = topTemptations(cur, 5);
  const tMaxN = tempt[0]?.count || 1;
  const temptCard = card(t('prod.tempt'), t('prod.temptSub'), 'period',
    tempt.length ? h('div', { class: 'meter-list' }, tempt.map((x) => h('div', { class: 'meter-row' }, h('span', { class: 'site' }, favicon(x.host), h('span', { class: 'truncate', text: x.host })), h('span', { class: 'num muted-2', text: t('prod.times', { n: x.count }) }), h('div', { class: 'progress' }, h('i', { class: 'distracting', style: { width: Math.max(3, (x.count / tMaxN) * 100) + '%' } })))))
      : lock(t('prod.noTempt'), 'shield-check'));

  const wins = recentWins(heat, 5);
  const winsCard = card(t('prod.wins'), null, 'weeks16',
    wins.length ? h('div', { class: 'wins' }, wins.map((w) => h('div', { class: 'win' }, icon('sparkles'), h('span', { class: 'win-d', text: fmtDate(parseKey(w.key), { weekday: 'short', day: 'numeric', month: 'short' }) }), h('span', { text: w.text }))))
      : lock(t('prod.noWins'), 'moon'));

  const reasons = pauseReasonTotals(cur);
  const reasonTotal = PAUSE_REASONS.reduce((a, r) => a + (reasons[r] || 0), 0);
  const pauseCard = card(t('prod.pauses'), reasonTotal ? t('prod.pausesSub', { n: reasons.back || 0, total: reasonTotal }) : null, 'period',
    reasonTotal ? h('div', { class: 'row gap-2 wrap' }, PAUSE_REASONS.filter((r) => reasons[r]).map((r) => h('span', { class: 'chip' + (r === 'back' ? ' good' : ''), text: `${t('block.why.' + r)} · ${reasons[r]}` })))
      : lock(t('prod.noPauses'), 'wind'));

  /* planning fallacy: planned vs actual on finished tasks */
  const acc = estimateAccuracy(estTasks || tasks);
  const estCard = card(t('prod.estimate'), t('prod.estimateSub'), 'allTime',
    acc
      ? h('div', { class: 'stack gap-3' },
          h('p', { class: 'est-verdict ' + acc.verdict, text: acc.verdict === 'under' ? t('prod.estimateUnder', { x: (Math.round(acc.median * 10) / 10).toString() }) : acc.verdict === 'over' ? t('prod.estimateOver', { pct: Math.round(acc.median * 100) }) : t('prod.estimateGood') }),
          h('div', { class: 'meter-list' }, acc.rows.map((r) => h('div', { class: 'meter-row est-row' }, h('span', { class: 'truncate', text: r.text }), h('span', { class: 'num muted-2', text: `${fmtDuration(r.est * 60)} → ${fmtDuration(r.actual * 60)}` }),
            h('div', { class: 'progress est-bar', 'data-tip': `${t('prod.estPlanned')} ${fmtDuration(r.est * 60)} · ${t('prod.estActual')} ${fmtDuration(r.actual * 60)}` }, h('i', { class: r.ratio > 1.15 ? 'distracting' : 'productive', style: { width: Math.min(100, Math.max(4, (r.actual / Math.max(r.est, r.actual)) * 100)) + '%' } }))))))
      : lock(t('prod.estimateNeed'), 'timer'));

  // focus time per project (#tag of the task a session was started for)
  const pr = projectRows(cur, prev);
  const maxSec = Math.max(...pr.rows.map((r) => r.sec), 1);
  const deltaText = (r) => (r.delta === null ? t('prod.projectsNew') : Math.round(Math.abs(r.delta) * 100) === 0 ? '0%' : `${r.delta >= 0 ? '+' : '−'}${Math.round(Math.abs(r.delta) * 100)}%`);
  const projectsCard = card(t('prod.projects'), t('prod.projectsSub'), 'period',
    pr.rows.length
      ? h('div', { class: 'stack gap-3' },
          h('div', { class: 'meter-list' }, pr.rows.slice(0, 8).map((r) => h('div', { class: 'meter-row proj-row' },
            h('span', { class: 'truncate', text: '#' + r.tag }),
            h('span', { class: 'num muted-2', text: `${fmtDuration(r.sec)} · ${t('prod.projectsSessions', { n: r.sessions })} · ${deltaText(r)}` }),
            h('div', { class: 'progress', 'data-tip': `${Math.round(r.share * 100)}%` }, h('i', { class: 'productive', style: { width: Math.max(4, (r.sec / maxSec) * 100) + '%' } })))) ),
          pr.untaggedSec >= 60 ? h('p', { class: 'chart-note', text: t('prod.projectsUntagged', { time: fmtDuration(pr.untaggedSec) }) }) : null)
      : lock(t('prod.projectsNone'), 'tag'));

  return h('div', { class: 'stack gap-4' }, kpis,
    h('div', { class: 'grid-eq' }, hoursCard, weekCard),
    h('div', { class: 'grid-eq' }, sessionsCard, taskCard),
    projectsCard,
    h('div', { class: 'grid-3' }, temptCard, winsCard, pauseCard),
    estCard);
}
