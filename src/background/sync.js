// Optional settings sync across the person's browsers (chrome.storage.sync). Off by default; only settings travel —
// never browsing history, tasks, notes or the companion token. Newest deliberate edit wins. Event-driven: a 30 s alarm batches bursts of changes.
//
// The first sync on a device is special: if a cloud copy already exists it always wins (a freshly installed browser must
// adopt the configuration you already made, not overwrite it with its onboarding defaults).

import { getRaw, setRaw } from '../shared/storage.js';
import { pack, unpack, staleKeys, decide, remoteVersion, SYNC_VERSION } from '../shared/syncpack.js';
import { applySettings } from './apply.js';

const ALARM = 'settings-sync';
const remote = () => (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) || null;

async function setStatus(status) {
  const { syncStatus } = await getRaw('syncStatus');
  if (status.ok && syncStatus && syncStatus.ok && status.action === 'none') return; // nothing changed: no write, no storage events
  await setRaw({ syncStatus: { at: Date.now(), ...status } });
}

export async function syncNow() {
  const area = remote();
  const { syncSettings, syncedOnce, settings, settingsUpdatedAt = 0 } = await getRaw(['syncSettings', 'syncedOnce', 'settings', 'settingsUpdatedAt']);
  if (!syncSettings) { if (syncedOnce) await setRaw({ syncedOnce: false }); return { ok: true, off: true }; }
  if (!area) { await setStatus({ ok: false, error: 'unsupported' }); return { ok: false }; }
  try {
    const all = await area.get(null);
    const ver = remoteVersion(all);
    if (ver > SYNC_VERSION) { await setStatus({ ok: false, error: 'incompatible' }); return { ok: false }; } // written by a newer EyeTime: never overwrite it
    const rem = unpack(all);
    let action;
    if (!rem) action = settings ? 'push' : 'none';
    else if (!syncedOnce) action = 'pull';
    else action = decide(settingsUpdatedAt, rem.ts);

    if (action === 'pull') {
      const keep = { ...(settings && settings.onboarded ? { onboarded: true } : {}), ...(settings && settings.companion ? { companion: settings.companion } : {}) };
      await setRaw({ settings: { ...rem.settings, ...keep }, settingsUpdatedAt: rem.ts, syncedOnce: true });
      await applySettings(); // alarms, menus, open tabs: the other browser's changes take effect now, not at the next cold start
    } else if (action === 'push') {
      const ts = settingsUpdatedAt || Date.now();
      const p = pack(settings || {}, ts);
      if (!p) { await setStatus({ ok: false, error: 'too_big' }); return { ok: false }; }
      await area.set(p.items); // write the new copy first; only then drop leftover chunks, so an interrupted sync never leaves a torn payload
      const stale = staleKeys(all, p.count);
      if (stale.length) await area.remove(stale);
      await setRaw({ syncedOnce: true, ...(settingsUpdatedAt ? {} : { settingsUpdatedAt: ts }) });
    } else if (!syncedOnce) await setRaw({ syncedOnce: true });
    await setStatus({ ok: true, action });
    return { ok: true, action };
  } catch (e) {
    await setStatus({ ok: false, error: String((e && e.message) || e).slice(0, 120) });
    return { ok: false };
  }
}

// local change → schedule an upload; the other browser's change → pull right away
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes.syncSettings) { syncNow(); return; } // turning it off also resets the first-sync marker
    if (changes.settingsUpdatedAt) getRaw('syncSettings').then(({ syncSettings }) => { if (syncSettings) chrome.alarms.create(ALARM, { delayInMinutes: 0.5 }); });
  } else if (areaName === 'sync') {
    if (changes['sync:meta']) syncNow();
  }
});
chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) syncNow(); });
