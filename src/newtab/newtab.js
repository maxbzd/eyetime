import { bootPage } from '../ui/page.js';
import { $, h, icon, clear, toast } from '../ui/dom.js';
import { mountFocusCard } from '../ui/focus-card.js';
import { mountToday } from '../ui/today-card.js';
import { tasksModule, habitsModule, notesModule, linksModule } from './modules.js';
import { t, fmtDate, fmtTime } from '../shared/i18n.js';
import { getSettings, updateSettings, getRaw, setRaw, onChange, getDays, getCollection } from '../shared/storage.js';
import { nudge as pickNudge, dayReview, applyPlans } from '../shared/productivity.js';
import { applyRepeats } from '../shared/tasks.js';
import { openShutdown } from './shutdown.js';
import { installPalette } from '../ui/palette.js';
import { mountGettingStarted } from './getting-started.js';
import { mountWhatsNew } from './whatsnew.js';
import { openDayPlan } from './dayplan.js';
import { mountRings } from './rings.js';
import { installSpotlight } from '../ui/spotlight.js';
import { applyCanvas, canvasActive } from './canvas.js';
import { applyType, clockSeconds } from './type-apply.js';
import { createWidgetHost } from './widgets.js';
import { applyDepth } from './depth.js';
import { cutOut } from './cutout.js';
import { themeBlock } from './theme-io.js';
import { resolveSettings, wantedLayout, activeLayoutId, editingLayoutId, setFocusing, home } from './home-config.js';
import { normalizeDepth } from '../shared/depth.js';
import { downloadBackup, needsBackup } from '../ui/backup.js';
import { send } from '../ui/api.js';
import { setCollection } from '../shared/storage.js';
import { dayKey } from '../shared/time.js';
import { LOOKS } from '../shared/looks.js';
import { fmtDuration } from '../shared/i18n.js';
import { clock, remainingMs } from '../shared/focus.js';
import { isFocusActive } from '../shared/blocking.js';
import { looksGallery, accentPicker } from '../ui/appearance.js';
import { luminance, normalizeHex } from '../shared/color.js';

const BACKGROUNDS = ['look', 'peaks', 'dawn', 'ocean', 'forest', 'dusk', 'sand', 'slate', 'mesh', 'aurora', 'stars', 'waves', 'grain', 'dots', 'grid', 'living', 'plain', 'color'];
const DARK_SCENES = ['aurora', 'stars', 'photo', 'sea', 'onyx', 'peaks'];
const MODULES = ['today', 'tasks', 'habits', 'notes', 'links'];
const CLOCKS = ['thin', 'bold', 'mono', 'serif', 'compact', 'stacked', 'none'];
const LAYOUTS = ['center', 'split', 'minimal'];
/** Saved order, completed with any module it does not mention (new modules, hand-edited backups). */
const moduleOrder = (n) => [...new Set([...(n.order || []).filter((m) => MODULES.includes(m)), ...MODULES])];
let settings, rawSettings, linksMod;

/* ---------- hero ---------- */

function paintClock() {
  const now = new Date();
  const time = fmtTime(now, settings.newtab.clock24 ?? undefined, clockSeconds(settings));
  const clockEl = $('#clock');
  if (settings.newtab.clockStyle === 'stacked') {
    const [hh, ...rest] = time.split(':');
    const tail = rest.join(':'), ap = /\s?([AP]M)$/i.exec(tail);
    clear(clockEl, h('span', { class: 'h', text: hh }), h('span', { class: 'm' }, tail.replace(/\s?[AP]M$/i, ''), ap ? h('span', { class: 'ap', text: ap[1].toUpperCase() }) : null));
  } else clockEl.textContent = time;
  document.body.dataset.clock = CLOCKS.includes(settings.newtab.clockStyle) ? settings.newtab.clockStyle : 'thin';
  document.body.dataset.layout = canvasActive(settings) ? 'canvas' : LAYOUTS.includes(settings.newtab.layout) ? settings.newtab.layout : 'center';
  $('#date').textContent = fmtDate(now);
  const hr = now.getHours();
  $('#greeting').textContent = settings.newtab.greeting ? t(hr < 5 ? 'greet.night' : hr < 12 ? 'greet.morning' : hr < 18 ? 'greet.afternoon' : 'greet.evening') : '';
}

/** The clock ticks every 10 s, every second when seconds are shown. */
let clockTimer = 0, clockEvery = 0;
function scheduleClock() {
  const every = clockSeconds(settings) ? 1000 : 10_000;
  if (every === clockEvery) return;
  clearInterval(clockTimer); clockEvery = every; clockTimer = setInterval(() => { paintClock(); checkLayout(); }, every);
}

/** A layout that switches on by itself (during focus, or at certain hours) takes over when its moment comes. */
function checkLayout() {
  if (rawSettings && !editingLayoutId() && wantedLayout(rawSettings) !== activeLayoutId()) applySettings(rawSettings);
}

/** A gentle, snoozable reminder to save a backup file (history lives only on this device). */
async function paintBackupNudge() {
  const el = $('#backupNudge');
  const { lastBackupAt = 0, backupSnoozedUntil = 0, meta } = await getRaw(['lastBackupAt', 'backupSnoozedUntil', 'meta']);
  const all = await chrome.storage.local.get(null);
  const daysStored = Object.keys(all).filter((k) => k.startsWith('d:')).length;
  if (!needsBackup({ now: Date.now(), installedAt: meta && meta.installedAt, lastBackupAt, daysStored, snoozedUntil: backupSnoozedUntil })) { el.hidden = true; return; }
  el.hidden = false;
  clear(el, icon('database'), h('span', { class: 'nudge-text', text: t('backup.title') + '. ' + t('backup.body') }),
    h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: async () => { await downloadBackup(); el.hidden = true; } }, icon('download'), t('backup.now')),
    h('button', { class: 'btn btn-sm', type: 'button', onclick: async () => { await setRaw({ backupSnoozedUntil: Date.now() + 14 * 86_400_000 }); el.hidden = true; } }, t('backup.later')));
}

/** While a session runs the tab title shows the countdown, so it is visible from other tabs. */
let runningFocus = null;
function paintTitle() {
  document.title = runningFocus && isFocusActive(runningFocus) ? `${clock(remainingMs(runningFocus))} · EyeTime` : 'EyeTime';
}
async function watchFocus() {
  const sync = async () => { runningFocus = (await getRaw('focus')).focus; paintTitle(); setFocusing(!!runningFocus && isFocusActive(runningFocus)); checkLayout(); };
  await sync();
  onChange('focus', sync);
  setInterval(() => { paintTitle(); const on = !!runningFocus && isFocusActive(runningFocus); setFocusing(on); checkLayout(); }, 1000);
}

/* ---------- day-loop nudge: one gentle prompt (plan · review · goal) ---------- */

const nudgeOff = (kind) => { try { return localStorage.getItem('et-nudge-off') === dayKey() + ':' + kind; } catch { return false; } };
async function paintNudge() {
  const el = $('#nudge');
  const [[, day]] = await getDays([dayKey()]);
  const tasks = (await getCollection('tasks', [])).filter((x) => !x.done);
  const kind = pickNudge({ now: new Date(), fsSec: day?.fs || 0, goalMin: 0, openTasks: tasks.length, starred: tasks.filter((x) => x.starred).length, sessionsToday: (day?.ss || []).length });
  if (!kind || kind === 'start' || nudgeOff(kind)) { el.hidden = true; return; }
  const r = dayReview(day);
  const rated = r.avgRating ? t(r.avgRating >= 2.5 ? 'review.r3' : r.avgRating >= 1.75 ? 'review.r2' : 'review.r1').toLowerCase() : '';
  const msg = { plan: t('nudge.plan'), goal: t('nudge.goal'), review: r.sessions ? (rated ? t('nudge.review', { n: r.sessions, time: fmtDuration(r.minutes * 60) }).replace(/\.$/, '') + ' · ' + rated + '.' : t('nudge.review', { n: r.sessions, time: fmtDuration(r.minutes * 60) })) : t('nudge.reviewEmpty') }[kind];
  const ico = { plan: { icon: 'star' }, goal: { icon: 'trophy' }, review: { icon: 'moon' } }[kind].icon;
  clear(el, icon(ico), h('span', { class: 'nudge-text', text: msg }),
    kind === 'review' ? h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: openShutdown }, icon('moon'), t('nudge.closeDay')) : null,
    kind === 'review' ? h('a', { class: 'btn btn-sm', href: '../insights/insights.html' }, t('nudge.seeDay')) : null,
    h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': t('common.close'), onclick: () => { try { localStorage.setItem('et-nudge-off', dayKey() + ':' + kind); } catch { /* private mode */ } el.hidden = true; } }, icon('x')));
  el.hidden = false;
}

/* ---------- background ---------- */

async function applyBackground() {
  const n = settings.newtab;
  let bg = BACKGROUNDS.includes(n.background) || n.background === 'photo' ? n.background : 'look';
  if (bg === 'look') { // "as in the look": Calm paints Dawn, Tide a sea (one per scheme), the others their own page colour
    const scene = LOOKS[settings.appearance.look]?.homeScene;
    bg = (scene && typeof scene === 'object' ? scene[document.documentElement.dataset.scheme] : scene) || 'look';
  }
  let scene = bg;
  if (bg === 'photo') {
    const { newtabBg } = await getRaw('newtabBg');
    if (newtabBg) document.documentElement.style.setProperty('--photo', `url(${newtabBg})`); else bg = 'look';
    const { newtabFg } = bg === 'photo' ? await getRaw('newtabFg') : {};
    if (newtabFg) { document.documentElement.style.setProperty('--photo-mask', `url(${newtabFg})`); scene = 'photo-cut'; } // the cut-out subject: a masked copy of the photo goes in front of the clock
  }
  const color = normalizeHex(n.bgColor) || '#e9e4ff';
  if (bg === 'color') document.documentElement.style.setProperty('--bg-color', color);
  document.body.dataset.bg = bg;
  $('.bg').className = 'bg bgx-' + bg;
  applyDepth(settings, scene);
  // light hero text on scenes that are dark in every theme, and on dark custom colours
  document.body.dataset.tone = DARK_SCENES.includes(bg) || (bg === 'color' && luminance(color) < 0.28) ? 'dark' : '';
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

let modEls = [], widgetEls = [];
const widgetHost = createWidgetHost();

function renderModules() {
  const on = settings.newtab.modules;
  modEls = [];
  linksMod = null;
  for (const id of moduleOrder(settings.newtab)) {
    if (!on[id]) continue;
    let el;
    if (id === 'today') { el = h('section', { class: 'card mod', id: 'mod-today' }); mountToday(el); }
    else if (id === 'tasks') el = tasksModule();
    else if (id === 'habits') el = habitsModule();
    else if (id === 'notes') el = notesModule();
    else { linksMod = linksModule(settings); el = linksMod.el; }
    modEls.push(el);
  }
  widgetEls = widgetHost.sync(settings);
  layoutModules();
  applyCanvas(settings);
}

/** A flat bento grid (see newtab.css): the saved order is the reading order, rows share one height. */
function layoutModules() { clear($('#modules'), [...modEls, ...widgetEls]); }

/* ---------- customize drawer ---------- */

function openDrawer() {
  $('#drawer').hidden = false; $('#scrim').hidden = false; drawDrawer(); $('#drawerClose').focus();
}
/** The arrangement editor (loaded on demand): drag, resize and hide the blocks of Home. */
async function openEditor() {
  if (window.innerWidth < 1100) { toast(t('cv.tooNarrow')); return; }
  $('#drawer').hidden = true; $('#scrim').hidden = true;
  const { startEditing } = await import('./canvas-edit.js');
  await startEditing(settings, { onExit: () => { checkLayout(); $('#customize').focus(); } });
}
function closeDrawer() { $('#drawer').hidden = true; $('#scrim').hidden = true; $('#customize').focus(); }

/** "Depth for your photo": cut the subject out on this device so the clock can sit behind it. */
function cutoutBlock() {
  const status = h('div', { class: 'muted', style: { fontSize: 'var(--fs-sm)' }, role: 'status', 'aria-live': 'polite' });
  const make = h('button', { class: 'btn btn-sm', type: 'button' }, icon('scissors'), t('ct.make'));
  const remove = h('button', { class: 'btn btn-sm btn-ghost', type: 'button', hidden: true }, icon('x'), t('ct.remove'));
  const sync = (has) => { make.hidden = has; remove.hidden = !has; };
  getRaw('newtabFg').then(({ newtabFg }) => sync(!!newtabFg));
  make.addEventListener('click', async () => {
    const { newtabBg } = await getRaw('newtabBg');
    if (!newtabBg) { status.textContent = t('ct.noPhoto'); return; }
    make.disabled = true;
    try {
      const r = await cutOut(newtabBg, (stage) => { status.textContent = t('ct.' + stage); });
      if (!r.usable) { status.textContent = t('ct.unusable'); return; }
      await setRaw({ newtabFg: r.dataUrl }); sync(true); status.textContent = t('ct.done');
    } catch { status.textContent = t('ct.error'); } finally { make.disabled = false; }
  });
  remove.addEventListener('click', async () => { await chrome.storage.local.remove('newtabFg'); sync(false); status.textContent = ''; });
  return h('div', { class: 'stack gap-2', style: { marginTop: 'var(--s-4)' } }, h('div', { class: 'eyebrow', text: t('ct.title') }), h('p', { class: 'muted', style: { fontSize: 'var(--fs-sm)' }, text: t('ct.hint') }), h('div', { class: 'row gap-2' }, make, remove), status);
}

function drawDrawer() {
  const body = $('#drawerBody'), n = settings.newtab;
  const set = (fn) => updateSettings((s) => { fn({ ...s, newtab: home(s) }); }); // edits go to the layout in use

  const fileIn = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { await setRaw({ newtabBg: await fileToDataUrl(f) }); await chrome.storage.local.remove('newtabFg'); await set((s) => { s.newtab.background = 'photo'; }); await applyBackground(); toast(t('home.photoSaved')); } catch { toast(t('common.error')); }
  } });

  const tiles = [...BACKGROUNDS, 'photo'].map((id) => h('button', { class: 'bg-tile', type: 'button', 'aria-pressed': String(n.background === id), onclick: async () => {
    if (id === 'photo') { const { newtabBg } = await getRaw('newtabBg'); if (!newtabBg) { fileIn.click(); return; } }
    await set((s) => { s.newtab.background = id; });
  } }, h('i', { class: 'bgx-' + (id === 'photo' ? 'plain' : id), style: id === 'photo' ? { background: 'repeating-linear-gradient(45deg, var(--surface-2), var(--surface-2) 6px, var(--surface-3) 6px, var(--surface-3) 12px)' } : id === 'color' ? { '--bg-color': normalizeHex(n.bgColor) || '#e9e4ff' } : {} }), h('span', { text: t('bg.' + id) })));

  const colorIn = h('label', { class: 'row gap-2', style: { marginTop: 'var(--s-3)' } }, h('span', { class: 'muted-2', text: t('home.bgColor') }),
    h('input', { type: 'color', value: normalizeHex(n.bgColor) || '#e9e4ff', 'aria-label': t('home.bgColor'), onchange: (e) => set((s) => { s.newtab.bgColor = e.target.value; s.newtab.background = 'color'; }) }));

  const seg = (label, list, value, key, keyPrefix) => h('div', { class: 'segmented wrap-seg', role: 'group', 'aria-label': label },
    list.map((v) => h('button', { type: 'button', 'aria-pressed': String(v === value), text: t(keyPrefix + v), onclick: () => set((s) => { s.newtab[key] = v; }) })));

  const depth = normalizeDepth(n.depth);
  const depthToggle = (label, on, patch) => h('label', { class: 'toggle-row' }, h('span', { text: label }), h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked: on, 'aria-label': label, onchange: (e) => set((s) => { s.newtab.depth = { ...normalizeDepth(s.newtab.depth), ...patch(e.target.checked) }; }) }), h('span', { class: 'track' }), h('span', { class: 'thumb' })));
  const order = moduleOrder(n);
  const move = (m, d) => set((s) => { const o = moduleOrder(s.newtab); const i = o.indexOf(m), j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; s.newtab.order = o; });
  const modRows = order.map((m, i) => h('div', { class: 'toggle-row mod-row' },
    h('span', { class: 'grow', text: t('mod.' + m) }),
    h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', disabled: i === 0, 'aria-label': t('home.moveUp') + ': ' + t('mod.' + m), onclick: () => move(m, -1) }, icon('arrow-up')),
    h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', disabled: i === order.length - 1, 'aria-label': t('home.moveDown') + ': ' + t('mod.' + m), onclick: () => move(m, 1) }, icon('arrow-down')),
    h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked: !!n.modules[m], 'aria-label': t('mod.' + m), onchange: (e) => set((s) => { s.newtab.modules[m] = e.target.checked; }) }), h('span', { class: 'track' }), h('span', { class: 'thumb' }))));

  const clockSeg = h('div', { class: 'segmented', role: 'group', 'aria-label': t('home.clockFormat') }, [[null, 'home.clockAuto'], [false, 'home.clock12'], [true, 'home.clock24']].map(([v, k]) => h('button', { type: 'button', 'aria-pressed': String(n.clock24 === v), text: t(k), onclick: () => set((s) => { s.newtab.clock24 = v; }) })));

  const section = (title, ...kids) => h('div', {}, h('h4', { text: title }), ...kids);
  clear(body,
    section(t('cv.edit'), h('p', { class: 'muted', style: { marginBottom: 'var(--s-3)' }, text: t('cv.drawerHint') }), h('button', { class: 'btn btn-primary', type: 'button', onclick: openEditor }, icon('move'), t('cv.edit'))),
    section(t('th.title'), themeBlock()),
    section(t('ap.looks'), looksGallery(settings.appearance, { compact: true, onPick: (id) => set((s) => { s.appearance.look = id; if (s.newtab.background === 'dawn') s.newtab.background = 'look'; }) })),
    section(t('home.accent'), accentPicker(settings.appearance, (v) => set((s) => { s.appearance.accent = v; }))),
    section(t('home.background'), h('div', { class: 'bg-grid' }, tiles), fileIn,
      n.background === 'color' ? null : colorIn,
      n.background === 'photo' ? h('button', { class: 'btn btn-sm', style: { marginTop: 'var(--s-3)' }, type: 'button', onclick: () => fileIn.click() }, icon('image'), t('home.changePhoto')) : null,
      n.background === 'photo' ? cutoutBlock() : null),
    section(t('dp.title'), h('p', { class: 'muted', style: { fontSize: 'var(--fs-sm)', marginBottom: 'var(--s-2)' }, text: t('dp.hint') }),
      depthToggle(t('dp.on'), depth.on, (v) => ({ on: v })), depthToggle(t('dp.parallax'), depth.parallax, (v) => ({ parallax: v })),
      h('label', { class: 'toggle-row' }, h('span', { text: t('dp.strength') }), h('input', { type: 'range', min: 0, max: 100, step: 5, value: depth.strength, 'aria-label': t('dp.strength'), disabled: !depth.on || !depth.parallax, style: { width: '140px', accentColor: 'var(--accent)' }, onchange: (e) => set((s) => { s.newtab.depth = { ...normalizeDepth(s.newtab.depth), strength: Number(e.target.value) }; }) }))),
    section(t('home.layout'), seg(t('home.layout'), LAYOUTS, n.layout, 'layout', 'layout.')),
    section(t('home.modules'), modRows),
    section(t('home.clock'), seg(t('home.clockStyle'), CLOCKS, n.clockStyle, 'clockStyle', 'clock.'), h('div', { style: { height: 'var(--s-3)' } }), clockSeg,
      h('label', { class: 'toggle-row', style: { marginTop: 'var(--s-3)' } }, h('span', { text: t('home.greeting') }), h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked: n.greeting, onchange: (e) => set((s) => { s.newtab.greeting = e.target.checked; }) }), h('span', { class: 'track' }), h('span', { class: 'thumb' })))),
    h('a', { class: 'btn', href: chrome.runtime.getURL('src/options/options.html#appearance') }, icon('palette'), t('home.moreAppearance')));
}

/* ---------- boot ---------- */

async function applySettings(rawIn, first = false) {
  rawSettings = rawIn;
  const s = resolveSettings(rawIn); // the layout that is on now, over the default
  const prevMods = settings ? JSON.stringify([settings.newtab.modules, settings.newtab.order]) : null;
  const prevLinks = settings ? JSON.stringify(settings.newtab.links) : null;
  settings = s;
  paintClock(); scheduleClock(); applyType(s); await applyBackground();
  const wEls = widgetHost.sync(s); // widgets: new / removed cards re-lay the grid, a changed setting only updates its card
  if (!first && (wEls.length !== widgetEls.length || wEls.some((e, i) => e !== widgetEls[i]))) { widgetEls = wEls; layoutModules(); }
  applyCanvas(s);
  if (!first) {
    if (JSON.stringify([s.newtab.modules, s.newtab.order]) !== prevMods) renderModules();
    else if (linksMod && JSON.stringify(s.newtab.links) !== prevLinks) linksMod.update(s);
    if (!$('#drawer').hidden) drawDrawer();
  }
}

/** Yesterday evening's plan becomes today's priorities (and stale plans are dropped). */
async function morningPlan() {
  const tasks = await getCollection('tasks', []);
  const r = applyPlans(tasks, dayKey());
  const rep = applyRepeats(r.tasks, dayKey(), (ms) => dayKey(new Date(ms))); // finished daily/weekly tasks that are due again
  if (r.changed || rep.changed) await setCollection('tasks', rep.tasks);
}

/** Single-key shortcuts (ignored while typing): the new tab is where work starts, so it should be drivable from the keyboard. */
const SHORTCUTS = [['Ctrl K', 'sc.palette'], ['f', 'sc.focus'], ['n', 'sc.task'], ['d', 'sc.closeDay'], ['c', 'sc.customize'], ['i', 'sc.insights'], ['s', 'sc.settings'], ['?', 'sc.help']];
function homeShortcuts(e) {
  if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.querySelector('dialog[open]') || !$('#drawer').hidden) return;
  const k = e.key;
  const go = (fn) => { e.preventDefault(); fn(); };
  if (k === 'f') go(() => { const el = document.querySelector('#focus input[id^="goal"]'); el?.scrollIntoView({ block: 'center' }); el?.focus(); });
  else if (k === 'n') go(() => { const el = document.querySelector('#mod-tasks input'); el?.scrollIntoView({ block: 'center' }); el?.focus(); });
  else if (k === 'd') go(openShutdown);
  else if (k === 'c') go(openDrawer);
  else if (k === 'i') go(() => { location.href = '../insights/insights.html'; });
  else if (k === 's') go(() => { location.href = '../options/options.html'; });
  else if (k === '?') go(openShortcutHelp);
}
function openShortcutHelp() {
  const dlg = h('dialog', { class: 'dialog' }, h('form', { method: 'dialog' },
    h('div', { class: 'dialog-body stack gap-3' }, h('h3', { text: t('sc.title') }),
      h('div', { class: 'sc-list' }, SHORTCUTS.map(([key, label]) => h('div', { class: 'sc-row' }, h('span', { class: 'kbd', text: key }), h('span', { text: t(label) }))))),
    h('div', { class: 'dialog-actions' }, h('button', { class: 'btn btn-primary', value: 'ok', text: t('common.close'), autofocus: true }))));
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg); dlg.showModal();
}

(async function main() {
  const s0 = await bootPage({ onSettings: (s) => applySettings(s) });
  rawSettings = s0; settings = resolveSettings(s0);
  if (s0.newtab.enabled === false) {
    // user switched the EyeTime new tab off: hand the tab back to the browser's own page
    try { const tab = await chrome.tabs.getCurrent(); await chrome.tabs.update(tab.id, { url: 'chrome://new-tab-page/' }); return; } catch { /* stay */ }
  }
  await morningPlan();
  installPalette({ extra: () => [{ group: 'focus', icon: 'calendar-clock', label: t('plan.title'), run: openDayPlan, keys: ['plan', 'schedule', 'day', 'blocks'] }, { group: 'go', icon: 'moon', label: t('sc.closeDay'), run: openShutdown, keys: ['shutdown', 'review', 'plan tomorrow'] }, { group: 'go', icon: 'move', label: t('cv.edit'), run: openEditor, keys: ['arrange', 'move', 'drag', 'layout', 'widgets'] }, { group: 'go', icon: 'sliders-horizontal', label: t('sc.customize'), run: openDrawer, keys: ['customize', 'layout', 'background', 'clock'] }] });
  paintClock(); scheduleClock(); applyType(settings); await applyBackground();
  let rz = 0; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { paintClock(); applyCanvas(settings); }, 120); });
  mountFocusCard($('#focus'), { variant: 'large' });
  mountRings($('#rings'));
  installSpotlight();
  mountWhatsNew($('#wn'));
  mountGettingStarted($('#gs'), { startShortSession: async () => { const s = await getSettings(); await send('focus:start', { minutes: 5, strict: false, scope: s.focus.scope }); } });
  paintNudge(); setInterval(paintNudge, 60_000); paintBackupNudge();
  onChange(['tasks', 'd:*'], paintNudge);
  renderModules();
  $('#customize').addEventListener('click', openDrawer);
  $('#moreMods').addEventListener('click', () => document.body.classList.toggle('show-mods'));
  $('#drawerClose').addEventListener('click', closeDrawer);
  $('#scrim').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', homeShortcuts);
  document.addEventListener('keydown', (e) => {
    if ($('#drawer').hidden) return;
    if (e.key === 'Escape') { closeDrawer(); return; }
    if (e.key !== 'Tab') return; // keep keyboard focus inside the open drawer
    const f = [...$('#drawer').querySelectorAll('button, input, a[href], select')].filter((el) => !el.disabled && el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  onChange(['newtabBg', 'newtabFg'], applyBackground);
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => setTimeout(applyBackground, 0));
  watchFocus();
})();
