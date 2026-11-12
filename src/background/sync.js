// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Optional settings sync across the person's browsers (chrome.storage.sync). Off by default; only settings travel —
// never browsing history, tasks, notes or the companion token. Newest deliberate edit wins. Event-driven: a 30 s alarm batches bursts of changes.
//
// The first sync on a device is special: if a cloud copy already exists it always wins (a freshly installed browser must
// adopt the configuration you already made, not overwrite it with its onboarding defaults).

import { getRaw, setRaw } from '../shared/storage.js';
import { errorText } from '../shared/errorlog.js';
import { pack, packSealed, unpack, unpackSealed, staleKeys, decide, remoteVersion, cloudMeta, SYNC_VERSION, META_KEY } from '../shared/syncpack.js';
import { chooseMode, declaredEnc, sameEnc } from '../shared/syncseal.js';
import { loadSyncKey } from '../shared/syncvault.js';
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
  const { syncSettings, syncedOnce, settings, settingsUpdatedAt = 0, syncEnc = null, syncEncOff = 0 } = await getRaw(['syncSettings', 'syncedOnce', 'settings', 'settingsUpdatedAt', 'syncEnc', 'syncEncOff']);
  if (!syncSettings) { if (syncedOnce) await setRaw({ syncedOnce: false }); return { ok: true, off: true }; }
  if (!area) { await setStatus({ ok: false, error: 'unsupported' }); return { ok: false }; }
  try {
    const all = await area.get(null);
    const ver = remoteVersion(all);
    if (ver > SYNC_VERSION) { await setStatus({ ok: false, error: 'incompatible' }); return { ok: false }; } // written by a newer EyeTime: never overwrite it
    // Encryption first: is this copy sealed, and does this device hold the key for it? (shared/syncseal.js chooseMode has the rules)
    const plan = chooseMode({ enc: syncEnc, off: syncEncOff, remoteMeta: cloudMeta(all) });
    if (plan.clearLocal) { await setRaw({ syncEnc: null, syncEncOff: Math.max(syncEncOff, syncEnc ? syncEnc.rot : 0) }); } // turned off on another device: follow it
    const info = /** @type {any} */ (plan).info;
    let key = null;
    if (plan.mode === 'unlock') { await setRaw({ syncNeeds: info }); await setStatus({ ok: false, error: 'locked' }); return { ok: false, locked: true }; } // set up on another device: the passphrase is needed here
    if (plan.mode === 'sealed') {
      key = await loadSyncKey(info);
      if (!key) { await setStatus({ ok: false, error: 'locked' }); return { ok: false, locked: true }; } // after a restart: nothing is uploaded in the clear, nothing is lost
    }
    const rEnc = declaredEnc(all[META_KEY]);
    const sameSeal = plan.mode === 'sealed' && sameEnc(rEnc, info);
    let rem;
    try { rem = sameSeal ? await unpackSealed(all, key) : (rEnc ? null : unpack(all)); } // an older sealed copy is replaced, not read
    catch { await setStatus({ ok: false, error: 'tampered' }); return { ok: false }; } // does not open with the right key: changed or put back by someone else; never overwritten blindly
    const reseal = plan.mode === 'sealed' && !sameSeal; // a plain or older copy is in the cloud: the sealed one has to go up
    let action;
    if (!rem) action = settings || reseal ? 'push' : 'none';
    else if (!syncedOnce) action = 'pull';
    else action = decide(settingsUpdatedAt, rem.ts);
    const push = async (ts, data = settings) => {
      const off = Math.max(syncEncOff, rem && rem.off ? rem.off : 0);
      const p = plan.mode === 'sealed' ? await packSealed(data || {}, ts, key, info) : pack(data || {}, ts, off);
      if (!p) { await setStatus({ ok: false, error: 'too_big' }); return false; }
      await area.set(p.items); // write the new copy first; only then drop leftover chunks, so an interrupted sync never leaves a torn payload
      const stale = staleKeys(all, p.count);
      if (stale.length) await area.remove(stale);
      return true;
    };

    if (action === 'pull') {
      const keep = { ...(settings && settings.onboarded ? { onboarded: true } : {}), ...(settings && settings.companion ? { companion: settings.companion } : {}) };
      await setRaw({ settings: { ...rem.settings, ...keep }, settingsUpdatedAt: rem.ts, syncedOnce: true });
      await applySettings(); // alarms, menus, open tabs: the other browser's changes take effect now, not at the next cold start
      if (reseal && !(await push(rem.ts, (await getRaw('settings')).settings))) return { ok: false }; // what was taken from a plain copy goes back up sealed
    } else if (action === 'push') {
      const ts = settingsUpdatedAt || Date.now();
      if (!(await push(ts))) return { ok: false };
      await setRaw({ syncedOnce: true, ...(settingsUpdatedAt ? {} : { settingsUpdatedAt: ts }) });
    } else if (!syncedOnce) await setRaw({ syncedOnce: true });
    await setStatus({ ok: true, action });
    return { ok: true, action };
  } catch (e) {
    await setStatus({ ok: false, error: errorText(e).slice(0, 120) });
    return { ok: false };
  }
}

// local change → schedule an upload; the other browser's change → pull right away
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes.syncSettings) { syncNow(); return; } // turning it off also resets the first-sync marker
    if (changes.settingsUpdatedAt) (async () => { const { syncSettings } = await getRaw('syncSettings'); if (syncSettings) await chrome.alarms.create(ALARM, { delayInMinutes: 0.5 }); })();
  } else if (areaName === 'sync') {
    if (changes['sync:meta']) syncNow();
  }
});
chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) syncNow(); });
