// What answers "what is your focus": on Today a line under the clock and two tiles in the corners, on the other arrangements the focus card.
// The arrangement can change while the page is open (a ready theme, the editor), so the parts are mounted and taken down here without a reload.

import { $ } from '../../ui/dom.js';
import { mountFocusCard } from '../../ui/focus-card.js';
import { mountFocusLine } from '../today/focusline.js';
import { mountGlance } from '../today/glance.js';
import { state, isToday } from './state.js';

let homeParts = null; // what is mounted for the arrangement in use, so it can be swapped without a reload
/** Mount the focus parts of the arrangement in use (Today: the line and the corner tiles; otherwise the focus card). */
export function mountHome() {
  homeParts?.destroy();
  state.todayOn = isToday(state.settings);
  document.body.classList.remove('td-panel'); $('#tdPanelBtn')?.setAttribute('aria-expanded', 'false');
  if (state.todayOn) {
    $('#focus').className = 'fl'; // not a card: one line under the clock
    const line = mountFocusLine($('#focus'), $('#countdown')), glance = mountGlance($('#tdGlance'));
    homeParts = { destroy() { line.destroy(); glance.destroy(); } };
  } else {
    $('#focus').className = 'card focus-card';
    $('#countdown').hidden = true; $('#tdGlance').hidden = true;
    const card = mountFocusCard($('#focus'), { variant: 'large' });
    homeParts = { destroy() { card.destroy(); $('#focus').className = 'card focus-card'; } };
  }
}

/** Today's side panel (tasks, habits, notes): the button, Escape and the "n" shortcut open and close it (called once, when the page boots). */
export function installPanel() {
  const panel = (open) => { document.body.classList.toggle('td-panel', open); $('#tdPanelBtn').setAttribute('aria-expanded', String(open)); };
  $('#tdPanelBtn').addEventListener('click', () => panel(!document.body.classList.contains('td-panel')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.todayOn && document.body.classList.contains('td-panel') && $('#drawer').hidden) panel(false); });
  window.addEventListener('et:open-panel', () => { if (state.todayOn) panel(true); });
}
