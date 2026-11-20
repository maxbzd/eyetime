// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Widgets about time: a clock (analog, flip, digital), the date, the moon, sunrise and sunset, the year, a timer.

import { icon, toast } from '../ui/dom.js';
import { t, fmtTime, getLocale } from '../shared/i18n.js';
import { handAngles, zonedParts } from '../shared/wgx.js';
import { el, h, clear, live, SVG_NS } from './widget-kit.js';

const svg = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(SVG_NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); for (const c of kids) if (c) e.append(c); return e; };
const hand = (cls, len, w) => svg('line', { class: 'cl-hand ' + cls, x1: 50, y1: 50 + (cls === 'cl-s' ? 10 : 0), x2: 50, y2: 50 - len, 'stroke-width': w });

function analogFace(face) {
  const out = [];
  if (face === 'ticks') for (let i = 0; i < 60; i++) { const big = i % 5 === 0, a = i * 6 * Math.PI / 180, r1 = big ? 40 : 44, r2 = 47.5; out.push(svg('line', { class: big ? 'cl-tick big' : 'cl-tick', x1: 50 + Math.sin(a) * r1, y1: 50 - Math.cos(a) * r1, x2: 50 + Math.sin(a) * r2, y2: 50 - Math.cos(a) * r2 })); }
  else if (face === 'dots') for (let i = 0; i < 12; i++) { const a = i * 30 * Math.PI / 180; out.push(svg('circle', { class: i % 3 === 0 ? 'cl-dot big' : 'cl-dot', cx: 50 + Math.sin(a) * 43, cy: 50 - Math.cos(a) * 43, r: i % 3 === 0 ? 2.6 : 1.5 }));
  } else if (face === 'bold') for (const [i, n] of /** @type {Array<[number, string]>} */ ([[0, '12'], [1, '3'], [2, '6'], [3, '9']])) { const a = i * 90 * Math.PI / 180; out.push(svg('text', { class: 'cl-num', x: 50 + Math.sin(a) * 38, y: 50 - Math.cos(a) * 38 + 5, 'text-anchor': 'middle' }, document.createTextNode(n))); }
  else for (let i = 0; i < 4; i++) { const a = i * 90 * Math.PI / 180; out.push(svg('line', { class: 'cl-tick big', x1: 50 + Math.sin(a) * 41, y1: 50 - Math.cos(a) * 41, x2: 50 + Math.sin(a) * 46, y2: 50 - Math.cos(a) * 46 })); }
  return out;
}

export const TIME_DEFS = {
  clock: {
    build(root, api) {
      let key = '';
      const draw = () => {
        const c = api.cfg(), now = new Date(), p = zonedParts(now, c.zone), sig = [c.view, c.face, c.seconds, c.zone].join();
        if (c.view === 'analog') {
          if (sig !== key) {
            key = sig;
            const s = hand('cl-s', 40, 0.9); if (!c.seconds) s.setAttribute('hidden', '');
            const face = svg('svg', { class: 'cl-svg', viewBox: '0 0 100 100', role: 'img', 'aria-label': t('wg.k.clock') }, svg('circle', { class: 'cl-rim', cx: 50, cy: 50, r: 48.5 }), ...analogFace(c.face), hand('cl-h', 26, c.face === 'bold' ? 4 : 2.6), hand('cl-m', 38, c.face === 'bold' ? 2.8 : 1.7), s, svg('circle', { class: 'cl-pin', cx: 50, cy: 50, r: 2.4 }));
            clear(root, face);
          }
          const a = handAngles(new Date(1970, 0, 1, p.h, p.m, p.s));
          root.querySelector('.cl-h')?.setAttribute('transform', `rotate(${a.h} 50 50)`); root.querySelector('.cl-m')?.setAttribute('transform', `rotate(${a.m} 50 50)`); root.querySelector('.cl-s')?.setAttribute('transform', `rotate(${a.s} 50 50)`);
        } else {
          const d = new Date(1970, 0, 1, p.h, p.m, p.s), hh = String(p.h).padStart(2, '0'), mm = String(p.m).padStart(2, '0');
          const label = fmtTime(d, undefined, c.seconds);
          if (c.view === 'flip') {
            const tile = (v) => el('span', 'cf-tile', el('b', '', v), el('i', ''));
            if (sig !== key || root.dataset.t !== hh + mm) { key = sig; root.dataset.t = hh + mm; clear(root, el('div', 'cf-row', tile(hh[0]), tile(hh[1]), el('span', 'cf-sep', ':'), tile(mm[0]), tile(mm[1])), c.seconds ? el('div', 'cf-sec num', String(p.s).padStart(2, '0')) : null); } else if (c.seconds) root.querySelector('.cf-sec').textContent = String(p.s).padStart(2, '0');
            root.firstElementChild?.setAttribute('aria-label', label); root.firstElementChild?.setAttribute('role', 'img');
          } else { key = sig; clear(root, el('div', 'cd-time num', label)); }
        }
        const zl = c.zone ? c.zone.split('/').pop().replace(/_/g, ' ') : '';
        root.dataset.zone = zl; if (zl && !root.querySelector('.cl-zone')) root.append(el('div', 'cl-zone', zl)); else if (!zl) root.querySelector('.cl-zone')?.remove(); else root.querySelector('.cl-zone').textContent = zl;
      };
      root.classList.add('wgt-clock');
      return live(draw, { every: 1000 });
    },
  },

  date: {
    build(root, api) {
      const draw = () => {
        const d = new Date(), loc = getLocale(), c = api.cfg(), f = (o) => new Intl.DateTimeFormat(loc, o).format(d);
        root.dataset.style = c.style;
        clear(root, c.style === 'plain'
          ? [el('div', 'dt-wk', f({ weekday: 'long' })), el('div', 'dt-line num', f({ day: 'numeric', month: 'long' })), el('div', 'wg-sub', f({ year: 'numeric' }))]
          : c.style === 'bar'
            ? [el('div', 'dt-bar', el('span', 'dt-day num', f({ day: 'numeric' })), el('span', 'dt-col', el('b', '', f({ weekday: 'long' })), el('span', '', f({ month: 'long', year: 'numeric' }))))]
            : [el('div', 'dt-top', f({ month: 'long' })), el('div', 'dt-day num', f({ day: 'numeric' })), el('div', 'dt-wk', f({ weekday: 'long' }))]);
      };
      return live(draw, { every: 60_000, align: 60_000 });
    },
  },




  timer: {
    build(root, api) {
      const R = 44, C = 2 * Math.PI * R, PRESETS = [5, 10, 25, 45];
      let done = false, sig = '';
      const total = () => api.cfg().minutes * 60_000;
      const leftMs = () => { const c = api.cfg(); return c.endsAt ? Math.max(0, c.endsAt - Date.now()) : c.left || total(); };
      const clockText = (left) => `${Math.floor(left / 60_000)}:${String(Math.floor((left % 60_000) / 1000)).padStart(2, '0')}`;
      const draw = () => {
        const c = api.cfg(), running = !!c.endsAt, left = leftMs(), frac = total() ? Math.max(0, Math.min(1, left / total())) : 0, idle = !running && !c.left;
        if (running && left <= 0 && !done) { done = true; api.save({ endsAt: 0, left: 0 }); toast((c.title ? c.title + ': ' : '') + t('wg.timer.done'), { ms: 8000 }); }
        if (!running) done = false;
        const next = [running, idle, c.minutes, c.title].join();
        if (next === sig && root.querySelector('.tm-time')) { root.querySelector('.tm-time').textContent = clockText(left); root.querySelector('.tm-ring .bar')?.setAttribute('stroke-dasharray', `${(C * frac).toFixed(1)} ${C.toFixed(1)}`); return; }
        sig = next;
        clear(root, el('div', 'wg-label', c.title || t('wg.k.timer')),
          el('div', 'tm-ringwrap', svg('svg', { class: 'tm-ring', viewBox: '0 0 100 100', 'aria-hidden': 'true' }, svg('circle', { class: 'track', cx: 50, cy: 50, r: R }), svg('circle', { class: 'bar', cx: 50, cy: 50, r: R, 'stroke-dasharray': `${(C * frac).toFixed(1)} ${C.toFixed(1)}` })), el('div', 'tm-time num', clockText(left))),
          idle ? el('div', 'tm-presets', PRESETS.map((m) => h('button', { class: 'chip' + (m === c.minutes ? ' on' : ''), type: 'button', 'aria-pressed': String(m === c.minutes), onclick: () => api.save({ minutes: m, left: 0, endsAt: 0 }) }, t('wg.timer.min', { n: m })))) : null,
          el('div', 'tm-btns',
            running
              ? h('button', { class: 'btn btn-sm', type: 'button', onclick: () => api.save({ left: Math.max(1000, leftMs()), endsAt: 0 }) }, icon('pause'), t('wg.timer.pause'))
              : h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: () => api.save({ endsAt: Date.now() + (c.left || total()), left: 0 }) }, icon('play'), t('wg.timer.start')),
            !idle ? h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => api.save({ endsAt: 0, left: 0 }) }, icon('rotate-ccw'), t('wg.timer.reset')) : null));
      };
      return live(draw, { every: 500 });
    },
  },
};
