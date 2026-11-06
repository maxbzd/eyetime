// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// End-to-end encryption of what is kept in the browser's own sync storage (chrome.storage.sync): the settings and the task list.
//
// Without it the text travels as plain JSON to the account's cloud (Google's or Mozilla's), where the provider can read it. With a sync passphrase it is compressed and sealed with
// AES-256-GCM on this device, under a key that never leaves it: the cloud holds ciphertext, a salt and a time. The key is derived from the passphrase (PBKDF2, shared/vault.js), so a
// second device needs the same passphrase once per browser session.
//
// A sealed payload is stored in the same chunked items as before, with meta { v: 2, n, ts, enc }:
//   * v is 2, so an older EyeTime (which understands v 1 only) says "written by a newer version" and leaves it alone instead of overwriting the ciphertext with plain text;
//   * the context of the seal contains the time `ts`, so an old copy put back with a new time (a rollback by whoever can write to the cloud) does not open;
//   * `enc` = the vault meta (salt, rounds, a check value; nothing secret) and `rot`, the time the passphrase was set, which tells a newer passphrase from an older one.
// When encryption is switched off, the plain payload carries `off` = the `rot` it replaces, so that a device that still has the old setting knows it was turned off on purpose.
//
// Pure functions over Web Crypto (they run in Node for the tests); the part that touches storage is in shared/syncvault.js and the workers.

import { sealBytes, openBytes, toB64, fromB64, unlockVault, createVault } from './vault.js';

export const SEALED_VERSION = 2;
export const SEALED_CHUNK_CHARS = 7000; // the text is ASCII (base64): one character is one byte; an item may hold 8192 bytes with its key
const utf8 = new TextEncoder(), utf8d = new TextDecoder();

/** @typedef {{ v: 1, kdf: string, iter: number, salt: string, check: { iv: string, ct: string } }} VaultMeta */
/** @typedef {{ meta: VaultMeta, rot: number }} EncInfo */

async function deflate(/** @type {Uint8Array} */ bytes) {
  const stream = new Blob([/** @type {BlobPart} */ (bytes)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function inflate(/** @type {Uint8Array} */ bytes, max = 2_000_000) {
  const stream = new Blob([/** @type {BlobPart} */ (bytes)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const out = new Uint8Array(await new Response(stream).arrayBuffer());
  if (out.length > max) throw new Error('sealed payload is too large'); // a compression bomb is refused after one read, and the cap is checked before anything is parsed
  return out;
}

/** Text → one ASCII string: compressed, sealed under `context`, as `iv.ciphertext` in base64. */
export async function sealText(/** @type {Uint8Array} */ key, /** @type {string} */ context, /** @type {string} */ text) {
  const s = await sealBytes(key, context, await deflate(utf8.encode(text)));
  return s.iv + '.' + s.ct;
}
/** The text back; throws when the key or the context is not the one it was sealed with, or one bit was changed. */
export async function openText(/** @type {Uint8Array} */ key, /** @type {string} */ context, /** @type {string} */ sealed) {
  const [iv, ct, extra] = String(sealed).split('.');
  if (!iv || !ct || extra !== undefined) throw new Error('not a sealed payload');
  return utf8d.decode(await inflate(await openBytes(key, context, { iv, ct })));
}

/** A string in chunks that fit an item; null when it needs more than `max`. */
export function splitText(/** @type {string} */ text, /** @type {number} */ max, size = SEALED_CHUNK_CHARS) {
  const parts = [];
  for (let at = 0; at < text.length; at += size) parts.push(text.slice(at, at + size));
  return parts.length > max ? null : parts;
}

/** The encryption a payload in storage.sync declares (from its meta item), or null when it is plain or absent. */
export function declaredEnc(/** @type {any} */ meta) {
  const e = meta && meta.v === SEALED_VERSION && meta.enc;
  if (!e || typeof e.salt !== 'string' || typeof e.iter !== 'number' || !e.check || typeof e.check.iv !== 'string' || typeof e.check.ct !== 'string' || !(Number(e.rot) > 0)) return null;
  const { rot, ...meta2 } = e;
  return /** @type {EncInfo} */ ({ meta: /** @type {VaultMeta} */ (meta2), rot: Number(rot) });
}
/** What goes into the meta item for a sealed payload. */
export const declare = (/** @type {EncInfo} */ info) => ({ ...info.meta, rot: info.rot });

export const sealContext = (/** @type {string} */ what, /** @type {number} */ ts) => `sync:${what}:${ts}`;

/** A new sync passphrase: its vault and the key. */
export async function newEncryption(/** @type {string} */ passphrase, now = Date.now(), iterations = undefined) {
  const { meta, key } = await createVault(passphrase, iterations);
  return { info: /** @type {EncInfo} */ ({ meta: /** @type {VaultMeta} */ (/** @type {unknown} */ (meta)), rot: now }), key };
}
/** The key for a passphrase against the encryption a payload declares; throws WrongPassphraseError when it is not the one. */
export const keyFor = (/** @type {EncInfo} */ info, /** @type {string} */ passphrase) => unlockVault(/** @type {any} */ (info.meta), passphrase);

export { toB64, fromB64 };

/**
 * What a sync run has to do about encryption, from what this device has (`enc`: the encryption it set or adopted, `off`: the `rot` of an encryption it switched off) and the meta item
 * found in the cloud:
 *   { mode: 'plain' }                      nothing is sealed; { replaceSealed: true }: an old sealed copy is still there and is to be overwritten (this device switched it off)
 *   { mode: 'plain', clearLocal: true }    this device still has an encryption that was switched off elsewhere: forget it
 *   { mode: 'sealed', info }               seal with this device's encryption (a plain or older copy in the cloud is replaced by a sealed one)
 *   { mode: 'unlock', info }               the cloud holds an encryption this device does not have (a newer one, or the first): the passphrase is needed
 */
/** Which of two encryptions was set later (the time, then the salt, so that two set in the same millisecond still have an order). */
export const isNewer = (/** @type {EncInfo} */ a, /** @type {EncInfo} */ b) => a.rot > b.rot || (a.rot === b.rot && a.meta.salt > b.meta.salt);
/** The same encryption (the salt is unique to each one). */
export const sameEnc = (/** @type {EncInfo | null} */ a, /** @type {EncInfo | null} */ b) => !!a && !!b && a.meta.salt === b.meta.salt;

export function chooseMode(/** @type {{ enc: EncInfo | null, off?: number, remoteMeta: any }} */ { enc, off = 0, remoteMeta }) {
  const r = declaredEnc(remoteMeta);
  if (enc) {
    if (r && !sameEnc(r, enc) && isNewer(r, enc)) return { mode: 'unlock', info: r };
    if (!r && remoteMeta && remoteMeta.v === 1 && Number(remoteMeta.off) >= enc.rot) return { mode: 'plain', clearLocal: true };
    return { mode: 'sealed', info: enc };
  }
  if (r) return r.rot <= off ? { mode: 'plain', replaceSealed: true } : { mode: 'unlock', info: r };
  return { mode: 'plain' };
}
