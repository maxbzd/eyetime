// Connections to other services (Todoist, Notion, CalDAV calendars, Google, Microsoft): what is kept on this device and how it is read and written.
//
//   conns        { [id]: { id, provider, label, tasks, calendar, deletes, options, status } }   — nothing secret, shown in Settings
//   connSecrets  { [id]: { … a token, a password, a refresh token … } }                         — local only: never synced, never in a backup, deleted with the connection
//   cl:<id>:<kind>   the pairs of one connection ("tasks" or "blocks"): which local item is which remote one, and what they looked like when they last agreed
//
// The page writes the connection (Settings → Data & privacy → Connected services); the worker (background/connections.js) does the synchronising.

import { getRaw, setRaw, getCollection, updateCollection, withLock } from './storage.js';
import { writeSource, removeSource } from './calstore.js';

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
    if (secrets) { const { connSecrets } = await getRaw('connSecrets'); await setRaw({ connSecrets: { ...(connSecrets || {}), [conn.id]: secrets } }); }
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
export async function getSecrets(/** @type {string} */ id) { const { connSecrets } = await getRaw('connSecrets'); return (connSecrets && connSecrets[id]) || null; }
export function setSecrets(/** @type {string} */ id, /** @type {Record<string, any>} */ secrets) { return withLock('conns', async () => { const { connSecrets } = await getRaw('connSecrets'); await setRaw({ connSecrets: { ...(connSecrets || {}), [id]: secrets } }); }); }

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
