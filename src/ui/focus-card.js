// The focus-session control, shared by the popup (compact) and the new tab (large).
// It owns its own state: it reads settings + the running session from storage and re-renders on change.

import { h, svg, icon, clear, toast, confirmDialog, $ } from './dom.js';
import { send } from './api.js';
import { t, fmtDuration, fmtTime } from '../shared/i18n.js';
import { getSettings, getRaw, getDays, getCollection, setCollection, onChange } from '../shared/storage.js';
import { goalStrip, reviewCard } from './day-loop.js';
import { goalStreak, suggestMinutes } from '../shared/productivity.js';
import { rangeKeys } from '../shared/time.js';
import { isFocusActive } from '../shared/blocking.js';
import { remainingMs, progress, isRestActive } from '../shared/focus.js';
import { modeName } from '../shared/modes.js';

export function mountFocusCard(root, { variant = 'compact' } = {}) {
  const large = variant === 'large';
  const st = { settings: null, focus: null, rest: null, review: null, today: null, streak: 0, suggest: null, tasks: [], draft: { goal: '', taskId: '', minutes: null, strict: null, scope: null, mode: null, custom: false } };
  let tickId = null;
  const uid = Math.random().toString(36).slice(2, 7);

  async function load() {
    st.settings = await getSettings();
    const { focus, rest, review } = await getRaw(['focus', 'rest', 'review']);
    st.review = review || null;
    const days = await getDays(rangeKeys(30));
    st.today = days[29][1];
    st.suggest = suggestMinutes(days, st.settings.focus.presets);
    st.streak = goalStreak(days, st.settings.focus.dailyGoal, st.settings.focus.goalDays);
    st.tasks = (await getCollection('tasks', [])).filter((x) => !x.done);
    st.focus = isFocusActive(focus) ? focus : null;
    st.rest = !st.focus && isRestActive(rest) ? rest : null;
    const d = st.draft, s = st.settings.focus;
    if (d.minutes === null) d.minutes = s.minutes;
    if (d.strict === null) d.strict = s.strict;
    if (d.scope === null) d.scope = s.scope;
    if (d.mode === null) d.mode = s.mode;
  }

  function startLabel() { return t('focus.start', { time: fmtDuration(st.draft.minutes * 60) }); }

  async function start() {
    const d = st.draft;
    const res = await send('focus:start', { minutes: d.minutes, goal: d.goal, strict: d.strict, taskId: d.taskId, scope: d.scope, mode: d.mode });
    if (res && res.ok === false) toast(t('common.error'));
    d.goal = ''; d.taskId = '';
  }

  async function endEarly() {
    const ok = await confirmDialog({ title: t('focus.endConfirmTitle'), body: t('focus.endConfirmBody'), confirm: t('focus.end'), cancel: t('focus.keepGoing'), danger: true });
    if (ok) await send('focus:stop');
  }

  /** A mode is a preset for the whole session: length, scope, strictness (sound and extra allowed sites are applied by the worker). */
  function applyMode(id) {
    const d = st.draft, s = st.settings.focus, m = s.modes.find((x) => x.id === id);
    if (!m) return;
    d.mode = m.id; d.minutes = m.minutes; d.custom = !s.presets.includes(m.minutes); d.strict = !!m.strict; d.scope = m.scope || 'distractions';
    render();
  }

  function renderIdle() {
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
    const modeSelectEl = () => h('select', { class: 'select select-sm mode-select', 'aria-label': t('focus.mode'), onchange: (e) => applyMode(e.target.value) }, modes.map((m) => h('option', { value: m.id, selected: d.mode === m.id, text: modeName(m) + ' · ' + fmtDuration(m.minutes * 60) })));
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
    const strip = goalStrip({ fsSec: st.today?.fs || 0, goalMin: st.settings.focus.dailyGoal, streak: st.streak });

    // in the popup a pending review takes the place of the whole start form: one decision at a time, and it fits
    if (!large && st.review) {
      clear(root, h('div', { class: 'focus-idle review-only' }, reviewCard(st.review, { onDone: refresh }), h('button', { class: 'btn btn-primary btn-lg btn-block', type: 'button', onclick: start }, icon('play'), h('span', { text: startLabel() }))));
      return;
    }
    clear(root, h('div', { class: 'focus-idle' + (large ? ' large' : '') },
      st.review ? reviewCard(st.review, { onDone: refresh }) : null,
      strip,
      goal, taskRow, resumeLine, modeRow,
      large
        ? h('div', { class: 'focus-row' }, h('div', { class: 'durations' }, chips, custom), btn)
        : [h('div', { class: 'durations' }, chips, custom), btn],
      suggestLine, strict, noEffort));
  }

  /** While focusing: park stray thoughts (so they stop pulling), see what was held back, pick a sound. */
  function runningExtras() {
    const held = st.today?.fa || 0;
    const park = h('input', { class: 'input input-sm', placeholder: t('focus.park'), 'aria-label': t('focus.park'), maxlength: 300, onkeydown: async (e) => {
      if (e.key !== 'Enter' || !e.target.value.trim()) return;
      const notes = await getCollection('captures', []);
      notes.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), text: e.target.value.trim(), at: Date.now() });
      await setCollection('captures', notes);
      e.target.value = ''; toast(t('focus.parked'));
    } });
    const cur = st.settings.focus.ambient || 'off';
    const sounds = h('div', { class: 'segmented segmented-sm', role: 'group', 'aria-label': t('focus.ambient') }, ['off', 'brown', 'rain', 'cafe'].map((k) => h('button', { type: 'button', 'aria-pressed': String(cur === k), text: t('ambient.' + k), onclick: () => send('ambient:set', { kind: k }) })));
    return h('div', { class: 'run-extras' }, large ? park : null, sounds, held ? h('div', { class: 'held', 'data-tip': t('focus.heldTip') }, icon('shield-check'), t('focus.held', { n: held })) : null);
  }

  /** Breaks work best away from the screen and with movement — offer something concrete instead of a bare countdown. */
  function restIdeas() {
    const ideas = ['rest.i1', 'rest.i2', 'rest.i3', 'rest.i4', 'rest.i5', 'rest.i6'];
    const pick = ideas[Math.floor(st.rest.startedAt / 60000) % ideas.length];
    return h('div', { class: 'rest-idea' }, icon('sparkles'), h('span', { text: t(pick) }));
  }

  function renderRunning(restMode = false) {
    const f = restMode ? st.rest : st.focus;
    const size = large ? 220 : 104, sw = large ? 8 : 7, R = size / 2 - sw, C = 2 * Math.PI * R, mid = size / 2;
    const time = h('div', { class: 'time num' });
    const ends = t('focus.endsAt', { time: fmtTime(new Date(f.endsAt), st.settings.newtab.clock24 ?? undefined) });
    const track = svg('circle', { cx: mid, cy: mid, r: R, fill: 'none', 'stroke-width': sw, class: 'track' });
    const bar = svg('circle', { cx: mid, cy: mid, r: R, fill: 'none', 'stroke-width': sw, 'stroke-linecap': 'round', class: 'bar', 'stroke-dasharray': C });
    const ring = svg('svg', { viewBox: `0 0 ${size} ${size}` }, track, bar);
    const label = restMode ? t(f.long ? 'rest.long' : 'rest.title') : t('focus.running');
    const actions = restMode
      ? [h('button', { class: 'btn btn-sm', type: 'button', onclick: () => send('rest:skip') }, t('rest.skip')),
         h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: async () => { await send('rest:skip'); await start(); } }, icon('play'), startLabel())]
      : f.strict
        ? h('span', { class: 'locked' }, icon('lock'), t('focus.strictLocked'))
        : [h('button', { class: 'btn btn-sm', type: 'button', 'data-tip': t('focus.extendTip', { n: 5 }), onclick: () => send('focus:extend', { minutes: 5 }) }, icon('plus'), t('focus.extend', { n: 5 })),
           h('button', { class: 'btn btn-sm', type: 'button', onclick: endEarly }, t('focus.end'))];
    const extras = restMode ? restIdeas() : runningExtras();
    const ringEl = h('div', { class: 'ring', role: 'timer', 'aria-label': label, style: { width: size + 'px', height: size + 'px' } }, ring, h('div', { class: 'center' }, time, large ? h('div', { class: 'sub', text: ends }) : null));
    const badge = h('span', { class: 'badge ' + (restMode ? 'badge-success' : 'badge-accent') + ' badge-dot', text: label });
    const goalEl = restMode ? (large ? h('div', { class: 'goal-line', text: t('rest.hint') }) : null) : (f.goal ? h('div', { class: 'goal-line', text: f.goal }) : null);
    clear(root, large
      ? h('div', { class: 'focus-run large' + (restMode ? ' rest' : '') }, badge, ringEl, goalEl, h('div', { class: 'run-actions' }, actions), extras)
      // popup: ring and details side by side — a running session must leave room for the rest of the popup
      : h('div', { class: 'focus-run compact' + (restMode ? ' rest' : '') },
          h('div', { class: 'run-top' }, ringEl, h('div', { class: 'run-info' }, badge, goalEl, h('div', { class: 'muted run-ends', text: ends }), h('div', { class: 'run-actions' }, actions))),
          extras));
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
