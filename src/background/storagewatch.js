// Tells the person once a week when the history is close to the browser's storage limit (Chrome keeps 10 MB per extension).
// Nothing is deleted without them: the notice points to Settings → Data & privacy, where "Free up space" and a backup live.

import { getRaw, setRaw, getSettings, storageUsage } from '../shared/storage.js';
import { setLocale, resolveLocale, t } from '../shared/i18n.js';

const WARN_AT = 0.8, EVERY_MS = 7 * 86_400_000;
const ICON = 'icons/icon128.png';

export async function checkStorage() {
  try {
    const u = await storageUsage();
    if (!u.limit || u.total / u.limit < WARN_AT) return;
    const { storageWarnedAt = 0 } = await getRaw('storageWarnedAt');
    if (Date.now() - storageWarnedAt < EVERY_MS) return;
    await setRaw({ storageWarnedAt: Date.now() });
    const settings = await getSettings();
    setLocale(resolveLocale(settings.language));
    await chrome.notifications.create('storage-full', { type: 'basic', iconUrl: ICON, priority: 1, title: t('store.fullTitle'), message: t('store.fullBody', { pct: Math.round((u.total / u.limit) * 100) }) });
  } catch { /* a heads-up is a nicety, never an error */ }
}
