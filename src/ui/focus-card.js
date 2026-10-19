// The focus-session control, shared by the popup (compact) and the new tab (large).
// It owns its own state: it reads settings + the running session from storage and re-renders on change.

import { h, icon, clear, toast, confirmDialog, $ } from './dom.js';
import { send } from './api.js';
import { t, fmtDuration, fmtTime } from '../shared/i18n.js';
import { getSettings, getRaw, onChange } from '../shared/storage.js';
import { isFocusActive } from '../shared/blocking.js';
import { remainingMs, progress } from '../shared/focus.js';

export function mountFocusCard(root, { variant = 'compact' } = {}) {
  const large = variant === 'large';
  const st = { settings: null, focus: null, draft: { goal: '', minutes: null, strict: null, custom: false } };
  let tickId = null;
  const uid = Math.random().toString(36).slice(2, 7);

  async function load() {
    st.settings = await getSettings();
    const { focus } = await getRaw('focus');
    st.focus = isFocusActive(focus) ? focus : null;
    const d = st.draft, s = st.settings.focus;
    if (d.minutes === null) d.minutes = s.minutes;
    if (d.strict === null) d.strict = s.strict;
  }

  function startLabel() { return t('focus.start', { time: fmtDuration(st.draft.minutes * 60) }); }

  async function start() {
    const d = st.draft;
    const res = await send('focus:start', { minutes: d.minutes, goal: d.goal, strict: d.strict });
    if (res && res.ok === false) toast(t('common.error'));
    d.goal = '';
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
      : h('button', { class: 'chip', type: 'button', onclick: () => { d.custom = true; render(); $('#cm' + uid, root)?.focus(); } }, icon('plus'), t('focus.custom'));

    const goal = h('input', { class: 'input' + (large ? ' input-lg' : ''), id: 'goal' + uid, maxlength: 140, value: d.goal, placeholder: t(large ? 'focus.goalPlaceholderLarge' : 'focus.goalPlaceholder'), 'aria-label': t('focus.goalPlaceholder'),
      oninput: (e) => { d.goal = e.target.value; }, onkeydown: (e) => { if (e.key === 'Enter') start(); } });
    const btn = h('button', { class: 'btn btn-primary btn-lg ' + (large ? '' : 'btn-block'), id: 'sb' + uid, type: 'button', onclick: start }, icon('play'), h('span', { text: startLabel() }));
    const strict = h('label', { class: 'strict-row' },
      h('span', { class: 'lbl', 'data-tip': t('focus.strictHint') }, icon('lock'), t('focus.strict')),
      h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked: d.strict, 'aria-label': t('focus.strict'), onchange: (e) => { d.strict = e.target.checked; } }), h('span', { class: 'track' }), h('span', { class: 'thumb' })));

    clear(root, h('div', { class: 'focus-idle' + (large ? ' large' : '') },
      large ? null : h('div', { class: 'focus-head' }, h('h2', { text: t('focus.title') }), h('span', { class: 'hint', text: t('focus.tagline') })),
      goal,
      large
        ? h('div', { class: 'focus-row' }, h('div', { class: 'durations' }, chips, custom), strict, btn)
        : [h('div', { class: 'durations' }, chips, custom), btn, strict]));
  }

  function renderRunning() {
    const f = st.focus;
    const size = large ? 220 : 168, R = size / 2 - 8, C = 2 * Math.PI * R, mid = size / 2;
    const time = h('div', { class: 'time num' });
    const sub = h('div', { class: 'sub', text: t('focus.endsAt', { time: fmtTime(new Date(f.endsAt), st.settings.newtab.clock24 ?? undefined) }) });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    const track = h('circle', { cx: mid, cy: mid, r: R, fill: 'none', 'stroke-width': 8, class: 'track' });
    const bar = h('circle', { cx: mid, cy: mid, r: R, fill: 'none', 'stroke-width': 8, 'stroke-linecap': 'round', class: 'bar', 'stroke-dasharray': C });
    svg.append(track, bar);
    const actions = f.strict
      ? h('span', { class: 'locked' }, icon('lock'), t('focus.strictLocked'))
      : h('button', { class: 'btn btn-ghost', type: 'button', onclick: endEarly }, t('focus.end'));
    clear(root, h('div', { class: 'focus-run' + (large ? ' large' : '') },
      h('span', { class: 'badge badge-accent badge-dot', text: t('focus.running') }),
      h('div', { class: 'ring', style: { width: size + 'px', height: size + 'px' } }, svg, h('div', { class: 'center' }, time, sub)),
      f.goal ? h('div', { class: 'goal-line', text: f.goal }) : null,
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
    st.focus ? renderRunning() : renderIdle();
  }
  async function refresh() { await load(); render(); }

  refresh();
  onChange(['focus', 'settings'], async () => {
    const was = !!st.focus;
    await load();
    if (was !== !!st.focus || (!st.focus && !root.contains(document.activeElement))) render();
  });
  return { refresh };
}
