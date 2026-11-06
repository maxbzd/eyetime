// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The idle view: the day so far, the goal field, the length, the options and the start button.

import { dropdown } from '../dropdown.js';
import { h, icon, clear, $ } from '../dom.js';
import { t, fmtDuration } from '../../shared/i18n.js';
import { goalStrip, reviewCard } from '../day-loop.js';
import { dayKey } from '../../shared/time.js';
import { showQuote } from '../quote.js';
import { modeName } from '../../shared/modes.js';
import { nextEvent } from '../../shared/ics.js';

/** @param {any} ctx the context of createSession */
export function renderIdle(ctx) {
  const { st, root, large, uid, render, refresh, start, startLabel, applyMode } = ctx;
  const d = st.draft, s = st.settings.focus;
  const chips = s.presets.map((m) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(!d.custom && d.minutes === m), 'data-tip': st.suggest?.minutes === m ? t('focus.suggestedTip') : undefined, onclick: () => { d.minutes = m; d.custom = false; render(); } }, st.suggest?.minutes === m ? icon('sparkles') : null, t('focus.minutesShort', { n: m })));
  const custom = d.custom
    ? h('span', { class: 'custom-min' }, h('input', { class: 'input input-sm num', type: 'number', min: 1, max: 720, value: d.minutes, id: 'cm' + uid, 'aria-label': t('focus.custom'), style: { width: '68px', textAlign: 'center' },
        oninput: (e) => { d.minutes = Math.min(720, Math.max(1, Number(e.target.value) || 1)); const b = $('#sb' + uid, root); if (b) b.querySelector('span').textContent = startLabel(); } }), h('span', { class: 'muted', text: t('unit.m') }))
    : h('button', { class: 'chip chip-custom', type: 'button', onclick: () => { d.custom = true; render(); $('#cm' + uid, root)?.focus(); } }, icon('plus'), t('focus.custom'));

  const goal = h('input', { class: 'input' + (large ? ' input-lg' : ''), id: 'goal' + uid, maxlength: 140, value: d.goal, placeholder: t(large ? 'focus.goalPlaceholderLarge' : 'focus.goalPlaceholder'), 'aria-label': t('focus.goalPlaceholder'),
    oninput: (e) => { d.goal = e.target.value; if (d.taskId) { const task = st.tasks.find((x) => x.id === d.taskId); if (!task || task.text !== d.goal) { d.taskId = ''; taskRow.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false')); } } }, onkeydown: (e) => { if (e.key === 'Enter') start(); } });
  const btn = h('button', { class: 'btn btn-primary btn-lg ' + (large ? '' : 'btn-block'), id: 'sb' + uid, type: 'button', onclick: start }, icon('play'), h('span', { text: startLabel() }));
  const modes = s.modes || [];
  const modeRow = modes.length ? (large
    ? h('div', { class: 'mode-row', role: 'group', 'aria-label': t('focus.mode') }, modes.map((m) => h('button', { class: 'mode-chip', type: 'button', 'aria-pressed': String(d.mode === m.id), onclick: () => applyMode(m.id) }, icon(m.icon || 'zap'), h('span', { class: 'mn', text: modeName(m) }), h('span', { class: 'mm num', text: fmtDuration(m.minutes * 60) }))))
    : null) : null;
  const modeSelectEl = () => dropdown(modes.map((m) => [m.id, modeName(m) + ' · ' + fmtDuration(m.minutes * 60)]), d.mode, applyMode, { label: t('focus.mode'), cls: 'select-sm mode-select' });
  const opt = (ico, key, hint, checked, onchange) => h('label', { class: 'strict-row' },
    h('span', { class: 'lbl', 'data-tip': t(hint) }, icon(ico), t(key)),
    h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked, 'aria-label': t(key), onchange: (e) => onchange(e.target.checked) }), h('span', { class: 'track' }), h('span', { class: 'thumb' })));
  const strict = h('div', { class: 'focus-opts' },
    !large && modes.length ? modeSelectEl() : null,
    opt('lock', large ? 'focus.strict' : 'focus.strictShort', 'focus.strictHint', d.strict, (v) => { d.strict = v; }),
    large || !modes.length ? opt('shield-check', large ? 'focus.onlyMine' : 'focus.onlyMineShort', 'focus.onlyMineHint', d.scope === 'only-mine', (v) => { d.scope = v ? 'only-mine' : 'distractions'; }) : null);

  // task picker: priorities first, then the newest open tasks — one tap sets the goal and links the session to the task
  const picks = [...st.tasks.filter((x) => x.starred), ...st.tasks.filter((x) => !x.starred)].slice(0, large ? 4 : 2);
  const taskRow = h('div', { class: 'task-picks' + (picks.length ? '' : ' none') }, picks.map((x) => h('button', { class: 'chip chip-task', type: 'button', 'aria-pressed': String(d.taskId === x.id), 'data-tip': x.text, onclick: () => {
    const on = d.taskId !== x.id;
    d.taskId = on ? x.id : ''; d.goal = on ? x.text : '';
    if (on && x.est) { d.minutes = Math.min(720, Math.max(1, x.est)); d.custom = !s.presets.includes(d.minutes); } // the planned length becomes the session length
    render(); $('#goal' + uid, root)?.focus();
  } }, x.starred ? icon('star') : icon('circle'), h('span', { class: 'truncate', text: x.text }))));
  const picked = st.tasks.find((x) => x.id === d.taskId);
  const resumeLine = picked?.resume ? h('div', { class: 'resume-line' }, icon('corner-down-right'), h('span', {}, h('b', { text: t('focus.leftOff') + ' ' }), picked.resume)) : null;
  const suggestLine = st.suggest && large ? h('div', { class: 'hint' }, icon('sparkles'), t('focus.suggested', { n: st.suggest.minutes })) : null;
  const noEffort = st.today?.fs || !large ? null : h('button', { class: 'just5', type: 'button', onclick: () => { d.minutes = 5; d.custom = false; start(); } }, icon('sparkles'), t('focus.just5'));
  // next meeting (from an imported calendar file): say when, and warn if the chosen session would run into it
  const nowD = new Date(), ne = large ? nextEvent(st.events, dayKey(nowD), nowD.getHours() * 60 + nowD.getMinutes()) : null;
  let calLine = null;
  if (ne && ne.inMin <= 8 * 60) {
    const gap = ne.inMin, runsInto = !ne.ongoing && d.minutes > gap - 3, fit = Math.floor((gap - 5) / 5) * 5;
    calLine = h('div', { class: 'cal-line' + (runsInto ? ' warn' : '') }, icon('calendar-clock'),
      h('span', { text: (ne.title ? t('cal.next', { title: ne.title, time: ne.start }) : t('cal.nextNoTitle', { time: ne.start })) + ' · ' + (ne.ongoing ? t('cal.ongoing') : t('cal.in', { time: fmtDuration(gap * 60) })) + (runsInto && !ne.ongoing ? '. ' + t('cal.overlap', { n: d.minutes }) : '') }),
      runsInto && fit >= 10 ? h('button', { class: 'btn btn-sm', type: 'button', onclick: () => { d.minutes = fit; d.custom = !s.presets.includes(fit); render(); } }, t('cal.fit', { n: fit })) : null);
  }
  const todayAll = large ? (st.allDay || []).filter((e) => e.day === dayKey(nowD)) : [];
  const allDayLine = todayAll.length ? h('div', { class: 'cal-line' }, icon('calendar-days'), h('span', { text: t('cal.allDay', { title: todayAll.slice(0, 2).map((e) => e.title || t('meet.untitled')).join(', ') }) })) : null;
  const qfig = h('figure', { class: 'quote focus-quote', hidden: true }, h('blockquote', { class: 'q-text' }), h('figcaption', { class: 'q-by' }));
  const startQuote = showQuote(qfig, 'start', st.settings) ? qfig : null;
  const strip = goalStrip({ fsSec: st.today?.fs || 0, goalMin: st.settings.focus.dailyGoal, streak: st.streak });

  // in the popup a pending review takes the place of the whole start form: one decision at a time, and it fits
  if (!large && st.review) {
    clear(root, h('div', { class: 'focus-idle review-only' }, reviewCard(st.review, { onDone: refresh }), h('button', { class: 'btn btn-primary btn-lg btn-block', type: 'button', onclick: start }, icon('play'), h('span', { text: startLabel() }))));
    return;
  }
  clear(root, h('div', { class: 'focus-idle' + (large ? ' large' : '') },
    st.review ? reviewCard(st.review, { onDone: refresh }) : null,
    startQuote,
    strip, calLine, allDayLine,
    goal, taskRow, resumeLine, modeRow,
    large
      ? h('div', { class: 'focus-row' }, h('div', { class: 'durations' }, chips, custom), btn)
      : [h('div', { class: 'durations' }, chips, custom), btn],
    suggestLine, strict, noEffort));
  }
