// Command palette (Ctrl/Cmd+K) for the full-page surfaces: type to find a command, a task, a setting or a look, Enter to run it.
// Everything it does is also reachable by hand — the palette only makes the frequent things one keystroke away.

import { h, icon, clear, toast } from './dom.js';
import { send } from './api.js';
import { t, fmtDuration } from '../shared/i18n.js';
import { getSettings, updateSettings, getRaw, getCollection, setCollection } from '../shared/storage.js';
import { LOOK_IDS } from '../shared/looks.js';
import { rank } from '../shared/fuzzy.js';
import { isFocusActive } from '../shared/blocking.js';
import { taskFromInput } from '../shared/tasks.js';
import { modeName } from '../shared/modes.js';

const SECTIONS = ['general', 'appearance', 'focus', 'blocking', 'eye', 'tracking', 'data', 'about'];
const ITABS = ['overview', 'focus', 'sites', 'patterns'];
const url = (p) => chrome.runtime.getURL(p);

let open = false;

/** Build the command list for the current state. `extra` lets a page add its own (e.g. "Close the day" on Home). */
async function commands(extra) {
  const [settings, { focus, pausedUntil = 0 }, tasks] = await Promise.all([getSettings(), getRaw(['focus', 'pausedUntil']), getCollection('tasks', [])]);
  const running = isFocusActive(focus);
  const list = [];
  const add = (group, ico, label, run, { hint = '', keys = [] } = {}) => list.push({ group, icon: ico.icon, label, run, hint, keys: [label, ...keys] });

  // focus
  if (running) {
    add('focus', { icon: 'plus' }, t('focus.extend', { n: 5 }), () => send('focus:extend', { minutes: 5 }), { keys: ['extend', 'more time'] });
    if (!focus.strict) add('focus', { icon: 'square' }, t('focus.end'), async () => { await send('focus:stop'); }, { keys: ['stop', 'end'] });
  } else {
    add('focus', { icon: 'play' }, t('focus.start', { time: fmtDuration(settings.focus.minutes * 60) }), async () => { const r = await send('focus:start', { minutes: settings.focus.minutes, strict: settings.focus.strict, scope: settings.focus.scope, mode: settings.focus.mode }); if (r && r.ok === false) toast(t('common.error')); }, { keys: ['start', 'focus', 'session'] });
    for (const m of settings.focus.modes || []) {
      add('focus', { icon: m.icon || 'zap' }, `${modeName(m)} · ${fmtDuration(m.minutes * 60)}`, () => send('focus:start', { minutes: m.minutes, strict: !!m.strict, scope: m.scope, mode: m.id }), { hint: t('palette.mode'), keys: ['focus', 'start', 'mode'] });
    }
    for (const x of tasks.filter((y) => !y.done).slice(0, 30)) {
      add('tasks', { icon: 'play' }, x.text, () => send('focus:start', { minutes: x.est || settings.focus.minutes, strict: settings.focus.strict, scope: settings.focus.scope, taskId: x.id }), { hint: t('palette.focusOn'), keys: ['focus on'] });
    }
  }
  add('focus', { icon: 'eye' }, t('palette.eyeBreak'), () => send('break:open'), { keys: ['break', 'eye', '20-20-20'] });
  if (pausedUntil > Date.now()) add('focus', { icon: 'play' }, t('track.resume'), () => send('tracking:pause', { minutes: 0 }), { keys: ['tracking'] });
  else add('focus', { icon: 'pause' }, t('track.pause'), () => send('tracking:pause', { minutes: 60 }), { keys: ['tracking', 'stop'] });

  // go to
  add('go', { icon: 'house' }, t('nav.home'), () => { location.href = url('src/newtab/newtab.html'); }, { keys: ['home', 'new tab'] });
  for (const tab of ITABS) add('go', { icon: 'chart-column' }, `${t('nav.insights')} · ${t('itab.' + tab)}`, () => { try { localStorage.setItem('et-itab', tab); } catch { /* ignore */ } location.href = url('src/insights/insights.html'); }, { keys: ['stats', 'insights', 'statistics'] });
  for (const s of SECTIONS) add('go', { icon: 'settings' }, `${t('nav.settings')} · ${t('sec.' + s)}`, () => { location.href = url('src/options/options.html#' + s); }, { keys: ['settings', 'options', 'preferences'] });

  // look
  for (const id of LOOK_IDS) add('look', { icon: 'palette' }, `${t('palette.look')}: ${t('look.' + id)}`, () => updateSettings((s) => { s.appearance.look = id; }), { keys: ['theme', 'appearance', 'style'] });
  for (const [mode, key] of [['light', 'opt.themeLight'], ['dark', 'opt.themeDark'], ['system', 'opt.themeSystem']]) add('look', { icon: 'sun-moon' }, `${t('opt.theme')}: ${t(key)}`, () => updateSettings((s) => { s.appearance.mode = mode; }), { keys: ['dark mode', 'light mode', 'theme'] });

  for (const c of (typeof extra === 'function' ? await extra() : [])) list.push({ keys: [c.label], hint: '', ...c });
  return list;
}

function mount(extra) {
  if (open) return;
  open = true;
  try { localStorage.setItem('et-palette-used', '1'); window.dispatchEvent(new window.CustomEvent('et:palette-used')); } catch { /* ignore */ }
  let items = [], shown = [], sel = 0, token = 0;
  const input = h('input', { class: 'pal-input', type: 'text', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'pal-list', 'aria-autocomplete': 'list', placeholder: t('palette.placeholder'), spellcheck: false, autocomplete: 'off' });
  const list = h('div', { class: 'pal-list', id: 'pal-list', role: 'listbox' });
  const foot = h('div', { class: 'pal-foot' }, h('span', {}, h('span', { class: 'kbd', text: '↑↓' }), t('palette.navigate')), h('span', {}, h('span', { class: 'kbd', text: '↵' }), t('palette.run')), h('span', {}, h('span', { class: 'kbd', text: 'esc' }), t('palette.close')));
  const dlg = h('dialog', { class: 'palette', 'aria-label': t('palette.title') }, h('div', { class: 'pal-top' }, icon('search'), input), list, foot);

  function compute() {
    const q = input.value.trim();
    let out;
    if (!q) out = items.filter((c) => c.group !== 'tasks' && c.group !== 'look').slice(0, 14);
    else {
      out = rank(q, items, (c) => c.keys).slice(0, 9);
      // anything typed can become a task — the parser takes time, length and priority out of the text
      const { task, parsed } = taskFromInput(q, []);
      const bits = [parsed.at ? t('tasks.qaAt', { time: parsed.at }) : null, parsed.est ? t('tasks.qaEst', { time: fmtDuration(parsed.est * 60) }) : null, parsed.priority ? t('tasks.qaPri') : null].filter(Boolean).join(' · ');
      out.push({ group: 'add', icon: 'list-plus', label: t('palette.addTask', { text: task.text }), hint: bits, run: async () => {
        const tasks = await getCollection('tasks', []);
        const made = taskFromInput(q, tasks).task;
        tasks.unshift(made); await setCollection('tasks', tasks);
        toast(t('palette.taskAdded'));
      } });
    }
    shown = out; sel = Math.min(sel, Math.max(0, shown.length - 1));
  }
  function paint() {
    let last = '';
    clear(list, shown.length ? shown.map((c, i) => {
      const head = !input.value.trim() && c.group !== last ? h('div', { class: 'pal-group', text: t('palette.g.' + c.group) }) : null; last = c.group;
      return [head, h('div', { class: 'pal-item', id: 'pal-' + i, role: 'option', 'aria-selected': String(i === sel), onmousemove: () => { if (sel !== i) { sel = i; mark(); } }, onclick: () => run(i) },
        icon(c.icon), h('span', { class: 'pal-label', text: c.label }), c.hint ? h('span', { class: 'pal-hint', text: c.hint }) : null)];
    }) : h('div', { class: 'pal-empty', text: t('palette.none') }));
    input.setAttribute('aria-activedescendant', shown.length ? 'pal-' + sel : '');
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }
  function mark() { list.querySelectorAll('.pal-item').forEach((el, i) => el.setAttribute('aria-selected', String(i === sel))); input.setAttribute('aria-activedescendant', 'pal-' + sel); list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }
  async function run(i) {
    const c = shown[i]; if (!c) return;
    dlg.close();
    try { await c.run(); } catch { toast(t('common.error')); }
  }
  input.addEventListener('input', () => { sel = 0; compute(); paint(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, shown.length); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + shown.length) % Math.max(1, shown.length); mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { dlg.remove(); open = false; token++; });
  document.body.append(dlg);
  dlg.showModal();
  input.focus();
  const my = ++token;
  commands(extra).then((c) => { if (my !== token) return; items = c; compute(); paint(); });
}

/** Install the Ctrl/Cmd+K shortcut on the current page. */
export function installPalette({ extra } = {}) {
  if (!document.querySelector('link[data-palette]')) document.head.append(h('link', { rel: 'stylesheet', href: new URL('./palette.css', import.meta.url).href, 'data-palette': '' }));
  window.addEventListener('et:palette', () => mount(extra));
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.code === 'KeyK' || e.key.toLowerCase() === 'k')) { e.preventDefault(); mount(extra); }
  });
  return { open: () => mount(extra) };
}
