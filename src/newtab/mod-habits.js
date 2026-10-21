// Home module: habits with streaks.

import { h, icon, toast, clear } from '../ui/dom.js';
import { t, fmtNumber } from '../shared/i18n.js';
import { getCollection, setCollection, onChange } from '../shared/storage.js';
import { dayKey, rangeKeys, addDays } from '../shared/time.js';
import { uid, card } from './mod-common.js';

/* ---------- habits ---------- */
const SUGGESTIONS = ['habits.s1', 'habits.s2', 'habits.s3', 'habits.s4'];

export function habitsModule() {
  const root = card('habits', icon('sprout'), t('mod.habits'));
  const body = h('div', { class: 'stack gap-3' });
  root.append(body);
  let data = { items: [], log: {} }, adding = false;
  const save = () => setCollection('habits', data);
  const week = rangeKeys(7);

  function streakOf(id) {
    let n = 0, d = new Date();
    if (!(data.log[dayKey(d)] || []).includes(id)) d = addDays(d, -1);
    while ((data.log[dayKey(d)] || []).includes(id)) { n++; d = addDays(d, -1); }
    return n;
  }
  function toggle(id, on) {
    const k = dayKey(); const set = new Set(data.log[k] || []);
    on ? set.add(id) : set.delete(id);
    set.size ? data.log[k] = [...set] : delete data.log[k];
    save(); render();
  }
  function addHabit(name) { data.items.push({ id: uid(), name: name.trim().slice(0, 80) }); adding = false; save(); render(); }

  function render() {
    const doneToday = (data.log[dayKey()] || []).filter((id) => data.items.some((i) => i.id === id)).length;
    root.querySelector('.count')?.remove();
    if (data.items.length) root.querySelector('.mod-head').append(h('span', { class: 'count num', text: `${doneToday}/${data.items.length}` }));
    const addInput = h('input', { class: 'input', placeholder: t('habits.add'), 'aria-label': t('habits.add'), maxlength: 80, onkeydown: (e) => { if (e.key === 'Enter' && e.target.value.trim()) addHabit(e.target.value); if (e.key === 'Escape') { adding = false; render(); } } });
    clear(body,
      data.items.length ? h('div', { class: 'items' }, data.items.map((it) => {
        const on = (data.log[dayKey()] || []).includes(it.id), s = streakOf(it.id);
        return h('div', { class: 'habit' },
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: on, 'aria-label': it.name, onchange: (e) => toggle(it.id, e.target.checked) }), h('span', { class: 'box' }, icon('check'))),
          h('span', { class: 'txt', text: it.name }),
          h('span', { class: 'row' }, h('span', { class: 'week', 'aria-hidden': 'true' }, week.map((k) => h('i', { class: (data.log[k] || []).includes(it.id) ? 'on' : '' }))), s >= 2 ? h('span', { class: 'streak-n num', 'data-tip': t('habits.streak', { n: s }) }, icon('flame'), fmtNumber(s)) : null),
          h('button', { class: 'x', type: 'button', 'aria-label': t('common.remove'), onclick: () => { const i = data.items.indexOf(it); data.items.splice(i, 1); save(); render(); toast(t('habits.removed'), { action: t('common.undo'), onAction: () => { data.items.splice(i, 0, it); save(); render(); } }); } }, icon('x')));
      })) : h('div', { class: 'hint', text: t('habits.empty') }),
      adding ? addInput : h('button', { class: 'btn btn-sm btn-ghost', style: { alignSelf: 'flex-start' }, type: 'button', onclick: () => { adding = true; render(); document.querySelector('#mod-habits input.input')?.focus(); } }, icon('plus'), t('habits.addBtn')),
      !data.items.length ? h('div', { class: 'suggest' }, h('span', { class: 'hint', text: t('habits.ideas') }), SUGGESTIONS.map((k) => h('button', { class: 'chip', type: 'button', onclick: () => addHabit(t(k)) }, t(k)))) : null);
  }

  getCollection('habits', { items: [], log: {} }).then((v) => { data = v; render(); });
  onChange('habits', async () => { const v = await getCollection('habits', { items: [], log: {} }); if (!root.contains(document.activeElement)) { data = v; render(); } });
  return root;
}
