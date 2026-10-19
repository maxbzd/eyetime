// Common page bootstrap: load settings, set language + theme, hydrate static markup.

import { getSettings, onChange } from '../shared/storage.js';
import { resolveLocale, setLocale, applyI18n } from '../shared/i18n.js';
import { hydrateIcons } from './dom.js';

export const ACCENT_NAMES = ['ember', 'blue', 'violet', 'pink', 'teal', 'green'];

export function applyTheme(settings) {
  window.EyeTimeTheme?.apply(settings.theme, settings.accent);
}

export function localize(settings) {
  setLocale(resolveLocale(settings.language));
  document.documentElement.dataset.langCache = document.documentElement.lang;
}

/**
 * Standard startup for every extension page. Returns the loaded settings.
 * Calls `onSettings(settings)` again whenever settings change (from any other page).
 */
export async function bootPage({ onSettings } = {}) {
  const settings = await getSettings();
  localize(settings);
  applyTheme(settings);
  applyI18n();
  hydrateIcons();
  if (onSettings) {
    onChange('settings', async () => {
      const s = await getSettings();
      localize(s); applyTheme(s);
      onSettings(s);
    });
  }
  return settings;
}
