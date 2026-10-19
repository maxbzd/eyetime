// Home-page modules: tasks, habits, notes, quick links. Each returns a card element and manages its own storage.

import { h, icon, favicon, toast, clear } from '../ui/dom.js';
import { t, fmtNumber, fmtDuration } from '../shared/i18n.js';
import { send } from '../ui/api.js';
import { getSettings } from '../shared/storage.js';
import { MAX_PRIORITIES } from '../shared/productivity.js';
import { getCollection, setCollection, onChange, updateSettings } from '../shared/storage.js';
import { dayKey, rangeKeys, addDays } from '../shared/time.js';
import { parseUserDomain } from '../shared/domains.js';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function card(id, ico, title, ...body) {
  return h('section', { class: 'card mod', id: 'mod-' + id }, h('div', { class: 'mod-head' }, h('h3', {}, ico, title)), body);
}

/* ---------- tasks ---------- */
export function tasksModule() {
  const root = card('tasks', icon('list-checks'), t('mod.tasks'));
  const body = h('div', { class: 'stack gap-3' });
  const head = root.querySelector('.mod-head');
  root.append(body);
  let tasks = [], showAll = false;

  const save = () => setCollection('tasks', tasks);
  const LIMIT = 6;

  function render() {
    const open = tasks.filter((x) => !x.done), done = tasks.filter((x) => x.done);
    // priorities first (the day's top three), then the rest, then done
    const ordered = [...open.filter((x) => x.starred), ...open.filter((x) => !x.starred), ...done];
    const visible = showAll ? ordered : ordered.slice(0, LIMIT);
    const prio = open.filter((x) => x.starred).length;
    head.querySelector('.count')?.remove();
    if (tasks.length) head.append(h('span', { class: 'count num', text: `${done.length}/${tasks.length}` }));

    const input = h('input', { class: 'input', placeholder: t('tasks.add'), 'aria-label': t('tasks.add'), maxlength: 300, onkeydown: (e) => {
      if (e.key !== 'Enter' || !e.target.value.trim()) return;
      tasks.unshift({ id: uid(), text: e.target.value.trim(), done: false, starred: false, createdAt: Date.now() }); save(); render();
      document.querySelector('#mod-tasks input')?.focus();
    } });

    const toggleStar = (x) => {
      if (!x.starred && tasks.filter((y) => y.starred && !y.done).length >= MAX_PRIORITIES) { toast(t('tasks.maxPriorities', { n: MAX_PRIORITIES })); return; }
      x.starred = !x.starred; save(); render();
    };
    const startOn = async (x) => { const s = await getSettings(); const r = await send('focus:start', { minutes: s.focus.minutes, strict: s.focus.strict, scope: s.focus.scope, taskId: x.id }); if (r && r.ok === false) toast(t('common.error')); };

    const row = (x) => h('div', { class: 'item' + (x.done ? ' done' : '') + (x.starred && !x.done ? ' prio' : '') },
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: x.done, 'aria-label': x.text, onchange: (e) => { x.done = e.target.checked; x.doneAt = x.done ? Date.now() : 0; if (x.done) x.starred = false; save(); render(); } }), h('span', { class: 'box' }, icon('check'))),
      h('span', { class: 'txt' }, x.text, x.focusSec >= 60 ? h('span', { class: 'spent num', 'data-tip': t('tasks.spent'), text: fmtDuration(x.focusSec) }) : null),
      x.done ? null : h('button', { class: 'x act star' + (x.starred ? ' on' : ''), type: 'button', 'aria-pressed': String(!!x.starred), 'aria-label': t('tasks.priority') + ': ' + x.text, 'data-tip': t('tasks.priority'), onclick: () => toggleStar(x) }, icon('star')),
      x.done ? null : h('button', { class: 'x act', type: 'button', 'aria-label': t('tasks.focusOn') + ': ' + x.text, 'data-tip': t('tasks.focusOn'), onclick: () => startOn(x) }, icon('play')),
      h('button', { class: 'x', type: 'button', 'aria-label': t('common.remove'), onclick: () => { const i = tasks.indexOf(x); tasks.splice(i, 1); save(); render(); toast(t('tasks.removed'), { action: t('common.undo'), onAction: () => { tasks.splice(i, 0, x); save(); render(); } }); } }, icon('x')));

    clear(body, input,
      prio ? h('div', { class: 'eyebrow', text: t('tasks.priorities', { n: prio, max: MAX_PRIORITIES }) }) : null,
      visible.length ? h('div', { class: 'items' }, visible.map(row)) : h('div', { class: 'hint', text: t('tasks.empty') }),
      ordered.length > LIMIT ? h('button', { class: 'more-link', type: 'button', onclick: () => { showAll = !showAll; render(); } }, showAll ? t('mod.showLess') : t('mod.showAll', { n: ordered.length })) : null,
      done.length ? h('button', { class: 'more-link', type: 'button', onclick: () => { tasks = tasks.filter((x) => !x.done); save(); render(); } }, t('tasks.clearDone')) : null);
  }

  getCollection('tasks', []).then((v) => { tasks = v; render(); });
  onChange('tasks', async () => { const v = await getCollection('tasks', []); if (JSON.stringify(v) !== JSON.stringify(tasks) && !root.contains(document.activeElement)) { tasks = v; render(); } });
  return root;
}

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
      !data.items.length ? h('div', { class: 'suggest' }, SUGGESTIONS.map((k) => h('button', { class: 'chip', type: 'button', onclick: () => addHabit(t(k)) }, t(k)))) : null);
  }

  getCollection('habits', { items: [], log: {} }).then((v) => { data = v; render(); });
  onChange('habits', async () => { const v = await getCollection('habits', { items: [], log: {} }); if (!root.contains(document.activeElement)) { data = v; render(); } });
  return root;
}

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
    tasks.unshift({ id: uid(), text: n.text.slice(0, 300), done: false, starred: false, createdAt: Date.now() });
    await setCollection('tasks', tasks);
    notes = notes.filter((x) => x !== n); save(); render(); toast(t('notes.movedToTasks'));
  }

  function render() {
    const input = h('textarea', { class: 'textarea', rows: 2, placeholder: t('notes.add'), 'aria-label': t('notes.add'), maxlength: 500, onkeydown: (e) => {
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
  onChange('captures', async () => { const v = await getCollection('captures', []); if (!root.contains(document.activeElement)) { notes = v; render(); } });
  return root;
}

/* ---------- quick links ---------- */
export function linksModule(settings) {
  const root = card('links', icon('link'), t('mod.links'));
  const body = h('div', {});
  root.append(body);

  function openAdd() {
    const urlIn = h('input', { class: 'input', placeholder: 'https://example.com', type: 'text', 'aria-label': 'URL', autofocus: true });
    const titleIn = h('input', { class: 'input', placeholder: t('links.titlePh'), maxlength: 24, 'aria-label': t('links.titlePh') });
    const err = h('div', { class: 'hint', style: { color: 'var(--distracting-text)' } });
    const dlg = h('dialog', { class: 'dialog' }, h('form', { method: 'dialog' },
      h('div', { class: 'dialog-body' }, h('h3', { text: t('links.add') }), h('div', { class: 'field' }, h('label', { text: 'URL' }), urlIn), h('div', { class: 'field' }, h('label', { text: t('links.title') }), titleIn), err),
      h('div', { class: 'dialog-actions' }, h('button', { class: 'btn btn-ghost', value: 'no', text: t('common.cancel'), formnovalidate: true }), h('button', { class: 'btn btn-primary', value: 'yes', text: t('common.add'), onclick: async (e) => {
        e.preventDefault();
        let u = urlIn.value.trim(); if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
        const host = parseUserDomain(u);
        if (!host) { err.textContent = t('links.invalid'); return; }
        await updateSettings((s) => { s.newtab.links.push({ url: new URL(u).href, title: (titleIn.value.trim() || host).slice(0, 24) }); });
        dlg.close();
      } }))));
    dlg.addEventListener('close', () => dlg.remove());
    document.body.append(dlg); dlg.showModal();
  }

  function render(s) {
    const links = s.newtab.links;
    clear(body, h('div', { class: 'links' },
      links.map((l, i) => {
        let host = ''; try { host = new URL(l.url).hostname; } catch { /* ignore */ }
        return h('a', { class: 'link', href: l.url }, favicon(host.replace(/^www\./, ''), 'fav'), h('span', { class: 't', text: l.title }),
          h('button', { class: 'x', type: 'button', 'aria-label': t('common.remove'), onclick: async (e) => { e.preventDefault(); e.stopPropagation(); await updateSettings((st) => { st.newtab.links.splice(i, 1); }); } }, icon('x')));
      }),
      h('button', { class: 'link add', type: 'button', onclick: openAdd }, h('span', { class: 'plus' }, icon('plus')), h('span', { class: 't', text: t('links.add') }))));
  }
  render(settings);
  return { el: root, update: render };
}
