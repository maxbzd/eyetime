// Widgets about time: a clock (analog, flip, digital), the date, the moon, sunrise and sunset, the year, a timer.

import { icon, toast } from '../ui/dom.js';
import { t, fmtDuration, fmtNumber, fmtTime, getLocale } from '../shared/i18n.js';
import { getSettings } from '../shared/storage.js';
import { handAngles, zonedParts, moonInfo, moonPath, sunTimes, sunProgress, yearInfo } from '../shared/wgx.js';
import { normalizeWeather } from '../shared/weather.js';
import { el, h, clear, live, SVG_NS } from './widget-kit.js';

const svg = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(SVG_NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); for (const c of kids) if (c) e.append(c); return e; };
const hand = (cls, len, w) => svg('line', { class: 'cl-hand ' + cls, x1: 50, y1: 50 + (cls === 'cl-s' ? 10 : 0), x2: 50, y2: 50 - len, 'stroke-width': w });

function analogFace(face) {
  const out = [];
  if (face === 'ticks') for (let i = 0; i < 60; i++) { const big = i % 5 === 0, a = i * 6 * Math.PI / 180, r1 = big ? 40 : 44, r2 = 47.5; out.push(svg('line', { class: big ? 'cl-tick big' : 'cl-tick', x1: 50 + Math.sin(a) * r1, y1: 50 - Math.cos(a) * r1, x2: 50 + Math.sin(a) * r2, y2: 50 - Math.cos(a) * r2 })); }
  else if (face === 'dots') for (let i = 0; i < 12; i++) { const a = i * 30 * Math.PI / 180; out.push(svg('circle', { class: i % 3 === 0 ? 'cl-dot big' : 'cl-dot', cx: 50 + Math.sin(a) * 43, cy: 50 - Math.cos(a) * 43, r: i % 3 === 0 ? 2.6 : 1.5 }));
  } else if (face === 'bold') for (const [i, n] of [[0, '12'], [1, '3'], [2, '6'], [3, '9']]) { const a = i * 90 * Math.PI / 180; out.push(svg('text', { class: 'cl-num', x: 50 + Math.sin(a) * 38, y: 50 - Math.cos(a) * 38 + 5, 'text-anchor': 'middle' }, document.createTextNode(n))); }
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

  moon: {
    build(root) {
      const draw = () => {
        const m = moonInfo(new Date()), p = moonPath(m.frac, 46), full = m.toFull < m.toNew || m.name === 'new';
        const disc = svg('svg', { class: 'mo-svg', viewBox: '-50 -50 100 100', role: 'img', 'aria-label': t('wx.moon.' + m.name) },
          svg('defs', {}, svg('radialGradient', { id: 'mo-g', cx: '35%', cy: '35%', r: '80%' }, svg('stop', { offset: '0', 'stop-color': '#fffbe9' }), svg('stop', { offset: '1', 'stop-color': '#cfc7aa' }))),
          svg('circle', { class: 'mo-dark', r: 46 }), p.d ? svg('path', { d: p.d, fill: 'url(#mo-g)', transform: p.flip ? 'scale(-1 1)' : '' }) : null, svg('circle', { class: 'mo-rim', r: 46 }));
        clear(root, disc, el('div', 'mo-name', t('wx.moon.' + m.name)), el('div', 'wg-sub', t('wg.moon.lit', { n: fmtNumber(Math.round(m.illum * 100)) }) + ' · ' + (m.toFull <= m.toNew && m.name !== 'new' ? t('wg.moon.toFull', { n: fmtNumber(Math.max(1, Math.round(m.toFull))) }) : t('wg.moon.toNew', { n: fmtNumber(Math.max(1, Math.round(m.toNew))) }))));
        void full;
      };
      return live(draw, { every: 3_600_000 });
    },
  },

  sun: {
    build(root) {
      const draw = async (alive) => {
        const place = normalizeWeather((await getSettings()).weather).place;
        if (!alive()) return;
        if (!place) { clear(root, el('div', 'wg-label', t('wg.k.sun')), el('div', 'wg-sub', t('wg.sun.needCity')), h('a', { class: 'btn btn-sm', href: chrome.runtime.getURL('src/options/options.html#home') }, icon('settings'), t('wg.sun.setCity'))); return; }
        const now = new Date(), s = sunTimes(now, place.lat, place.lon);
        if ('polar' in s) { clear(root, el('div', 'wg-label', place.name), el('div', 'wg-sub', t(s.polar === 'day' ? 'wg.sun.polarDay' : 'wg.sun.polarNight'))); return; }
        const pr = sunProgress(now, s.rise, s.set), x = Math.max(-0.08, Math.min(1.08, pr)), a = Math.PI * (1 - x), sx = 50 + 40 * Math.cos(a), sy = 52 - 40 * Math.sin(a), up = pr >= 0 && pr <= 1;
        const arc = svg('svg', { class: 'su-svg', viewBox: '0 0 100 60', role: 'img', 'aria-label': t('wg.k.sun') }, svg('path', { class: 'su-track', d: 'M10,52 A40,40 0 0 1 90,52' }), svg('line', { class: 'su-horizon', x1: 2, y1: 52, x2: 98, y2: 52 }),
          svg('path', { class: 'su-done', d: `M10,52 A40,40 0 0 1 ${sx.toFixed(2)},${sy.toFixed(2)}`, hidden: up ? null : '' }), svg('circle', { class: up ? 'su-sun' : 'su-sun night', cx: sx.toFixed(2), cy: Math.min(sy, 56).toFixed(2), r: 4.2 }));
        const tm = (d) => fmtTime(d);
        clear(root, el('div', 'wg-label', place.name), arc,
          el('div', 'su-times', el('span', '', icon('sun'), el('b', 'num', tm(s.rise))), el('span', '', icon('moon'), el('b', 'num', tm(s.set)))),
          el('div', 'wg-sub', t('wg.sun.len', { t: fmtDuration((s.set - s.rise) / 1000) })));
      };
      return live(draw, { watch: ['settings'], every: 60_000, align: 60_000 });
    },
  },

  year: {
    build(root, api) {
      const draw = () => {
        const y = yearInfo(new Date()), c = api.cfg(), pct = Math.floor(y.frac * 100);
        root.dataset.view = c.view;
        const head = el('div', 'wg-label', String(y.year));
        const foot = el('div', 'yr-foot', el('b', 'num', t('wg.year.left', { n: fmtNumber(y.left) })), el('span', 'wg-sub', t('wg.year.pct', { n: fmtNumber(pct), year: y.year })));
        if (c.view === 'ring') {
          const R = 40, C = 2 * Math.PI * R;
          clear(root, head, el('div', 'yr-ringwrap', svg('svg', { class: 'yr-ring', viewBox: '0 0 100 100', role: 'img', 'aria-label': `${pct}%` }, svg('circle', { class: 'track', cx: 50, cy: 50, r: R }), svg('circle', { class: 'bar', cx: 50, cy: 50, r: R, 'stroke-dasharray': `${(C * y.frac).toFixed(1)} ${C.toFixed(1)}` })), el('div', 'yr-pct num', pct + '%')), foot);
        } else if (c.view === 'weeks') {
          const weeks = Math.ceil(y.total / 7), cur = Math.floor(y.index / 7);
          clear(root, head, el('div', 'yr-weeks', Array.from({ length: weeks }, (_, i) => el('i', i < cur ? 'on' : i === cur ? 'now' : ''))), foot);
        } else {
          clear(root, head, el('div', 'yr-dots', Array.from({ length: y.total }, (_, i) => el('i', i < y.index ? 'on' : i === y.index ? 'now' : ''))), foot);
        }
      };
      return live(draw, { every: 3_600_000 });
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
