import { bootPage } from '../ui/page.js';
import { $, h, icon, clear, toast } from '../ui/dom.js';
import { mountFocusCard } from '../ui/focus-card.js';
import { mountToday } from '../ui/today-card.js';
import { tasksModule, habitsModule, notesModule, linksModule } from './modules.js';
import { t, fmtDate, fmtTime } from '../shared/i18n.js';
import { updateSettings, getRaw, setRaw, onChange } from '../shared/storage.js';
import { clock, remainingMs } from '../shared/focus.js';
import { isFocusActive } from '../shared/blocking.js';
import { ACCENT_NAMES } from '../ui/page.js';

const BACKGROUNDS = ['dawn', 'ocean', 'forest', 'dusk', 'sand', 'slate', 'plain'];
const MODULES = ['today', 'tasks', 'habits', 'notes', 'links'];
let settings, linksMod;

/* ---------- hero ---------- */

function paintClock() {
  const now = new Date();
  $('#clock').textContent = fmtTime(now, settings.newtab.clock24 ?? undefined);
  $('#date').textContent = fmtDate(now);
  const hr = now.getHours();
  $('#greeting').textContent = settings.newtab.greeting ? t(hr < 5 ? 'greet.night' : hr < 12 ? 'greet.morning' : hr < 18 ? 'greet.afternoon' : 'greet.evening') : '';
}

/** While a session runs the tab title shows the countdown, so it is visible from other tabs. */
let runningFocus = null;
function paintTitle() {
  document.title = runningFocus && isFocusActive(runningFocus) ? `${clock(remainingMs(runningFocus))} · EyeTime` : 'EyeTime';
}
async function watchFocus() {
  runningFocus = (await getRaw('focus')).focus; paintTitle();
  onChange('focus', async () => { runningFocus = (await getRaw('focus')).focus; paintTitle(); });
  setInterval(paintTitle, 1000);
}

/* ---------- background ---------- */

async function applyBackground() {
  const bg = settings.newtab.background;
  if (bg === 'photo') {
    const { newtabBg } = await getRaw('newtabBg');
    if (newtabBg) { document.documentElement.style.setProperty('--photo', `url(${newtabBg})`); document.body.dataset.bg = 'photo'; return; }
  }
  document.body.dataset.bg = BACKGROUNDS.includes(bg) ? bg : 'dawn';
}

/** Downscale a user photo so storage stays small. */
function fileToDataUrl(file, maxW = 1920) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxW / img.width);
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.82)); URL.revokeObjectURL(img.src);
    };
    img.onerror = reject; img.src = URL.createObjectURL(file);
  });
}

/* ---------- modules ---------- */

function renderModules() {
  const root = $('#modules');
  clear(root);
  const on = settings.newtab.modules;
  if (on.today) { const sec = h('section', { class: 'card mod', id: 'mod-today' }); root.append(sec); mountToday(sec); }
  if (on.tasks) root.append(tasksModule());
  if (on.habits) root.append(habitsModule());
  if (on.notes) root.append(notesModule());
  if (on.links) { linksMod = linksModule(settings); root.append(linksMod.el); } else linksMod = null;
}

/* ---------- customize drawer ---------- */

function openDrawer() {
  $('#drawer').hidden = false; $('#scrim').hidden = false; drawDrawer(); $('#drawerClose').focus();
}
function closeDrawer() { $('#drawer').hidden = true; $('#scrim').hidden = true; $('#customize').focus(); }

function drawDrawer() {
  const body = $('#drawerBody'), n = settings.newtab;
  const set = (fn) => updateSettings((s) => { fn(s); });

  const fileIn = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { await setRaw({ newtabBg: await fileToDataUrl(f) }); await set((s) => { s.newtab.background = 'photo'; }); await applyBackground(); toast(t('home.photoSaved')); } catch { toast(t('common.error')); }
  } });

  const tiles = [...BACKGROUNDS, 'photo'].map((id) => h('button', { class: 'bg-tile', type: 'button', 'aria-pressed': String(n.background === id), onclick: async () => {
    if (id === 'photo') { const { newtabBg } = await getRaw('newtabBg'); if (!newtabBg) { fileIn.click(); return; } }
    await set((s) => { s.newtab.background = id; });
  } }, h('i', { style: id === 'photo' ? { background: 'repeating-linear-gradient(45deg, var(--surface-2), var(--surface-2) 6px, var(--surface-3) 6px, var(--surface-3) 12px)' } : id === 'plain' ? {} : { background: `linear-gradient(135deg, ${{ dawn: '#ffb68a,#c9b8ff', ocean: '#8ec9ff,#7ee3d0', forest: '#a8e0a0,#f2e6a0', dusk: '#ff9fb8,#9fa8ff', sand: '#f1d9a8,#f4b7a0', slate: '#cfd6e0,#e2e6ee' }[id]})` } }), h('span', { text: t('bg.' + id) })));

  const modRows = MODULES.map((m) => h('label', { class: 'toggle-row' }, h('span', { text: t('mod.' + m) }),
    h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked: !!n.modules[m], onchange: (e) => set((s) => { s.newtab.modules[m] = e.target.checked; }) }), h('span', { class: 'track' }), h('span', { class: 'thumb' }))));

  const clockSeg = h('div', { class: 'segmented', role: 'group', 'aria-label': t('home.clockFormat') }, [[null, 'home.clockAuto'], [false, 'home.clock12'], [true, 'home.clock24']].map(([v, k]) => h('button', { type: 'button', 'aria-pressed': String(n.clock24 === v), text: t(k), onclick: () => set((s) => { s.newtab.clock24 = v; }) })));

  const accents = h('div', { class: 'row gap-2 wrap' }, ACCENT_NAMES.map((a) => {
    const c = window.EyeTimeTheme.ACCENTS[a].l[0];
    return h('button', { type: 'button', class: 'swatch-btn', 'aria-pressed': String(settings.accent === a), 'aria-label': t('accent.' + a), style: { '--c': c }, onclick: () => set((s) => { s.accent = a; }) });
  }));

  clear(body,
    h('div', {}, h('h4', { text: t('home.background') }), h('div', { class: 'bg-grid' }, tiles), fileIn,
      n.background === 'photo' ? h('button', { class: 'btn btn-sm', style: { marginTop: 'var(--s-3)' }, type: 'button', onclick: () => fileIn.click() }, icon('image'), t('home.changePhoto')) : null),
    h('div', {}, h('h4', { text: t('home.accent') }), accents),
    h('div', {}, h('h4', { text: t('home.modules') }), modRows),
    h('div', {}, h('h4', { text: t('home.clock') }), clockSeg,
      h('label', { class: 'toggle-row', style: { marginTop: 'var(--s-3)' } }, h('span', { text: t('home.greeting') }), h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked: n.greeting, onchange: (e) => set((s) => { s.newtab.greeting = e.target.checked; }) }), h('span', { class: 'track' }), h('span', { class: 'thumb' })))));
}

/* ---------- boot ---------- */

async function applySettings(s, first = false) {
  const prevMods = settings ? JSON.stringify(settings.newtab.modules) : null;
  const prevLinks = settings ? JSON.stringify(settings.newtab.links) : null;
  settings = s;
  paintClock(); await applyBackground();
  if (!first) {
    if (JSON.stringify(s.newtab.modules) !== prevMods) renderModules();
    else if (linksMod && JSON.stringify(s.newtab.links) !== prevLinks) linksMod.update(s);
    if (!$('#drawer').hidden) drawDrawer();
  }
}

(async function main() {
  const s0 = await bootPage({ onSettings: (s) => applySettings(s) });
  settings = s0;
  if (s0.newtab.enabled === false) {
    // user switched the EyeTime new tab off: hand the tab back to the browser's own page
    try { const tab = await chrome.tabs.getCurrent(); await chrome.tabs.update(tab.id, { url: 'chrome://new-tab-page/' }); return; } catch { /* stay */ }
  }
  paintClock(); await applyBackground();
  setInterval(paintClock, 10_000);
  mountFocusCard($('#focus'), { variant: 'large' });
  renderModules();
  $('#customize').addEventListener('click', openDrawer);
  $('#drawerClose').addEventListener('click', closeDrawer);
  $('#scrim').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#drawer').hidden) closeDrawer(); });
  onChange('newtabBg', applyBackground);
  watchFocus();
})();
