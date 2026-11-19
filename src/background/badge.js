// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Toolbar badge: minutes left while a focus session runs, otherwise today's screen time.

import { getRaw, dayStorageKey } from '../shared/storage.js';
import { dayKey } from '../shared/time.js';
import { isFocusActive } from '../shared/blocking.js';
import { remainingMs, isPaused } from '../shared/focus.js';
import { fmtDuration, resolveLocale, setLocale, t } from '../shared/i18n.js';

const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);

export function compact(sec) {
  const m = Math.floor(sec / 60), h = Math.floor(m / 60);
  if (sec < 60) return '';
  if (h === 0) return `${m}m`;
  return h >= 10 ? `${h}h` : `${h}h${String(m % 60).padStart(2, '0')}`;
}

/** What the toolbar shows now; a call that would show the same again does nothing (the tracker asks about twice a minute, and each of the four settings is a message to the browser). */
let shown = '';
async function apply({ text, bg, fg, title }) {
  const sig = [text, bg, fg, title].join('\u0001');
  if (sig === shown) return;
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color: bg });
  await chrome.action.setBadgeTextColor?.({ color: fg });
  await chrome.action.setTitle({ title });
  shown = sig;
}

export async function updateBadge(settings) {
  const dk = dayStorageKey(dayKey());
  const raw = await getRaw(['focus', 'rest', dk]);
  await setLocale(resolveLocale(settings.language));

  if (raw.focus && isPaused(raw.focus)) {
    return apply({ text: 'II', bg: '#78716c', fg: '#ffffff', title: t('badge.pausedTitle') + (raw.focus.goal ? ` — ${raw.focus.goal}` : '') });
  }
  if (isFocusActive(raw.focus)) {
    const min = Math.ceil(remainingMs(raw.focus) / 60000);
    // focus: ink with a amber count, like the countdown on Home
    return apply({ text: String(min), bg: '#171612', fg: '#f2c14e', title: t('badge.focusTitle', { n: min }) + (raw.focus.goal ? ` — ${raw.focus.goal}` : '') });
  }
  if (raw.rest && Date.now() < raw.rest.endsAt) {
    const min = Math.ceil((raw.rest.endsAt - Date.now()) / 60000);
    return apply({ text: String(min), bg: '#1f7a52', fg: '#ffffff', title: t('rest.badgeTitle', { n: min }) });
  }
  const day = raw[dk] || {};
  const total = sum(day.d) + sum(day.a);
  return apply({ text: settings.tracking.badge ? compact(total) : '', bg: '#57534e', fg: '#ffffff', title: total >= 60 ? t('badge.todayTitle', { time: fmtDuration(total) }) : t('badge.defaultTitle') });
}
