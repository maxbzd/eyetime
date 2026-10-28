// The Home widgets: small cards the user adds from the gallery (main focus, day rings, countdown, world clocks, day / week / year progress,
// a mantra, the next meeting, the week in focus time, one big number, the eye-break timer, a sticky note).
// Everything is computed on this device. Each widget is built by `build(root, api)` and may return { update(cfg), destroy() }.

import { h, icon, clear } from '../ui/dom.js';
import { t, fmtDuration, fmtNumber, fmtDate, weekdayName, getLocale } from '../shared/i18n.js';
import { getSettings, updateSettings, getDays, getCollection, getRaw, onChange } from '../shared/storage.js';
import { send } from '../ui/api.js';
import { dayKey, rangeKeys } from '../shared/time.js';
import { nextEvent } from '../shared/ics.js';
import { makeClassifier } from '../shared/classify.js';
import { summarize, focusStreak } from '../shared/stats.js';
import { loadRings } from './rings.js';
import { WIDGET_KINDS, normalizeCfg, normalizeWidgets, countdownLeft, periodProgress, zoneCity, zoneClock, MANTRA_COUNT } from '../shared/widgets.js';

const R = 40, C = 2 * Math.PI * R;
const SVG_NS = 'http://www.w3.org/2000/svg';

/** "12 days" split into the number and the unit word, in the user's language. */
function unitParts(n, unit) {
  const parts = new Intl.NumberFormat(getLocale(), { style: 'unit', unit, unitDisplay: 'long' }).formatToParts(n);
  return { num: parts.filter((p) => p.type !== 'unit' && p.type !== 'literal').map((p) => p.value).join(''), unit: parts.filter((p) => p.type === 'unit').map((p) => p.value).join('') };
}
const ago = (n, unit) => new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto' }).format(-n, unit);
const el = (tag, cls, ...kids) => h(tag, { class: cls }, ...kids);
const dayOfYear = (d) => Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000);

/** The name of a widget kind, for the gallery and the frame label. */
export const widgetName = (kind) => t('wg.k.' + kind);

/* ---------- the widgets ---------- */

const DEFS = {
  mainfocus: {
    build(root, api) {
      const today = dayKey();
      function draw() {
        const c = api.cfg(), live = c.day === today && c.text;
        const input = h('input', { class: 'input wf-input', maxlength: 140, placeholder: t('wg.mainfocus.ph'), 'aria-label': t('wg.k.mainfocus'),
          onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
          onblur: (e) => { const v = e.target.value.trim(); if (v) api.save({ text: v, day: today, done: false }); } });
        clear(root, el('div', 'wg-label', t('wg.k.mainfocus')),
          live
            ? el('div', 'wf-row' + (c.done ? ' done' : ''),
              h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: c.done, 'aria-label': t('wg.mainfocus.done'), onchange: (e) => api.save({ done: e.target.checked }) }), el('span', 'box', icon('check'))),
              h('button', { class: 'wf-text', type: 'button', 'aria-label': t('wg.mainfocus.edit') + ': ' + c.text, onclick: () => { clear(root, el('div', 'wg-label', t('wg.k.mainfocus')), input); input.value = c.text; input.focus(); input.select(); } }, c.text),
              h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': t('common.remove'), onclick: () => api.save({ text: '', day: '', done: false }) }, icon('x')))
            : input);
      }
      draw();
      return { update: () => { if (!root.contains(document.activeElement)) draw(); } };
    },
  },

  rings: {
    build(root) {
      let alive = true;
      const arc = (frac) => { const f = Math.max(0, Math.min(1, frac)); return `${(f * C).toFixed(1)} ${C.toFixed(1)}`; };
      async function draw() {
        const data = await loadRings(await getSettings());
        if (!alive) return;
        clear(root, ...data.map((d) => {
          const svg = document.createElementNS(SVG_NS, 'svg'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('aria-hidden', 'true');
          for (const [cls, extra] of /** @type {Array<[string, Record<string, string>]>} */ ([['track', {}], ['bar', { 'stroke-linecap': 'round', 'stroke-dasharray': arc(d.frac) }]])) {
            const c = document.createElementNS(SVG_NS, 'circle'); c.setAttribute('class', cls); c.setAttribute('cx', '50'); c.setAttribute('cy', '50'); c.setAttribute('r', String(R)); c.setAttribute('fill', 'none');
            for (const [k, v] of Object.entries(extra)) c.setAttribute(k, v);
            svg.append(c);
          }
          return h('div', { class: 'wr-i ' + d.cls, role: 'img', 'aria-label': `${d.label}: ${d.big}${d.sub ? ' ' + d.sub : ''}` }, el('div', 'wr-fig', svg, el('div', 'wr-val num', d.big)), el('div', 'wr-lbl', d.label), el('div', 'wr-sub', d.sub || ' '));
        }));
      }
      draw();
      const off = onChange(['tasks', 'd:*', 'settings'], draw);
      return { destroy: () => { alive = false; off(); } };
    },
  },

  countdown: {
    build(root, api) {
      function draw() {
        const c = api.cfg(), L = countdownLeft(c.date, c.time, new Date());
        let big, unit, sub = '';
        if (L.past) { big = ago(Math.max(1, Math.abs(L.calDays)), 'day'); unit = ''; }
        else if (L.calDays > 0) { const u = unitParts(L.calDays, 'day'); big = u.num; unit = u.unit; }
        else if (L.sameDay && c.time && !L.past) { big = fmtDuration(L.ms / 1000); unit = ''; }
        else { big = t('wg.cd.today'); unit = ''; }
        if (L.calDays > 0 && c.time) sub = c.time;
        clear(root, el('div', 'wg-label', c.title || t('wg.cd.default')),
          el('div', 'wc-big', el('span', 'wc-num num', big), unit ? el('span', 'wc-unit', unit) : null),
          el('div', 'wg-sub', fmtDate(new Date(`${c.date}T00:00:00`), { day: 'numeric', month: 'long', year: 'numeric' }) + (sub ? ' · ' + sub : '')));
      }
      draw();
      const id = setInterval(draw, 30_000);
      return { update: draw, destroy: () => clearInterval(id) };
    },
  },

  worldclock: {
    build(root, api) {
      async function draw() {
        const c = api.cfg(), s = await getSettings(), now = new Date();
        clear(root, el('div', 'wg-label', t('wg.k.worldclock')), ...c.zones.map((tz) => {
          const z = zoneClock(tz, now, getLocale(), s.newtab.clock24 ?? undefined);
          return el('div', 'ww-row', el('span', 'ww-city', zoneCity(tz)), z.dayShift ? el('span', 'ww-shift', t(z.dayShift > 0 ? 'wg.wc.next' : 'wg.wc.prev')) : null, el('span', 'ww-time num', z.time));
        }));
      }
      draw();
      const id = setInterval(draw, 10_000);
      return { update: draw, destroy: () => clearInterval(id) };
    },
  },

  percent: {
    build(root, api) {
      function draw() {
        const now = new Date();
        clear(root, el('div', 'wg-label', t('wg.k.percent')), ...api.cfg().periods.map((p) => {
          const v = periodProgress(p, now), pct = Math.floor(v * 100);
          return h('div', { class: 'wp-row', role: 'img', 'aria-label': `${t('wg.p.' + p)}: ${pct}%` }, el('div', 'wp-top', el('span', '', t('wg.p.' + p)), el('span', 'num', pct + '%')), el('div', 'wp-bar', h('i', { style: { width: (v * 100).toFixed(2) + '%' } })));
        }));
      }
      draw();
      const id = setInterval(draw, 60_000);
      return { update: draw, destroy: () => clearInterval(id) };
    },
  },

  mantra: {
    build(root, api) {
      function draw() {
        const c = api.cfg();
        clear(root, el('blockquote', 'wm-text', c.text || t('wg.mantra' + ((dayOfYear(new Date()) % MANTRA_COUNT) + 1))));
      }
      draw();
      return { update: draw };
    },
  },

  nextevent: {
    build(root) {
      let alive = true;
      async function draw() {
        const { calendar = [] } = await getRaw('calendar');
        if (!alive) return;
        const d = new Date(), e = nextEvent(calendar, dayKey(d), d.getHours() * 60 + d.getMinutes());
        clear(root, el('div', 'wg-label', t('wg.k.nextevent')),
          e ? el('div', 'we-body', el('div', 'we-title', e.title || t('meet.untitled')), el('div', 'wg-sub', `${e.start}–${e.end} · ${e.ongoing ? t('cal.ongoing') : t('cal.in', { time: fmtDuration(e.inMin * 60) })}`))
            : el('div', 'wg-sub', calendar.length ? t('wg.ne.done') : t('wg.ne.none')));
      }
      draw();
      const off = onChange(['calendar'], draw), id = setInterval(draw, 30_000);
      return { destroy: () => { alive = false; off(); clearInterval(id); } };
    },
  },

  week: {
    build(root) {
      let alive = true;
      async function draw() {
        const keys = rangeKeys(7), days = await getDays(keys);
        if (!alive) return;
        const mins = days.map(([, d]) => Math.round((d?.fs || 0) / 60)), max = Math.max(30, ...mins), total = mins.reduce((a, b) => a + b, 0);
        const today = dayKey();
        clear(root, el('div', 'wg-label', t('wg.k.week')),
          el('div', 'wk-bars', days.map(([k], i) => {
            const date = new Date(`${k}T12:00:00`);
            return h('div', { class: 'wk-col' + (k === today ? ' now' : ''), role: 'img', 'aria-label': `${weekdayName(date.getDay(), 'long')}: ${fmtDuration(mins[i] * 60)}` }, h('i', { style: { height: Math.max(3, mins[i] / max * 100) + '%' } }), el('span', '', weekdayName(date.getDay(), 'narrow')));
          })),
          el('div', 'wg-sub', t('wg.week.total', { time: fmtDuration(total * 60) })));
      }
      draw();
      const off = onChange(['d:*'], draw);
      return { destroy: () => { alive = false; off(); } };
    },
  },

  bignumber: {
    build(root, api) {
      let alive = true;
      async function draw() {
        const s = await getSettings(), metric = api.cfg().metric, days = await getDays(rangeKeys(30)), today = days[29][1];
        let val = '', sub = '';
        if (metric === 'focusToday') { val = fmtDuration(today?.fs || 0); sub = s.focus.dailyGoal ? '/ ' + fmtDuration(s.focus.dailyGoal * 60) : ''; }
        else if (metric === 'sessionsToday') val = fmtNumber(today?.fc || 0);
        else if (metric === 'streak') { const n = focusStreak(days); const u = new Intl.NumberFormat(getLocale(), { style: 'unit', unit: 'day', unitDisplay: 'long' }).format(n); val = fmtNumber(n); sub = u.replace(/[\d\s., ]+/, ''); }
        else if (metric === 'tasksLeft') val = fmtNumber((await getCollection('tasks', [])).filter((x) => !x.done).length);
        else { const { classify } = makeClassifier(s); val = fmtDuration(summarize([[dayKey(), today]], classify).total); }
        if (!alive) return;
        clear(root, el('div', 'wg-label', t('wg.m.' + metric)), el('div', 'wb-num num', val), sub ? el('div', 'wg-sub', sub) : null);
      }
      draw();
      const off = onChange(['d:*', 'tasks', 'settings'], draw);
      return { update: draw, destroy: () => { alive = false; off(); } };
    },
  },

  eyebreak: {
    build(root) {
      let alive = true;
      async function draw() {
        const s = await getSettings(), st = await send('break:state');
        if (!alive) return;
        const eye = s.eye;
        if (!eye.enabled) { clear(root, el('div', 'wg-label', t('wg.k.eyebreak')), el('div', 'wg-sub', t('wg.eye.off'))); return; }
        const left = Math.max(0, eye.intervalMin * 60 - ((st && st.since) || 0)), due = !!(st && st.due);
        clear(root, el('div', 'wg-label', t('wg.k.eyebreak')),
          el('div', 'wb-num num', due ? t('eye.due') : fmtDuration(left)),
          h('button', { class: 'btn btn-sm' + (due ? ' btn-primary' : ''), type: 'button', onclick: () => send('break:open') }, icon('eye'), t('eye.breakNow')));
      }
      draw();
      const id = setInterval(draw, 15_000);
      return { destroy: () => { alive = false; clearInterval(id); } };
    },
  },

  sticky: {
    build(root, api) {
      let timer = 0;
      const ta = h('textarea', { class: 'textarea wn-text', rows: 4, maxlength: 2000, placeholder: t('wg.sticky.ph'), 'aria-label': t('wg.k.sticky'), oninput: (e) => { clearTimeout(timer); timer = setTimeout(() => api.save({ text: e.target.value }), 400); } });
      ta.value = api.cfg().text;
      clear(root, el('div', 'wg-label', t('wg.k.sticky')), ta);
      return { update: (c) => { if (document.activeElement !== ta) ta.value = c.text; }, destroy: () => clearTimeout(timer) };
    },
  },
};

/* ---------- the host: keeps the page's widget cards in step with the saved list ---------- */

export function createWidgetHost() {
  /** @type {Map<string, { el: HTMLElement, kind: string, cfg: string, inst: any, current: any }>} */
  const live = new Map();
  const pending = new Map();

  /** Save a patch of one widget's settings a moment later (typing must not write on every key). */
  function saver(id, kind) {
    return (patch) => {
      const inst = live.get(id); if (!inst) return;
      inst.current = normalizeCfg(kind, { ...inst.current, ...patch }); inst.cfg = JSON.stringify(inst.current);
      inst.inst?.update?.(inst.current);
      clearTimeout(pending.get(id));
      pending.set(id, setTimeout(() => updateSettings((s) => { const w = (s.newtab.widgets || []).find((x) => x.id === id); if (w) w.cfg = inst.current; }), 150));
    };
  }

  /** Bring the cards in line with `settings`; returns them in the saved order. */
  function sync(settings) {
    const list = normalizeWidgets(settings.newtab.widgets);
    const ids = new Set(list.map((w) => w.id));
    for (const [id, v] of live) if (!ids.has(id)) { v.inst?.destroy?.(); v.el.remove(); live.delete(id); }
    for (const w of list) {
      const have = live.get(w.id), cfg = JSON.stringify(w.cfg);
      if (have && have.kind === w.kind) {
        if (have.cfg !== cfg) { have.cfg = cfg; have.current = w.cfg; have.inst?.update?.(w.cfg); }
        continue;
      }
      have?.inst?.destroy?.(); have?.el.remove();
      const root = h('section', { class: 'card wgt wgt-' + w.kind, id: 'wgt-' + w.id, 'data-kind': w.kind, 'aria-label': widgetName(w.kind) });
      const entry = { el: root, kind: w.kind, cfg, current: w.cfg, inst: null };
      live.set(w.id, entry);
      entry.inst = DEFS[w.kind].build(root, { id: w.id, cfg: () => entry.current, save: saver(w.id, w.kind) }) || null;
    }
    return list.map((w) => live.get(w.id).el);
  }
  return { sync, ids: () => [...live.keys()] };
}

/** A throw-away preview of a widget with its default settings, for the gallery. */
export function previewWidget(kind) {
  const root = h('div', { class: 'card wgt wgt-' + kind + ' wgt-preview', 'aria-hidden': 'true' });
  const cfg = normalizeCfg(kind, {});
  const inst = DEFS[kind].build(root, { id: 'preview', cfg: () => cfg, save: () => {} });
  return { el: root, destroy: () => inst?.destroy?.() };
}

export { WIDGET_KINDS };
