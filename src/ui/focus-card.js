// The focus-session control, shared by the popup (compact) and the new tab (large).
// It owns its own state: it reads settings + the running session from storage and re-renders on change.

import { h, svg, icon, clear, toast, confirmDialog, $ } from './dom.js';
import { send } from './api.js';
import { t, fmtDuration, fmtTime } from '../shared/i18n.js';
import { getSettings, getRaw, getDays, getCollection, onChange } from '../shared/storage.js';
import { goalStrip, reviewCard } from './day-loop.js';
import { goalStreak } from '../shared/productivity.js';
import { rangeKeys } from '../shared/time.js';
import { isFocusActive } from '../shared/blocking.js';
import { remainingMs, progress, isRestActive } from '../shared/focus.js';

export function mountFocusCard(root, { variant = 'compact' } = {}) {
  const large = variant === 'large';
  const st = { settings: null, focus: null, rest: null, review: null, today: null, streak: 0, tasks: [], draft: { goal: '', taskId: '', minutes: null, strict: null, scope: null, custom: false } };
  let tickId = null;
  const uid = Math.random().toString(36).slice(2, 7);

  async function load() {
    st.settings = await getSettings();
    const { focus, rest, review } = await getRaw(['focus', 'rest', 'review']);
    st.review = review || null;
    const days = await getDays(rangeKeys(30));
    st.today = days[29][1];
    st.streak = goalStreak(days, st.settings.focus.dailyGoal);
    st.tasks = (await getCollection('tasks', [])).filter((x) => !x.done);
    st.focus = isFocusActive(focus) ? focus : null;
    st.rest = !st.focus && isRestActive(rest) ? rest : null;
    const d = st.draft, s = st.settings.focus;
    if (d.minutes === null) d.minutes = s.minutes;
    if (d.strict === null) d.strict = s.strict;
    if (d.scope === null) d.scope = s.scope;
  }

  function startLabel() { return t('focus.start', { time: fmtDuration(st.draft.minutes * 60) }); }

  async function start() {
    const d = st.draft;
    const res = await send('focus:start', { minutes: d.minutes, goal: d.goal, strict: d.strict, taskId: d.taskId, scope: d.scope });
    if (res && res.ok === false) toast(t('common.error'));
    d.goal = ''; d.taskId = '';
  }

  async function endEarly() {
    const ok = await confirmDialog({ title: t('focus.endConfirmTitle'), body: t('focus.endConfirmBody'), confirm: t('focus.end'), cancel: t('focus.keepGoing'), danger: true });
    if (ok) await send('focus:stop');
  }

  function renderIdle() {
    const d = st.draft, s = st.settings.focus;
    const chips = s.presets.map((m) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(!d.custom && d.minutes === m), onclick: () => { d.minutes = m; d.custom = false; render(); } }, t('focus.minutesShort', { n: m })));
    const custom = d.custom
      ? h('span', { class: 'custom-min' }, h('input', { class: 'input input-sm num', type: 'number', min: 1, max: 720, value: d.minutes, id: 'cm' + uid, 'aria-label': t('focus.custom'), style: { width: '68px', textAlign: 'center' },
          oninput: (e) => { d.minutes = Math.min(720, Math.max(1, Number(e.target.value) || 1)); const b = $('#sb' + uid, root); if (b) b.querySelector('span').textContent = startLabel(); } }), h('span', { class: 'muted', text: t('unit.m') }))
      : h('button', { class: 'chip chip-custom', type: 'button', onclick: () => { d.custom = true; render(); $('#cm' + uid, root)?.focus(); } }, icon('plus'), t('focus.custom'));

    const goal = h('input', { class: 'input' + (large ? ' input-lg' : ''), id: 'goal' + uid, maxlength: 140, value: d.goal, placeholder: t(large ? 'focus.goalPlaceholderLarge' : 'focus.goalPlaceholder'), 'aria-label': t('focus.goalPlaceholder'),
      oninput: (e) => { d.goal = e.target.value; if (d.taskId) { const task = st.tasks.find((x) => x.id === d.taskId); if (!task || task.text !== d.goal) { d.taskId = ''; taskRow.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false')); } } }, onkeydown: (e) => { if (e.key === 'Enter') start(); } });
    const btn = h('button', { class: 'btn btn-primary btn-lg ' + (large ? '' : 'btn-block'), id: 'sb' + uid, type: 'button', onclick: start }, icon('play'), h('span', { text: startLabel() }));
    const opt = (ico, key, hint, checked, onchange) => h('label', { class: 'strict-row' },
      h('span', { class: 'lbl', 'data-tip': t(hint) }, icon(ico), t(key)),
      h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked, 'aria-label': t(key), onchange: (e) => onchange(e.target.checked) }), h('span', { class: 'track' }), h('span', { class: 'thumb' })));
    const strict = h('div', { class: 'focus-opts' },
      opt('lock', 'focus.strict', 'focus.strictHint', d.strict, (v) => { d.strict = v; }),
      opt('shield-check', 'focus.onlyMine', 'focus.onlyMineHint', d.scope === 'only-mine', (v) => { d.scope = v ? 'only-mine' : 'distractions'; }));

    // task picker: priorities first, then the newest open tasks — one tap sets the goal and links the session to the task
    const picks = [...st.tasks.filter((x) => x.starred), ...st.tasks.filter((x) => !x.starred)].slice(0, large ? 4 : 3);
    const taskRow = h('div', { class: 'task-picks' + (picks.length ? '' : ' none') }, picks.map((x) => h('button', { class: 'chip chip-task', type: 'button', 'aria-pressed': String(d.taskId === x.id), 'data-tip': x.text, onclick: () => {
      const on = d.taskId !== x.id;
      d.taskId = on ? x.id : ''; d.goal = on ? x.text : ''; render(); $('#goal' + uid, root)?.focus();
    } }, x.starred ? icon('star') : icon('circle'), h('span', { class: 'truncate', text: x.text }))));
    const noEffort = st.today?.fs ? null : h('button', { class: 'just5', type: 'button', onclick: () => { d.minutes = 5; d.custom = false; start(); } }, icon('sparkles'), t('focus.just5'));
    const strip = goalStrip({ fsSec: st.today?.fs || 0, goalMin: st.settings.focus.dailyGoal, streak: st.streak });

    clear(root, h('div', { class: 'focus-idle' + (large ? ' large' : '') },
      st.review ? reviewCard(st.review, { onDone: refresh }) : null,
      large ? null : h('div', { class: 'focus-head' }, h('h2', { text: t('focus.title') }), h('span', { class: 'hint', text: t('focus.tagline') })),
      strip,
      goal, taskRow,
      large
        ? h('div', { class: 'focus-row' }, h('div', { class: 'durations' }, chips, custom), btn)
        : [h('div', { class: 'durations' }, chips, custom), btn],
      strict, noEffort));
  }

  function renderRunning(restMode = false) {
    const f = restMode ? st.rest : st.focus;
    const size = large ? 220 : 168, R = size / 2 - 8, C = 2 * Math.PI * R, mid = size / 2;
    const time = h('div', { class: 'time num' });
    const sub = h('div', { class: 'sub', text: t('focus.endsAt', { time: fmtTime(new Date(f.endsAt), st.settings.newtab.clock24 ?? undefined) }) });
    const track = svg('circle', { cx: mid, cy: mid, r: R, fill: 'none', 'stroke-width': 8, class: 'track' });
    const bar = svg('circle', { cx: mid, cy: mid, r: R, fill: 'none', 'stroke-width': 8, 'stroke-linecap': 'round', class: 'bar', 'stroke-dasharray': C });
    const ring = svg('svg', { viewBox: `0 0 ${size} ${size}` }, track, bar);
    const actions = restMode
      ? [h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => { await send('rest:skip'); await start(); } }, icon('play'), startLabel()),
         h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => send('rest:skip') }, t('rest.skip'))]
      : f.strict
        ? h('span', { class: 'locked' }, icon('lock'), t('focus.strictLocked'))
        : h('button', { class: 'btn btn-ghost', type: 'button', onclick: endEarly }, t('focus.end'));
    clear(root, h('div', { class: 'focus-run' + (large ? ' large' : '') + (restMode ? ' rest' : '') },
      h('span', { class: 'badge ' + (restMode ? 'badge-success' : 'badge-accent') + ' badge-dot', text: restMode ? t(f.long ? 'rest.long' : 'rest.title') : t('focus.running') }),
      h('div', { class: 'ring', role: 'timer', 'aria-label': restMode ? t(f.long ? 'rest.long' : 'rest.title') : t('focus.running'), style: { width: size + 'px', height: size + 'px' } }, ring, h('div', { class: 'center' }, time, sub)),
      restMode ? h('div', { class: 'goal-line', text: t('rest.hint') }) : (f.goal ? h('div', { class: 'goal-line', text: f.goal }) : null),
      h('div', { class: 'run-actions' }, actions)));
    const paint = () => {
      const rem = remainingMs(f);
      if (rem <= 0) { clearInterval(tickId); refresh(); return; }
      const sec = Math.ceil(rem / 1000), hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
      time.textContent = hh ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
      bar.setAttribute('stroke-dashoffset', String(C * progress(f)));
    };
    paint(); tickId = setInterval(paint, 1000);
  }

  function render() {
    clearInterval(tickId);
    root.classList.toggle('is-running', !!st.focus);
    root.classList.toggle('is-resting', !!st.rest);
    st.focus ? renderRunning() : st.rest ? renderRunning(true) : renderIdle();
  }
  async function refresh() { await load(); render(); }

  refresh();
  onChange(['focus', 'rest', 'settings', 'review', 'tasks', 'd:*'], async () => {
    const was = !!st.focus + ':' + !!st.rest;
    await load();
    if (was !== !!st.focus + ':' + !!st.rest || (!st.focus && !st.rest && !root.contains(document.activeElement))) render();
  });
  return { refresh };
}
