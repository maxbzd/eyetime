// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The hero: the clock, the date, the greeting and the quote of the day.

import { $, h, clear } from '../../ui/dom.js';
import { t, fmtDate, fmtTime } from '../../shared/i18n.js';
import { canvasActive } from '../canvas.js';
import { clockSeconds, alignClockFill } from '../type-apply.js';
import { CLOCKS, LAYOUTS } from '../home-controls.js';
import { showQuote } from '../../ui/quote.js';
import { checkLayout } from './layout-watch.js';
import { state } from './state.js';

export function paintClock() {
  const now = new Date();
  const time = fmtTime(now, state.settings.newtab.clock24 ?? undefined, clockSeconds(state.settings));
  const clockEl = $('#clock');
  if (state.settings.newtab.clockStyle === 'stacked') {
    const [hh, ...rest] = time.split(':');
    const tail = rest.join(':'), ap = /\s?([AP]M)$/i.exec(tail);
    clear(clockEl, h('span', { class: 'h', text: hh }), h('span', { class: 'm' }, tail.replace(/\s?[AP]M$/i, ''), ap ? h('span', { class: 'ap', text: ap[1].toUpperCase() }) : null));
  } else clockEl.textContent = time;
  document.body.dataset.clock = CLOCKS.includes(state.settings.newtab.clockStyle) ? state.settings.newtab.clockStyle : 'thin';
  document.body.dataset.layout = canvasActive(state.settings) ? 'canvas' : LAYOUTS.includes(state.settings.newtab.layout) ? state.settings.newtab.layout : 'center';
  $('#date').textContent = fmtDate(now);
  showQuote($('#quote'), 'day', state.settings);
  alignClockFill();
  const hr = now.getHours();
  $('#greeting').textContent = state.settings.newtab.greeting ? t(hr < 5 ? 'greet.night' : hr < 12 ? 'greet.morning' : hr < 18 ? 'greet.afternoon' : 'greet.evening') : '';
}

/** The clock ticks every 10 s, every second when seconds are shown. */
let clockTimer = 0, clockEvery = 0;
export function scheduleClock() {
  const every = clockSeconds(state.settings) ? 1000 : 10_000;
  if (every === clockEvery) return;
  clearInterval(clockTimer); clockEvery = every; clockTimer = setInterval(() => { paintClock(); checkLayout(); }, every);
}
