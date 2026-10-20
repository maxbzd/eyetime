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
  { id: 'general', icon: 'settings-2', fn: S.general }, { id: 'appearance', icon: 'palette', fn: S.appearance }, { id: 'focus', icon: 'target', fn: S.focus }, { id: 'blocking', icon: 'shield', fn: S.blocking },
  { id: 'eye', icon: 'eye', fn: S.eye }, { id: 'tracking', icon: 'activity', fn: S.tracking }, { id: 'data', icon: 'database', fn: S.data }, { id: 'about', icon: 'info', fn: S.about },
];

let settings;
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
  nav(); applyFilter();
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
  root.querySelectorAll('section.sec, section.sec > div').forEach((e) => { e.hidden = false; });
  if (!q) return;
  let any = false;
  $('#qcount').textContent = '';
  for (const r of rows) { const hit = r.textContent.toLowerCase().includes(q); r.hidden = !hit; if (hit) { r.classList.add('hit'); any = true; } }
  $('#qcount').textContent = t('opt.results', { n: rows.filter((r) => !r.hidden).length });
  for (const g of root.querySelectorAll('section.sec > div')) if (g.querySelector('.card') && !g.querySelector('.setting:not([hidden])')) g.hidden = true;
  for (const sec of root.querySelectorAll('section.sec')) { const vis = sec.querySelector('.setting:not([hidden])'); sec.hidden = !vis; }
  document.querySelectorAll('#side a').forEach((a) => a.setAttribute('aria-current', 'false'));
  if (!any) root.append(h('div', { class: 'no-results' }, h('div', { class: 'em-ico' }, icon('search')), h('div', { class: 'em-title', text: t('opt.noResults', { q: query.trim() }) }), h('div', { class: 'em-body', text: t('opt.noResultsHint') }),
    h('button', { class: 'btn btn-sm', type: 'button', onclick: () => { query = ''; $('#q').value = ''; applyFilter(); $('#q').focus(); } }, t('opt.clearSearch'))));
}

function nav() {
  const side = $('#side');
  const active = location.hash.slice(1) || 'general';
  clear(side, SECTIONS.map(({ id, icon: ico }) => h('a', { href: '#' + id, 'aria-current': String(id === active), onclick: (e) => { e.preventDefault(); history.replaceState(null, '', '#' + id); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); setActive(id); } }, icon(ico), t('sec.' + id))));
}
function setActive(id) { document.querySelectorAll('#side a').forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + id))); }

function spy() {
  const obs = new IntersectionObserver((entries) => {
    const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (vis) setActive(vis.target.id);
  }, { rootMargin: '-80px 0px -65% 0px' });
  document.querySelectorAll('section.sec').forEach((s) => obs.observe(s));
}

(async function main() {
  await bootPage({ onSettings: async (s) => { if (JSON.stringify(s) === lastSaved) return; settings = s; draw(); spy(); } });
  settings = await getSettings();
  mountHeader($('#header'), 'settings');
  installPalette();
  $('#q').addEventListener('input', (e) => { query = e.target.value; applyFilter(); });
  document.addEventListener('keydown', (e) => { if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) { e.preventDefault(); $('#q').focus(); } });
  draw(); spy();
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  if (settings.companion.enabled) checkCompanion();
})();

async function checkCompanion() {
  const el = document.getElementById('compStatus'); if (!el) return;
  try {
    const r = await fetch('http://127.0.0.1:8765/v1/today', { headers: { Authorization: `Bearer ${settings.companion.token}` }, cache: 'no-store' });
    el.textContent = r.ok ? t('opt.compConnected') : r.status === 401 ? t('opt.compBadToken') : t('opt.compError'); el.className = 'badge ' + (r.ok ? 'badge-success' : 'badge-warn');
  } catch { el.textContent = t('opt.compOffline'); el.className = 'badge'; }
}
