// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Common page bootstrap: load settings, set language + theme, hydrate static markup.

import { installSpotlight } from './spotlight.js';
import { getSettings, getRaw, onChange } from '../shared/storage.js';
import { resolveLocale, setLocale, applyI18n, t, fmtTime } from '../shared/i18n.js';
import { softens } from '../shared/strict.js';
import { hydrateIcons, toast } from './dom.js';

import { buildCache } from '../shared/looks.js';
import { captureErrors } from '../shared/errorlog.js';

/** Resolve the user's look and paint it (also refreshes the cache theme-init.js reads before first paint). */
export function applyTheme(settings) {
  /** @type {any} */ (window).EyeTimeTheme?.apply(buildCache(settings.appearance), true);
}

export async function localize(settings) {
  await setLocale(resolveLocale(settings.language));
  document.documentElement.dataset.langCache = document.documentElement.lang;
}

/**
 * Standard startup for every extension page. Returns the loaded settings.
 * Calls `onSettings(settings)` again whenever settings change (from any other page).
 */
/** @param {{ onSettings?: (s: any) => void }} [o] */
export async function bootPage({ onSettings } = {}) {
  captureErrors('page:' + location.pathname.split('/').slice(-2).join('/'));
  const settings = await getSettings();
  await localize(settings);
  applyTheme(settings);
  applyI18n();
  hydrateIcons();
  installSpotlight(); // the Obsidian look's light that follows the pointer round a card (no effect in other looks)
  // a strict session keeps the rules it started with: say, once, that a change which would open a site waits for the end of the session
  let deferred = false;
  onChange('settings', async () => {
    const s = await getSettings(), { focus } = await getRaw('focus'), now = softens(s, focus);
    if (now && !deferred) toast(t('strict.deferred', { time: fmtTime(new Date(focus.endsAt), s.newtab.clock24 ?? undefined) }));
    deferred = now;
  });
  if (onSettings) {
    onChange('settings', async () => {
      const s = await getSettings();
      await localize(s); applyTheme(s);
      onSettings(s);
    });
  }
  return settings;
}
