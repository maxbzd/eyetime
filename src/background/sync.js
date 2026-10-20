// Optional settings sync across the person's browsers (chrome.storage.sync). Off by default; only settings travel —
// never browsing history, tasks or notes. Newest write wins. Event-driven: a 30 s alarm batches bursts of changes.

import { getRaw, setRaw } from '../shared/storage.js';
import { pack, unpack, staleKeys, decide } from '../shared/syncpack.js';

const ALARM = 'settings-sync';
const remote = () => (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) || null;

async function setStatus(status) { await setRaw({ syncStatus: { at: Date.now(), ...status } }); }

export async function syncNow() {
  const area = remote();
  const { syncSettings, settings, settingsUpdatedAt = 0 } = await getRaw(['syncSettings', 'settings', 'settingsUpdatedAt']);
  if (!syncSettings) return { ok: true, off: true };
  if (!area) { await setStatus({ ok: false, error: 'unsupported' }); return { ok: false }; }
  try {
    const all = await area.get(null);
    const rem = unpack(all);
    const action = rem ? decide(settingsUpdatedAt, rem.ts) : (settings ? 'push' : 'none');
    if (action === 'pull') {
      const keep = settings && settings.onboarded;
      await setRaw({ settings: { ...rem.settings, ...(keep ? { onboarded: true } : {}) }, settingsUpdatedAt: rem.ts });
    } else if (action === 'push') {
      const ts = settingsUpdatedAt || Date.now();
      const p = pack(settings || {}, ts);
      if (!p) { await setStatus({ ok: false, error: 'too_big' }); return { ok: false }; }
      const stale = staleKeys(all, p.count);
      if (stale.length) await area.remove(stale);
      await area.set(p.items);
      if (!settingsUpdatedAt) await setRaw({ settingsUpdatedAt: ts });
    }
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
    if (changes.syncSettings) { if (changes.syncSettings.newValue) syncNow(); return; }
    if (changes.settings && !changes.settingsUpdatedAt) return; // written by an import/reset: not a user edit
    if (changes.settingsUpdatedAt) getRaw('syncSettings').then(({ syncSettings }) => { if (syncSettings) chrome.alarms.create(ALARM, { delayInMinutes: 0.5 }); });
  } else if (areaName === 'sync') {
    if (changes['sync:meta']) syncNow();
  }
});
chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) syncNow(); });
