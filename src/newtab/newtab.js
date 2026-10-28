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
import { applyCanvas, canvasActive } from './canvas.js';
import { applyType, clockSeconds, alignClockFill } from './type-apply.js';
import { createWidgetHost } from './widgets.js';
import { applyDepth } from './depth.js';
import { BACKGROUNDS, CLOCKS, LAYOUTS, backgroundControls, depthControls, lookControls, accentControls, clockFormatControls } from './home-controls.js';
import { themeBlock } from './theme-io.js';
import { resolveSettings, wantedLayout, activeLayoutId, editingLayoutId, setFocusing, home } from './home-config.js';
import { downloadBackup, needsBackup } from '../ui/backup.js';
import { send } from '../ui/api.js';
import { setCollection } from '../shared/storage.js';
import { dayKey } from '../shared/time.js';
import { LOOKS } from '../shared/looks.js';
import { fmtDuration } from '../shared/i18n.js';
import { clock, remainingMs, isPaused } from '../shared/focus.js';
import { isFocusActive, isFocusLive } from '../shared/blocking.js';
import { luminance, normalizeHex } from '../shared/color.js';
import { resolveTextTone } from '../shared/phototone.js';
import { getPhotoInfo, clearPhotoInfo } from './photo-info.js';
import { showQuote } from '../ui/quote.js';
import { mountStandby } from './standby.js';

const DARK_SCENES = ['aurora', 'stars', 'photo', 'sea', 'onyx', 'peaks'];
const MODULES = ['today', 'tasks', 'habits', 'notes', 'links'];
/** Saved order, completed with any module it does not mention (new modules, hand-edited backups). */
const moduleOrder = (n) => [...new Set([...(n.order || []).filter((m) => MODULES.includes(m)), ...MODULES])];
let settings, rawSettings, linksMod, standby;

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
  showQuote($('#quote'), 'day', settings);
  alignClockFill();
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
  document.title = runningFocus && isFocusActive(runningFocus) ? `${clock(remainingMs(runningFocus))} · EyeTime` : runningFocus && isPaused(runningFocus) ? `⏸ ${clock(remainingMs(runningFocus))} · EyeTime` : 'EyeTime';
}
async function watchFocus() {
  const sync = async () => { runningFocus = (await getRaw('focus')).focus; paintTitle(); setFocusing(!!runningFocus && isFocusLive(runningFocus)); checkLayout(); }; // a paused session keeps the focus layout
  await sync();
  onChange('focus', sync);
  setInterval(() => { paintTitle(); const on = !!runningFocus && isFocusLive(runningFocus); setFocusing(on); checkLayout(); }, 1000);
}

/* ---------- day-loop nudge: one gentle prompt (plan · review · goal) ---------- */

const nudgeOff = (kind) => { try { return localStorage.getItem('et-nudge-off') === dayKey() + ':' + kind; } catch { return false; } };
async function paintNudge() {
  const el = $('#nudge');
  const [[, day]] = await getDays([dayKey()]);
  const tasks = (await getCollection('tasks', [])).filter((x) => !x.done);
  const kind = pickNudge({ now: new Date(), fsSec: day?.fs || 0, goalMin: settings.focus.dailyGoal, openTasks: tasks.length, starred: tasks.filter((x) => x.starred).length, sessionsToday: (day?.ss || []).length });
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
  let scene = bg, photoTone = null;
  if (bg === 'photo') {
    const { newtabBg } = await getRaw('newtabBg');
    if (newtabBg) {
      const info = await getPhotoInfo(newtabBg);
      document.documentElement.style.setProperty('--photo', `url(${newtabBg})`);
      if (info.soft) document.documentElement.style.setProperty('--photo-soft', `url(${info.soft})`);
      photoTone = n.photoText === 'light' || n.photoText === 'dark' ? n.photoText : info.tone;
    } else bg = 'look';
    const { newtabFg } = bg === 'photo' ? await getRaw('newtabFg') : {};
    if (newtabFg) { document.documentElement.style.setProperty('--photo-mask', `url(${newtabFg})`); scene = 'photo-cut'; } // the cut-out subject: a masked copy of the photo goes in front of the clock
  }
  if (bg !== 'photo') { clearPhotoInfo(); document.documentElement.style.removeProperty('--photo'); document.documentElement.style.removeProperty('--photo-soft'); } // the glass / photo clock falls back to a plain fill
  const color = normalizeHex(n.bgColor) || '#e9e4ff';
  if (bg === 'color') document.documentElement.style.setProperty('--bg-color', color);
  document.body.dataset.bg = bg;
  $('.bg').className = 'bg bgx-' + bg;
  applyDepth(settings, scene);
  // light hero text on scenes that are dark in every theme, and on dark custom colours; a photo follows the person's choice or its own brightness
  document.body.dataset.tone = photoTone && bg === 'photo' ? (resolveTextTone(n.photoText, photoTone) === 'dark' ? 'light' : 'dark') : DARK_SCENES.includes(bg) || (bg === 'color' && luminance(color) < 0.28) ? 'dark' : '';
  alignClockFill();
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

function drawDrawer() {
  const body = $('#drawerBody'), n = settings.newtab;
  const set = (fn) => updateSettings((s) => { fn({ ...s, newtab: home(s) }); }); // edits go to the layout in use

  const seg = (label, list, value, key, keyPrefix) => h('div', { class: 'segmented wrap-seg', role: 'group', 'aria-label': label },
    list.map((v) => h('button', { type: 'button', 'aria-pressed': String(v === value), text: t(keyPrefix + v), onclick: () => set((s) => { s.newtab[key] = v; }) })));

  const order = moduleOrder(n);
  const move = (m, d) => set((s) => { const o = moduleOrder(s.newtab); const i = o.indexOf(m), j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; s.newtab.order = o; });
  const modRows = order.map((m, i) => h('div', { class: 'toggle-row mod-row' },
    h('span', { class: 'grow', text: t('mod.' + m) }),
    h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', disabled: i === 0, 'aria-label': t('home.moveUp') + ': ' + t('mod.' + m), onclick: () => move(m, -1) }, icon('arrow-up')),
    h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', disabled: i === order.length - 1, 'aria-label': t('home.moveDown') + ': ' + t('mod.' + m), onclick: () => move(m, 1) }, icon('arrow-down')),
    h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked: !!n.modules[m], 'aria-label': t('mod.' + m), onchange: (e) => set((s) => { s.newtab.modules[m] = e.target.checked; }) }), h('span', { class: 'track' }), h('span', { class: 'thumb' }))));

  const section = (title, ...kids) => h('div', {}, h('h4', { text: title }), ...kids);
  const [clockSeg, greeting] = clockFormatControls(n, set);
  clear(body,
    section(t('cv.edit'), h('p', { class: 'muted', style: { marginBottom: 'var(--s-3)' }, text: t('cv.drawerHint') }), h('button', { class: 'btn btn-primary', type: 'button', onclick: openEditor }, icon('move'), t('cv.edit'))),
    section(t('th.title'), themeBlock()),
    section(t('ap.looks'), ...lookControls(settings, set)),
    section(t('home.accent'), ...accentControls(settings, set)),
    section(t('home.background'), ...backgroundControls(n, set)),
    section(t('dp.title'), ...depthControls(n, set)),
    section(t('home.layout'), seg(t('home.layout'), LAYOUTS, n.layout, 'layout', 'layout.')),
    section(t('home.modules'), modRows),
    section(t('home.clock'), seg(t('home.clockStyle'), CLOCKS, n.clockStyle, 'clockStyle', 'clock.'), h('div', { style: { height: 'var(--s-3)' } }), clockSeg, greeting),
    h('a', { class: 'btn', href: chrome.runtime.getURL('src/options/options.html#appearance') }, icon('palette'), t('home.moreAppearance')));
}

/* ---------- boot ---------- */

let homeOff; // whether this page was opened with the home page switched off
async function applySettings(rawIn, first = false) {
  if (homeOff !== undefined && homeOff !== (rawIn.newtab.enabled === false)) { location.reload(); return; } // switched on or off in another tab: show the other page
  rawSettings = rawIn;
  const s = resolveSettings(rawIn); // the layout that is on now, over the default
  const prevMods = settings ? JSON.stringify([settings.newtab.modules, settings.newtab.order]) : null;
  const prevLinks = settings ? JSON.stringify(settings.newtab.links) : null;
  settings = s;
  standby?.rearm?.();
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

/** The home page is switched off: an empty, quiet page with one way back. */
function renderOff() {
  $('main.nt').hidden = true; $('#customize').hidden = true;
  document.body.append(h('div', { class: 'nt-off', role: 'main' }, h('h1', { text: t('home.offTitle') }), h('p', { class: 'muted', text: t('home.offBody') }),
    h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => { await updateSettings((x) => { x.newtab.enabled = true; }); location.reload(); } }, icon('check'), t('home.turnOn'))));
}

(async function main() {
  const s0 = await bootPage({ onSettings: (s) => applySettings(s) });
  rawSettings = s0; settings = resolveSettings(s0);
  homeOff = s0.newtab.enabled === false;
  if (s0.newtab.enabled === false) { renderOff(); return; } // a browser never lets an extension hand the tab back: it stays empty and quiet
  await morningPlan();
  installPalette({ extra: () => [{ group: 'go', icon: 'moon', label: t('sb.now'), run: () => window.dispatchEvent(new window.CustomEvent('et:standby')), keys: ['night', 'clock', 'standby', 'sleep'] }, { group: 'focus', icon: 'calendar-clock', label: t('plan.title'), run: openDayPlan, keys: ['plan', 'schedule', 'day', 'blocks'] }, { group: 'go', icon: 'moon', label: t('sc.closeDay'), run: openShutdown, keys: ['shutdown', 'review', 'plan tomorrow'] }, { group: 'go', icon: 'move', label: t('cv.edit'), run: openEditor, keys: ['arrange', 'move', 'drag', 'layout', 'widgets'] }, { group: 'go', icon: 'sliders-horizontal', label: t('sc.customize'), run: openDrawer, keys: ['customize', 'layout', 'background', 'clock'] }] });
  paintClock(); scheduleClock(); applyType(settings); await applyBackground();
  let rz = 0; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { paintClock(); applyCanvas(settings); }, 120); });
  mountFocusCard($('#focus'), { variant: 'large' });
  standby = mountStandby({ getSettings: () => settings, getFocus: () => runningFocus });
  if (new URLSearchParams(location.search).has('standby')) standby.show();
  mountRings($('#rings'));
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
