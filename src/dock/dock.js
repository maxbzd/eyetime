// The dock panel (an iframe inside web pages, see src/content/dock.js): Now (focus + today's tasks), Learn (topics and links) and Thoughts.
import { bootPage } from '../ui/page.js';
import { $, h, icon, favicon, clear, toast, confirmDialog } from '../ui/dom.js';
import { send } from '../ui/api.js';
import { mountFocusCard } from '../ui/focus-card.js';
import { t, fmtDuration } from '../shared/i18n.js';
import { updateSettings, getCollection, setCollection, updateCollection, getDays, onChange } from '../shared/storage.js';
import { rangeKeys } from '../shared/time.js';
import { hostFromUrl } from '../shared/domains.js';
import { taskFromInput } from '../shared/tasks.js';
import { updateEstLog } from '../shared/tasks.js';
import { ensureInbox, newTopic, addLink, updateTopic, updateLink, removeLink, removeTopic, progress, topicSeconds, cleanUrl, INBOX_ID, MAX_TOPICS, STATUSES } from '../shared/topics.js';

const TABS = ['now', 'learn', 'thoughts'];
const STATUS_ICON = { todo: { icon: 'circle' }, doing: { icon: 'circle-dot' }, done: { icon: 'circle-check' } };
const store = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
const hashTab = (location.hash.split('/')[1] || '').trim();
let tab = TABS.includes(hashTab) ? hashTab : TABS.includes(store.get('dock-tab')) ? store.get('dock-tab') : 'now';
let page = null;              // { url, title, host } of the page the dock sits on (sent by the page script)
let topics = [], open = store.get('dock-open', INBOX_ID), days = [];
let focusMounted = false, renaming = '';

const view = () => $('#view');
/** Someone is in the middle of typing or choosing: a redraw would throw their text away. (An emptied field, after Enter, is not.) */
const isTyping = () => { const e = document.activeElement; return !!e && ((/^(INPUT|TEXTAREA)$/.test(e.tagName) && !!e.value) || e.tagName === 'SELECT'); };
/** Redraws and gives the focus back to the field that had it (by its label). */
async function redraw() {
  const lab = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('aria-label');
  await render();
  if (lab) { const el = [...document.querySelectorAll('[aria-label]')].find((x) => x.getAttribute('aria-label') === lab && /^(INPUT|TEXTAREA)$/.test(x.tagName)); if (el && document.activeElement !== el) el.focus(); }
}
const saveTopics = (fn) => updateCollection('topics', [], (cur) => fn(ensureInbox(cur, t('topic.inbox'))));

/* ---------- header ---------- */

function renderTabs() {
  const el = $('#tabs');
  clear(el, ...TABS.map((id) => h('button', { type: 'button', role: 'tab', id: 'tab-' + id, 'aria-selected': String(tab === id), tabindex: tab === id ? 0 : -1, text: t('dock.tab.' + id),
    onclick: () => select(id),
    onkeydown: (e) => { const i = TABS.indexOf(id), n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null; if (n === null) return; e.preventDefault(); select(TABS[(n + TABS.length) % TABS.length]); $('#tab-' + tab).focus(); } })));
  view().setAttribute('aria-labelledby', 'tab-' + tab);
}
function select(id) { tab = id; store.set('dock-tab', id); renderTabs(); render(); try { window.parent.postMessage({ type: 'eyetime:tab-is', tab: id }, '*'); } catch { /* standalone */ } }

/* ---------- Now: focus + today's tasks ---------- */

async function renderNow() {
  const el = view();
  if (!focusMounted || !el.querySelector('#d-focus')) {
    clear(el, h('section', { id: 'd-focus', class: 'card' }), h('div', { id: 'd-tasks', class: 'stack gap-2' }));
    mountFocusCard($('#d-focus'), { variant: 'compact' }); focusMounted = true;
  }
  const tasks = (await getCollection('tasks', [])).filter((x) => !x.done);
  const top = [...tasks.filter((x) => x.starred), ...tasks.filter((x) => !x.starred)].slice(0, 6);
  const add = h('input', { class: 'field', placeholder: t('dock.addTaskPh'), 'aria-label': t('dock.addTaskPh'), maxlength: 300, onkeydown: async (e) => {
    if (e.key !== 'Enter' || !e.target.value.trim()) return;
    const value = e.target.value; e.target.value = '';
    await updateCollection('tasks', [], (cur) => [taskFromInput(value, cur).task, ...cur]);
  } });
  const list = top.length
    ? h('div', { class: 'inset' }, top.map((x) => h('label', { class: 'task-row' },
      h('input', { type: 'checkbox', 'aria-label': x.text, onchange: async (e) => {
        const done = e.target.checked; let changed = null;
        await updateCollection('tasks', [], (cur) => cur.map((y) => { if (y.id !== x.id) return y; changed = { ...y, done, doneAt: done ? Date.now() : 0, starred: done ? false : y.starred }; return changed; }));
        if (changed) { const log = await getCollection('estLog', []); await setCollection('estLog', updateEstLog(log, changed)); }
      } }),
      h('span', { class: 'trunc t', text: x.text }), x.starred ? icon('star') : null)))
    : h('div', { class: 'hint', text: t('dock.noTasks') });
  clear($('#d-tasks'), h('div', { class: 'group-title', text: t('dock.tasksToday') }), list, add);
}

/* ---------- Learn: topics and links ---------- */

function pageBar() {
  if (!page || !cleanUrl(page.url)) return page ? h('div', { class: 'hint', text: t('dock.cannotSave') }) : null;
  const last = store.get('dock-topic', INBOX_ID);
  const sel = h('select', { class: 'field', 'aria-label': t('dock.saveTo') }, topics.map((x) => h('option', { value: x.id, selected: x.id === last, text: x.id === INBOX_ID ? t('topic.inbox') : x.title })));
  const btn = h('button', { class: 'pill', type: 'button', text: t('dock.save'), onclick: async () => {
    const id = sel.value; store.set('dock-topic', id); let res = null;
    await saveTopics((cur) => { res = addLink(cur, id, { url: page.url, title: page.title }); return res.added ? res.topics : cur; });
    const name = (topics.find((x) => x.id === id) || {}).title || '';
    if (res.added) { open = id; store.set('dock-open', id); toast(t('dock.savedIn', { topic: id === INBOX_ID ? t('topic.inbox') : name }), { action: t('common.undo'), onAction: () => saveTopics((cur) => removeLink(cur, id, res.link.id)) }); }
    else toast(res.reason === 'duplicate' ? t('dock.dup', { topic: id === INBOX_ID ? t('topic.inbox') : name }) : res.reason === 'full' ? t('dock.full') : t('dock.cannotSave'));
  } });
  return h('div', { class: 'inset pagebar' },
    h('div', { class: 'who' }, favicon(page.host || '', 'fav'), h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'title', text: page.title || page.host }), h('div', { class: 'sub trunc', text: page.host }))),
    h('div', { class: 'pick' }, sel, btn));
}

function linkRow(topic, l) {
  const host = hostFromUrl(l.url) || '';
  const next = STATUSES[(STATUSES.indexOf(l.status) + 1) % STATUSES.length];
  return h('div', { class: 'link-row', 'data-s': l.status },
    h('button', { class: 'check-btn', type: 'button', 'data-s': l.status, 'aria-label': t('dock.statusCycle', { status: t('dock.status.' + l.status) }), 'data-tip': t('dock.status.' + l.status),
      onclick: () => saveTopics((cur) => updateLink(cur, topic.id, l.id, { status: next })) }, icon((STATUS_ICON[l.status] || STATUS_ICON.todo).icon)),
    favicon(host, 'fav'),
    h('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer' }, h('div', { class: 't trunc', text: l.title }), h('div', { class: 'sub trunc', text: host })),
    h('button', { class: 'icon-btn x', type: 'button', 'aria-label': t('dock.removeLink'), onclick: () => saveTopics((cur) => removeLink(cur, topic.id, l.id)) }, icon('x')));
}

function topicCard(topic) {
  const p = progress(topic), isOpen = open === topic.id, sec = topicSeconds(topic, days);
  const head = h('button', { class: 'topic-head', type: 'button', 'aria-expanded': String(isOpen), onclick: () => { open = isOpen ? '' : topic.id; store.set('dock-open', open); renderLearn(); } },
    icon('chevron-right'), h('span', { class: 'name trunc', text: topic.id === INBOX_ID ? t('topic.inbox') : topic.title }),
    sec >= 60 ? h('span', { class: 'chip-s', 'data-tip': t('dock.timeSpent', { time: fmtDuration(sec) }), text: fmtDuration(sec) }) : null,
    p.total ? h('span', { class: 'chip-s', text: t('dock.progress', { done: p.done, total: p.total }) }) : null);
  if (!isOpen) return h('div', { class: 'inset-item' }, head);
  const add = h('input', { class: 'field', placeholder: t('dock.pasteLink'), 'aria-label': t('dock.pasteLink'), onkeydown: async (e) => {
    if (e.key !== 'Enter') return;
    const v = e.target.value.trim(); if (!v) return;
    const url = cleanUrl(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : 'https://' + v);
    if (!url) { toast(t('dock.cannotSave')); return; }
    const field = e.target; field.value = ''; // cleared first: the redraw that follows the save must not mistake it for text being typed
    let res = null; await saveTopics((cur) => { res = addLink(cur, topic.id, { url, title: '' }); return res.added ? res.topics : cur; });
    if (!res.added) { field.value = v; toast(res.reason === 'duplicate' ? t('dock.dup', { topic: topic.title }) : t('dock.full')); }
  } });
  const note = h('textarea', { class: 'field', rows: 3, placeholder: t('dock.notePh'), 'aria-label': t('dock.notePh'), maxlength: 2000, value: topic.note || '', onchange: (e) => saveTopics((cur) => updateTopic(cur, topic.id, { note: e.target.value })) });
  const tools = topic.id === INBOX_ID ? null : h('div', { class: 'topic-tools' },
    renaming === topic.id
      ? h('input', { class: 'field', value: topic.title, maxlength: 80, 'aria-label': t('dock.rename'), onkeydown: (e) => { if (e.key === 'Escape') { e.stopPropagation(); renaming = ''; renderLearn(); } else if (e.key === 'Enter') { const v = e.target.value.trim(); renaming = ''; if (v) saveTopics((cur) => updateTopic(cur, topic.id, { title: v })); else renderLearn(); } } })
      : h('button', { class: 'linkbtn', type: 'button', onclick: () => { renaming = topic.id; renderLearn(); const f = document.querySelector('.topic-tools input'); if (f) f.focus(); } }, t('dock.rename')),
    h('button', { class: 'linkbtn danger', type: 'button', onclick: async () => {
      if (!(await confirmDialog({ title: t('dock.deleteTitle', { topic: topic.title }), body: t('dock.deleteBody'), confirm: t('dock.deleteTopic'), danger: true }))) return;
      saveTopics((cur) => removeTopic(cur, topic.id));
    } }, t('dock.deleteTopic')));
  return h('div', { class: 'inset-item' }, head, h('div', { class: 'topic-body' },
    topic.links.length ? topic.links.map((l) => linkRow(topic, l)) : h('div', { class: 'hint', text: topic.id === INBOX_ID ? t('dock.inboxHint') : t('dock.linksEmpty') }),
    h('div', { class: 'tools-col' }, add, note), tools));
}

function renderLearn() {
  const el = view();
  const newField = topics.length < MAX_TOPICS ? h('input', { class: 'field', placeholder: t('dock.newTopicPh'), 'aria-label': t('dock.newTopic'), maxlength: 80, onkeydown: async (e) => {
    if (e.key !== 'Enter' || !e.target.value.trim()) return;
    const tp = newTopic(e.target.value); e.target.value = ''; open = tp.id; store.set('dock-open', open);
    await saveTopics((cur) => [...cur, tp]);
  } }) : null;
  const only = topics.length === 1 && !topics[0].links.length;
  clear(el, pageBar(), h('div', { class: 'group-title', text: t('dock.tab.learn') }),
    h('div', { class: 'inset' }, topics.map(topicCard)), only ? h('div', { class: 'hint', text: t('dock.topicsEmpty') }) : null, newField);
}

async function loadLearn() {
  topics = ensureInbox(await getCollection('topics', []), t('topic.inbox'));
  days = await getDays(rangeKeys(30));
}

/* ---------- Thoughts: parked captures ---------- */

async function renderThoughts() {
  const list = await getCollection('captures', []);
  const add = h('input', { class: 'field', placeholder: t('dock.thoughtPh'), 'aria-label': t('dock.thoughtPh'), maxlength: 500, onkeydown: async (e) => {
    if (e.key !== 'Enter' || !e.target.value.trim()) return;
    const text = e.target.value.trim(); e.target.value = '';
    await updateCollection('captures', [], (cur) => [{ id: String(Date.now()), text, at: Date.now() }, ...cur].slice(0, 200));
  } });
  clear(view(), add, list.length
    ? h('div', { class: 'inset' }, list.slice(0, 30).map((n) => h('div', { class: 'row' }, h('div', { class: 'grow', text: n.text }),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('dock.toTask'), 'data-tip': t('dock.toTask'), onclick: async () => {
        await updateCollection('tasks', [], (cur) => [taskFromInput(n.text, cur).task, ...cur]);
        await updateCollection('captures', [], (cur) => cur.filter((x) => x.id !== n.id)); toast(t('notes.movedToTasks'));
      } }, icon('list-plus')),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('common.remove'), onclick: () => updateCollection('captures', [], (cur) => cur.filter((x) => x.id !== n.id)) }, icon('x')))))
    : h('div', { class: 'hint', text: t('dock.thoughtsEmpty') }));
}

/* ---------- glue ---------- */

async function render() {
  focusMounted = focusMounted && tab === 'now';
  if (tab === 'now') await renderNow();
  else if (tab === 'learn') { await loadLearn(); renderLearn(); }
  else await renderThoughts();
}

function updatePageUi() {
  const b = $('#hideHere'); b.hidden = !(page && page.host);
  if (tab === 'learn' && !isTyping()) loadLearn().then(renderLearn);
}

window.addEventListener('message', (e) => {
  if (e.source !== window.parent || !e.data) return;
  if (e.data.type === 'eyetime:tab' && TABS.includes(e.data.tab)) { if (e.data.tab !== tab) select(e.data.tab); return; }
  if (e.data.type !== 'eyetime:page') return;
  const url = typeof e.data.url === 'string' ? e.data.url.slice(0, 2000) : '', host = hostFromUrl(url) || '';
  page = { url, title: String(e.data.title || '').slice(0, 300), host };
  updatePageUi();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) window.parent.postMessage({ type: 'eyetime:close' }, '*'); });

(async function main() {
  await bootPage({ onSettings: () => { renderTabs(); render(); } });
  renderTabs();
  $('#closeDock').onclick = () => window.parent.postMessage({ type: 'eyetime:close' }, '*');
  $('#hideHere').onclick = async () => {
    if (!page || !page.host) return;
    await updateSettings((s) => { s.dock.hidden = [...new Set([...(s.dock.hidden || []), page.host])].slice(0, 100); });
    await send('settings:changed'); toast(t('dock.hidden', { host: page.host }));
  };
  await render();
  window.parent.postMessage({ type: 'eyetime:need-page' }, '*');
  onChange(['topics', 'tasks', 'captures'], () => { if (!isTyping()) redraw(); });
})();
