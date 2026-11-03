// The running session on the page: the tab title shows the countdown, and a focus layout switches on while one runs.

import { getRaw, onChange } from '../../shared/storage.js';
import { clock, remainingMs, isPaused } from '../../shared/focus.js';
import { isFocusActive, isFocusLive } from '../../shared/blocking.js';
import { setFocusing } from '../home-config.js';
import { checkLayout } from './layout-watch.js';
import { state } from './state.js';

/** While a session runs the tab title shows the countdown, so it is visible from other tabs. */
function paintTitle() {
  document.title = state.runningFocus && isFocusActive(state.runningFocus) ? `${clock(remainingMs(state.runningFocus))} · EyeTime` : state.runningFocus && isPaused(state.runningFocus) ? `⏸ ${clock(remainingMs(state.runningFocus))} · EyeTime` : 'EyeTime';
}
export async function watchFocus() {
  const sync = async () => { state.runningFocus = (await getRaw('focus')).focus; paintTitle(); setFocusing(!!state.runningFocus && isFocusLive(state.runningFocus)); checkLayout(); }; // a paused session keeps the focus layout
  await sync();
  onChange('focus', sync);
  setInterval(() => { paintTitle(); const on = !!state.runningFocus && isFocusLive(state.runningFocus); setFocusing(on); checkLayout(); }, 1000);
}
