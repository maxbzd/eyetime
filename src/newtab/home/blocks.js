// The blocks of Home: the modules (today, tasks, habits, notes, links), the widgets, and the skin of every card.

import { $, h, clear } from '../../ui/dom.js';
import { mountToday } from '../../ui/today-card.js';
import { tasksModule, habitsModule, notesModule, linksModule } from '../modules.js';
import { LOOKS } from '../../shared/looks.js';
import { normalizeSkin } from '../../shared/skins.js';
import { applyCanvas } from '../canvas.js';
import { createWidgetHost } from '../widgets.js';
import { moduleOrder } from '../home-rows.js';
import { paintSkin, skinEnv } from '../skin-apply.js';
import { state } from './state.js';

let linksMod = null, modEls = [], widgetEls = [];
const widgetHost = createWidgetHost();

/** What decides whether the blocks must be built again: the modules and their order, and the links. */
export const blocksSig = (s) => ({ mods: JSON.stringify([s.newtab.modules, s.newtab.order]), links: JSON.stringify(s.newtab.links) });

export function renderModules() {
  const on = state.settings.newtab.modules;
  modEls = [];
  linksMod = null;
  for (const id of moduleOrder(state.settings.newtab)) {
    if (!on[id]) continue;
    let el;
    if (id === 'today') { el = h('section', { class: 'card mod', id: 'mod-today' }); mountToday(el); }
    else if (id === 'tasks') el = tasksModule();
    else if (id === 'habits') el = habitsModule();
    else if (id === 'notes') el = notesModule();
    else { linksMod = linksModule(state.settings); el = linksMod.el; }
    modEls.push(el);
  }
  widgetEls = widgetHost.sync(state.settings);
  layoutModules();
  applyCanvas(state.settings);
}

/** A flat bento grid (see newtab.css): the saved order is the reading order, rows share one height. */
function layoutModules() { clear($('#modules'), [...modEls, ...widgetEls]); }

/** The settings changed: new or removed widget cards re-lay the grid (a changed setting only updates its card), then modules, links and canvas follow. `prev` is `blocksSig` of the settings before. */
export function syncBlocks(s, first, prev) {
  const wEls = widgetHost.sync(s);
  if (!first && (wEls.length !== widgetEls.length || wEls.some((e, i) => e !== widgetEls[i]))) { widgetEls = wEls; layoutModules(); }
  applyCanvas(s);
  if (!first && prev) {
    const now = blocksSig(s);
    if (now.mods !== prev.mods) renderModules();
    else if (linksMod && now.links !== prev.links) linksMod.update(s);
  }
}

/** The skin of every card on Home: the theme's (newtab.dna), or the widget's own. */
export function applySkins() {
  const dna0 = normalizeSkin(state.settings.newtab.dna), lookSkin = LOOKS[state.settings.appearance.look]?.skin, dna = dna0 && dna0.s !== 'look' ? dna0 : lookSkin ? { s: lookSkin } : dna0, own = new Map((state.settings.newtab.widgets || []).map((w) => [`wgt-${w.id}`, w.skin]));
  const env = skinEnv();
  for (const el of document.querySelectorAll('main.nt #focus, main.nt .card.mod, main.nt .wgt:not(.wgt-preview)')) paintSkin(/** @type {HTMLElement} */ (el), own.get(el.id) || dna, env);
}
