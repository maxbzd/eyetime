// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Home · Today: the day as one story, under the line of intent.
//
//   morning  a card: "What matters today?" — your open tasks, up to three chosen, with times that fit your calendar, one button to start the day (or "not today")
//   work     one quiet line: how many of today's three are done and what is next; a small moon to close the day early
//   evening  a card: the numbers of the day, one win, notes to resume, tomorrow's three — the same form as the "Close the day" dialog
//   closed   one quiet line: the day is closed; what it held; tomorrow's three; a way to reopen
//
// The rules (which part of the day it is) are in shared/ritual.js; this file draws and writes.

import { h, svg, icon, clear, toast } from '../../ui/dom.js';
import { t, fmtDuration } from '../../shared/i18n.js';
import { getSettings, getCollection, setCollection, getDays, getRaw, updateDay, onChange } from '../../shared/storage.js';
import { isFocusLive } from '../../shared/blocking.js';
import { dayKey } from '../../shared/time.js';
import { MAX_PRIORITIES } from '../../shared/productivity.js';
import { taskFromInput } from '../../shared/tasks.js';
import { phase, rtOf, candidates, setPriorities, applyTimes, todaysThree, nextUp, tomorrowPicks } from '../../shared/ritual.js';
import { track } from '../../shared/usage-store.js';
import { loadPlanContext, proposeBlocks } from '../plan-context.js';
import { loadClosing, closingForm, commitClosing, openShutdown } from '../shutdown.js';

const LATER_KEY = 'et-ritual-later';
const LATER_MS = 60 * 60_000;

const ring = (/** @type {number} */ p) => svg('svg', { class: 'rt-ring', viewBox: '0 0 20 20', width: 16, height: 16, 'aria-hidden': 'true' },
  svg('circle', { cx: 10, cy: 10, r: 8, fill: 'none', 'stroke-width': 2.4, class: 'rt-track' }),
  svg('circle', { cx: 10, cy: 10, r: 8, fill: 'none', 'stroke-width': 2.4, 'stroke-linecap': 'round', class: 'rt-arc', 'stroke-dasharray': `${(50.27 * Math.min(1, p)).toFixed(2)} 50.27`, transform: 'rotate(-90 10 10)' }));

/** @param {HTMLElement} root */
export function mountRitual(root) {
  const st = { running: false, settings: /** @type {any} */ (null), tasks: /** @type {any[]} */ ([]), day: /** @type {any} */ (null), today: dayKey() };
  let sel = /** @type {string[]} */ ([]), picked = false, remind = true, ctx = /** @type {any} */ (null), closingData = /** @type {any} */ (null), form = /** @type {any} */ (null), shown = '', dead = false;

  const later = () => { try { const v = localStorage.getItem(LATER_KEY) || ''; const [d, ts] = v.split('|'); return d === dayKey() && Date.now() - Number(ts) < LATER_MS; } catch { return false; } };
  const setLater = () => { try { localStorage.setItem(LATER_KEY, dayKey() + '|' + Date.now()); } catch { /* private mode: it comes back sooner */ } };

  async function load() {
    const today = dayKey();
    if (today !== st.today) { picked = false; sel = []; ctx = null; closingData = null; shown = ''; remind = true; } // a new day starts from the beginning
    st.today = today;
    st.settings = await getSettings();
    st.tasks = await getCollection('tasks', []);
    st.running = isFocusLive((await getRaw('focus')).focus);
    [[, st.day]] = await getDays([st.today]);
  }
  /** A card never interrupts a session that is running, and "in an hour" is respected. */
  const currentPhase = () => { const p = phase({ now: new Date(), day: st.day, settings: st.settings }); return (p === 'evening' && later()) || ((p === 'evening' || p === 'morning') && st.running) ? 'work' : p; };

  /* ---------- morning ---------- */
  async function renderMorning() {
    if (!ctx || ctx.today !== st.today) ctx = await loadPlanContext();
    const list = candidates(st.tasks, st.today);
    if (!picked) { sel = list.filter((c) => c.pre).map((c) => c.task.id); picked = true; }
    sel = sel.filter((id) => st.tasks.some((x) => x.id === id && !x.done));
    const shownTasks = [...list.map((c) => c.task), ...st.tasks.filter((x) => sel.includes(x.id) && !list.some((c) => c.task.id === x.id))];
    const whyOf = new Map(list.map((c) => [c.task.id, c.why]));
    const hint = h('div', { class: 'rt-hint', role: 'status', 'aria-live': 'polite' });
    const open = sel.map((id) => st.tasks.find((x) => x.id === id)).filter(Boolean);
    const plan = open.length ? proposeBlocks(ctx, open) : null;
    const blocks = plan ? plan.blocks.filter((b) => sel.includes(b.taskId)) : [];

    const slot = new Map(blocks.map((b) => [b.taskId, b]));
    const rows = shownTasks.map((x) => {
      const n = sel.indexOf(x.id) + 1, on = n > 0, why = whyOf.get(x.id);
      return h('button', { class: 'rt-row' + (on ? ' on' : ''), type: 'button', role: 'checkbox', 'aria-checked': String(on), onclick: () => {
        if (on) sel = sel.filter((id) => id !== x.id);
        else if (sel.length >= MAX_PRIORITIES) { hint.textContent = t('rt.m.max'); return; }
        else sel = [...sel, x.id];
        paint(true);
      } },
        h('span', { class: 'rt-n num', 'aria-hidden': 'true', text: on ? String(n) : '' }),
        h('span', { class: 'rt-t truncate', text: x.text }),
        why ? h('span', { class: 'rt-why', text: t('rt.why.' + why) }) : null,
        slot.get(x.id) ? h('span', { class: 'rt-slot num', text: slot.get(x.id).start + ' · ' + fmtDuration(slot.get(x.id).minutes * 60) }) : (x.est ? h('span', { class: 'rt-est num', text: fmtDuration(x.est * 60) }) : null));
    });
    const input = h('input', { class: 'rt-add', maxlength: 300, placeholder: t('rt.m.add'), 'aria-label': t('rt.m.add'), onkeydown: async (e) => {
      if (e.key !== 'Enter' || !e.target.value.trim()) return;
      const { task } = taskFromInput(e.target.value, st.tasks);
      task.starred = false;
      const fresh = await getCollection('tasks', []);
      await setCollection('tasks', [task, ...fresh]);
      track('task_add');
      if (sel.length < MAX_PRIORITIES) sel = [...sel, task.id];
      e.target.value = '';
      await refresh(true);
      root.querySelector('.rt-add')?.focus();
    } });
    const flex = blocks.filter((b) => !b.fixed);
    const preview = flex.length ? h('label', { class: 'rt-remind' }, h('input', { type: 'checkbox', checked: remind, onchange: (e) => { remind = e.target.checked; } }), icon('calendar-clock'), h('span', { text: t('rt.m.remind') })) : null;

    clear(root,
      h('div', { class: 'rt-head' }, h('span', { class: 'rt-ico' }, icon('sun')), h('div', {}, h('h2', { class: 'rt-title', text: t('rt.m.title') }), h('p', { class: 'rt-sub', text: shownTasks.length ? t('rt.m.sub') : t('rt.m.none') }))),
      rows.length ? h('div', { class: 'rt-list', role: 'group', 'aria-label': t('rt.m.title') }, rows) : null,
      input, hint, preview,
      h('div', { class: 'rt-actions' },
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: skip }, t('rt.m.skip')),
        h('button', { class: 'btn btn-primary', type: 'button', disabled: !sel.length && shownTasks.length > 0, onclick: () => start(blocks) }, icon('arrow-right'), t('rt.m.start'))));
  }
  async function start(/** @type {any[]} */ blocks) {
    const ids = sel.slice(0, MAX_PRIORITIES);
    let list = setPriorities(await getCollection('tasks', []), ids);
    if (remind && blocks.length) list = applyTimes(list, blocks, st.today);
    await setCollection('tasks', list);
    await updateDay(st.today, (d) => { d.rt = { ...(d.rt || {}), p: Date.now(), top: ids }; });
    track('ritual_plan');
  }
  async function skip() {
    await updateDay(st.today, (d) => { d.rt = { ...(d.rt || {}), s: Date.now() }; });
    track('ritual_skip');
  }

  /* ---------- work ---------- */
  function renderWork() {
    const three = todaysThree(st.tasks, st.day), next = nextUp(st.tasks, st.day), done = three.filter((x) => x.done).length;
    const goalMin = st.settings.focus.dailyGoal, reached = goalMin > 0 && ((st.day && st.day.fs) || 0) >= goalMin * 60;
    if (!three.length && !reached) { clear(root); return false; }
    const line = three.length
      ? (next ? [h('b', { class: 'num', text: `${done}/${three.length}` }), h('span', { class: 'rt-sep', text: '·' }), h('span', { class: 'truncate', text: t('rt.w.next', { task: next.text }) })]
        : [h('b', { class: 'num', text: `${done}/${three.length}` }), h('span', { class: 'rt-sep', text: '·' }), h('span', { text: t('rt.w.allDone') })])
      : [h('span', { text: t('goal.reached') })];
    clear(root, h('div', { class: 'rt-pill', role: 'group', 'aria-label': t('rt.w.label') },
      ring(three.length ? done / three.length : 1), h('div', { class: 'rt-line' }, line),
      h('button', { class: 'rt-icon', type: 'button', 'aria-label': t('rt.w.close'), 'data-tip': t('rt.w.close'), onclick: () => openShutdown() }, icon('moon'))));
    return true;
  }

  /* ---------- evening ---------- */
  async function renderEvening() {
    closingData = await loadClosing();
    form = closingForm(closingData);
    clear(root, h('div', { class: 'rt-body' }, h('div', { class: 'rt-head' }, h('span', { class: 'rt-ico' }, icon('moon')), h('div', { class: 'rt-grow' }, form.el))),
      h('div', { class: 'rt-actions' },
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { setLater(); refresh(true); } }, t('rt.e.later')),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => { await commitClosing(closingData, form.collect()); toast(t('shutdown.done')); } }, icon('moon'), t('shutdown.close'))));
  }

  /* ---------- closed ---------- */
  function renderClosed() {
    const rt = rtOf(st.day), sumMin = Math.round(((st.day && st.day.fs) || 0) / 60);
    const doneN = st.tasks.filter((x) => x.done && x.doneAt && dayKey(new Date(x.doneAt)) === st.today).length;
    const nextTexts = (rt.next || []).map((id) => st.tasks.find((x) => x.id === id && !x.done)).filter(Boolean).map((x) => x.text);
    const tomorrow = nextTexts.length ? nextTexts : tomorrowPicks(st.tasks, dayKey(new Date(Date.now() + 86_400_000))).map((x) => x.text);
    clear(root, h('div', { class: 'rt-pill closed', role: 'group', 'aria-label': t('rt.c.title') },
      icon('moon'), h('div', { class: 'rt-line' },
        h('b', { text: t('rt.c.title') }), h('span', { class: 'rt-sep', text: '·' }), h('span', { class: 'num', text: t('rt.c.line', { time: sumMin ? fmtDuration(sumMin * 60) : '0m', n: doneN }) }),
        tomorrow.length ? [h('span', { class: 'rt-sep', text: '·' }), h('span', { class: 'truncate', text: t('rt.c.tomorrow', { list: tomorrow.slice(0, MAX_PRIORITIES).join(' · ') }) })] : null),
      h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: reopen }, t('rt.c.reopen'))));
  }
  async function reopen() { await updateDay(st.today, (d) => { const rt = { ...(d.rt || {}) }; delete rt.c; d.rt = rt; }); try { localStorage.removeItem(LATER_KEY); } catch { /* ignore */ } }

  /* ---------- the loop ---------- */
  async function paint(force = false) {
    if (dead) return;
    const p = currentPhase();
    const typing = root.contains(document.activeElement) && !force && p === shown;
    if (typing || (!force && p === shown && p === 'evening')) return; // never rebuild a form someone is filling in
    shown = p;
    root.dataset.phase = p;
    document.body.classList.toggle('td-card', p === 'morning' || p === 'evening'); document.body.classList.toggle('td-evening', p === 'evening');
    if (p === 'off') { clear(root); root.hidden = true; return; }
    if (p === 'morning') await renderMorning();
    else if (p === 'evening') await renderEvening();
    else if (p === 'closed') renderClosed();
    else if (!renderWork()) { root.hidden = true; return; }
    root.hidden = false;
  }
  async function refresh(force = false) { await load(); await paint(force); }

  refresh(true);
  const off = onChange(['tasks', 'd:*', 'settings', 'focus'], () => { refresh(); });
  const iv = window.setInterval(() => { refresh(); }, 60_000);
  return { destroy() { dead = true; off(); clearInterval(iv); clear(root); root.hidden = true; document.body.classList.remove('td-card', 'td-evening'); } };
}
