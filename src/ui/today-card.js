// "Today" summary: total, split by site type, top sites and the eye-break row. Shared by popup and new tab.

import { h, icon, favicon, clear } from './dom.js';
import { send } from './api.js';
import { t, fmtDuration } from '../shared/i18n.js';
import { getSettings, getDays, getRaw, onChange } from '../shared/storage.js';
import { makeClassifier } from '../shared/classify.js';
import { summarize, focusStreak } from '../shared/stats.js';
import { dayKey, rangeKeys } from '../shared/time.js';

export function mountToday(root, { closeOnBreak = false, sites = 3 } = {}) {
  const st = { settings: null, today: null, yesterday: null, eye: { since: 0, due: false }, streak: 0 };

  async function load() {
    st.settings = await getSettings();
    const days = await getDays(rangeKeys(30));
    st.today = days[29][1]; st.yesterday = days[28][1];
    st.streak = focusStreak(days);
    const eye = await send('break:state');
    if (eye && typeof eye.since === 'number') st.eye = eye;
  }

  function eyeRow() {
    const { eye } = st.settings;
    if (!eye.enabled) return null;
    const left = Math.max(0, eye.intervalMin * 60 - (st.eye.since || 0));
    const due = st.eye.due;
    return h('div', { class: 'breaks' + (due ? ' due' : '') },
      h('span', { class: 'lbl' }, icon('eye'), due ? t('eye.due') : t('eye.nextIn', { time: fmtDuration(left) })),
      h('button', { class: 'btn btn-sm ' + (due ? 'btn-primary' : 'btn-ghost'), type: 'button', onclick: () => { send('break:open'); if (closeOnBreak) window.close(); } }, t('eye.breakNow')));
  }

  function render() {
    const { classify } = makeClassifier(st.settings);
    const sum = summarize([[dayKey(), st.today]], classify);
    const y = summarize([[dayKey(), st.yesterday]], classify);

    if (sum.total < 60) {
      clear(root,
        h('div', { class: 'empty', style: { padding: 'var(--s-4)' } }, h('div', { class: 'empty-icon' }, icon('chart-column')), h('h4', { text: t('today.emptyTitle') }), h('p', { text: t('today.emptyBody') })),
        eyeRow());
      return;
    }
    const diff = y.total >= 60 ? sum.total - y.total : null;
    const deltaTxt = diff === null ? '' : Math.abs(diff) < 300 ? t('today.sameAsYesterday') : t(diff > 0 ? 'today.moreThanYesterday' : 'today.lessThanYesterday', { time: fmtDuration(Math.abs(diff)) });
    const seg = (cls, key) => sum[key] > 0 ? h('i', { class: cls, style: { flexGrow: sum[key] }, 'data-tip': `${t('class.' + { p: 'productive', n: 'neutral', d: 'distracting' }[cls])}: ${fmtDuration(sum[key])}` }) : null;
    const top = sum.topSites.slice(0, sites);
    const max = top[0]?.sec || 1;
    clear(root,
      h('div', { class: 'today-head' },
        h('div', {}, h('div', { class: 'eyebrow', text: t('today.title') }), h('div', { class: 'today-total num', text: fmtDuration(sum.total) })),
        h('div', { class: 'delta-note', text: deltaTxt })),
      h('div', { class: 'split', role: 'img', 'aria-label': t('today.splitLabel') }, seg('p', 'productive'), seg('n', 'neutral'), seg('d', 'distracting')),
      h('div', { class: 'legend-grid' }, [['productive', 'dot-productive'], ['neutral', 'dot-neutral'], ['distracting', 'dot-distracting']].map(([k, dot]) =>
        h('div', {}, h('span', { class: 'lg' }, h('i', { class: 'dot ' + dot }), t('class.' + k)), h('b', { class: 'num', text: fmtDuration(sum[k]) })))),
      top.length ? h('div', { class: 'top-sites' }, top.map((s) => h('div', { class: 'top-site' }, favicon(s.host), h('span', { class: 'truncate', text: s.host }), h('span', { class: 't num', text: fmtDuration(s.sec) }), h('div', { class: 'bar' }, h('i', { class: 'cls-' + s.cls, style: { width: (s.sec / max) * 100 + '%' } }))))) : null,
      st.streak >= 2 ? h('div', { class: 'streak' }, icon('flame'), t('insight.streak', { n: st.streak })) : null,
      eyeRow());
  }

  async function refresh() { await load(); render(); }
  refresh();
  onChange(['d:*', 'settings'], refresh);
  return { refresh };
}
