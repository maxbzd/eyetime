// Common page bootstrap: load settings, set language + theme, hydrate static markup.

import { installSpotlight } from './spotlight.js';
import { getSettings, onChange } from '../shared/storage.js';
import { resolveLocale, setLocale, applyI18n } from '../shared/i18n.js';
import { hydrateIcons } from './dom.js';

import { buildCache } from '../shared/looks.js';
import { captureErrors } from '../shared/errorlog.js';

/** Resolve the user's look and paint it (also refreshes the cache theme-init.js reads before first paint). */
export function applyTheme(settings) {
  /** @type {any} */ (window).EyeTimeTheme?.apply(buildCache(settings.appearance), true);
}

export function localize(settings) {
  setLocale(resolveLocale(settings.language));
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
  localize(settings);
  applyTheme(settings);
  applyI18n();
  hydrateIcons();
  installSpotlight(); // the Obsidian look's light that follows the pointer round a card (no effect in other looks)
  if (onSettings) {
    onChange('settings', async () => {
      const s = await getSettings();
      localize(s); applyTheme(s);
      onSettings(s);
    });
  }
  return settings;
}
