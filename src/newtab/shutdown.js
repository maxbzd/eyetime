// "Close the day": a two-minute evening ritual. Research behind it: unfinished work keeps intruding until you make a concrete plan for it
// (Masicampo & Baumeister 2011), "ready to resume" notes cut attention residue (Leroy & Glomb), and ending the day on a small win plus a
// next-day plan is the strongest daily habit in Amabile & Kramer's diary study. Everything it writes stays on this device.
//
// One form, two places: a dialog (the shortcut, the command palette, the classic arrangements of Home) and the card of the evening on Today (today/ritual.js).

import { h, icon, toast } from '../ui/dom.js';
import { t, fmtDuration } from '../shared/i18n.js';
import { getDays, getCollection, setCollection, updateDay } from '../shared/storage.js';
import { dayKey, addDays } from '../shared/time.js';
import { planDay, MAX_PRIORITIES } from '../shared/productivity.js';
import { closing, tomorrowPicks } from '../shared/ritual.js';
import { track } from '../shared/usage-store.js';

/** Everything the form needs, read once. */
export async function loadClosing() {
  const today = dayKey(), tomorrow = dayKey(addDays(new Date(), 1));
  const [[, day]] = await getDays([today]);
  const tasks = await getCollection('tasks', []);
  const open = tasks.filter((x) => !x.done);
  return { today, tomorrow, day, tasks, open, sum: closing({ day, tasks, today, dayKeyOf: (ms) => dayKey(new Date(ms)) }), wip: open.filter((x) => x.starred || x.focusSec > 0).slice(0, 4) };
}

/**
 * The form: the numbers of the day, one win, "ready to resume" notes, tomorrow's three.
 * @returns {{ el: HTMLElement, focus: () => void, collect: () => { win: string, resume: Map<string, string>, picks: string[] } }}
 */
export function closingForm(/** @type {Awaited<ReturnType<typeof loadClosing>>} */ data) {
  const { day, open, wip, sum, tomorrow, tasks } = data;
  const win = h('input', { class: 'input', maxlength: 200, value: day?.w || '', placeholder: t('shutdown.winPh'), 'aria-label': t('shutdown.win') });
  const resume = new Map();
  const picks = new Set(tomorrowPicks(tasks, tomorrow).map((x) => x.id));
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
  const el = h('div', { class: 'stack gap-4 sd-form' },
    h('div', {}, h('h3', { text: t('shutdown.title') }), h('p', { class: 'muted-2', text: t('shutdown.sub') })),
    h('div', { class: 'sd-stats' },
      stat('target', sum.minutes ? fmtDuration(sum.minutes * 60) : '0m', t('shutdown.focus', { n: sum.sessions })),
      stat('circle-check', String(sum.done), t('shutdown.tasksDone')),
      stat('shield-check', String(sum.held), t('shutdown.held'))),
    h('label', { class: 'stack gap-2' }, h('b', { text: t('shutdown.win') }), win),
    wip.length ? h('div', { class: 'stack gap-2' }, h('b', { text: t('shutdown.resume') }), h('p', { class: 'muted-2', text: t('shutdown.resumeSub') }),
      wip.map((x) => h('label', { class: 'stack gap-1' }, h('span', { class: 'sd-task', text: x.text }),
        h('input', { class: 'input input-sm', maxlength: 140, value: x.resume || '', placeholder: t('review.resumePh'), 'aria-label': x.text + ': ' + t('review.resume'), oninput: (e) => resume.set(x.id, e.target.value) })))) : null,
    open.length ? h('div', { class: 'stack gap-2' }, h('b', { text: t('shutdown.plan', { n: MAX_PRIORITIES }) }), pickBox, err) : h('p', { class: 'muted-2', text: t('shutdown.noTasks') }));
  return { el, focus: () => win.focus(), collect: () => ({ win: win.value, resume, picks: [...picks] }) };
}

/** Write the closing of the day: the win, the notes, tomorrow's three, and the mark that the day is closed. */
export async function commitClosing(/** @type {Awaited<ReturnType<typeof loadClosing>>} */ data, /** @type {ReturnType<ReturnType<typeof closingForm>['collect']>} */ got, now = Date.now()) {
  track('shutdown_done');
  const text = got.win.trim().slice(0, 200);
  await updateDay(data.today, (d) => { if (text) d.w = text; else delete d.w; d.rt = { ...(d.rt || {}), c: now, next: got.picks.slice(0, MAX_PRIORITIES) }; });
  const fresh = await getCollection('tasks', []);
  for (const x of fresh) if (got.resume.has(x.id)) { const v = (got.resume.get(x.id) || '').trim().slice(0, 140); if (v) x.resume = v; else delete x.resume; }
  await setCollection('tasks', planDay(fresh, got.picks, data.tomorrow));
}

/** The same form in a dialog. */
export async function openShutdown() {
  const data = await loadClosing();
  const form = closingForm(data);
  const dlg = h('dialog', { class: 'dialog dialog-wide' },
    h('div', { class: 'dialog-body' }, form.el),
    h('div', { class: 'dialog-actions' },
      h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => dlg.close(), text: t('common.cancel') }),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => { await commitClosing(data, form.collect()); dlg.close(); toast(t('shutdown.done')); } }, icon('moon'), t('shutdown.close'))));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg); dlg.showModal(); form.focus();
}
