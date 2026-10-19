// "Close the day": a two-minute evening ritual. Research behind it: unfinished work keeps intruding until you make a concrete plan for it
// (Masicampo & Baumeister 2011), "ready to resume" notes cut attention residue (Leroy & Glomb), and ending the day on a small win plus a
// next-day plan is the strongest daily habit in Amabile & Kramer's diary study. Everything it writes stays on this device.

import { h, icon, toast } from '../ui/dom.js';
import { t, fmtDuration } from '../shared/i18n.js';
import { getDays, getCollection, setCollection, updateDay } from '../shared/storage.js';
import { dayKey, addDays } from '../shared/time.js';
import { dayReview, planDay, MAX_PRIORITIES } from '../shared/productivity.js';

export async function openShutdown() {
  const today = dayKey();
  const tomorrow = dayKey(addDays(new Date(), 1));
  const [[, day]] = await getDays([today]);
  const tasks = await getCollection('tasks', []);
  const review = dayReview(day);
  const doneToday = tasks.filter((x) => x.done && x.doneAt && dayKey(new Date(x.doneAt)) === today);
  const open = tasks.filter((x) => !x.done);
  const wip = open.filter((x) => x.starred || x.focusSec > 0).slice(0, 4);

  const win = h('input', { class: 'input', maxlength: 200, value: day?.w || '', placeholder: t('shutdown.winPh'), 'aria-label': t('shutdown.win') });
  const resume = new Map();
  const picks = new Set((open.filter((x) => x.planFor === tomorrow).length ? open.filter((x) => x.planFor === tomorrow) : open.filter((x) => x.starred)).slice(0, MAX_PRIORITIES).map((x) => x.id));
  const pickBox = h('div', { class: 'items' });
  const err = h('div', { class: 'hint', style: { color: 'var(--distracting-text)' } });
  const drawPicks = () => {
    pickBox.replaceChildren(...open.slice(0, 12).map((x) => h('label', { class: 'item' },
      h('span', { class: 'check' }, h('input', { type: 'checkbox', checked: picks.has(x.id), 'aria-label': x.text, onchange: (e) => {
        if (e.target.checked && picks.size >= MAX_PRIORITIES) { e.target.checked = false; err.textContent = t('tasks.maxPriorities', { n: MAX_PRIORITIES }); return; }
        err.textContent = ''; e.target.checked ? picks.add(x.id) : picks.delete(x.id);
      } }), h('span', { class: 'box' }, icon('check'))),
      h('span', { class: 'txt', text: x.text }))));
  };
  drawPicks();

  const stat = (ico, value, label) => h('div', { class: 'sd-stat' }, h('div', { class: 'sd-val num' }, icon(ico), value), h('div', { class: 'muted', text: label }));
  const dlg = h('dialog', { class: 'dialog dialog-wide' },
    h('div', { class: 'dialog-body stack gap-4' },
      h('div', {}, h('h3', { text: t('shutdown.title') }), h('p', { class: 'muted-2', text: t('shutdown.sub') })),
      h('div', { class: 'sd-stats' },
        stat('target', fmtDuration(review.minutes * 60), t('shutdown.focus', { n: review.sessions })),
        stat('circle-check', String(doneToday.length), t('shutdown.tasksDone')),
        stat('shield-check', String(day?.fa || 0), t('shutdown.held'))),
      h('label', { class: 'stack gap-2' }, h('b', { text: t('shutdown.win') }), win),
      wip.length ? h('div', { class: 'stack gap-2' }, h('b', { text: t('shutdown.resume') }), h('p', { class: 'muted-2', text: t('shutdown.resumeSub') }),
        wip.map((x) => h('label', { class: 'stack gap-1' }, h('span', { class: 'sd-task', text: x.text }),
          h('input', { class: 'input input-sm', maxlength: 140, value: x.resume || '', placeholder: t('review.resumePh'), 'aria-label': x.text + ': ' + t('review.resume'), oninput: (e) => resume.set(x.id, e.target.value) })))) : null,
      open.length ? h('div', { class: 'stack gap-2' }, h('b', { text: t('shutdown.plan', { n: MAX_PRIORITIES }) }), pickBox, err) : h('p', { class: 'muted-2', text: t('shutdown.noTasks') })),
    h('div', { class: 'dialog-actions' },
      h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => dlg.close(), text: t('common.cancel') }),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
        const text = win.value.trim().slice(0, 200);
        await updateDay(today, (d) => { if (text) d.w = text; else delete d.w; });
        const fresh = await getCollection('tasks', []);
        for (const x of fresh) if (resume.has(x.id)) { const v = resume.get(x.id).trim().slice(0, 140); if (v) x.resume = v; else delete x.resume; }
        await setCollection('tasks', planDay(fresh, [...picks], tomorrow));
        dlg.close(); toast(t('shutdown.done'));
      } }, icon('moon'), t('shutdown.close'))));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg); dlg.showModal(); win.focus();
}
