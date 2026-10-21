// "Plan my day" dialog: proposes focus blocks for the open priorities; one confirmation schedules a reminder for each.

import { h, icon, toast } from '../ui/dom.js';
import { t, fmtDuration } from '../shared/i18n.js';
import { getSettings, getCollection, setCollection, getDays } from '../shared/storage.js';
import { planDay, toMin } from '../shared/dayplan.js';
import { bestHours } from '../shared/productivity.js';
import { estimateAccuracy } from '../shared/quickadd.js';
import { accuracyInput } from '../shared/tasks.js';
import { dayKey, rangeKeys } from '../shared/time.js';

export async function openDayPlan() {
  const [settings, tasks, estLog, days, events] = await Promise.all([getSettings(), getCollection('tasks', []), getCollection('estLog', []), getDays(rangeKeys(112)), getCollection('calendar', [])]);
  const today = dayKey();
  const now = new Date();
  const open = tasks.filter((x) => !x.done);
  const best = bestHours(days);
  const acc = estimateAccuracy(accuracyInput(tasks, estLog));
  const busy = events.filter((e) => e.day === today).map((e) => ({ start: toMin(e.start), end: toMin(e.end) }));
  const plan = planDay({ tasks: open, nowMin: now.getHours() * 60 + now.getMinutes(), bestStart: best ? best.start : null, calibration: acc ? acc.median : null, busy, defaultMinutes: settings.focus.minutes, goalMinutes: settings.focus.dailyGoal, workEnd: (settings.blocking.schedule && settings.blocking.schedule.enabled && settings.blocking.schedule.end) || '18:00', today });

  const rows = plan.blocks.map((b) => {
    const on = h('input', { type: 'checkbox', checked: true, 'aria-label': b.text, disabled: b.fixed });
    const time = h('input', { class: 'input input-sm', type: 'time', value: b.start, 'aria-label': t('plan.start') + ': ' + b.text, disabled: b.fixed });
    return { b, on, time, el: h('div', { class: 'plan-block' + (b.fixed ? ' fixed' : '') }, h('label', { class: 'check' }, on, h('span', { class: 'box' }, icon('check'))), h('div', { class: 'plan-text' }, h('b', { class: 'truncate', text: b.text }), h('span', { class: 'muted', text: fmtDuration(b.minutes * 60) + (b.fixed ? ' · ' + t('plan.fixed') : '') })), time) };
  });
  const flex = rows.some((r) => !r.b.fixed);
  const notes = flex ? [best ? t('plan.bestNote', { time: `${String(best.start).padStart(2, '0')}:00` }) : null, plan.calibrated ? t('plan.calibNote', { x: (Math.round(acc.median * 10) / 10).toString() }) : null, busy.length ? t('plan.calNote') : null].filter(Boolean) : [];

  const dlg = h('dialog', { class: 'dialog dialog-wide' }, h('form', { method: 'dialog' },
    h('div', { class: 'dialog-body stack gap-3' }, h('h3', { text: t('plan.title') }), h('p', { class: 'muted-2', text: flex ? t('plan.lead') : rows.length ? t('plan.booked') : (open.length ? t('plan.late') : t('plan.none')) }),
      rows.length ? h('div', { class: 'plan-list' }, rows.map((r) => r.el)) : null,
      notes.length ? h('ul', { class: 'plan-notes' }, notes.map((n) => h('li', { text: n }))) : null),
    h('div', { class: 'dialog-actions' },
      h('button', { class: 'btn btn-ghost', value: 'no', text: t('common.cancel') }),
      rows.some((r) => !r.b.fixed) ? h('button', { class: 'btn btn-primary', value: 'yes', text: t('plan.schedule'), autofocus: true }) : null)));
  dlg.addEventListener('close', async () => {
    if (dlg.returnValue === 'yes') {
      const fresh = await getCollection('tasks', []);
      let n = 0;
      for (const r of rows) {
        if (r.b.fixed || !r.on.checked || !r.time.value) continue;
        const x = fresh.find((y) => y.id === r.b.taskId); if (!x) continue;
        x.at = r.time.value; x.atDay = today; if (!x.est) x.est = r.b.minutes; n++;
      }
      if (n) { await setCollection('tasks', fresh); toast(t('plan.done', { n })); }
    }
    dlg.remove();
  });
  document.body.append(dlg); dlg.showModal();
}
