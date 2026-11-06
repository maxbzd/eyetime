// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The sync passphrase on this device (storage side of shared/syncseal.js). Stored on disk: the vault meta and the time it was set (nothing secret). Kept only in memory
// (chrome.storage.session, gone when the browser closes): the key. After a restart the sync waits for the passphrase; nothing is lost, and nothing is uploaded in the clear.

import { getRaw, setRaw } from './storage.js';
import { newEncryption, keyFor, toB64, fromB64 } from './syncseal.js';
import { passphraseProblem } from './vault.js';

const KEY = 'syncKey';
/** @typedef {import('./syncseal.js').EncInfo} EncInfo */

/** The encryption this device has set or adopted, or null. */
export async function getSyncEnc() { return /** @type {EncInfo | null} */ ((await getRaw('syncEnc')).syncEnc || null); }

/** The key for `info` if it was unlocked in this browser session, else null (the key of another passphrase is not the key for this one). */
export async function loadSyncKey(/** @type {EncInfo} */ info) {
  const v = (await chrome.storage.session.get(KEY))[KEY];
  return v && v.salt === info.meta.salt && typeof v.key === 'string' ? fromB64(v.key) : null;
}
const keep = (/** @type {EncInfo} */ info, /** @type {Uint8Array} */ key) => chrome.storage.session.set({ [KEY]: { salt: info.meta.salt, key: toB64(key) } });

/** Switch encryption on with a new passphrase (a passphrase problem is thrown as Error('passphrase: short'...)). Everything is uploaded sealed at the next sync. */
export async function enableSyncEncryption(/** @type {string} */ passphrase) {
  const problem = passphraseProblem(passphrase);
  if (problem) throw new Error('passphrase: ' + problem);
  const { info, key } = await newEncryption(passphrase);
  await keep(info, key);
  await setRaw({ syncEnc: info, syncNeeds: null, settingsUpdatedAt: Date.now() }); // newer than the plain copy in the cloud, so that the sealed one replaces it
  return info;
}

/** Take over the encryption another device set up (`info` is what the cloud declares): the passphrase opens it, or WrongPassphraseError is thrown. */
export async function unlockSyncEncryption(/** @type {EncInfo} */ info, /** @type {string} */ passphrase) {
  const key = await keyFor(info, passphrase);
  await keep(info, key);
  await setRaw({ syncEnc: info, syncNeeds: null });
}

/** Unlock again after a restart with the passphrase of the encryption this device already has. */
export async function unlockLocal(/** @type {string} */ passphrase) {
  const info = await getSyncEnc();
  if (!info) throw new Error('no sync encryption');
  await unlockSyncEncryption(info, passphrase);
}

/** A new passphrase for the same data: the old one must be right. Uploaded sealed again at the next sync; the other devices ask for the new one. */
export async function changeSyncPassphrase(/** @type {string} */ oldPassphrase, /** @type {string} */ passphrase) {
  const info = await getSyncEnc();
  if (!info) throw new Error('no sync encryption');
  await keyFor(info, oldPassphrase);
  const problem = passphraseProblem(passphrase);
  if (problem) throw new Error('passphrase: ' + problem);
  const next = await newEncryption(passphrase);
  await keep(next.info, next.key);
  await setRaw({ syncEnc: next.info, syncNeeds: null, settingsUpdatedAt: Date.now() });
}

/** Switch encryption off: the next sync writes plain copies that say which encryption they replace, so that the other devices follow. */
export async function disableSyncEncryption() {
  const info = await getSyncEnc();
  await chrome.storage.session.remove(KEY);
  await setRaw({ syncEnc: null, syncNeeds: null, syncEncOff: info ? info.rot : 0, settingsUpdatedAt: Date.now() });
}

/** Forget the key now (the passphrase is asked for again). */
export const lockSync = () => chrome.storage.session.remove(KEY);
