// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The vault for the sign-in details of connected services (Todoist and Notion tokens, CalDAV passwords): an optional passphrase that turns them into ciphertext.
//
// What it protects, and what it does not (the whole threat model is in SECURITY.md):
//   * It protects against what can be read from the profile folder alone: a copy of the browser's files, a backup of the disk, malware that reads files but cannot
//     run inside the browser. Without the passphrase the tokens in `chrome.storage.local` are random bytes.
//   * It does not protect against code that runs inside the browser as the person while the vault is unlocked (the key is in session memory then), nor against a weak
//     passphrase (the key derivation only makes each guess cost about 0.3 s).
//
// How: the key is PBKDF2-SHA256 (600 000 rounds, 16-byte random salt) of the passphrase; each connection's details are one AES-256-GCM message with a fresh 96-bit
// nonce, bound to its connection id (an attacker with write access cannot move one connection's details to another). After unlocking, the derived key is kept in
// `chrome.storage.session`: memory only, never written to disk, gone when the browser closes, readable by EyeTime's own pages and worker only.
//
// Pure functions over Web Crypto (they run in Node for the tests); the part that touches storage is in connections.js.

const enc = new TextEncoder(), dec = new TextDecoder();

export const KDF = { name: 'PBKDF2-SHA256', iterations: 600_000, saltBytes: 16 };
export const MIN_PASSPHRASE = 12; // for a NEW passphrase; one made under the old rule of 8 still unlocks (nothing checks the length of a passphrase that is only being entered)
const CHECK_TEXT = 'eyetime-vault-v1';
const AAD = (/** @type {string} */ id) => enc.encode('eyetime-vault-v1|' + id);
const AAD_CHECK = enc.encode('eyetime-vault-v1#check'); // not of the form of the other one, so that no connection id can ever address the check

export class VaultLockedError extends Error { constructor() { super('the vault is locked'); this.name = 'VaultLockedError'; } }
export class WrongPassphraseError extends Error { constructor() { super('wrong passphrase'); this.name = 'WrongPassphraseError'; } }

const toB64 = (/** @type {Uint8Array} */ u8) => { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s); };
const fromB64 = (/** @type {string} */ s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** @typedef {{ iv: string, ct: string }} Sealed */
/** @typedef {{ v: 1, kdf: string, iter: number, salt: string, check: Sealed }} VaultMeta */

const WEAK = new Set(['password', 'password1', 'password12', 'password123', 'passw0rd', '12345678', '123456789', '1234567890', '987654321', 'qwertyui', 'qwertyuiop', 'qwerty123', 'qwerty1234', 'iloveyou', 'letmein1', 'abcd1234', 'abc12345', 'admin123', 'welcome1', '1q2w3e4r', 'zaq12wsx', 'йцукенгш', 'пароль123']);

/** Why a passphrase is not accepted (a code for the screen to word), or '' when it is. Length only: rules about symbols make people choose worse ones. */
export function passphraseProblem(/** @type {unknown} */ p) {
  if (typeof p !== 'string') return 'type';
  if ([...p.normalize('NFKC')].length < MIN_PASSPHRASE) return 'short';
  if (p.length > 256) return 'long';
  const low = p.normalize('NFKC').toLowerCase();
  if (WEAK.has(low) || new Set([...p]).size < 4 || /^(.{1,4})\1+$/.test(low) || /^(?:0123456789|1234567890|abcdefghij|qwertyuiop|asdfghjkl|zxcvbnm)/.test(low)) return 'weak'; // the passwords everyone tries first, a few characters repeated, and a walk along the keyboard or the digits
  return '';
}

async function deriveRaw(/** @type {string} */ passphrase, /** @type {Uint8Array} */ salt, /** @type {number} */ iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: /** @type {BufferSource} */ (salt), iterations }, base, 256));
}
const aes = (/** @type {Uint8Array} */ raw, /** @type {KeyUsage[]} */ usages) => crypto.subtle.importKey('raw', /** @type {BufferSource} */ (raw), 'AES-GCM', false, usages);

/** @returns {Promise<Sealed>} */
async function seal(/** @type {Uint8Array} */ raw, /** @type {Uint8Array} */ plain, /** @type {Uint8Array} */ aad) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: /** @type {BufferSource} */ (aad) }, await aes(raw, ['encrypt']), /** @type {BufferSource} */ (plain)));
  return { iv: toB64(iv), ct: toB64(ct) };
}
async function open(/** @type {Uint8Array} */ raw, /** @type {Sealed} */ sealed, /** @type {Uint8Array} */ aad) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: /** @type {BufferSource} */ (fromB64(sealed.iv)), additionalData: /** @type {BufferSource} */ (aad) }, await aes(raw, ['decrypt']), /** @type {BufferSource} */ (fromB64(sealed.ct))));
}

/**
 * A new vault for a passphrase. `meta` is what is stored (nothing in it is secret); `key` is the derived key, to be kept in memory.
 * @returns {Promise<{ meta: VaultMeta, key: Uint8Array }>}
 */
export async function createVault(/** @type {string} */ passphrase, iterations = KDF.iterations) {
  const problem = passphraseProblem(passphrase);
  if (problem) throw new Error('passphrase: ' + problem);
  const salt = crypto.getRandomValues(new Uint8Array(KDF.saltBytes));
  const key = await deriveRaw(passphrase, salt, iterations);
  return { meta: { v: 1, kdf: KDF.name, iter: iterations, salt: toB64(salt), check: await seal(key, enc.encode(CHECK_TEXT), AAD_CHECK) }, key };
}

/** The key for a passphrase, checked against the vault; throws WrongPassphraseError when it is not the one. */
export async function unlockVault(/** @type {VaultMeta} */ meta, /** @type {string} */ passphrase) {
  if (!meta || meta.v !== 1 || meta.kdf !== KDF.name || !Number.isInteger(meta.iter) || meta.iter < 1000 || meta.iter > 10_000_000) throw new Error('this vault is not one this version can read');
  const key = await deriveRaw(String(passphrase), fromB64(meta.salt), meta.iter);
  let text = '';
  try { text = dec.decode(await open(key, meta.check, AAD_CHECK)); } catch { throw new WrongPassphraseError(); }
  if (text !== CHECK_TEXT) throw new WrongPassphraseError();
  return key;
}

/** Is this value one of ours (a sealed message), as opposed to plain details of a connection? */
export const isSealed = (/** @type {any} */ v) => !!v && typeof v === 'object' && v._vault === 1 && typeof v.iv === 'string' && typeof v.ct === 'string';

/** The details of one connection as a sealed message bound to its id. */
export async function sealSecrets(/** @type {Uint8Array} */ key, /** @type {string} */ id, /** @type {Record<string, any>} */ secrets) {
  return { _vault: 1, ...(await seal(key, enc.encode(JSON.stringify(secrets)), AAD(id))) };
}

/** The details back; throws if the message was changed, or belongs to another connection, or the key is wrong. */
export async function openSecrets(/** @type {Uint8Array} */ key, /** @type {string} */ id, /** @type {any} */ sealed) {
  if (!isSealed(sealed)) throw new Error('not a sealed message');
  return JSON.parse(dec.decode(await open(key, sealed, AAD(id))));
}

/**
 * Bytes sealed under a key and a context string (what the message belongs to: a connection, a sync payload and its time). Another context, another key or one changed
 * bit and opening throws. Used by the sync encryption, which has its own key from its own passphrase.
 */
export const sealBytes = (/** @type {Uint8Array} */ key, /** @type {string} */ context, /** @type {Uint8Array} */ bytes) => seal(key, bytes, AAD(context));
export const openBytes = (/** @type {Uint8Array} */ key, /** @type {string} */ context, /** @type {Sealed} */ sealed) => open(key, sealed, AAD(context));
export { toB64, fromB64 };

/* ---------- the key in memory ---------- */

const SESSION_KEY = 'vaultKey';
export const keepKey = (/** @type {Uint8Array} */ key) => chrome.storage.session.set({ [SESSION_KEY]: toB64(key) });
export async function loadKey() { const v = (await chrome.storage.session.get(SESSION_KEY))[SESSION_KEY]; return typeof v === 'string' ? fromB64(v) : null; }
export const forgetKey = () => chrome.storage.session.remove(SESSION_KEY);
