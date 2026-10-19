// Toolbar badge: minutes left while a focus session runs, otherwise today's screen time.

import { getRaw, dayStorageKey } from '../shared/storage.js';
import { dayKey } from '../shared/time.js';
import { isFocusActive } from '../shared/blocking.js';
import { remainingMs } from '../shared/focus.js';
import { fmtDuration, resolveLocale, setLocale, t } from '../shared/i18n.js';

const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);

export function compact(sec) {
  const m = Math.floor(sec / 60), h = Math.floor(m / 60);
  if (sec < 60) return '';
  if (h === 0) return `${m}m`;
  return h >= 10 ? `${h}h` : `${h}h${String(m % 60).padStart(2, '0')}`;
}

export async function updateBadge(settings) {
  const dk = dayStorageKey(dayKey());
  const raw = await getRaw(['focus', 'rest', dk]);
  setLocale(resolveLocale(settings.language));

  if (isFocusActive(raw.focus)) {
    const min = Math.ceil(remainingMs(raw.focus) / 60000);
    await chrome.action.setBadgeText({ text: String(min) });
    await chrome.action.setBadgeBackgroundColor({ color: '#cf450a' });
    await chrome.action.setBadgeTextColor?.({ color: '#ffffff' });
    await chrome.action.setTitle({ title: t('badge.focusTitle', { n: min }) + (raw.focus.goal ? ` — ${raw.focus.goal}` : '') });
    return;
  }
  if (raw.rest && Date.now() < raw.rest.endsAt) {
    const min = Math.ceil((raw.rest.endsAt - Date.now()) / 60000);
    await chrome.action.setBadgeText({ text: String(min) });
    await chrome.action.setBadgeBackgroundColor({ color: '#1f7a52' });
    await chrome.action.setBadgeTextColor?.({ color: '#ffffff' });
    await chrome.action.setTitle({ title: t('rest.badgeTitle', { n: min }) });
    return;
  }
  const day = raw[dk] || {};
  const total = sum(day.d) + sum(day.a);
  await chrome.action.setBadgeText({ text: settings.tracking.badge ? compact(total) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#57534e' });
  await chrome.action.setBadgeTextColor?.({ color: '#ffffff' });
  await chrome.action.setTitle({ title: total >= 60 ? t('badge.todayTitle', { time: fmtDuration(total) }) : t('badge.defaultTitle') });
}
