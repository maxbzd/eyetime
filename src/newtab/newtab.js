// Home (the new tab page): boots the page and keeps it in step with the settings. The parts live in ./home/:
//   state · hero (clock, date, greeting, quote) · background · blocks (modules, widgets, skins) · parts (the focus line or card) · nudges · drawer (customize + editor)
//   focus-watch (tab title, focus layout) · layout-watch · shortcuts · palette. This file only decides what to do when the settings change.

import { bootPage } from '../ui/page.js';
import { $, h, icon } from '../ui/dom.js';
import { t } from '../shared/i18n.js';
import { getSettings, updateSettings, setCollection, getCollection, onChange } from '../shared/storage.js';
import { applyPlans } from '../shared/productivity.js';
import { applyRepeats } from '../shared/tasks.js';
import { dayKey } from '../shared/time.js';
import { send } from '../ui/api.js';
import { mountGettingStarted } from './getting-started.js';
import { mountWhatsNew } from './whatsnew.js';
import { mountRings } from './rings.js';
import { applyCanvas } from './canvas.js';
import { applyType } from './type-apply.js';
import { resolveSettings } from './home-config.js';
import { mountStandby } from './standby.js';
import { autoGuess } from '../ui/siteai.js';
import { state, isToday } from './home/state.js';
import { paintClock, scheduleClock } from './home/hero.js';
import { applyBackground, applyWeatherFx } from './home/background.js';
import { renderModules, syncBlocks, blocksSig, applySkins } from './home/blocks.js';
import { mountHome, installPanel } from './home/parts.js';
import { paintNudge, paintBackupNudge } from './home/nudges.js';
import { installDrawer, drawDrawer } from './home/drawer.js';
import { installShortcuts } from './home/shortcuts.js';
import { installHomePalette } from './home/palette.js';
import { watchFocus } from './home/focus-watch.js';
import { track } from '../shared/usage-store.js';

let homeOff; // whether this page was opened with the home page switched off

async function applySettings(rawIn, first = false) {
  if (homeOff !== undefined && homeOff !== (rawIn.newtab.enabled === false)) { location.reload(); return; } // switched on or off in another tab: show the other page
  state.raw = rawIn;
  const s = resolveSettings(rawIn); // the layout that is on now, over the default
  const prev = state.settings ? blocksSig(state.settings) : null;
  state.settings = s;
  if (state.todayOn !== undefined && state.todayOn !== isToday(s)) mountHome(); // Today ⇄ another arrangement: the focus parts of the page change in place
  state.standby?.rearm?.();
  paintClock(); scheduleClock(); applyType(s); await applyBackground();
  syncBlocks(s, first, prev);
  if (!first && !$('#drawer').hidden) drawDrawer();
  applySkins();
}
state.reapply = () => applySettings(state.raw);

/** Yesterday evening's plan becomes today's priorities (and stale plans are dropped). */
async function morningPlan() {
  const tasks = await getCollection('tasks', []);
  const r = applyPlans(tasks, dayKey());
  const rep = applyRepeats(r.tasks, dayKey(), (ms) => dayKey(new Date(ms))); // finished daily/weekly tasks that are due again
  if (r.changed || rep.changed) await setCollection('tasks', rep.tasks);
}

/** The home page is switched off: an empty, quiet page with one way back. */
function renderOff() {
  $('main.nt').hidden = true; $('#customize').hidden = true;
  document.body.append(h('div', { class: 'nt-off', role: 'main' }, h('h1', { text: t('home.offTitle') }), h('p', { class: 'muted', text: t('home.offBody') }),
    h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => { await updateSettings((x) => { x.newtab.enabled = true; }); location.reload(); } }, icon('check'), t('home.turnOn'))));
}

(async function main() {
  const s0 = await bootPage({ onSettings: (s) => applySettings(s) });
  state.raw = s0; state.settings = resolveSettings(s0);
  homeOff = s0.newtab.enabled === false;
  if (homeOff) { renderOff(); return; } // a browser never lets an extension hand the tab back: it stays empty and quiet
  track('newtab_view');
  await morningPlan();
  installHomePalette();
  paintClock(); scheduleClock(); applyType(state.settings); await applyBackground();
  let rz = 0; window.addEventListener('resize', () => { clearTimeout(rz); rz = window.setTimeout(() => { paintClock(); applyCanvas(state.settings); }, 120); });
  mountHome(); installPanel();
  setTimeout(() => autoGuess().catch(() => {}), 5000); // experimental, off by default: the on-device model learns about the few most used unknown sites
  setInterval(() => applyWeatherFx(), 10 * 60_000); onChange(['weatherCache'], () => applyWeatherFx());
  state.standby = mountStandby({ getSettings: () => state.settings, getFocus: () => state.runningFocus });
  if (new URLSearchParams(location.search).has('standby')) state.standby.show();
  mountRings($('#rings'));
  mountWhatsNew($('#wn'));
  mountGettingStarted($('#gs'), { startShortSession: async () => { const s = await getSettings(); await send('focus:start', { minutes: 5, strict: false, scope: s.focus.scope }); } });
  paintNudge(); setInterval(paintNudge, 60_000); paintBackupNudge();
  onChange(['tasks', 'd:*'], paintNudge);
  renderModules(); applySkins();
  installDrawer(); installShortcuts();
  $('#moreMods').addEventListener('click', () => document.body.classList.toggle('show-mods'));
  onChange(['newtabBg', 'newtabFg', 'newtabDepth'], applyBackground);
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => setTimeout(applyBackground, 0));
  watchFocus();
})();
