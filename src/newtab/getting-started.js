// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// "Get started" checklist on Home for the first days: four small steps that make the product click (a first session, teaching it what
// distracts you, a task, the command palette). Steps tick themselves from real state; the card disappears when done or dismissed.

import { h, icon, clear } from '../ui/dom.js';
import { t } from '../shared/i18n.js';
import { getSettings, getRaw, setRaw, getDays, getCollection, onChange } from '../shared/storage.js';
import { rangeKeys } from '../shared/time.js';
import { isFocusLive } from '../shared/blocking.js';

const MAX_AGE_DAYS = 21; // after three weeks the card is noise, whatever was ticked

/** Which steps are done. Pure: easy to test. */
/** `taught`: the person already said what distracts them (the second screen of the first run does it). */
export function stepsState({ days, settings, tasks, paletteUsed, taught = false }) {
  return {
    focus: days.some(([, d]) => (d?.fs || 0) > 0 || (d?.ss || []).length > 0),
    classify: Object.keys(settings.sites || {}).length > 0 || !!taught,
    task: (tasks || []).length > 0,
    palette: !!paletteUsed,
  };
}

/** Put the cursor in the task field. On Today the tasks live in the side panel, which has to be opened first (the field stays hidden until then); when no field can be shown, the palette takes the task. */
function addTaskHere() {
  const btn = /** @type {HTMLElement | null} */ (document.querySelector('#tdPanelBtn'));
  if (btn && btn.offsetParent !== null && !document.body.classList.contains('td-panel')) btn.click();
  document.body.classList.add('show-mods');
  setTimeout(() => {
    const i = /** @type {HTMLInputElement | null} */ (document.querySelector('#mod-tasks input'));
    if (!i || i.offsetParent === null) { window.dispatchEvent(new window.CustomEvent('et:palette')); return; }
    i.scrollIntoView({ block: 'center' }); i.focus();
  }, 250);
}

export async function mountGettingStarted(el, { startShortSession }) {
  let shown = ''; // what is on screen now: skip identical repaints (the tracker writes day records every few seconds)
  async function paint() {
    const [{ gsDismissed, meta, focus, obFirst }, settings, tasks, days] = await Promise.all([getRaw(['gsDismissed', 'meta', 'focus', 'obFirst']), getSettings(), getCollection('tasks', []), getDays(rangeKeys(60))]);
    const born = (meta && meta.installedAt) || Date.now();
    let paletteUsed = false; try { paletteUsed = localStorage.getItem('et-palette-used') === '1'; } catch { /* ignore */ }
    if (isFocusLive(focus)) { el.hidden = true; shown = ''; return; } // while a session runs the page is the session's: the list waits until it ends
    const s = stepsState({ days, settings, tasks, paletteUsed, taught: !!(obFirst && obFirst.sid) });
    const done = Object.values(s).filter(Boolean).length;
    if (gsDismissed || done === 4 || Date.now() - born > MAX_AGE_DAYS * 86_400_000) { el.hidden = true; shown = ''; return; }
    const sig = JSON.stringify(s);
    if (sig === shown && !el.hidden) return;
    shown = sig; el.hidden = false;
    el.classList.toggle('gs-compact', done >= 1); // after the first step the card shrinks to what is left, so tasks and notes stay on screen
    const step = (key, ico, action) => h('li', { class: 'gs-step' + (s[key] ? ' done' : '') },
      h('span', { class: 'gs-mark', 'aria-hidden': 'true' }, s[key] ? icon('check') : icon(ico)),
      h('div', { class: 'gs-text' }, h('b', { text: t('gs.' + key) }), h('span', { text: t('gs.' + key + 'D') })),
      !s[key] && action ? h('button', { class: 'btn btn-sm', type: 'button', onclick: action.run }, action.label) : null);
    clear(el,
      h('div', { class: 'gs-head' }, h('h2', { id: 'gsTitle', text: t('gs.title') }), h('span', { class: 'gs-count num', text: `${done}/4` }),
        h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': t('gs.dismiss'), 'data-tip': t('gs.dismiss'), onclick: async () => { await setRaw({ gsDismissed: true }); el.hidden = true; } }, icon('x'))),
      h('ol', { class: 'gs-list' },
        step('focus', 'play', { label: t('gs.tryFocus'), run: startShortSession }),
        step('classify', 'tag', { label: t('gs.openSites'), run: () => { try { localStorage.setItem('et-itab', 'sites'); } catch { /* ignore */ } location.href = '../insights/insights.html'; } }),
        step('task', 'list-plus', { label: t('gs.addTask'), run: () => addTaskHere() }),
        step('palette', 'search', { label: t('gs.openPalette'), run: () => window.dispatchEvent(new window.CustomEvent('et:palette')) })));
  }
  await paint();
  onChange(['tasks', 'd:*', 'settings', 'focus', 'obFirst'], paint);
  window.addEventListener('et:palette-used', paint);
  return { paint };
}
