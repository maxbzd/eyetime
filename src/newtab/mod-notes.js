// Home module: quick notes.

import { h, icon, toast, clear } from '../ui/dom.js';
import { t } from '../shared/i18n.js';
import { getCollection, setCollection, onChange } from '../shared/storage.js';
import { taskFromInput } from '../shared/tasks.js';
import { uid, card } from './mod-common.js';

/* ---------- notes ---------- */
export function notesModule() {
  const root = card('notes', icon('notebook-pen'), t('mod.notes'));
  const body = h('div', { class: 'stack gap-3' });
  root.append(body);
  let notes = [], showAll = false;
  const save = () => setCollection('captures', notes);
  const LIMIT = 5;

  async function toTask(n) {
    const tasks = await getCollection('tasks', []);
    tasks.unshift(taskFromInput(n.text, tasks).task); // a note like "Call Anna 16:45 30m" keeps its time and length when it becomes a task
    await setCollection('tasks', tasks);
    notes = notes.filter((x) => x !== n); save(); render(); toast(t('notes.movedToTasks'));
  }

  function render() {
    const input = h('textarea', { class: 'textarea textarea-grow', rows: 2, oninput: (e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(160, e.target.scrollHeight + 2) + 'px'; }, placeholder: t('notes.add'), 'aria-label': t('notes.add'), maxlength: 500, onkeydown: (e) => {
      if (e.key === 'Enter' && !e.shiftKey && e.target.value.trim()) { e.preventDefault(); notes.unshift({ id: uid(), text: e.target.value.trim(), at: Date.now() }); save(); render(); document.querySelector('#mod-notes textarea')?.focus(); }
    } });
    const visible = showAll ? notes : notes.slice(0, LIMIT);
    clear(body, input,
      visible.length ? h('div', { class: 'items' }, visible.map((n) => h('div', { class: 'note' },
        h('span', { class: 'txt', text: n.text }),
        h('span', { class: 'acts' },
          h('button', { type: 'button', 'data-tip': t('notes.toTask'), 'aria-label': t('notes.toTask'), onclick: () => toTask(n) }, icon('list-plus')),
          h('button', { type: 'button', 'aria-label': t('common.remove'), onclick: () => { const i = notes.indexOf(n); notes.splice(i, 1); save(); render(); toast(t('notes.removed'), { action: t('common.undo'), onAction: () => { notes.splice(i, 0, n); save(); render(); } }); } }, icon('x'))))))
        : h('div', { class: 'hint', text: t('notes.empty') }),
      notes.length > LIMIT ? h('button', { class: 'more-link', type: 'button', onclick: () => { showAll = !showAll; render(); } }, showAll ? t('mod.showLess') : t('mod.showAll', { n: notes.length })) : null);
  }

  getCollection('captures', []).then((v) => { notes = v; render(); });
  onChange('captures', async () => { const v = await getCollection('captures', []); if (JSON.stringify(v) === JSON.stringify(notes)) return; notes = v; if (!root.contains(document.activeElement)) render(); });
  return root;
}
