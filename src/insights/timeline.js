// Insights → Patterns: one day hour by hour — time by site type — with the focus sessions laid on a lane underneath.

import { h, icon } from '../ui/dom.js';
import { stackedColumns, classLegend, attachTip, tipBody } from '../ui/charts.js';
import { t, fmtDuration, fmtDate, fmtTime } from '../shared/i18n.js';
import { summarize } from '../shared/stats.js';
import { sessionsOf } from '../shared/productivity.js';
import { parseKey } from '../shared/time.js';

/** entry = [dayKey, day]. nav = { onPrev, onNext } (null disables). */
export function timelineCard({ entry, classify, clock24, nav }) {
  const [key, day] = entry;
  const sum = summarize([entry], classify);
  const date = parseKey(key);
  const hourTotal = (hr) => hr.productive + hr.neutral + hr.distracting;
  const active = sum.hourly.map(hourTotal);
  const first = active.findIndex((v) => v > 0), last = active.length - 1 - [...active].reverse().findIndex((v) => v > 0);
  const hourLabel = (i) => fmtTime(new Date(2000, 0, 1, i), clock24);

  const items = sum.hourly.map((hr, i) => ({ key: i, label: `${String(i).padStart(2, '0')}:00`, sub: `${hourLabel(i)}`, axis: String(i), values: hr }));
  const chart = stackedColumns(items, { axisEvery: 3, height: 150 });

  const sessions = sessionsOf([entry]).filter((s) => s.m > 0).sort((a, b) => a.t - b.t);
  const mid = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const lane = h('div', { class: 'tl-lane', role: 'group', 'aria-label': t('insights.focusLane') },
    sessions.map((s) => {
      const startMin = Math.max(0, (s.t - mid) / 60000), left = (startMin / 1440) * 100, width = Math.max(0.5, Math.min(100 - left, (s.m / 1440) * 100));
      const end = new Date(s.t + s.m * 60000);
      const el = h('div', { class: 'tl-block' + (s.c ? '' : ' early') + (s.r === 3 ? ' deep' : ''), tabindex: 0, role: 'img', style: { left: left + '%', width: width + '%' }, 'aria-label': `${s.g || t('prod.noGoal')}: ${fmtTime(new Date(s.t), clock24)} – ${fmtTime(end, clock24)}` });
      attachTip(el, () => tipBody(s.g || t('prod.noGoal'), [{ cls: '', label: `${fmtTime(new Date(s.t), clock24)} – ${fmtTime(end, clock24)}`, value: fmtDuration(s.m * 60) }].concat(s.r ? [{ cls: '', label: t('review.r' + s.r), value: '' }] : []), ''));
      return el;
    }),
    sessions.length ? null : h('span', { class: 'tl-none', text: t('insights.noSessionsDay') }));

  const summary = sum.total >= 60 && first >= 0
    ? h('div', { class: 'tl-sum' },
        h('span', {}, icon('clock'), t('insights.firstLast', { from: hourLabel(first), to: hourLabel(Math.min(23, last + 1)) })),
        h('span', {}, icon('target'), t('insights.sessions', { n: sessions.length }) + (day?.fs ? ' · ' + fmtDuration(day.fs) : '')),
        h('span', {}, icon('eye'), t('review.breaks', { n: day?.b || 0 })))
    : null;

  const step = (fn, label, ico) => h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': label, disabled: !fn, onclick: fn }, icon(ico.icon));
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' },
      h('div', {}, h('h3', { text: t('insights.timeline') }), h('p', { text: t('insights.timelineSub') })),
      h('div', { class: 'row gap-2' }, step(nav.onPrev, t('insights.prevDay'), { icon: 'chevron-left' }), h('span', { class: 'tl-date num', text: fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short' }) }), step(nav.onNext, t('insights.nextDay'), { icon: 'chevron-right' }))),
    h('div', { class: 'card-body stack gap-3' }, h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, classLegend(sum)), chart, h('div', { class: 'tl-lane-wrap' }, h('span', { class: 'tl-lane-k', text: t('insights.focusLane') }), lane), summary));
}
