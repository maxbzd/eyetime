// Which layout of Home is on: checked every few seconds and when a focus session starts or ends.

import { wantedLayout, activeLayoutId, editingLayoutId } from '../home-config.js';
import { state } from './state.js';

/** A layout that switches on by itself (during focus, or at certain hours) takes over when its moment comes. */
export function checkLayout() {
  if (state.raw && !editingLayoutId() && wantedLayout(state.raw) !== activeLayoutId()) state.reapply();
}
