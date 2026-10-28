import { dropdown } from '../ui/dropdown.js';
import { bootPage } from '../ui/page.js';
import { mountHeader } from '../ui/header.js';
import { $, h, icon, favicon, clear, toast } from '../ui/dom.js';
import { send } from '../ui/api.js';
import { stackedColumns, classLegend, heatmap, CLASS_ORDER } from '../ui/charts.js';
import { t, fmtDuration, fmtDate, fmtNumber, weekdayName, fmtTime, monthName } from '../shared/i18n.js';
import { getSettings, updateSettings, getDays, getCollection, onChange } from '../shared/storage.js';
import { focusTab } from './focus-tab.js';
import { installPalette } from '../ui/palette.js';
import { timelineCard } from './timeline.js';
import { openWrapped } from './wrapped.js';
import { accuracyInput } from '../shared/tasks.js';
import { mondayKey, weekProgress } from '../shared/week.js';
import { triggerInsights } from '../shared/triggers.js';
import { makeClassifier } from '../shared/classify.js';
import { loadGuess } from '../shared/guessstore.js';
import { summarize, delta, insights as computeInsights, focusStreak, suggestLimit } from '../shared/stats.js';
import { rangeKeys, addDays, dayKey, parseKey } from '../shared/time.js';

const RANGES = { today: 1, 7: 7, 30: 30 };
let range = new URLSearchParams(location.search).get('range') || localStorage.getItem('et-range') || '7';
if (!(range in RANGES)) range = '7';
const TABS = ['overview', 'focus', 'sites', 'patterns'];
let tab = (() => { try { return localStorage.getItem('et-itab'); } catch { return null; } })();
if (!TABS.includes(tab)) tab = 'overview';
let guess = {}, cls = null; // the on-device model's guesses about unknown sites (shared/siteguess.js), and the classifier of the last render
let settings, shown = 10, tableView = false, tlBack = 0; // tlBack: days before today shown in the day timeline

async function load() {
  settings = await getSettings();
  guess = await loadGuess();
  const n = RANGES[range];
  const today = new Date();
  const [cur, prev, heat] = await Promise.all([
    getDays(rangeKeys(n, today)),
    getDays(rangeKeys(n, addDays(today, -n))),
    getDays(rangeKeys(15 * 7 + ((today.getDay() + 6) % 7) + 1, today)), // 16 calendar weeks (Mon-aligned) ending today
  ]);
  const tasks = await getCollection('tasks', []);
  const estLog = await getCollection('estLog', []);
  return { cur, prev, heat, tasks, estLog };
}

/* ---------- pieces ---------- */

/** `tone`: 'upGood' (default), 'upBad', or 'none' (no good/bad colouring — e.g. screen time). */
function deltaChip(pct, { tone = 'upGood', unit = '%' } = {}) {
  if (pct === null || pct === undefined) return null;
  const v = Math.round(pct) || 0;
  const up = v > 0;
  const cls = v === 0 || tone === 'none' ? '' : (up === (tone === 'upBad') ? 'bad' : 'good');
  return h('span', { class: 'delta ' + cls }, icon(v === 0 ? 'minus' : up ? 'trending-up' : 'trending-down'), `${up ? '+' : ''}${fmtNumber(v)}${unit}`);
}

function kpi({ ico, label, value, sub, chip }) {
  return h('div', { class: 'card kpi' }, h('div', { class: 'label' }, icon(ico), label), h('div', { class: 'value num', text: value }), h('div', { class: 'sub' }, chip, sub));
}

function prevLabel() { return range === 'today' ? t('insights.vsYesterday') : t('insights.vsPrev', { n: RANGES[range] }); }

function renderKpis(cur, prev) {
  const shareCur = cur.total ? (cur.distracting / cur.total) * 100 : 0;
  const sharePrev = prev.total >= 60 ? (prev.distracting / prev.total) * 100 : null;
  const breakAvg = cur.activeDays ? cur.breaks / cur.activeDays : 0;
  return h('div', { class: 'kpis' },
    kpi({ ico: 'clock', label: t('insights.screenTime'), value: fmtDuration(cur.total), chip: deltaChip(delta(cur.total, prev.total), { tone: 'none' }), sub: prev.total >= 60 ? prevLabel() : t('insights.noComparison') }),
    kpi({ ico: 'target', label: t('insights.focusTime'), value: fmtDuration(cur.focusSec), chip: deltaChip(delta(cur.focusSec, prev.focusSec)), sub: t('insights.sessions', { n: cur.focusSessions }) }),
    kpi({ ico: 'circle-alert', label: t('insights.distractionShare'), value: Math.round(shareCur) + '%', chip: deltaChip(sharePrev === null ? null : Math.round(shareCur - sharePrev), { tone: 'upBad', unit: t('insights.pts') }), sub: fmtDuration(cur.distracting) }),
    kpi({ ico: 'eye', label: t('insights.eyeBreaks'), value: fmtNumber(cur.breaks), chip: null, sub: range === 'today' ? t('insights.breaksSub') : t('insights.perDay', { n: fmtNumber(Math.round(breakAvg * 10) / 10) }) }));
}

function mainChart(sum) {
  let items, axisEvery, title, subtitle;
  if (range === 'today') {
    const nowH = new Date().getHours();
    items = sum.hourly.map((hr, i) => ({ key: i, future: i > nowH, label: `${String(i).padStart(2, '0')}:00`, sub: `${String(i).padStart(2, '0')}:00 – ${String((i + 1) % 24).padStart(2, '0')}:00`, axis: String(i), values: hr }));
    axisEvery = 3; title = t('insights.byHour'); subtitle = t('insights.byHourSub');
  } else {
    items = sum.days.map((d) => {
      const date = parseKey(d.key);
      return { key: d.key, label: fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short' }), sub: fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' }), axis: range === '7' ? weekdayName(date.getDay()) + ' ' + date.getDate() : String(date.getDate()), values: d };
    });
    axisEvery = range === '7' ? 1 : 3; title = t('insights.byDay'); subtitle = t('insights.byDaySub');
  }
  const body = tableView
    ? h('div', { class: 'card-body', style: { overflowX: 'auto' } }, h('table', { class: 'table-view num' },
        h('thead', {}, h('tr', {}, h('th', { text: t('insights.date') }), CLASS_ORDER.map((c) => h('th', { text: t('class.' + c) })), h('th', { text: t('chart.total') }))),
        h('tbody', {}, items.filter((it) => CLASS_ORDER.some((c) => it.values[c] > 0)).map((it) => h('tr', {}, h('td', { text: it.sub }), CLASS_ORDER.map((c) => h('td', { text: fmtDuration(it.values[c] || 0) })), h('td', { text: fmtDuration(CLASS_ORDER.reduce((a, c) => a + (it.values[c] || 0), 0)) }))))))
    : h('div', { class: 'card-body' }, stackedColumns(items, { axisEvery }));
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', {}, h('h3', { text: title }), h('p', { text: subtitle })),
      h('div', { class: 'row gap-3 wrap' }, classLegend(sum),
        h('div', { class: 'segmented seg-sm', role: 'group', 'aria-label': t('insights.tableView') }, [[false, 'insights.viewChart', { icon: 'chart-column' }], [true, 'insights.viewTable', { icon: 'table-2' }]].map(/** @param {any} a */ ([v, k, ico]) => h('button', { type: 'button', 'aria-pressed': String(tableView === v), onclick: () => { tableView = v; render(); } }, icon(ico.icon), t(k)))))),
    body);
}

function sitesCard(sum) {
  const all = sum.topSites;
  const total = sum.total || 1;
  const max = all[0]?.sec || 1;
  const rows = all.slice(0, shown).map((s) => {
    const sel = dropdown(CLASS_ORDER.map((c) => [c, t('class.' + c)]), s.cls, async (v) => {
      const was = s.cls;
      await updateSettings((st) => { st.sites[s.host] = v; });
      send('settings:changed');
      toast(t('insights.marked', { host: s.host, cls: t('class.' + v).toLowerCase() }), { action: t('common.undo'), onAction: async () => { await updateSettings((st) => { st.sites[s.host] = was; }); send('settings:changed'); } });
    }, { label: t('insights.classifyAria', { host: s.host }), cls: 'tag tag-' + s.cls, bare: true, chevron: false });
    return h('tr', {},
      h('td', { class: 'name' }, h('div', { class: 'site' }, favicon(s.host), h('span', { text: s.host, title: s.host }), cls && cls.guessed(s.host) ? h('span', { class: 'guess-mark', role: 'img', title: t('sg.mark'), 'aria-label': t('sg.mark') }, icon('sparkles')) : null)),
      h('td', { class: 'cls' }, h('span', { class: 'tag-wrap tag-' + s.cls }, sel, icon('chevron-down'))),
      h('td', { class: 'share' }, h('div', { class: 'progress' }, h('i', { class: s.cls, style: { width: Math.max(2, (s.sec / max) * 100) + '%' } }))),
      h('td', { class: 'time', text: fmtDuration(s.sec) }),
      h('td', { class: 'time pct', text: Math.round((s.sec / total) * 100) + '%' }));
  });
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', {}, h('h3', { text: t('insights.sites') }), h('p', { text: t('insights.sitesSub') }))),
    h('div', { class: 'card-body', style: { paddingTop: 'var(--s-3)' } },
      all.length ? h('table', { class: 'sites sites-sel' }, h('thead', {}, h('tr', {}, h('th', { text: t('insights.site') }), h('th', { text: t('insights.class') }), h('th', { class: 'share', text: t('insights.share') }), h('th', { text: t('insights.time'), style: { textAlign: 'right' } }), h('th', { class: 'pct' }, h('span', { class: 'sr-only', text: '%' })))), h('tbody', {}, rows))
        : h('div', { class: 'empty' }, h('p', { text: t('insights.noSites') })),
      all.length > shown ? h('div', { class: 'more' }, h('button', { class: 'btn btn-sm', type: 'button', onclick: () => { shown += 15; render(); } }, t('insights.showMore', { n: all.length - shown }))) : null));
}

/** The stored plan (current or the previous week's) whose week is `key`. */
async function weekPlanFor(key) {
  for (const name of ['weekPlan', 'weekPlanPrev']) { const p = await getCollection(name, null); if (p && p.week === key) return p; }
  return null;
}

/** The week whose goals the review reports: a stored plan's week when the range touches it (Monday morning still sees last week's goals). */
function weekOfRange(plans, rows) {
  const first = mondayKey(parseKey(rows[0][0])), last = mondayKey(parseKey(rows[rows.length - 1][0]));
  const hit = plans.find((p) => p && p.week === last) || plans.find((p) => p && p.week === first);
  return hit ? hit.week : last;
}

function reviewCard(cur, prev) {
  const share = cur.total ? Math.round((cur.distracting / cur.total) * 100) : 0;
  const sharePrev = prev.total >= 60 ? Math.round((prev.distracting / prev.total) * 100) : null;
  const sug = suggestLimit(cur, settings.blocking.limits);
  const line = (ico, text, chip) => h('div', { class: 'review-line' }, h('div', { class: 'ico-wrap' }, icon(ico)), h('span', { class: 'grow', text }), chip);
  const action = sug
    ? h('div', { class: 'review-suggest' },
        h('div', {}, h('b', { text: t('review.suggestTitle') }), h('p', { class: 'muted-2', text: t('review.suggestBody', { host: sug.host, avg: sug.avgMin, limit: sug.limitMin }) })),
        h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: async () => {
          await updateSettings((st) => { st.blocking.limits[sug.host] = sug.limitMin; });
          send('settings:changed');
          toast(t('review.limitSet', { host: sug.host, n: sug.limitMin }), { action: t('common.undo'), onAction: async () => { await updateSettings((st) => { delete st.blocking.limits[sug.host]; }); send('settings:changed'); } });
        } }, t('review.setLimit', { n: sug.limitMin })))
    : sharePrev !== null && share - sharePrev >= 5
      ? h('div', { class: 'review-suggest warn' }, icon('trending-up'), h('span', { text: t('review.rising', { pts: share - sharePrev }) }))
      : h('div', { class: 'review-suggest ok' }, icon('sparkles'), h('span', { text: t('review.balanced') }));
  return h('section', { class: 'card review' },
    h('div', { class: 'card-head' }, h('div', {}, h('h3', { text: t('review.title') }), h('p', { text: t('review.sub') })),
      h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => { const key = weekOfRange([await getCollection('weekPlan', null), await getCollection('weekPlanPrev', null)], data.cur); const plan = await weekPlanFor(key); openWrapped({ sum: cur, prev, cur: data.cur, goalMin: settings.focus.dailyGoal, weekGoals: weekProgress(plan, key) }); } }, icon('image'), t('wrapped.share'))),
    h('div', { class: 'card-body', style: { paddingTop: 'var(--s-3)' } },
      line('target', t('review.focus', { time: fmtDuration(cur.focusSec), n: cur.focusSessions }), deltaChip(delta(cur.focusSec, prev.focusSec))),
      line('circle-alert', t('review.share', { pct: share }), deltaChip(sharePrev === null ? null : share - sharePrev, { tone: 'upBad', unit: t('insights.pts') })),
      line('eye', t('review.breaks', { n: cur.breaks }), null),
      action));
}

const TEXT = {
  worstDay: (p) => ({ icon: 'calendar-x', tone: 'bad', text: t('insight.worstDay', { weekday: weekdayName(p.weekday, 'long'), time: fmtDuration(p.sec) }) }),
  bestDay: (p) => ({ icon: 'calendar-check', tone: 'good', text: t('insight.bestDay', { weekday: weekdayName(p.weekday, 'long'), pct: p.pct }) }),
  peakHour: (p) => ({ icon: 'sun', tone: 'good', text: t('insight.peakHour', { time: fmtTime(new Date(2000, 0, 1, p.hour), settings.newtab.clock24 ?? undefined) }) }),
  lateNight: (p) => ({ icon: 'moon', tone: 'bad', text: t('insight.lateNight', { time: fmtDuration(p.sec) }) }),
  distractionShare: (p) => ({ icon: 'circle-alert', tone: '', text: t('insight.distractionShare', { pct: p.pct }) + (p.delta === null || Math.abs(p.delta) < 5 ? '' : ' ' + t(p.delta > 0 ? 'insight.moreThanBefore' : 'insight.lessThanBefore', { pct: Math.abs(p.delta) })) }),
  topDistraction: (p) => ({ icon: 'flame', tone: 'bad', text: t('insight.topDistraction', { host: p.host, time: fmtDuration(p.sec) }) }),
  focusTotal: (p) => ({ icon: 'target', tone: 'good', text: t('insight.focusTotal', { n: p.sessions, time: fmtDuration(p.sec) }) }),
};

function insightsCard(cur, prev, streak) {
  const items = computeInsights(cur, prev.total >= 60 ? prev : null).map((i) => TEXT[i.id](i.params));
  const body = items.length
    ? items.map((i) => h('div', { class: 'insight tone-' + i.tone }, h('div', { class: 'ico-wrap' }, icon(i.icon)), h('p', { text: i.text })))
    : [h('div', { class: 'empty', style: { padding: 'var(--s-6) 0' } }, h('div', { class: 'empty-icon' }, icon('sparkles')), h('p', { text: t('insights.needMoreData') }))];
  if (streak >= 2) body.push(h('div', { class: 'insight tone-good' }, h('div', { class: 'ico-wrap' }, icon('flame')), h('p', { text: t('insight.streak', { n: streak }) })));
  return h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('div', {}, h('h3', { text: t('insights.highlights' ) }), h('p', { text: t('insights.highlightsSub') }))), h('div', { class: 'card-body', style: { paddingTop: 'var(--s-2)' } }, body));
}

function typicalDay(sum) {
  const n = Math.max(1, sum.activeDays);
  const items = sum.hourly.map((hr, i) => ({ key: i, label: `${String(i).padStart(2, '0')}:00`, sub: t('insights.typicalAt', { time: `${String(i).padStart(2, '0')}:00` }), axis: String(i), values: Object.fromEntries(CLASS_ORDER.map((c) => [c, hr[c] / n])) }));
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', {}, h('h3', { text: t('insights.typicalDay') }), h('p', { text: t('insights.typicalDaySub') }))),
    h('div', { class: 'card-body' }, stackedColumns(items, { axisEvery: 3, height: 180 })));
}

function heatCard(heatEntries) {
  const cells = heatEntries.map(([key, d]) => {
    const date = parseKey(key);
    const sec = Object.values(d?.d || {}).reduce((a, b) => a + b, 0) + Object.values(d?.a || {}).reduce((a, b) => a + b, 0);
    return { key, date, sec, title: fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' }) };
  });
  const firstIdx = cells.findIndex((c) => c.sec > 0);
  cells.forEach((c, i) => { c.pre = firstIdx < 0 || i < firstIdx; });
  const active = cells.filter((c) => c.sec > 0);
  const max = Math.max(...cells.map((c) => c.sec), 0);
  // quantile thresholds over active days keep the scale readable when one day is huge
  const sorted = active.map((c) => c.sec).sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] || 0;
  const cuts = [q(0.25), q(0.5), q(0.75)];
  const level = (sec) => (!sec ? 0 : sec > cuts[2] ? 4 : sec > cuts[1] ? 3 : sec > cuts[0] ? 2 : 1);
  const weeks = Math.ceil((cells.length + ((cells[0].date.getDay() + 6) % 7)) / 7);
  // month labels sit above the first week-column of each month
  const months = []; let lastM = -1;
  for (let c = 0; c < weeks; c++) {
    const cell = cells[Math.max(0, c * 7 - ((cells[0].date.getDay() + 6) % 7))];
    const m = cell.date.getMonth();
    months.push(m !== lastM ? h('span', { text: monthName(m) }) : h('span'));
    lastM = m;
  }
  const busiest = active.length ? active.reduce((a, b) => (b.sec > a.sec ? b : a)) : null;
  const avg = active.length ? active.reduce((a, c) => a + c.sec, 0) / active.length : 0;
  const stat = (label, value) => h('div', { class: 'hm-stat' }, h('span', { text: label }), h('b', { class: 'num', text: value }));
  const dayLabels = [1, 3, 5].map((w) => h('span', { style: { gridRow: String(((w + 6) % 7) + 1) }, text: weekdayName(w) }));
  const grid = heatmap(cells, max, { level });
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', {}, h('h3', { text: t('insights.calendar') }), h('p', { text: t('insights.calendarSub') }))),
    h('div', { class: 'card-body' },
      h('div', { class: 'hm-stats' }, stat(t('insights.hmActive'), `${active.length}/${cells.length}`), stat(t('insights.hmAvg'), active.length ? fmtDuration(avg) : '–'), stat(t('insights.hmBusiest'), busiest ? `${fmtDate(busiest.date, { day: 'numeric', month: 'short' })} · ${fmtDuration(busiest.sec)}` : '–')),
      h('div', { class: 'heat-wrap', style: { '--weeks': weeks } },
        h('div', { class: 'heat-months' }, months),
        h('div', { class: 'heat-body' }, h('div', { class: 'heat-days' }, dayLabels), grid),
        h('div', { class: 'heat-legend' }, t('insights.less'), [0, 1, 2, 3, 4].map((l) => h('span', { class: 'hm-cell l' + l })), t('insights.more')))));
}

function triggersCard(classify) {
  const rows = triggerInsights(data.heat, classify);
  const hour = (n) => fmtTime(new Date(2000, 0, 1, n), settings.newtab.clock24 ?? undefined);
  const body = rows.length ? rows.map((r) => {
    const has = Object.keys(settings.blocking.limits).some((d) => r.host === d || r.host.endsWith('.' + d));
    return h('div', { class: 'trig' },
      h('div', { class: 'trig-head' }, favicon(r.host), h('b', { class: 'truncate', text: r.host }), r.attempts ? h('span', { class: 'muted', text: t('trig.visits', { n: r.attempts }) }) : null),
      h('p', { class: 'trig-line', text: [r.peak && r.kind === 'window' ? t('trig.window', { from: hour(r.peak.from), to: hour(r.peak.to), pct: Math.round(r.peak.share * 100) }) : null, t('trig.avg', { n: r.avgMin })].filter(Boolean).join(' · ') }),
      h('p', { class: 'muted-2', text: t('trig.tip' + { window: 'Window', limit: 'Limit', watch: 'Watch' }[r.kind]) }),
      r.kind === 'watch' ? null : h('div', { class: 'row gap-2 wrap' },
        has ? h('span', { class: 'chip good', text: t('trig.hasLimit') }) : h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => {
          await updateSettings((st) => { st.blocking.limits[r.host] = r.limitMin; }); send('settings:changed');
          toast(t('trig.limitSet', { host: r.host, n: r.limitMin }), { action: t('common.undo'), onAction: async () => { await updateSettings((st) => { delete st.blocking.limits[r.host]; }); send('settings:changed'); } }); render();
        } }, icon('timer'), t('trig.setLimit', { n: r.limitMin })),
        h('a', { class: 'btn btn-sm btn-ghost', href: '../options/options.html#blocking' }, icon('pencil'), t('trig.writePlan'))));
  }) : [h('div', { class: 'locked-hint' }, icon('clock'), h('span', { text: t('trig.need') }))];
  return h('section', { class: 'card pcard' }, h('div', { class: 'card-head' }, h('div', {}, h('h3', { text: t('trig.title') }), h('p', { text: t('trig.sub') })), h('span', { class: 'scope', text: t('scope.weeks16') })), h('div', { class: 'card-body stack gap-4' }, body));
}

function appsCard(sum) {
  if (!sum.topApps.length) return null;
  const max = sum.topApps[0].sec;
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', {}, h('h3', { text: t('insights.apps') }), h('p', { text: t('insights.appsSub') }))),
    h('div', { class: 'card-body' }, h('table', { class: 'sites' }, h('tbody', {}, sum.topApps.slice(0, 8).map((a) => h('tr', {},
      h('td', { class: 'name' }, h('div', { class: 'site' }, h('span', { class: 'fav' }, icon('monitor')), h('span', { text: a.name, title: a.name }))),
      h('td', { class: 'share' }, h('div', { class: 'progress' }, h('i', { style: { width: (a.sec / max) * 100 + '%' } }))),
      h('td', { class: 'time', text: fmtDuration(a.sec) })))))));
}

function emptyState() {
  return h('div', { class: 'card empty empty-big' },
    h('div', { class: 'empty-icon' }, icon('chart-column')),
    h('h2', { text: t('insights.emptyTitle') }), h('p', { text: t('insights.emptyBody') }),
    h('div', { class: 'steps' },
      [['1', 'insights.step1', 'insights.step1b'], ['2', 'insights.step2', 'insights.step2b'], ['3', 'insights.step3', 'insights.step3b']].map(([n, a, b]) => h('div', { class: 'step' }, h('div', { class: 'n', text: n }), h('b', { text: t(a) }), h('span', { text: t(b) })))));
}

/* ---------- main ---------- */

let data;
function render() {
  cls = makeClassifier(settings, guess);
  const { classify } = cls;
  const sum = summarize(data.cur, classify);
  const prev = summarize(data.prev, classify);
  const streak = focusStreak(data.heat);

  const keys = data.cur.map((e) => e[0]);
  $('#subtitle').textContent = range === 'today' ? fmtDate(new Date()) : `${fmtDate(parseKey(keys[0]), { day: 'numeric', month: 'short' })} – ${fmtDate(parseKey(keys[keys.length - 1]), { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const root = $('#content');
  const empty = sum.total < 60 && sum.topApps.length === 0 && data.heat.every(([, d]) => !d);
  $('#export').disabled = empty;
  if (empty) { clear(root, emptyState()); return; }

  const views = {
    overview: () => [renderKpis(sum, prev), range === '7' && sum.total >= 3600 && sum.activeDays >= 3 ? reviewCard(sum, prev) : null, mainChart(sum), insightsCard(sum, prev, streak)],
    focus: () => [focusTab({ cur: data.cur, prev: data.prev, heat: data.heat, tasks: data.tasks, estTasks: accuracyInput(data.tasks, data.estLog), settings })],
    sites: () => [triggersCard(classify)].concat(sum.topApps.length ? [h('div', { class: 'grid-2' }, sitesCard(sum), appsCard(sum))] : [sitesCard(sum)]),
    patterns: () => {
      const entry = data.heat[data.heat.length - 1 - tlBack];
      return [entry ? timelineCard({ entry, classify, clock24: settings.newtab.clock24 ?? undefined, nav: { onPrev: tlBack < data.heat.length - 1 ? () => { tlBack++; render(); } : null, onNext: tlBack > 0 ? () => { tlBack--; render(); } : null } }) : null,
        range === 'today' ? null : typicalDay(sum), heatCard(data.heat)];
    },
  };
  const tabIcons = { overview: { icon: 'layout-dashboard' }, focus: { icon: 'target' }, sites: { icon: 'globe' }, patterns: { icon: 'calendar-days' } };
  const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': t('insights.tabs') }, TABS.map((id) => h('button', { class: 'tab', type: 'button', role: 'tab', id: 'tab-' + id, 'aria-controls': 'tabpanel', 'aria-selected': String(id === tab), onclick: () => { tab = id; try { localStorage.setItem('et-itab', id); } catch { /* ignore */ } render(); } }, icon(tabIcons[id].icon), t('itab.' + id))));
  clear(root, tabs, h('div', { class: 'stack gap-4', role: 'tabpanel', id: 'tabpanel', 'aria-labelledby': 'tab-' + tab, style: { marginTop: 'var(--s-5)' } }, views[tab]()));
  root.querySelectorAll('.card-head h3').forEach((el) => el.setAttribute('aria-level', '2')); // page h1 → card titles are level 2
  tabs.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

function drawRange() {
  const seg = $('#range');
  clear(seg, ['today', '7', '30'].map((r) => h('button', { type: 'button', 'aria-pressed': String(r === range), text: t('range.' + r), onclick: async () => {
    range = r; shown = 10; localStorage.setItem('et-range', r); history.replaceState(null, '', `?range=${r}`);
    drawRange(); data = await load(); render();
  } })));
}

function exportCsv() {
  const { classify } = makeClassifier(settings, guess);
  const lines = ['date,domain,seconds,class'];
  for (const [key, d] of data.heat.concat(data.cur).filter((e, i, a) => e[1] && a.findIndex((x) => x[0] === e[0]) === i)) {
    for (const [host, sec] of Object.entries(d.d || {})) lines.push(`${key},${host},${sec},${classify(host)}`);
    for (const [app, sec] of Object.entries(d.a || {})) lines.push(`${key},"${app.replace(/"/g, '""')}",${sec},app`);
  }
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  const a = h('a', { href: url, download: `eyetime-${dayKey()}.csv` }); document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

(async function main() {
  send('tracker:sync').catch(() => {});
  await bootPage({ onSettings: async () => { data = await load(); drawRange(); render(); } });
  mountHeader($('#header'), 'insights');
  $('#export').addEventListener('click', exportCsv);
  installPalette({ extra: () => [{ group: 'go', icon: 'download', label: t('insights.export'), run: exportCsv, keys: ['csv', 'download', 'export'] }] });
  drawRange();
  data = await load();
  render();
  onChange(['d:*', 'siteGuess'], async () => { data = await load(); render(); });
})();
