// The worker side of "Connected services": every fifteen minutes (and shortly after the tasks change) each connection is synchronised, one after another.
// Tasks go through shared/sync/run.js `syncTasks`; a calendar brings its busy times in and puts planned focus blocks out (`syncBlocks`).
// A failure is written into the connection's status (shown in Settings); a refused sign-in pauses it until the person signs in again; a service that asks to slow down is left alone for that long.

import { listConnections, patchConnection, getSecrets, setSecrets, makeDeps, writeBusy, vaultState, VaultLockedError } from '../shared/connections.js';
import { syncTasks, syncBlocks, SyncError } from '../shared/sync/run.js';
import { PROVIDERS } from '../shared/sync/providers/index.js';
import { getSettings, onChange } from '../shared/storage.js';
import { dayKey } from '../shared/time.js';
import { logError, errorText } from '../shared/errorlog.js';

const EVERY = 'connections-sync', SOON = 'connections-soon';
const PERIOD_MIN = 15, SOON_MS = 45_000, QUIET_AFTER_RUN_MS = 6_000;
let inflight = null, lastEnd = 0;

/** Make sure the alarm exists exactly while some connection is on. */
export async function armConnections() {
  try {
    const on = Object.values(await listConnections()).some((c) => !c.status || !c.status.needsAuth);
    if (!on) { await chrome.alarms.clear(EVERY); await chrome.alarms.clear(SOON); return; }
    if (!(await chrome.alarms.get(EVERY))) await chrome.alarms.create(EVERY, { delayInMinutes: 2, periodInMinutes: PERIOD_MIN });
  } catch { /* alarms unavailable */ }
}

/** The busy times of a calendar, in the shape the planner reads: timed events with "HH:MM", all-day ones apart. Our own blocks are left out (the plan knows them). */
export function busyToCalendar(/** @type {any[]} */ busy) {
  const events = [], allDay = [];
  for (const e of busy || []) {
    if (e.taskId) continue;
    if (e.allDay) allDay.push({ id: String(e.id), title: String(e.title || '').slice(0, 80), day: e.day });
    else if (e.start && e.end) events.push({ id: String(e.id), title: String(e.title || '').slice(0, 80), day: e.day, start: e.start, end: e.end });
  }
  return { events: events.slice(0, 500), allDay: allDay.slice(0, 500) };
}

async function syncOne(/** @type {any} */ conn, { force = false } = {}) {
  const def = PROVIDERS[conn.provider], now = Date.now();
  if (!def) return;
  if (!force && conn.status && (conn.status.needsAuth || (conn.status.retryAt && conn.status.retryAt > now))) return;
  if (conn.status && conn.status.needsUnlock && (await vaultState()) === 'locked') return; // still locked: nothing to try until the passphrase is given
  /** @type {any} */ const status = { at: now, ok: true };
  try {
    const secrets = (await getSecrets(conn.id)) || {};
    const allowed = await chrome.permissions.contains({ origins: def.origins(conn) }).catch(() => false);
    if (!allowed) throw new SyncError('permission', 'auth');
    const provider = def.build(conn, secrets, { fetchImpl: (u, i) => fetch(u, i), now: () => Date.now(), saveToken: (tok) => setSecrets(conn.id, { ...secrets, ...tok }) }); // a renewed token is kept
    const deps = makeDeps(conn.id);
    if (conn.tasks && provider.tasks) status.tasks = await syncTasks({ provider, deps, options: { deletes: conn.deletes !== false, allowMassDelete: !!(conn.options && conn.options.allowMass) } });
    if (conn.calendar && provider.events) {
      const r = await syncBlocks({ provider, deps, today: dayKey(), defaultMinutes: (await getSettings()).focus.minutes });
      const { busy, ...calendar } = r; status.calendar = calendar;
      const cal = busyToCalendar(busy); await writeBusy(conn.id, cal); status.events = cal.events.length + cal.allDay.length;
    }
    const errs = [...((status.tasks && status.tasks.errors) || []), ...((status.calendar && status.calendar.errors) || [])];
    if (errs.length) { status.ok = false; status.error = 'other'; status.detail = errs[0]; }
  } catch (e) {
    status.ok = false;
    if (e instanceof VaultLockedError) { status.error = 'locked'; status.needsUnlock = true; } // not a failure of the service: the passphrase has not been given since the browser started
    else if (e instanceof SyncError) { status.error = e.kind; status.detail = e.message; if (e.kind === 'auth') status.needsAuth = true; if (e.kind === 'rate') status.retryAt = now + (e.retryAfter || 60) * 1000; }
    else { status.error = 'other'; status.detail = errorText(e).slice(0, 160); logError('connections:' + conn.provider, e); }
  }
  const still = await patchConnection(conn.id, (c) => { c.status = status; });
  if (!still) await chrome.storage.local.remove([`cl:${conn.id}:tasks`, `cl:${conn.id}:blocks`]).catch(() => {}); // disconnected while this round was running: leave no pairs behind
}

/** One round at a time (the alarm, a change of tasks and "sync now" can coincide). `only` names one connection; `force` ignores a pause. */
export function syncConnections({ only = '', force = false } = {}) {
  if (!inflight) inflight = (async () => {
    try { for (const c of Object.values(await listConnections())) if (!only || c.id === only) await syncOne(c, { force: force || c.id === only }); }
    finally { lastEnd = Date.now(); inflight = null; }
  })();
  return inflight;
}

/** The tasks changed (by the person, not by the round that just ended): sync soon. */
export function watchTasks() {
  onChange('tasks', async () => {
    if (inflight || Date.now() - lastEnd < QUIET_AFTER_RUN_MS) return;
    try { if (Object.keys(await listConnections()).length) await chrome.alarms.create(SOON, { when: Date.now() + SOON_MS }); } catch { /* ignore */ }
  });
}

/** @param {{ name: string }} a */
export function onConnectionsAlarm(a) { if (a.name === EVERY || a.name === SOON) syncConnections().catch((e) => logError('connections', e)); }
