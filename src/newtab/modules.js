// Home-page modules: tasks, habits, notes, quick links. Each returns a card element and manages its own storage.

import { h, icon, favicon, toast, clear } from '../ui/dom.js';
import { t, fmtNumber, fmtDuration } from '../shared/i18n.js';
import { send } from '../ui/api.js';
import { getSettings } from '../shared/storage.js';
import { MAX_PRIORITIES } from '../shared/productivity.js';
import { openShutdown } from './shutdown.js';
import { getCollection, setCollection, onChange, updateSettings } from '../shared/storage.js';
import { dayKey, rangeKeys, addDays } from '../shared/time.js';
import { parseUserDomain } from '../shared/domains.js';
import { taskFromInput, updateEstLog } from '../shared/tasks.js';
import { parseQuickAdd } from '../shared/quickadd.js';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function card(id, ico, title, ...body) {
  return h('section', { class: 'card mod', id: 'mod-' + id }, h('div', { class: 'mod-head' }, h('h3', {}, ico, title)), body);
}

/** A calm, centred empty state shared by the modules: soft icon, one line of guidance. */
function emptyMini({ ico, title, body }) {
  return h('div', { class: 'empty-mini' }, h('div', { class: 'em-ico' }, icon(ico)), h('div', { class: 'em-title', text: title }), body ? h('div', { class: 'em-body', text: body }) : null);
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

    // what EyeTime understood from the line, shown while typing: time · length · priority · tags
    const preview = h('div', { class: 'qa-preview', 'aria-live': 'polite' });
    const drawPreview = (value) => {
      const p = parseQuickAdd(value);
      const chips = [p.at ? [{ icon: 'alarm-clock' }, t('tasks.qaAt', { time: p.at })] : null, p.est ? [{ icon: 'timer' }, t('tasks.qaEst', { time: fmtDuration(p.est * 60) })] : null, p.priority ? [{ icon: 'star' }, t('tasks.qaPri')] : null, ...p.tags.map((g) => [{ icon: 'tag' }, '#' + g])].filter(Boolean);
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
    const startOn = async (x) => { const s = await getSettings(); const r = await send('focus:start', { minutes: x.est || s.focus.minutes, strict: s.focus.strict, scope: s.focus.scope, taskId: x.id }); if (r && r.ok === false) toast(t('common.error')); };

    const priStar = () => { const el = icon('star'); el.classList.add('pri'); return el; };
    const row = (x) => {
      const scheduled = x.at && x.atDay === dayKey() && !x.done;
      const meta = [
        scheduled ? h('span', { class: 'tagm at num', 'data-tip': t('tasks.scheduledAt') }, icon('alarm-clock'), x.at) : null,
        x.focusSec >= 60 ? h('span', { class: 'tagm num', 'data-tip': t('tasks.spent') }, icon('timer'), x.est ? t('tasks.estOf', { spent: fmtDuration(x.focusSec), est: fmtDuration(x.est * 60) }) : fmtDuration(x.focusSec)) : (x.est && !x.done ? h('span', { class: 'tagm num', 'data-tip': t('prod.estPlanned') }, icon('timer'), t('tasks.estOnly', { est: fmtDuration(x.est * 60) })) : null),
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
          h('button', { type: 'button', 'aria-label': t('common.remove'), onclick: () => { const i = tasks.indexOf(x); tasks.splice(i, 1); save(); render(); toast(t('tasks.removed'), { action: t('common.undo'), onAction: () => { tasks.splice(i, 0, x); save(); render(); } }); } }, icon('x'))));
    };

    clear(body, input, preview,
      prio ? h('div', { class: 'eyebrow', text: t('tasks.priorities', { n: prio, max: MAX_PRIORITIES }) }) : null,
      visible.length ? h('div', { class: 'items' }, visible.map(row)) : emptyMini({ ico: 'list-checks', title: t('tasks.emptyTitle'), body: t('tasks.empty') }),
      ordered.length > LIMIT ? h('button', { class: 'more-link', type: 'button', onclick: () => { showAll = !showAll; render(); } }, showAll ? t('mod.showLess') : t('mod.showAll', { n: ordered.length })) : null,
      done.length ? h('button', { class: 'more-link', type: 'button', onclick: () => { tasks = tasks.filter((x) => !x.done); save(); render(); } }, t('tasks.clearDone')) : null,
      open.length ? h('button', { class: 'more-link plan-link', type: 'button', onclick: openShutdown }, icon('moon'), t('tasks.planTomorrow')) : null);
  }

  getCollection('tasks', []).then((v) => { tasks = v; render(); });
  onChange('tasks', async () => { const v = await getCollection('tasks', []); if (JSON.stringify(v) === JSON.stringify(tasks)) return; tasks = v; if (!root.contains(document.activeElement)) render(); }); // keep memory fresh even while typing, so a later save never overwrites a task added elsewhere (palette, another tab)
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
      !data.items.length ? h('div', { class: 'suggest' }, h('span', { class: 'hint', text: t('habits.ideas') }), SUGGESTIONS.map((k) => h('button', { class: 'chip', type: 'button', onclick: () => addHabit(t(k)) }, t(k)))) : null);
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
      h('button', { class: 'link add' + (links.length ? '' : ' alone'), type: 'button', onclick: openAdd }, h('span', { class: 'plus' }, icon('plus')), h('span', { class: 't', text: links.length ? t('links.addShort') : t('links.addFirst') }))));
  }
  render(settings);
  return { el: root, update: render };
}
