import { bootPage } from '../ui/page.js';
import { mountHeader } from '../ui/header.js';
import { $, h, icon, favicon, clear, toast } from '../ui/dom.js';
import { send } from '../ui/api.js';
import { stackedColumns, classLegend, heatmap, CLASS_ORDER } from '../ui/charts.js';
import { t, fmtDuration, fmtDate, fmtNumber, weekdayName, fmtTime, monthName } from '../shared/i18n.js';
import { getSettings, updateSettings, getDays, getCollection, onChange } from '../shared/storage.js';
import { goalStreak, bestHours, sessionsOf, pauseReasonTotals, PAUSE_REASONS, switchRate, topTemptations, recentWins, weekdayPattern, suggestMinutes } from '../shared/productivity.js';
import { makeClassifier } from '../shared/classify.js';
import { summarize, delta, insights as computeInsights, focusStreak, heatLevel, suggestLimit } from '../shared/stats.js';
import { rangeKeys, addDays, dayKey, parseKey } from '../shared/time.js';

const RANGES = { today: 1, 7: 7, 30: 30 };
let range = new URLSearchParams(location.search).get('range') || localStorage.getItem('et-range') || '7';
if (!(range in RANGES)) range = '7';
let settings, shown = 10, tableView = false;

async function load() {
  settings = await getSettings();
  const n = RANGES[range];
  const today = new Date();
  const [cur, prev, heat] = await Promise.all([
    getDays(rangeKeys(n, today)),
    getDays(rangeKeys(n, addDays(today, -n))),
    getDays(rangeKeys(15 * 7 + ((today.getDay() + 6) % 7) + 1, today)), // 16 calendar weeks (Mon-aligned) ending today
  ]);
  const tasks = await getCollection('tasks', []);
  return { cur, prev, heat, tasks };
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
    kpi({ ico: 'eye', label: t('insights.eyeBreaks'), value: fmtNumber(cur.breaks), chip: null, sub: range === 'today' ? '' : t('insights.perDay', { n: fmtNumber(Math.round(breakAvg * 10) / 10) }) }));
}

function mainChart(sum) {
  let items, axisEvery, title, subtitle;
  if (range === 'today') {
    items = sum.hourly.map((hr, i) => ({ key: i, label: `${String(i).padStart(2, '0')}:00`, sub: `${String(i).padStart(2, '0')}:00 – ${String((i + 1) % 24).padStart(2, '0')}:00`, axis: String(i), values: hr }));
    axisEvery = 3; title = t('insights.byHour'); subtitle = t('insights.byHourSub');
  } else {
    items = sum.days.map((d) => {
      const date = parseKey(d.key);
      return { key: d.key, label: fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short' }), sub: fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' }), axis: range === '7' ? weekdayName(date.getDay()) : String(date.getDate()), values: d };
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
      h('div', { class: 'row gap-3' }, classLegend(sum),
        h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-pressed': String(tableView), 'data-tip': t('insights.tableView'), 'aria-label': t('insights.tableView'), onclick: () => { tableView = !tableView; render(); } }, icon('table-2')))),
    body);
}

function sitesCard(sum) {
  const all = sum.topSites;
  const total = sum.total || 1;
  const max = all[0]?.sec || 1;
  const rows = all.slice(0, shown).map((s) => {
    const sel = h('select', { class: 'tag tag-' + s.cls, 'aria-label': t('insights.classifyAria', { host: s.host }), onchange: async (e) => {
      const v = e.target.value, was = s.cls;
      await updateSettings((st) => { st.sites[s.host] = v; });
      send('settings:changed');
      toast(t('insights.marked', { host: s.host, cls: t('class.' + v).toLowerCase() }), { action: t('common.undo'), onAction: async () => { await updateSettings((st) => { st.sites[s.host] = was; }); send('settings:changed'); } });
    } }, CLASS_ORDER.map((c) => h('option', { value: c, selected: c === s.cls, text: t('class.' + c) })));
    return h('tr', {},
      h('td', {}, h('div', { class: 'site' }, favicon(s.host), h('span', { text: s.host }))),
      h('td', {}, sel),
      h('td', { class: 'share' }, h('div', { class: 'progress' }, h('i', { class: s.cls, style: { width: Math.max(2, (s.sec / max) * 100) + '%' } }))),
      h('td', { class: 'time', text: fmtDuration(s.sec) }),
      h('td', { class: 'time', style: { color: 'var(--text-3)', width: '48px' }, text: Math.round((s.sec / total) * 100) + '%' }));
  });
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', {}, h('h3', { text: t('insights.sites') }), h('p', { text: t('insights.sitesSub') }))),
    h('div', { class: 'card-body', style: { paddingTop: 'var(--s-3)' } },
      all.length ? h('table', { class: 'sites' }, h('thead', {}, h('tr', {}, h('th', { text: t('insights.site') }), h('th', { text: t('insights.class') }), h('th', {}), h('th', { text: t('insights.time'), style: { textAlign: 'right' } }), h('th', {}))), h('tbody', {}, rows))
        : h('div', { class: 'empty' }, h('p', { text: t('insights.noSites') })),
      all.length > shown ? h('div', { class: 'more' }, h('button', { class: 'btn btn-sm', type: 'button', onclick: () => { shown += 15; render(); } }, t('insights.showMore', { n: all.length - shown }))) : null));
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
    : h('div', { class: 'review-suggest ok' }, icon('sparkles'), h('span', { text: t('review.balanced') }));
  return h('section', { class: 'card review' },
    h('div', { class: 'card-head' }, h('div', {}, h('h3', { text: t('review.title') }), h('p', { text: t('review.sub') }))),
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

/* ---------- focus & productivity ---------- */

function hoursChart(best) {
  const max = Math.max(...best.byHour, 1);
  const hr = (i) => fmtTime(new Date(2000, 0, 1, i), settings.newtab.clock24 ?? undefined);
  return h('div', { class: 'hours', role: 'img', 'aria-label': t('prod.bestAria', { from: hr(best.start), to: hr(best.end) }) },
    h('div', { class: 'hours-bars' }, best.byHour.map((v, i) => h('i', { class: 'hb' + (i === best.start || i === (best.start + 1) % 24 ? ' best' : ''), style: { height: Math.max(3, (v / max) * 100) + '%' }, 'data-tip': `${hr(i)} · ${fmtDuration(Math.round(v) * 60)}` }))),
    h('div', { class: 'hours-axis' }, [0, 6, 12, 18].map((i) => h('span', { style: { gridColumn: `${i + 1} / span 3` }, text: String(i).padStart(2, '0') }))));
}

function ratingDots(r) {
  if (!r) return h('span', { class: 'muted', text: '–' });
  return h('span', { class: 'rating r' + r, 'data-tip': t('review.r' + r) }, icon(r === 3 ? 'zap' : r === 2 ? 'meh' : 'frown'));
}

function weekdayChart(wk) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const max = Math.max(...wk.map((d) => d.avgMin), 1);
  return h('div', { class: 'hours', role: 'img', 'aria-label': t('prod.weekdays') },
    h('div', { class: 'hours-bars wk' }, order.map((w) => h('i', { class: 'hb' + (wk[w].avgMin === max ? ' best' : ''), style: { height: Math.max(3, (wk[w].avgMin / max) * 100) + '%' }, 'data-tip': `${weekdayName(w, 'long')} · ${fmtDuration(wk[w].avgMin * 60)}` }))),
    h('div', { class: 'hours-axis wk' }, order.map((w) => h('span', { text: weekdayName(w) }))));
}

function productivityCard(cur, heat, tasks) {
  const goal = settings.focus.dailyGoal;
  const sessions = sessionsOf(cur).sort((a, b) => b.t - a.t);
  const best = bestHours(heat);
  const reasons = pauseReasonTotals(cur);
  const reasonTotal = PAUSE_REASONS.reduce((a, r) => a + (reasons[r] || 0), 0);
  const daysHit = goal ? cur.filter(([, d]) => (d?.fs || 0) >= goal * 60).length : 0;
  const streak = goalStreak(heat, goal, settings.focus.goalDays);
  const rated = sessions.filter((s) => s.r);
  const avgR = rated.length ? rated.reduce((a, s) => a + s.r, 0) / rated.length : 0;
  const rates = cur.map(([, d]) => switchRate(d)).filter((r) => r !== null);
  const swPerHour = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
  const tempt = topTemptations(cur, 5);
  const wins = recentWins(heat, 5);
  const wk = weekdayPattern(heat, goal);
  const wkData = wk.reduce((a, d) => a + d.days, 0) >= 10 && wk.some((d) => d.avgMin > 0);
  const lenBest = suggestMinutes(heat, settings.focus.presets);
  const topTasks = tasks.filter((x) => x.focusSec >= 60).sort((a, b) => b.focusSec - a.focusSec).slice(0, 5);
  if (!sessions.length && !reasonTotal && !best && !topTasks.length && !tempt.length && swPerHour === null) {
    return h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('div', {}, h('h3', { text: t('prod.title' ) }), h('p', { text: t('prod.sub') }))),
      h('div', { class: 'card-body' }, h('div', { class: 'empty', style: { padding: 'var(--s-4) 0' } }, h('div', { class: 'empty-icon' }, icon('target')), h('p', { text: t('prod.empty') }))));
  }
  const stat = ({ ico, label, value, sub }) => h('div', { class: 'pstat' }, h('div', { class: 'label' }, icon(ico), label), h('div', { class: 'value num', text: value }), sub ? h('div', { class: 'sub', text: sub }) : null);
  const stats = h('div', { class: 'pstats' },
    goal ? stat({ ico: 'target', label: t('prod.goalDays'), value: `${daysHit}/${cur.length}`, sub: t('prod.goalIs', { time: fmtDuration(goal * 60) }) }) : null,
    goal ? stat({ ico: 'flame', label: t('prod.goalStreak'), value: String(streak), sub: t('prod.days') }) : null,
    stat({ ico: 'timer', label: t('prod.avgSession'), value: sessions.length ? fmtDuration(Math.round(sessions.reduce((a, s) => a + s.m, 0) / sessions.length) * 60) : '–', sub: t('insights.sessions', { n: sessions.length }) }),
    swPerHour !== null ? stat({ ico: 'shuffle', label: t('prod.switches'), value: String(Math.round(swPerHour)), sub: t('prod.switchesSub') }) : null,
    stat({ ico: 'zap', label: t('prod.quality'), value: avgR ? (avgR >= 2.5 ? t('review.r3') : avgR >= 1.75 ? t('review.r2') : t('review.r1')) : '–', sub: rated.length ? t('prod.rated', { n: rated.length }) : t('prod.rateHint') }));

  const reasonRow = reasonTotal
    ? h('div', { class: 'pblock' }, h('h4', { text: t('prod.pauses') }), h('p', { class: 'muted-2', text: t('prod.pausesSub', { n: reasons.back || 0, total: reasonTotal }) }),
        h('div', { class: 'row gap-2 wrap' }, PAUSE_REASONS.filter((r) => reasons[r]).map((r) => h('span', { class: 'chip' + (r === 'back' ? ' good' : ''), text: `${t('block.why.' + r)} · ${reasons[r]}` }))))
    : null;

  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', {}, h('h3', { text: t('prod.title') }), h('p', { text: t('prod.sub') }))),
    h('div', { class: 'card-body stack gap-6' },
      stats,
      best ? h('div', { class: 'pblock' }, h('h4', { text: t('prod.best') }),
        h('p', { class: 'muted-2', text: t('prod.bestBody', { from: fmtTime(new Date(2000, 0, 1, best.start), settings.newtab.clock24 ?? undefined), to: fmtTime(new Date(2000, 0, 1, best.end), settings.newtab.clock24 ?? undefined), pct: Math.round(best.share * 100) }) }), hoursChart(best))
        : h('div', { class: 'pblock' }, h('h4', { text: t('prod.best') }), h('p', { class: 'muted-2', text: t('prod.bestLocked') })),
      topTasks.length ? h('div', { class: 'pblock' }, h('h4', { text: t('prod.byTask') }), h('table', { class: 'sites' }, h('tbody', {}, topTasks.map((x) => h('tr', {}, h('td', {}, h('span', { class: 'truncate', text: x.text })), h('td', { class: 'time', text: fmtDuration(x.focusSec) })))))) : null,
      sessions.length ? h('div', { class: 'pblock' }, h('h4', { text: t('prod.recent') }), h('table', { class: 'sites' }, h('tbody', {}, sessions.slice(0, 8).map((s) => h('tr', {},
        h('td', { class: 'time', style: { textAlign: 'left', width: '1%' }, text: fmtDate(new Date(s.t), { weekday: 'short' }) + ' ' + fmtTime(new Date(s.t), settings.newtab.clock24 ?? undefined) }),
        h('td', {}, h('span', { class: 'truncate', text: s.g || t('prod.noGoal') })),
        h('td', { class: 'time', text: fmtDuration(s.m * 60) + (s.c ? '' : ' · ' + t('prod.early')) }),
        h('td', { class: 'time', style: { width: '36px' } }, ratingDots(s.r))))))) : null,
      lenBest ? h('div', { class: 'pblock' }, h('h4', { text: t('prod.length') }), h('p', { class: 'muted-2', text: t('prod.lengthBody', { n: lenBest.minutes }) }),
        h('div', { class: 'row gap-2 wrap' }, lenBest.lengths.map((l) => h('span', { class: 'chip' + (l.minutes === lenBest.minutes ? ' good' : ''), text: `${fmtDuration(l.minutes * 60)} · ${l.mean.toFixed(1)}/3 · ${l.n}×` })))) : null,
      wkData ? h('div', { class: 'pblock' }, h('h4', { text: t('prod.weekdays') }), h('p', { class: 'muted-2', text: t('prod.weekdaysSub') }), weekdayChart(wk)) : null,
      tempt.length ? h('div', { class: 'pblock' }, h('h4', { text: t('prod.tempt') }), h('p', { class: 'muted-2', text: t('prod.temptSub') }),
        h('table', { class: 'sites' }, h('tbody', {}, tempt.map((x) => h('tr', {}, h('td', {}, h('div', { class: 'site' }, favicon(x.host), h('span', { text: x.host }))), h('td', { class: 'time', text: t('prod.times', { n: x.count }) })))))) : null,
      wins.length ? h('div', { class: 'pblock' }, h('h4', { text: t('prod.wins') }), h('div', { class: 'wins' }, wins.map((w) => h('div', { class: 'win' }, icon('sparkles'), h('span', { class: 'win-d', text: fmtDate(parseKey(w.key), { weekday: 'short', day: 'numeric', month: 'short' }) }), h('span', { text: w.text }))))) : null,
      reasonRow));
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
  const max = Math.max(...cells.map((c) => c.sec), 0);
  // month labels sit above the first week-column of each month
  const months = []; let lastM = -1;
  for (let c = 0; c < Math.ceil(cells.length / 7); c++) {
    const m = cells[c * 7].date.getMonth();
    months.push(m !== lastM ? h('span', { text: monthName(m) }) : h('span'));
    lastM = m;
  }
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', {}, h('h3', { text: t('insights.calendar') }), h('p', { text: t('insights.calendarSub') }))),
    h('div', { class: 'card-body' }, h('div', { class: 'heat-wrap' },
      h('div', { class: 'heat-months' }, months),
      heatmap(cells, max, { level: heatLevel }),
      h('div', { class: 'heat-legend' }, t('insights.less'), [0, 1, 2, 3, 4].map((l) => h('span', { class: 'hm-cell l' + l })), t('insights.more')))));
}

function appsCard(sum) {
  if (!sum.topApps.length) return null;
  const max = sum.topApps[0].sec;
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', {}, h('h3', { text: t('insights.apps') }), h('p', { text: t('insights.appsSub') }))),
    h('div', { class: 'card-body' }, h('table', { class: 'sites' }, h('tbody', {}, sum.topApps.slice(0, 8).map((a) => h('tr', {},
      h('td', {}, h('div', { class: 'site' }, h('span', { class: 'fav' }, icon('monitor')), h('span', { text: a.name }))),
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
  const { classify } = makeClassifier(settings);
  const sum = summarize(data.cur, classify);
  const prev = summarize(data.prev, classify);
  const streak = focusStreak(data.heat);

  const keys = data.cur.map((e) => e[0]);
  $('#subtitle').textContent = range === 'today' ? fmtDate(new Date()) : `${fmtDate(parseKey(keys[0]), { day: 'numeric', month: 'short' })} – ${fmtDate(parseKey(keys[keys.length - 1]), { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const root = $('#content');
  if (sum.total < 60 && sum.topApps.length === 0 && data.heat.every(([, d]) => !d)) { clear(root, emptyState()); return; }

  clear(root,
    renderKpis(sum, prev),
    range === '7' && sum.total >= 3600 && sum.activeDays >= 3 ? reviewCard(sum, prev) : null,
    mainChart(sum),
    productivityCard(data.cur, data.heat, data.tasks),
    h('div', { class: 'grid-2' }, sitesCard(sum), h('div', { class: 'stack gap-4' }, insightsCard(sum, prev, streak), appsCard(sum))),
    range === 'today' ? heatCard(data.heat) : h('div', { class: 'grid-2' }, typicalDay(sum), heatCard(data.heat)));
}

function drawRange() {
  const seg = $('#range');
  clear(seg, ['today', '7', '30'].map((r) => h('button', { type: 'button', 'aria-pressed': String(r === range), text: t('range.' + r), onclick: async () => {
    range = r; shown = 10; localStorage.setItem('et-range', r); history.replaceState(null, '', `?range=${r}`);
    drawRange(); data = await load(); render();
  } })));
}

function exportCsv() {
  const { classify } = makeClassifier(settings);
  const lines = ['date,domain,seconds,class'];
  for (const [key, d] of data.heat.concat(data.cur).filter((e, i, a) => e[1] && a.findIndex((x) => x[0] === e[0]) === i)) {
    for (const [host, sec] of Object.entries(d.d || {})) lines.push(`${key},${host},${sec},${classify(host)}`);
    for (const [app, sec] of Object.entries(d.a || {})) lines.push(`${key},"${app.replace(/"/g, '""')}",${sec},app`);
  }
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  const a = h('a', { href: url, download: `eyetime-${dayKey()}.csv` }); document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

(async function main() {
  await bootPage({ onSettings: async () => { data = await load(); drawRange(); render(); } });
  mountHeader($('#header'), 'insights');
  $('#export').addEventListener('click', exportCsv);
  drawRange();
  data = await load();
  render();
  onChange(['d:*'], async () => { data = await load(); render(); });
})();
