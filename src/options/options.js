import { bootPage } from '../ui/page.js';
import { mountHeader } from '../ui/header.js';
import { installPalette } from '../ui/palette.js';
import { $, h, icon, clear } from '../ui/dom.js';
import { send } from '../ui/api.js';
import { t } from '../shared/i18n.js';
import { getSettings, updateSettings } from '../shared/storage.js';
import { debounce } from '../ui/dom.js';
import * as S from './sections.js';

const SECTIONS = [
  { id: 'general', icon: 'settings-2', fn: S.general }, { id: 'home', icon: 'house', fn: S.home }, { id: 'appearance', icon: 'palette', fn: S.appearance }, { id: 'focus', icon: 'target', fn: S.focus }, { id: 'blocking', icon: 'shield', fn: S.blocking },
  { id: 'eye', icon: 'eye', fn: S.eye }, { id: 'tracking', icon: 'activity', fn: S.tracking }, { id: 'data', icon: 'database', fn: S.data }, { id: 'about', icon: 'info', fn: S.about },
];

let settings;
let active = 'general'; // the section on the screen (one at a time; a search shows every match)
let savedTimer;
let lastSaved = '';
const notifyWorker = debounce(() => send('settings:changed'), 400);

function flashSaved() {
  const el = $('#saved');
  el.replaceChildren(icon('check'), t('opt.saved'));
  el.classList.add('show');
  clearTimeout(savedTimer); savedTimer = setTimeout(() => el.classList.remove('show'), 1400);
}

/** Persist a change. `rerender` re-draws the sections when the change alters what is visible (language, theme, toggles that reveal rows). */
async function save(mutate, rerender = false) {
  settings = await updateSettings((s) => { mutate(s); });
  lastSaved = JSON.stringify(settings);
  flashSaved(); notifyWorker();
  // theme / language apply through the settings listener in bootPage → full redraw; other changes redraw only when they reveal rows
  if (rerender) draw();
}

function draw() {
  const y = window.scrollY;
  const focusLabel = document.activeElement?.getAttribute?.('aria-label');
  const ctx = { s: settings, save, refresh: draw };
  const root = $('#content');
  clear(root, SECTIONS.map((x) => x.fn(ctx)));
  for (const sec of root.querySelectorAll('section.sec')) [...sec.children].filter((g) => g.querySelector(':scope > h3.group-title')).forEach((g, i) => { g.id = `${sec.id}-g${i}`; });
  applyFilter(); nav();
  window.scrollTo(0, y);
  if (focusLabel) document.querySelector(`[aria-label="${CSS.escape(focusLabel)}"]`)?.focus({ preventScroll: true });
}

/** Filter the long settings page: rows whose title or description match, with their groups and sections. */
let query = '';
function applyFilter() {
  const q = query.trim().toLowerCase();
  const root = $('#content');
  root.querySelector('.no-results')?.remove();
  const rows = [...root.querySelectorAll('.setting')];
  rows.forEach((r) => { r.hidden = false; r.classList.remove('hit'); });
  root.querySelectorAll('section.sec > div').forEach((e) => { e.hidden = false; });
  root.classList.toggle('searching', !!q);
  root.querySelectorAll('section.sec').forEach((e) => { e.hidden = !q && e.id !== active; });
  $('#qcount').textContent = '';
  if (!q) return;
  let any = false;
  for (const r of rows) { const hit = r.textContent.toLowerCase().includes(q); r.hidden = !hit; if (hit) { r.classList.add('hit'); any = true; } }
  $('#qcount').textContent = t('opt.results', { n: rows.filter((r) => !r.hidden).length });
  for (const g of root.querySelectorAll('section.sec > div')) if (g.querySelector('.card') && !g.querySelector('.setting:not([hidden])')) g.hidden = true;
  for (const sec of root.querySelectorAll('section.sec')) { const vis = sec.querySelector('.setting:not([hidden])'); sec.hidden = !vis; }
  if (!any) root.append(h('div', { class: 'no-results' }, h('div', { class: 'em-ico' }, icon('search')), h('div', { class: 'em-title', text: t('opt.noResults', { q: query.trim() }) }), h('div', { class: 'em-body', text: t('opt.noResultsHint') }),
    h('button', { class: 'btn btn-sm', type: 'button', onclick: () => { query = ''; $('#q').value = ''; applyFilter(); nav(); $('#q').focus(); } }, t('opt.clearSearch'))));
}

/** Show one section: the others are hidden, the page starts at its top. */
function go(id, { scroll = true } = {}) {
  if (!SECTIONS.some((x) => x.id === id)) id = 'general';
  active = id; query = ''; $('#q').value = '';
  history.replaceState(null, '', '#' + id);
  applyFilter(); nav();
  if (scroll) window.scrollTo(0, 0);
  spy();
}

function nav() {
  const side = $('#side');
  const groups = [...document.querySelectorAll(`#${active} > div[id]`)].map((g) => [g.id, g.querySelector('h3.group-title')?.textContent || '']).filter(([, n]) => n);
  const list = [];
  for (const { id, icon: ico } of SECTIONS) {
    list.push(h('a', { href: '#' + id, 'aria-current': String(!query.trim() && id === active), onclick: (e) => { e.preventDefault(); go(id); } }, icon(ico), t('sec.' + id)));
    if (id === active && !query.trim() && groups.length > 1) {
      list.push(h('div', { class: 'side-sub', role: 'group', 'aria-label': t('sec.' + id) }, groups.map(([gid, name]) =>
        h('a', { href: '#' + gid, 'data-g': gid, onclick: (e) => { e.preventDefault(); document.getElementById(gid)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); } }, name))));
    }
  }
  clear(side, list);
  markSub();
}

/** The group being read is marked in the side list. */
function markSub() {
  const subs = [...document.querySelectorAll('#side .side-sub a')];
  if (!subs.length) return;
  let cur = subs[0].dataset.g;
  for (const a of subs) { const g = document.getElementById(a.dataset.g); if (g && g.getBoundingClientRect().top <= 140) cur = a.dataset.g; }
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = subs[subs.length - 1].dataset.g; // at the very end the last group is the one being read
  subs.forEach((a) => a.setAttribute('aria-current', String(a.dataset.g === cur)));
}

let spyOn = false;
function spy() {
  if (spyOn) return; spyOn = true;
  let raf = 0;
  window.addEventListener('scroll', () => { if (!raf) raf = window.requestAnimationFrame(() => { raf = 0; markSub(); }); }, { passive: true });
}

(async function main() {
  await bootPage({ onSettings: async (s) => { if (JSON.stringify(s) === lastSaved) return; settings = s; draw(); } });
  settings = await getSettings();
  mountHeader($('#header'), 'settings');
  installPalette();
  $('#q').addEventListener('input', (e) => { query = e.target.value; applyFilter(); nav(); });
  $('#q').addEventListener('keydown', (e) => { if (e.key === 'Escape' && query) { e.preventDefault(); query = ''; $('#q').value = ''; applyFilter(); nav(); } });
  document.addEventListener('keydown', (e) => { if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) { e.preventDefault(); $('#q').focus(); } });
  active = SECTIONS.some((x) => x.id === location.hash.slice(1)) ? location.hash.slice(1) : 'general';
  draw(); spy();
  window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (SECTIONS.some((x) => x.id === id) && id !== active) go(id); });
  if (settings.companion.enabled) checkCompanion();
})();

async function checkCompanion() {
  const el = document.getElementById('compStatus'); if (!el) return;
  try {
    const r = await fetch('http://127.0.0.1:8765/v1/today', { headers: { Authorization: `Bearer ${settings.companion.token}` }, cache: 'no-store' });
    el.textContent = r.ok ? t('opt.compConnected') : r.status === 401 ? t('opt.compBadToken') : t('opt.compError'); el.className = 'badge ' + (r.ok ? 'badge-success' : 'badge-warn');
  } catch { el.textContent = t('opt.compOffline'); el.className = 'badge'; }
}
