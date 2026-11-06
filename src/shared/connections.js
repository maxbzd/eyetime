// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Connections to other services (Todoist, Notion, CalDAV calendars, Google, Microsoft): what is kept on this device and how it is read and written.
//
//   conns        { [id]: { id, provider, label, tasks, calendar, deletes, options, status } }   — nothing secret, shown in Settings
//   connSecrets  { [id]: { … a token, a password, a refresh token … } | sealed }                — local only: never synced, never in a backup, deleted with the connection;
//                                                                                                 with a passphrase (`vault`, see vault.js) each value is a sealed message
//   vault        { v, kdf, iter, salt, check }                                                   — nothing secret: how to turn the passphrase into the key, and a check that it was the right one
//   cl:<id>:<kind>   the pairs of one connection ("tasks" or "blocks"): which local item is which remote one, and what they looked like when they last agreed
//
// The page writes the connection (Settings → Data & privacy → Connected services); the worker (background/connections.js) does the synchronising.

import { getRaw, setRaw, getCollection, updateCollection, withLock } from './storage.js';
import { writeSource, removeSource } from './calstore.js';
import { createVault, unlockVault, sealSecrets, openSecrets, isSealed, loadKey, keepKey, forgetKey, VaultLockedError } from './vault.js';

export { VaultLockedError, WrongPassphraseError, passphraseProblem } from './vault.js';

export const MAX_CONNECTIONS = 6;
const linkKey = (/** @type {string} */ id, /** @type {string} */ kind) => `cl:${id}:${kind}`;
export const newConnId = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

/**
 * @typedef {{ at?: number, ok?: boolean, error?: string, detail?: string, needsAuth?: boolean, retryAt?: number, tasks?: Record<string, any>, calendar?: Record<string, any>, events?: number }} ConnStatus
 * @typedef {{ id: string, provider: string, label: string, tasks: boolean, calendar: boolean, deletes: boolean, options: Record<string, any>, status: ConnStatus, createdAt: number }} Connection
 */

export async function listConnections() {
  const { conns } = await getRaw('conns');
  return /** @type {Record<string, Connection>} */ (conns && typeof conns === 'object' ? conns : {});
}
export async function getConnection(/** @type {string} */ id) { return (await listConnections())[id] || null; }

/** Create or replace a connection and its secrets (one write each, under a lock). */
export function saveConnection(/** @type {Connection} */ conn, /** @type {Record<string, any> | null} */ secrets = null) {
  return withLock('conns', async () => {
    const all = await listConnections();
    if (!all[conn.id] && Object.keys(all).length >= MAX_CONNECTIONS) throw new Error('too many connections');
    await setRaw({ conns: { ...all, [conn.id]: conn } });
    if (secrets) { const packed = await packSecrets(conn.id, secrets); const { connSecrets } = await getRaw('connSecrets'); await setRaw({ connSecrets: { ...(connSecrets || {}), [conn.id]: packed } }); }
  });
}
export function patchConnection(/** @type {string} */ id, /** @type {(c: Connection) => void} */ fn) {
  return withLock('conns', async () => {
    const all = await listConnections();
    if (!all[id]) return null;
    const next = structuredClone(all[id]); fn(next);
    await setRaw({ conns: { ...all, [id]: next } });
    return next;
  });
}
/* ---------- the optional passphrase: the details of the connections as ciphertext ---------- */

/** @returns {Promise<import('./vault.js').VaultMeta | null>} */
const vaultMeta = async () => (await getRaw('vault')).vault || null;

/** 'off' (details are stored as they are), 'locked' (a passphrase is set and has not been given since the browser started), 'unlocked'. */
export async function vaultState() {
  if (!(await vaultMeta())) return 'off';
  return (await loadKey()) ? 'unlocked' : 'locked';
}

/** The details as they are to be stored: sealed when a passphrase is set (throws VaultLockedError if it is not unlocked: nothing may be written in the clear then). */
async function packSecrets(/** @type {string} */ id, /** @type {Record<string, any>} */ secrets) {
  if (!(await vaultMeta())) return secrets;
  const key = await loadKey();
  if (!key) throw new VaultLockedError();
  return sealSecrets(key, id, secrets);
}
async function unpackSecrets(/** @type {string} */ id, /** @type {any} */ stored) {
  if (!isSealed(stored)) return stored || null;
  const key = await loadKey();
  if (!key) throw new VaultLockedError();
  return openSecrets(key, id, stored);
}

export async function getSecrets(/** @type {string} */ id) { const { connSecrets } = await getRaw('connSecrets'); return unpackSecrets(id, connSecrets && connSecrets[id]); }
export function setSecrets(/** @type {string} */ id, /** @type {Record<string, any>} */ secrets) { return withLock('conns', async () => { const packed = await packSecrets(id, secrets); const { connSecrets } = await getRaw('connSecrets'); await setRaw({ connSecrets: { ...(connSecrets || {}), [id]: packed } }); }); }

/** The details of every connection, in the clear (the vault is unlocked, or there is none). */
async function allSecrets() {
  const { connSecrets } = await getRaw('connSecrets');
  return Object.fromEntries(await Promise.all(Object.entries(connSecrets || {}).map(async ([id, v]) => [id, await unpackSecrets(id, v)])));
}
const sealAll = (/** @type {Uint8Array} */ key, /** @type {Record<string, any>} */ plain) => Promise.resolve(Object.entries(plain)).then(async (rows) => Object.fromEntries(await Promise.all(rows.map(async ([id, v]) => [id, await sealSecrets(key, id, v)]))));

/** Set a passphrase: every stored detail is sealed, in one write together with the vault, so that an interruption leaves either the old state or the new one. */
export function enableVault(/** @type {string} */ passphrase) {
  return withLock('conns', async () => {
    if (await vaultMeta()) throw new Error('the vault is already on');
    const plain = await allSecrets();
    const { meta, key } = await createVault(passphrase);
    await setRaw({ vault: meta, connSecrets: await sealAll(key, plain) });
    await keepKey(key);
  });
}
/** Give the passphrase (after a browser start): throws WrongPassphraseError when it is not the right one. */
export async function unlockWith(/** @type {string} */ passphrase) {
  const meta = await vaultMeta();
  if (!meta) return;
  await keepKey(await unlockVault(meta, passphrase));
}
export const lockVault = () => forgetKey();
/** Take the passphrase off: the details are stored as they were before. Needs the passphrase. */
export function disableVault(/** @type {string} */ passphrase) {
  return withLock('conns', async () => {
    const meta = await vaultMeta();
    if (!meta) return;
    await keepKey(await unlockVault(meta, passphrase));
    const plain = await allSecrets();
    await setRaw({ connSecrets: plain });
    await chrome.storage.local.remove('vault');
    await forgetKey();
  });
}
/** A new passphrase for the same details; needs the old one. */
export function changePassphrase(/** @type {string} */ oldPassphrase, /** @type {string} */ newPassphrase) {
  return withLock('conns', async () => {
    const meta = await vaultMeta();
    if (!meta) throw new Error('there is no passphrase to change');
    await keepKey(await unlockVault(meta, oldPassphrase));
    const plain = await allSecrets();
    const next = await createVault(newPassphrase);
    await setRaw({ vault: next.meta, connSecrets: await sealAll(next.key, plain) });
    await keepKey(next.key);
  });
}
/** The passphrase is forgotten: the sealed details cannot be read by anyone, so they are deleted and each connection asks to sign in again. Nothing else is lost. */
export function resetVault() {
  return withLock('conns', async () => {
    const all = await listConnections();
    for (const c of Object.values(all)) c.status = { at: Date.now(), ok: false, needsAuth: true };
    await setRaw({ conns: all, connSecrets: {} });
    await chrome.storage.local.remove('vault');
    await forgetKey();
  });
}

/** Remove a connection with everything that belongs to it: secrets, pairs, and the events it brought into the calendar. Nothing on the service is touched. */
export async function removeConnection(/** @type {string} */ id) {
  await withLock('conns', async () => {
    const all = await listConnections(); delete all[id];
    const { connSecrets } = await getRaw('connSecrets'); const sec = { ...(connSecrets || {}) }; delete sec[id];
    await setRaw({ conns: all, connSecrets: sec });
    await chrome.storage.local.remove([linkKey(id, 'tasks'), linkKey(id, 'blocks')]);
  });
  await removeSource('conn-' + id);
}

/** What the runner needs from the device. */
export function makeDeps(/** @type {string} */ connId) {
  return {
    now: () => Date.now(),
    newId: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    readTasks: () => getCollection('tasks', []),
    updateTasks: (/** @type {(l: any[]) => any[]} */ fn) => updateCollection('tasks', [], fn),
    async readLinks(/** @type {string} */ kind) { const v = (await getRaw(linkKey(connId, kind)))[linkKey(connId, kind)]; return v && typeof v === 'object' ? v : {}; },
    async writeLinks(/** @type {string} */ kind, /** @type {Record<string, any>} */ links) { await setRaw({ [linkKey(connId, kind)]: links }); },
  };
}

/** The busy times of a service's calendar, kept as a calendar source of their own (the planner and the meeting warning read them like any other calendar). */
export const writeBusy = (/** @type {string} */ id, /** @type {{ events: any[], allDay: any[] }} */ data) => writeSource('conn-' + id, data);
