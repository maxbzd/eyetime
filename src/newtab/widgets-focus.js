// Widgets about focus and numbers: the running session, the daily goal, the streak, a heat map, best hours, today's sessions, screen time, top sites, the distraction budget, today against yesterday.

import { icon, favicon } from '../ui/dom.js';
import { send } from '../ui/api.js';
import { t, fmtDuration, fmtNumber, fmtTime } from '../shared/i18n.js';
import { getSettings, getDays, getRaw } from '../shared/storage.js';
import { dayKey, rangeKeys } from '../shared/time.js';
import { makeClassifier } from '../shared/classify.js';
import { loadGuess } from '../shared/guessstore.js';
import { summarize, focusStreak } from '../shared/stats.js';
import { goalProgress, goalStreak, bestHours, sessionsOf } from '../shared/productivity.js';
import { isFocusLive } from '../shared/blocking.js';
import { remainingMs, plannedMs, clock, isPaused } from '../shared/focus.js';
import { heatGrid, hourBars } from '../shared/wgx.js';
import { el, h, clear, live, SVG_NS } from './widget-kit.js';

const svg = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(SVG_NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); for (const c of kids) if (c) e.append(c); return e; };
const R = 44, C = 2 * Math.PI * R;
const ring = (frac, cls = '') => svg('svg', { class: 'fx-ring ' + cls, viewBox: '0 0 100 100', 'aria-hidden': 'true' }, svg('circle', { class: 'track', cx: 50, cy: 50, r: R }), svg('circle', { class: 'bar', cx: 50, cy: 50, r: R, 'stroke-dasharray': `${(C * Math.max(0, Math.min(1, frac))).toFixed(1)} ${C.toFixed(1)}` }));
const settingsLink = (hash, label) => h('a', { class: 'btn btn-sm', href: chrome.runtime.getURL('src/options/options.html#' + hash) }, icon('settings'), label);
const days = (n) => getDays(rangeKeys(n));

export const FOCUS_DEFS = {
  focusnow: {
    build(root) {
      let sig = '';
      const draw = async (alive) => {
        const [{ focus }, s] = await Promise.all([getRaw('focus'), getSettings()]);
        if (!alive()) return;
        const f = focus && isFocusLive(focus) ? focus : null;
        if (f) {
          const left = remainingMs(f), paused = isPaused(f), frac = plannedMs(f) ? left / plannedMs(f) : 0, next = ['run', paused].join();
          if (sig === next && root.querySelector('.fx-time')) { root.querySelector('.fx-time').textContent = clock(left); root.querySelector('.fx-ring .bar')?.setAttribute('stroke-dasharray', `${(C * Math.max(0, Math.min(1, frac))).toFixed(1)} ${C.toFixed(1)}`); return; }
          sig = next;
          clear(root, el('div', 'wg-label', paused ? t('focus.paused') : (f.goal || t('wg.k.focusnow'))),
            el('div', 'fx-wrap', ring(frac), el('div', 'fx-time num', clock(left))),
            el('div', 'fx-btns', paused ? h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: () => send('focus:resume') }, icon('play'), t('focus.resume')) : h('button', { class: 'btn btn-sm', type: 'button', onclick: () => send('focus:pause') }, icon('pause'), t('focus.pause')),
              h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => send('focus:stop') }, icon('square'), t('wg.fn.stop'))));
          return;
        }
        sig = 'idle';
        const mins = [15, 25, 50, 90];
        clear(root, el('div', 'wg-label', t('wg.k.focusnow')),
          el('div', 'fn-start', mins.map((m) => h('button', { class: 'btn' + (m === s.focus.minutes ? ' btn-primary' : ''), type: 'button', onclick: () => send('focus:start', { minutes: m, goal: '', strict: s.focus.strict, scope: s.focus.scope, mode: s.focus.mode }) }, icon('play'), fmtDuration(m * 60)))));
      };
      return live(draw, { watch: ['focus', 'settings'], every: 1000 });
    },
  },

  goal: {
    build(root) {
      const draw = async (alive) => {
        const [s, ds] = await Promise.all([getSettings(), days(60)]);
        if (!alive()) return;
        const today = ds[ds.length - 1][1], g = goalProgress(today?.fs || 0, s.focus.dailyGoal);
        if (!g.goalMin) { clear(root, el('div', 'wg-label', t('wg.k.goal')), el('div', 'wg-sub', t('wg.goal.none')), settingsLink('focus', t('wg.goal.set'))); return; }
        const st = goalStreak(ds, g.goalMin, s.focus.goalDays, { grace: true });
        clear(root, el('div', 'wg-label', t('wg.k.goal')),
          el('div', 'fx-wrap' + (g.reached ? ' hit' : ''), ring(g.pct), el('div', 'fx-center', el('b', 'num', fmtDuration(g.doneMin * 60)), el('span', '', '/ ' + fmtDuration(g.goalMin * 60)))),
          el('div', 'wg-sub', g.reached ? t('wg.goal.done') : t('wg.goal.left', { n: fmtDuration(g.leftMin * 60) })), st ? el('div', 'fx-chip', icon('flame'), t('wg.streak.days', { n: fmtNumber(st) })) : null);
      };
      return live(draw, { watch: ['d:*', 'settings'], every: 60_000 });
    },
  },

  streak: {
    build(root) {
      const draw = async (alive) => {
        const ds = await days(30);
        if (!alive()) return;
        const n = focusStreak(ds), last = ds.slice(-14);
        clear(root, el('div', 'wg-label', t('wg.k.streak')),
          el('div', 'st-big', el('span', 'st-flame' + (n ? ' on' : ''), icon('flame')), el('span', 'wb-num num', fmtNumber(n))),
          el('div', 'wg-sub', t('wg.streak.days', { n: fmtNumber(n) })),
          el('div', 'st-dots', last.map(([k, d]) => el('i', (d?.fc || 0) > 0 ? 'on' : k === dayKey() ? 'now' : ''))));
      };
      return live(draw, { watch: ['d:*'] });
    },
  },

  heat: {
    build(root, api) {
      const draw = async (alive) => {
        const weeks = api.cfg().weeks, ds = await days(weeks * 7 + 7);
        if (!alive()) return;
        const by = new Map(ds.map(([k, d]) => [k, d?.fs || 0])), g = heatGrid((k) => by.get(k) || 0, weeks, new Date());
        const total = ds.slice(-weeks * 7).reduce((a, [, d]) => a + (d?.fs || 0), 0);
        clear(root, el('div', 'wg-label', t('wg.k.heat')),
          el('div', 'ht-grid', { style: `--cols:${weeks}` }, g.flat().map((c) => el('i', 'l' + c.level + (c.future ? ' fut' : '')))),
          el('div', 'wg-sub', fmtDuration(total)));
      };
      return live(draw, { watch: ['d:*'] });
    },
  },

  hours: {
    build(root) {
      const draw = async (alive) => {
        const ds = await days(60);
        if (!alive()) return;
        const bars = hourBars(sessionsOf(ds)), best = bestHours(ds), now = new Date().getHours();
        if (!bars) { clear(root, el('div', 'wg-label', t('wg.k.hours')), el('div', 'wg-sub', t('wg.hours.few'))); return; }
        const hh = (x) => fmtTime(new Date(1970, 0, 1, x, 0), undefined);
        clear(root, el('div', 'wg-label', t('wg.k.hours')),
          el('div', 'hr-bars', bars.map((v, i) => el('i', (i === now ? 'now ' : '') + (best && (i === best.start || i === (best.start + 1) % 24) ? 'best' : ''), { style: `height:${Math.max(4, Math.round(v * 100))}%` }))),
          el('div', 'hr-axis', ['0', '6', '12', '18'].map((x) => el('span', '', x))),
          best ? el('div', 'wg-sub', t('wg.hours.best', { from: hh(best.start), to: hh(best.end) })) : null);
      };
      return live(draw, { watch: ['d:*'] });
    },
  },

  sessions: {
    build(root) {
      const draw = async (alive) => {
        const [[, day]] = await getDays([dayKey()]);
        if (!alive()) return;
        const ss = (day?.ss || []).slice().sort((a, b) => a.t - b.t);
        clear(root, el('div', 'wg-label', t('wg.k.sessions')),
          ss.length ? el('div', 'ss-list', ss.slice(-6).map((x) => el('div', 'ss-row', el('span', 'ss-time num', fmtTime(new Date(x.t))), el('span', 'ss-bar', el('i', '', { style: `width:${Math.min(100, Math.round(x.m / 60 * 100))}%` })), el('span', 'ss-m num', fmtDuration(x.m * 60))))) : el('div', 'wg-sub', t('wg.sessions.none')),
          ss.length ? el('div', 'wg-sub', fmtDuration((day.fs || 0)) + ' · ' + fmtNumber(ss.length)) : null);
      };
      return live(draw, { watch: ['d:*'] });
    },
  },

  screen: {
    build(root) {
      const draw = async (alive) => {
        const [s, ds, guess] = await Promise.all([getSettings(), days(1), loadGuess()]);
        if (!alive()) return;
        const sum = summarize(ds, makeClassifier(s, guess).classify), tot = sum.total || 1;
        clear(root, el('div', 'wg-label', t('wg.k.screen')), el('div', 'wb-num num', fmtDuration(sum.total)),
          el('div', 'sc-bar', ['productive', 'neutral', 'distracting'].map((c) => el('i', c, { style: `width:${(sum[c] / tot * 100).toFixed(1)}%` }))),
          el('div', 'sc-legend', ['productive', 'neutral', 'distracting'].map((c) => el('span', c, el('i', ''), t('class.' + c) + ' ' + fmtDuration(sum[c])))));
      };
      return live(draw, { watch: ['d:*', 'settings', 'siteGuess'], every: 60_000 });
    },
  },

  topsites: {
    build(root, api) {
      const draw = async (alive) => {
        const [s, ds, guess] = await Promise.all([getSettings(), days(1), loadGuess()]);
        if (!alive()) return;
        const sum = summarize(ds, makeClassifier(s, guess).classify), top = sum.topSites.slice(0, api.cfg().n), max = top[0]?.sec || 1;
        clear(root, el('div', 'wg-label', t('wg.k.topsites')),
          top.length ? el('div', 'ts-list', top.map((x) => el('div', 'ts-row', favicon(x.host), el('span', 'ts-host', x.host), el('span', 'ts-bar ' + x.cls, el('i', '', { style: `width:${Math.max(3, Math.round(x.sec / max * 100))}%` })), el('span', 'ts-t num', fmtDuration(x.sec))))) : el('div', 'wg-sub', t('wg.topsites.none')));
      };
      return live(draw, { watch: ['d:*', 'settings'], every: 60_000 });
    },
  },

  distraction: {
    build(root) {
      const draw = async (alive) => {
        const [s, ds, guess] = await Promise.all([getSettings(), days(1), loadGuess()]);
        if (!alive()) return;
        const used = summarize(ds, makeClassifier(s, guess).classify).distracting, b = s.blocking.budget || {}, total = (b.minutes || 0) * 60;
        if (!b.enabled || !total) { clear(root, el('div', 'wg-label', t('wg.k.distraction')), el('div', 'wb-num num', fmtDuration(used)), el('div', 'wg-sub', t('wg.budget.off')), settingsLink('blocking', t('wg.budget.set'))); return; }
        const frac = used / total;
        clear(root, el('div', 'wg-label', t('wg.k.distraction')), el('div', 'fx-wrap' + (frac >= 1 ? ' over' : frac > 0.75 ? ' warn' : ''), ring(frac), el('div', 'fx-center', el('b', 'num', fmtDuration(used)), el('span', '', '/ ' + fmtDuration(total)))));
      };
      return live(draw, { watch: ['d:*', 'settings'], every: 60_000 });
    },
  },

  compare: {
    build(root) {
      const draw = async (alive) => {
        const ds = await days(2);
        if (!alive()) return;
        const a = ds[0][1]?.fs || 0, b = ds[1][1]?.fs || 0, d = b - a, pct = a ? Math.round(d / a * 100) : (b ? 100 : 0);
        const dir = Math.abs(pct) < 3 ? 'same' : d > 0 ? 'up' : 'down';
        clear(root, el('div', 'wg-label', t('wg.k.compare')),
          el('div', 'cp-big ' + dir, (dir === 'up' ? icon('trending-up') : dir === 'down' ? icon('trending-down') : icon('minus')), el('span', 'wb-num num', dir === 'same' ? '0%' : (pct > 0 ? '+' : '') + fmtNumber(pct) + '%')),
          el('div', 'wg-sub', t('wg.compare.' + dir)),
          el('div', 'cp-rows', el('span', '', t('wg.compare.today'), el('b', 'num', fmtDuration(b))), el('span', '', t('wg.compare.yest'), el('b', 'num', fmtDuration(a)))));
      };
      return live(draw, { watch: ['d:*'], every: 60_000 });
    },
  },
};
