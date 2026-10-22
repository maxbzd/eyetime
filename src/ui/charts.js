// Small HTML/CSS chart toolkit (no dependencies). Marks follow docs/DESIGN.md:
// thin bars (≤24px) with a 4px rounded data-end, 2px surface gaps, hairline grid, one shared tooltip,
// every mark focusable, and a table fallback is provided by the pages that use these.

import { h } from './dom.js';
import { t, fmtDuration } from '../shared/i18n.js';

export const CLASS_ORDER = ['productive', 'neutral', 'distracting'];

/* ---------- tooltip ---------- */
let tip;
function ensureTip() { if (!tip) { tip = h('div', { class: 'chart-tip', role: 'tooltip', style: { opacity: 0, left: 0, top: 0 } }); document.body.append(tip); } return tip; }

export function showTip(content, x, y) {
  const el = ensureTip();
  el.replaceChildren(...[].concat(content));
  el.style.opacity = 1;
  const r = el.getBoundingClientRect();
  const left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2));
  const top = y - r.height - 12 < 8 ? y + 18 : y - r.height - 12;
  el.style.left = left + 'px'; el.style.top = top + 'px';
}
export function hideTip() { if (tip) tip.style.opacity = 0; }

/** Wire hover + keyboard focus on `el` to a tooltip built lazily by `build()`. */
export function attachTip(el, build) {
  const place = (e) => showTip(build(), e.clientX, e.clientY);
  el.addEventListener('pointermove', place);
  el.addEventListener('pointerleave', hideTip);
  el.addEventListener('focus', () => { const r = el.getBoundingClientRect(); showTip(build(), r.left + r.width / 2, r.top); });
  el.addEventListener('blur', hideTip);
}

export function tipBody(title, rows, total) {
  return [
    h('div', { class: 'sub', text: title }),
    ...rows.map((r) => h('div', { class: 'tip-row' }, h('i', { class: 'key ' + (r.cls || '') }), h('span', { class: 'sub', text: r.label }), h('b', { class: 'num', text: r.value }))),
    total ? h('div', { class: 'tip-total' }, h('span', { class: 'sub', text: t('chart.total') }), h('b', { class: 'num', text: total })) : null,
  ];
}

/* ---------- axis helpers ---------- */
const STEPS = [60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 14400, 21600, 28800, 43200];
/** Choose a round step so there are about 3–4 gridlines. */
export function niceScale(maxSec) {
  const step = STEPS.find((s) => maxSec / s <= 4) || 43200;
  const top = Math.max(step, Math.ceil(maxSec / step) * step);
  return { step, top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
}
export const tickLabel = (sec) => (sec === 0 ? '0' : fmtDuration(sec));

/**
 * Stacked columns. items: [{ key, label, sub?, values: {productive, neutral, distracting}, axis? }]
 * opts: { height, onSelect }
 */
export function stackedColumns(items, { height = 220, axisEvery = 1, caption = '' } = {}) {
  const totals = items.map((it) => CLASS_ORDER.reduce((a, c) => a + (it.values[c] || 0), 0));
  const scale = niceScale(Math.max(1, ...totals));

  const grid = h('div', { class: 'grid' }, scale.ticks.map((tk) => h('div', { class: 'gl', style: { bottom: (tk / scale.top) * 100 + '%' } }, h('span', { class: 'num', text: tickLabel(tk) }))));
  const cols = h('div', { class: 'cols' }, items.map((it, i) => {
    const total = totals[i];
    if (it.future) return h('div', { class: 'col is-future', 'aria-hidden': 'true' });
    const stack = h('div', { class: 'stack-bar', style: { height: (total / scale.top) * 100 + '%' } },
      CLASS_ORDER.filter((c) => (it.values[c] || 0) > 0).map((c) => h('i', { class: 'seg ' + c, style: { flexGrow: ((it.values[c] / total) * 1000).toFixed(3) } })));
    const col = h('div', { class: 'col' + (total === 0 ? ' is-empty' : ''), tabindex: 0, role: 'img', 'aria-label': `${it.label}: ${total ? fmtDuration(total) : t('chart.noData')}` }, stack);
    attachTip(col, () => tipBody(it.sub || it.label,
      CLASS_ORDER.map((c) => ({ cls: c, label: t('class.' + c), value: fmtDuration(it.values[c] || 0) })), total ? fmtDuration(total) : t('chart.noData')));
    return col;
  }));
  const xs = h('div', { class: 'xaxis' }, items.map((it, i) => h('span', { class: 'num', text: i % axisEvery === 0 ? it.axis ?? it.label : '' })));

  return h('div', { class: 'chart', style: { '--chart-h': height + 'px' } },
    h('div', { class: 'plot' }, grid, cols), xs);
}

/** Legend for the three site classes. */
export function classLegend(totals) {
  return h('div', { class: 'legend' }, CLASS_ORDER.map((c) => h('span', {}, h('i', { class: 'swatch ' + c }), t('class.' + c), totals ? h('b', { class: 'num', style: { color: 'var(--text)', fontWeight: 600 }, text: fmtDuration(totals[c] || 0) }) : null)));
}

/**
 * Calendar heatmap, one cell per day, weeks as columns (Mon at top).
 * cells: [{ key, date: Date, sec }]; max = busiest day. Sequential single hue (accent), 4 levels.
 */
/** @param {any[]} cells @param {number} max @param {{ startsOn?: number, level?: (v: number, max: number) => number }} [o] */
export function heatmap(cells, max, { startsOn = 1, level } = {}) {
  const first = cells[0].date;
  const lead = (first.getDay() - startsOn + 7) % 7;
  const nodes = [];
  for (let i = 0; i < lead; i++) nodes.push(h('span', { class: 'hm-cell pad' }));
  for (const c of cells) {
    const lv = level(c.sec, max);
    const cell = h('span', { class: 'hm-cell l' + lv + (c.pre ? ' pre' : ''), tabindex: 0, role: 'img', 'aria-label': `${c.title}: ${c.sec ? fmtDuration(c.sec) : c.pre ? t('insights.hmNone') : t('chart.noData')}` });
    attachTip(cell, () => tipBody(c.title, [], c.sec ? fmtDuration(c.sec) : c.pre ? t('insights.hmNone') : t('chart.noData')));
    nodes.push(cell);
  }
  const el = h('div', { class: 'heatmap' }, nodes);
  el.style.setProperty('--weeks', Math.ceil(nodes.length / 7));
  return el;
}
