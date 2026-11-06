// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The focus-session control, shared by the popup (compact) and the new tab (large).
// It owns its own state: it reads settings + the running session from storage and re-renders on change. See session.js (state, actions), idle.js and running.js (views).

import { clear } from '../dom.js';
import { onChange } from '../../shared/storage.js';
import { isPaused } from '../../shared/focus.js';
import { createSession } from './session.js';
import { renderIdle } from './idle.js';
import { renderRunning } from './running.js';

/** @param {HTMLElement} root @param {{ variant?: 'compact' | 'large' }} [o] */
export function mountFocusCard(root, { variant = 'compact' } = {}) {
  const ctx = createSession(root, { large: variant === 'large' }), { st } = ctx;

  function render() {
    clearInterval(ctx.tickId);
    root.classList.toggle('is-running', !!st.focus);
    root.classList.toggle('is-resting', !!st.rest);
    st.focus ? renderRunning(ctx) : st.rest ? renderRunning(ctx, true) : renderIdle(ctx);
  }
  async function refresh() { await ctx.load(); render(); }
  ctx.render = render; ctx.refresh = refresh;

  refresh();
  const off = onChange(['focus', 'rest', 'settings', 'review', 'tasks', 'calendar', 'calendarDays', 'd:*'], async () => {
    const state = () => !!st.focus + ':' + !!st.rest + ':' + isPaused(st.focus); // running, paused and idle each get their own view
    const was = state();
    await ctx.load();
    if (was !== state() || (!st.focus && !st.rest && !root.contains(document.activeElement))) render();
  });
  return { refresh, destroy() { off(); clearInterval(ctx.tickId); clear(root); } };
}
