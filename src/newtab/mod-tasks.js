// Home module: tasks — quick add (dates, times, lengths, tags, repeats), priorities, the week strip and "Plan my day".

import { h, icon, toast, clear } from '../ui/dom.js';
import { t, fmtDuration, fmtDate, weekdayName } from '../shared/i18n.js';
import { send } from '../ui/api.js';
import { getSettings } from '../shared/storage.js';
import { MAX_PRIORITIES } from '../shared/productivity.js';
import { openShutdown } from './shutdown.js';
import { getCollection, setCollection, onChange } from '../shared/storage.js';
import { dayKey, addDays, parseKey } from '../shared/time.js';
import { taskFromInput, updateEstLog } from '../shared/tasks.js';
import { openDayPlan } from './dayplan.js';
import { mondayKey, itemsFor, addItem, toggleItem, removeItem, weekProgress, MAX_WEEK_ITEMS } from '../shared/week.js';
import { parseQuickAdd } from '../shared/quickadd.js';
import { card, emptyMini } from './mod-common.js';

/* ---------- tasks ---------- */
export function tasksModule() {
  const root = card('tasks', icon('list-checks'), t('mod.tasks'));
  const body = h('div', { class: 'stack gap-3' });
  const head = root.querySelector('.mod-head');
  root.append(body);
  let tasks = [], showAll = false, weekPlan = null, weekEditing = false;
  const saveWeek = (p) => { if (weekPlan && weekPlan.week && p.week !== weekPlan.week) setCollection('weekPlanPrev', weekPlan); weekPlan = p; setCollection('weekPlan', p); }; // the finished week is kept one more week for the Monday digest and the share card

  const save = () => setCollection('tasks', tasks);
  const LIMIT = 6;

  /** "Today" / "Tomorrow" / "Friday" / "Oct 30" / "Overdue" for a due day. */
  const dueLabel = (key) => {
    const today = dayKey(); if (key === today) return t('tasks.dueToday');
    if (key < today) return t('tasks.overdue');
    if (key === dayKey(addDays(new Date(), 1))) return t('tasks.dueTomorrow');
    const d = parseKey(key), days = Math.round((d.getTime() - parseKey(today).getTime()) / 86_400_000);
    return days < 7 ? weekdayName(d.getDay(), 'long') : fmtDate(d, { day: 'numeric', month: 'short' });
  };

  function render() {
    const open = tasks.filter((x) => !x.done), done = tasks.filter((x) => x.done);
    // priorities first (the day's top three), then the rest, then done
    const ordered = [...open.filter((x) => x.starred), ...open.filter((x) => !x.starred), ...done];
    const visible = showAll ? ordered : ordered.slice(0, LIMIT);
    const prio = open.filter((x) => x.starred).length;
    head.querySelector('.count')?.remove();
    head.querySelector('.plan-btn')?.remove();
    if (open.length) head.append(h('button', { class: 'btn btn-ghost btn-sm plan-btn', type: 'button', onclick: openDayPlan }, icon('calendar-clock'), t('plan.title')));
    if (tasks.length) head.append(h('span', { class: 'count num', text: `${done.length}/${tasks.length}` }));

    // what EyeTime understood from the line, shown while typing: time · length · priority · tags
    const preview = h('div', { class: 'qa-preview', 'aria-live': 'polite' });
    const drawPreview = (value) => {
      const p = parseQuickAdd(value);
      const chips = [p.due ? [{ icon: 'calendar-days' }, dueLabel(p.due)] : null, p.at ? [{ icon: 'alarm-clock' }, t('tasks.qaAt', { time: p.at })] : null, p.est ? [{ icon: 'timer' }, t('tasks.qaEst', { time: fmtDuration(p.est * 60) })] : null, p.priority ? [{ icon: 'star' }, t('tasks.qaPri')] : null, p.repeat ? [{ icon: 'repeat' }, t('tasks.rep.' + p.repeat)] : null, ...p.tags.map((g) => [{ icon: 'tag' }, '#' + g])].filter(Boolean);
      clear(preview, chips.length ? chips.map(([ico, text]) => h('span', { class: 'tagm' }, icon(ico.icon), text)) : (value.trim() ? null : h('span', { class: 'hint', text: t('tasks.qaHint') })));
    };
    const input = h('input', { class: 'input', placeholder: t('tasks.add'), 'aria-label': t('tasks.add'), maxlength: 300, oninput: (e) => drawPreview(e.target.value), onkeydown: (e) => {
      if (e.key !== 'Enter' || !e.target.value.trim()) return;
      const { task, prioDenied } = taskFromInput(e.target.value, tasks);
      tasks.unshift(task); save(); render();
      if (prioDenied) toast(t('tasks.maxPriorities', { n: MAX_PRIORITIES }));
      document.querySelector('#mod-tasks input')?.focus();
    } });
    input.addEventListener('focus', () => { if (!input.value) drawPreview(''); });
    input.addEventListener('blur', () => { if (!input.value) clear(preview); });

    const toggleStar = (x) => {
      if (!x.starred && tasks.filter((y) => y.starred && !y.done).length >= MAX_PRIORITIES) { toast(t('tasks.maxPriorities', { n: MAX_PRIORITIES })); return; }
      x.starred = !x.starred; save(); render();
    };
    /** "When" is half of an if-then plan: a task with a time gets a notification that starts the session. */
    const askTime = (x) => {
      const input = h('input', { class: 'input', type: 'time', value: x.atDay === dayKey() ? x.at || '' : '', 'aria-label': t('tasks.schedule') });
      const dlg = h('dialog', { class: 'dialog' }, h('form', { method: 'dialog' },
        h('div', { class: 'dialog-body stack gap-3' }, h('h3', { text: t('tasks.scheduleTitle') }), h('p', { class: 'muted-2', text: x.text }), input, h('p', { class: 'hint', text: t('tasks.scheduleHint') })),
        h('div', { class: 'dialog-actions' },
          x.at ? h('button', { class: 'btn btn-ghost', value: 'clear', text: t('tasks.unschedule') }) : h('button', { class: 'btn btn-ghost', value: 'no', text: t('common.cancel') }),
          h('button', { class: 'btn btn-primary', value: 'yes', text: t('common.save'), autofocus: true }))));
      dlg.addEventListener('close', () => {
        if (dlg.returnValue === 'yes' && input.value) {
          const [hh, mm] = input.value.split(':').map(Number), now = new Date();
          const when = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);
          x.at = input.value; x.atDay = dayKey(when <= now ? addDays(now, 1) : now); save(); render();
        } else if (dlg.returnValue === 'clear') { delete x.at; delete x.atDay; save(); render(); }
        dlg.remove();
      });
      document.body.append(dlg); dlg.showModal();
    };
    const startOn = async (x) => { const s = await getSettings(); const r = await send('focus:start', { minutes: x.est || s.focus.minutes, strict: s.focus.strict, scope: s.focus.scope, taskId: x.id }); if (r && r.ok === false) toast(t(r.error === 'active' ? 'focus.alreadyRunning' : 'common.error')); };

    const priStar = () => { const el = icon('star'); el.classList.add('pri'); return el; };
    const row = (x) => { // (finishing a repeating task logs a separate estimate data point each time)
      const scheduled = x.at && x.atDay === dayKey() && !x.done;
      const meta = [
        scheduled ? h('span', { class: 'tagm at num', 'data-tip': t('tasks.scheduledAt') }, icon('alarm-clock'), x.at) : null,
        !x.done && x.due ? h('span', { class: 'tagm due' + (x.due < dayKey() ? ' late' : ''), 'data-tip': t('tasks.dueTip') }, icon('calendar-days'), dueLabel(x.due)) : null,
        !x.done && x.at && x.atDay && x.atDay > dayKey() ? h('span', { class: 'tagm at num', 'data-tip': t('tasks.scheduledAt') }, icon('alarm-clock'), `${dueLabel(x.atDay)} ${x.at}`) : null,
        x.focusSec >= 60 ? h('span', { class: 'tagm num', 'data-tip': t('tasks.spent') }, icon('timer'), x.est ? t('tasks.estOf', { spent: fmtDuration(x.focusSec), est: fmtDuration(x.est * 60) }) : fmtDuration(x.focusSec)) : (x.est && !x.done ? h('span', { class: 'tagm num', 'data-tip': t('prod.estPlanned') }, icon('timer'), t('tasks.estOnly', { est: fmtDuration(x.est * 60) })) : null),
        x.repeat ? h('span', { class: 'tagm', 'data-tip': t('tasks.repeatTip') }, icon('repeat'), t('tasks.rep.' + x.repeat)) : null,
        ...(x.tags || []).map((g) => h('span', { class: 'tagm tag-hash', text: '#' + g })),
        !x.done && x.resume ? h('span', { class: 'resume', title: x.resume }, icon('corner-down-right'), h('span', { text: x.resume })) : null,
      ].filter(Boolean);
      return h('div', { class: 'item' + (x.done ? ' done' : '') + (x.starred && !x.done ? ' prio' : '') },
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: x.done, 'aria-label': x.text, onchange: (e) => { x.done = e.target.checked; x.doneAt = x.done ? Date.now() : 0; if (x.done) x.starred = false; save(); render(); getCollection('estLog', []).then((log) => setCollection('estLog', updateEstLog(log, x))); if (x.done && x.est && x.focusSec >= 300) toast(t('tasks.tookVs', { actual: fmtDuration(x.focusSec), est: fmtDuration(x.est * 60) })); } }), h('span', { class: 'box' }, icon('check'))),
        h('div', { class: 'item-main' },
          h('div', { class: 'item-title' }, x.starred && !x.done ? priStar() : null, x.text),
          meta.length ? h('div', { class: 'item-meta' }, meta) : null),
        h('div', { class: 'item-acts' },
          x.done ? null : h('button', { class: 'star' + (x.starred ? ' on' : ''), type: 'button', 'aria-pressed': String(!!x.starred), 'aria-label': t('tasks.priority') + ': ' + x.text, 'data-tip': t('tasks.priority'), onclick: () => toggleStar(x) }, icon('star')),
          x.done ? null : h('button', { type: 'button', 'aria-label': t('tasks.schedule') + ': ' + x.text, 'data-tip': t('tasks.schedule'), onclick: () => askTime(x) }, icon('alarm-clock')),
          x.done ? null : h('button', { type: 'button', 'aria-label': t('tasks.focusOn') + ': ' + x.text, 'data-tip': t('tasks.focusOn'), onclick: () => startOn(x) }, icon('play')),
          h('button', { type: 'button', 'aria-label': t('common.remove'), onclick: () => { const i = tasks.findIndex((y) => y.id === x.id); if (i < 0) { render(); return; } x = tasks[i]; tasks.splice(i, 1); save(); render(); toast(t('tasks.removed'), { action: t('common.undo'), onAction: () => { tasks.splice(i, 0, x); save(); render(); } }); } }, icon('x'))));
    };

    // this week's outcomes: up to three results, tap to tick off; the week resets itself on Monday
    const wk = mondayKey(), wItems = itemsFor(weekPlan, wk), wp = weekProgress(weekPlan, wk);
    const weekAdd = () => {
      const inp = h('input', { class: 'input input-sm', maxlength: 80, placeholder: t('week.ph'), 'aria-label': t('week.ph'), onkeydown: (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) { saveWeek(addItem(weekPlan, wk, e.target.value)); weekEditing = itemsFor(weekPlan, wk).length < MAX_WEEK_ITEMS; render(); if (weekEditing) document.querySelector('#mod-tasks .week-add input')?.focus(); }
        else if (e.key === 'Escape') { weekEditing = false; render(); }
      } });
      return h('div', { class: 'week-add' }, inp, h('button', { class: 'btn btn-sm', type: 'button', onclick: () => { if (inp.value.trim()) { saveWeek(addItem(weekPlan, wk, inp.value)); } weekEditing = false; render(); } }, t('week.add')));
    };
    const week = h('div', { class: 'week' },
      h('div', { class: 'week-head' }, h('span', { class: 'eyebrow', text: t('week.title') }), wItems.length ? h('span', { class: 'week-count num', text: `${wp.done}/${wp.total}` }) : null,
        !weekEditing && wItems.length < MAX_WEEK_ITEMS ? h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': t('week.set'), 'data-tip': t('week.set'), onclick: () => { weekEditing = true; render(); document.querySelector('#mod-tasks .week-add input')?.focus(); } }, icon('plus')) : null),
      wItems.length ? h('div', { class: 'week-items' }, wItems.map((x) => h('span', { class: 'week-item' + (x.done ? ' done' : '') },
        h('button', { class: 'week-tick', type: 'button', 'aria-pressed': String(x.done), onclick: () => { saveWeek(toggleItem(weekPlan, wk, x.id)); render(); } }, icon(x.done ? 'circle-check' : 'circle'), h('span', { class: 'truncate', text: x.text })),
        h('button', { class: 'week-x', type: 'button', 'aria-label': t('week.remove') + ': ' + x.text, onclick: () => { saveWeek(removeItem(weekPlan, wk, x.id)); render(); } }, icon('x'))))) : (weekEditing ? null : h('button', { class: 'more-link', type: 'button', onclick: () => { weekEditing = true; render(); document.querySelector('#mod-tasks .week-add input')?.focus(); } }, t('week.prompt'))),
      weekEditing ? weekAdd() : null,
      wItems.length && wp.done === wp.total ? h('div', { class: 'hint', text: t('week.allDone') }) : null);

    clear(body, week, input, preview,
      prio ? h('div', { class: 'eyebrow', text: t('tasks.priorities', { n: prio, max: MAX_PRIORITIES }) }) : null,
      visible.length ? h('div', { class: 'items' }, visible.map(row)) : emptyMini({ ico: 'list-checks', title: t('tasks.emptyTitle'), body: t('tasks.empty') }),
      ordered.length > LIMIT ? h('button', { class: 'more-link', type: 'button', onclick: () => { showAll = !showAll; render(); } }, showAll ? t('mod.showLess') : t('mod.showAll', { n: ordered.length })) : null,
      done.some((x) => !x.repeat) ? h('button', { class: 'more-link', type: 'button', onclick: () => { tasks = tasks.filter((x) => !x.done || x.repeat); save(); render(); } }, t('tasks.clearDone')) : null,
      open.length ? h('button', { class: 'more-link plan-link', type: 'button', onclick: openShutdown }, icon('moon'), t('tasks.planTomorrow')) : null);
  }

  Promise.all([getCollection('tasks', []), getCollection('weekPlan', null)]).then(([v, w]) => { tasks = v; weekPlan = w; render(); });
  onChange('weekPlan', async () => { const w = await getCollection('weekPlan', null); if (JSON.stringify(w) !== JSON.stringify(weekPlan)) { weekPlan = w; if (!root.contains(document.activeElement)) render(); } });
  onChange('tasks', async () => { const v = await getCollection('tasks', []); if (JSON.stringify(v) === JSON.stringify(tasks)) return; tasks = v; if (!root.contains(document.activeElement) || !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) render(); }); // keep memory fresh even while typing (the redraw waits only while a text field has focus), so a later save never overwrites a task added elsewhere (palette, another tab)
  return root;
}
