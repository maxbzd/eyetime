// Home · Today: one quiet line under the clock. "What is your main focus right now?" — type, press Enter, the session starts.
// The length sits beside it as a small pill (a click steps through your lengths). While a session runs the clock becomes the
// countdown (#countdown) and this line becomes what you are working on, with three small controls that show on hover.
// Same storage and messages as ui/focus-card.js (the popup keeps that one).

import { h, icon, clear, toast, confirmDialog } from '../../ui/dom.js';
import { send } from '../../ui/api.js';
import { t, fmtDuration, fmtTime } from '../../shared/i18n.js';
import { getSettings, getRaw, getCollection, onChange } from '../../shared/storage.js';
import { reviewCard } from '../../ui/day-loop.js';
import { isFocusLive } from '../../shared/blocking.js';
import { remainingMs, progress, isRestActive, isPaused } from '../../shared/focus.js';

/** @param {HTMLElement} root the line  @param {HTMLElement} countdown the hero's countdown slot */
export function mountFocusLine(root, countdown) {
  const st = { settings: null, focus: null, rest: null, review: null, tasks: [], goal: '', taskId: '', minutes: null };
  let tickId = 0, starting = false;

  async function load() {
    st.settings = await getSettings();
    const { focus, rest, review } = await getRaw(['focus', 'rest', 'review']);
    st.review = review || null;
    st.tasks = (await getCollection('tasks', [])).filter((x) => !x.done);
    st.focus = isFocusLive(focus) ? focus : null;
    st.rest = !st.focus && isRestActive(rest) ? rest : null;
    if (st.minutes === null) st.minutes = st.settings.focus.minutes;
  }

  async function start() {
    if (starting) return;
    starting = true;
    try {
      const f = st.settings.focus;
      const res = await send('focus:start', { minutes: st.minutes, goal: st.goal, strict: f.strict, taskId: st.taskId, scope: f.scope, mode: f.mode });
      if (res && res.ok === false) toast(t(res.error === 'active' ? 'focus.alreadyRunning' : 'common.error'));
      st.goal = ''; st.taskId = '';
    } finally { starting = false; }
  }
  async function endEarly() {
    const ok = await confirmDialog({ title: t('focus.endConfirmTitle'), body: t('focus.endConfirmBody'), confirm: t('focus.end'), cancel: t('focus.keepGoing'), danger: true });
    if (ok) await send('focus:stop');
  }

  function renderIdle() {
    const lengths = [...new Set([...(st.settings.focus.presets || [15, 25, 50, 90]), st.minutes])].sort((a, b) => a - b);
    const len = h('button', { class: 'fl-len num', type: 'button', 'data-tip': t('focus.custom'), 'aria-label': t('td.length') + ': ' + fmtDuration(st.minutes * 60),
      onclick: () => { st.minutes = lengths[(lengths.indexOf(st.minutes) + 1) % lengths.length]; len.textContent = fmtDuration(st.minutes * 60); len.setAttribute('aria-label', t('td.length') + ': ' + len.textContent); } }, fmtDuration(st.minutes * 60));
    const go = h('button', { class: 'fl-go', type: 'button', 'aria-label': t('focus.start', { time: fmtDuration(st.minutes * 60) }), onclick: start }, icon('arrow-right'));
    const input = h('input', { class: 'fl-input', id: 'goalToday', maxlength: 140, value: st.goal, autocomplete: 'off', spellcheck: 'false', placeholder: t('td.ask'), 'aria-label': t('focus.goalPlaceholderLarge'),
      oninput: (e) => { st.goal = e.target.value; if (st.taskId && st.tasks.find((x) => x.id === st.taskId)?.text !== st.goal) st.taskId = ''; },
      onkeydown: (e) => { if (e.key === 'Enter') start(); } });
    // today's priorities, offered while the line is empty: one click and it is the goal
    const picks = [...st.tasks.filter((x) => x.starred), ...st.tasks.filter((x) => !x.starred)].slice(0, 2);
    const hints = picks.length ? h('div', { class: 'fl-hints' }, picks.map((x) => h('button', { type: 'button', class: 'fl-hint', title: x.text, onmousedown: (e) => e.preventDefault(), onclick: () => {
      st.goal = x.text; st.taskId = x.id; if (x.est) st.minutes = Math.min(720, Math.max(1, x.est)); render(); root.querySelector('#goalToday')?.focus();
    } }, x.starred ? icon('star') : null, h('span', { class: 'truncate', text: x.text })))) : null;
    clear(root,
      st.review ? h('div', { class: 'fl-review' }, reviewCard(st.review, { onDone: refresh })) : null,
      h('div', { class: 'fl-row' }, input, len, go),
      hints);
    countdown.hidden = true;
    document.body.classList.remove('td-run', 'td-rest', 'td-paused');
  }

  function renderRunning(restMode = false) {
    const f = restMode ? st.rest : st.focus, paused = !restMode && isPaused(f);
    document.body.classList.toggle('td-run', !restMode); document.body.classList.toggle('td-rest', restMode); document.body.classList.toggle('td-paused', paused);
    const time = h('span', { class: 'cd-time num' }), bar = h('i');
    clear(countdown, time, h('div', { class: 'cd-bar', role: 'progressbar', 'aria-label': t(restMode ? 'rest.title' : 'focus.running') }, bar));
    countdown.hidden = false;
    const label = restMode ? t(f.long ? 'rest.long' : 'rest.title') : paused ? t('focus.paused') : t('focus.running');
    const ends = paused ? '' : t('focus.endsAt', { time: fmtTime(new Date(f.endsAt), st.settings.newtab.clock24 ?? undefined) });
    const pill = (ico, text, fn, tip) => h('button', { class: 'fl-pill', type: 'button', 'data-tip': tip, onclick: fn }, ico ? icon(ico) : null, text);
    const acts = restMode
      ? [pill('', t('rest.skip'), () => send('rest:skip')), pill('play', fmtDuration(st.settings.focus.minutes * 60), async () => { await send('rest:skip'); st.minutes = st.settings.focus.minutes; await start(); })]
      : f.strict ? [h('span', { class: 'fl-note' }, icon('lock'), t('focus.strictLocked'))]
      : paused ? [pill('play', t('focus.resume'), () => send('focus:resume')), pill('', t('focus.end'), endEarly)]
      : [pill('pause', t('focus.pause'), () => send('focus:pause'), t('focus.pauseTip')),
         pill('plus', t('focus.extend', { n: 5 }), async () => { const r = await send('focus:extend', { minutes: 5 }); if (r && r.ok === false) toast(t(r.error === 'max' ? 'focus.maxLength' : 'common.error')); }, t('focus.extendTip', { n: 5 })),
         pill('', t('focus.end'), endEarly)];
    clear(root, h('div', { class: 'fl-now' },
      h('div', { class: 'fl-label' }, h('span', { class: 'fl-dot' }), label, ends ? h('span', { class: 'fl-ends', text: '· ' + ends }) : null),
      h('div', { class: 'fl-goal', text: restMode ? t('rest.hint') : f.goal || t('focus.running') }),
      h('div', { class: 'fl-acts' }, acts)));
    const paint = () => {
      const rem = remainingMs(f);
      if (rem <= 0) { clearInterval(tickId); refresh(); return; }
      const sec = Math.ceil(rem / 1000), hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = sec % 60;
      time.textContent = hh ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
      bar.style.width = (progress(f) * 100).toFixed(2) + '%';
    };
    paint(); tickId = window.setInterval(paint, 1000);
  }

  function render() {
    clearInterval(tickId);
    st.focus ? renderRunning() : st.rest ? renderRunning(true) : renderIdle();
  }
  async function refresh() { await load(); render(); }

  refresh();
  const off = onChange(['focus', 'rest', 'settings', 'review', 'tasks'], async () => {
    const state = () => !!st.focus + ':' + !!st.rest + ':' + isPaused(st.focus) + ':' + !!st.review;
    const was = state();
    await load();
    if (was !== state() || (!st.focus && !st.rest && !root.contains(document.activeElement))) render();
  });
  return { refresh, destroy() { off(); clearInterval(tickId); clear(root); clear(countdown); countdown.hidden = true; document.body.classList.remove('td-run', 'td-rest', 'td-paused'); } };
}
