// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// One synchronisation, start to finish: read both sides, plan (pairs.js), write to the service, write to the tasks, remember what was agreed.
// It knows nothing about the browser or any service: both come in as `deps` and `provider`, so the same code is tested with an in-memory fake and runs with real ones.
//
//   deps     { now(), newId(), readTasks(), updateTasks(fn), readLinks(kind), writeLinks(kind, links) }
//   provider { tasks?: { fields, list(), create(item), update(id, patch, item), remove(id) },
//              events?: { list({ from, to }), create(block), update(id, patch, block), remove(id) } }   — see providers/README.md
//
// A failure of one item never stops the others. A failure of the whole conversation (sign-in refused, too many requests, no network) stops the run, but what was already
// agreed is remembered, and what was not is tried again next time: every step can be repeated safely.

import { planPairs, snapshot, eq } from './pairs.js';
import { ALL_TASK_FIELDS, localItem, applyToTask, taskFromItem, adoptKeyOf } from './tasks.js';
import { BLOCK_FIELDS, blockItem, applyBlockToTask, unschedule, HORIZON_DAYS } from './blocks.js';

/** What a provider throws when the whole conversation fails. kind: 'auth' | 'rate' | 'network' | 'other'. */
export class SyncError extends Error {
  constructor(/** @type {string} */ message, /** @type {'auth' | 'rate' | 'network' | 'other'} */ kind = 'other', /** @type {{ status?: number, retryAfter?: number }} */ extra = {}) {
    super(message); this.name = 'SyncError'; this.kind = kind; this.status = extra.status; this.retryAfter = extra.retryAfter;
  }
}
const isFatal = (/** @type {any} */ e) => e instanceof SyncError && e.kind !== 'other';
const say = (/** @type {any} */ e) => String((e && e.message) || e).slice(0, 160);

const emptyResult = () => ({ createdRemote: 0, createdLocal: 0, updatedRemote: 0, updatedLocal: 0, deletedRemote: 0, deletedLocal: 0, adopted: 0, conflicts: 0, unsafe: false, held: 0, errors: /** @type {string[]} */ ([]) });

/**
 * Tasks ⇄ the service's task list.
 * @param {{ provider: any, deps: any, options?: { deletes?: boolean, allowMassDelete?: boolean } }} o
 */
export async function syncTasks({ provider, deps, options = {} }) {
  const api = provider.tasks, fields = ALL_TASK_FIELDS.filter((f) => api.fields.includes(f));
  const now = deps.now(), res = emptyResult();
  const { items, complete } = await api.list();
  const tasks = await deps.readTasks();
  const local = new Map(tasks.filter((x) => x && typeof x.text === 'string').map((x) => [x.id, localItem(x, now)]));
  const remote = new Map(items.map((i) => [i.id, i]));
  const links = await deps.readLinks('tasks');
  const plan = planPairs({ local, remote, links, fields, eligible: (it) => it.ok, adoptKey: adoptKeyOf, remoteComplete: complete, now, deletes: options.deletes !== false, allowMassDelete: !!options.allowMassDelete });
  Object.assign(res, { conflicts: plan.conflicts, unsafe: plan.unsafe, held: plan.held, adopted: plan.adopted.length });

  /** @type {Record<string, any>} */ const next = {};
  for (const [id, l] of Object.entries(plan.links)) next[id] = plan.retry[id] || l; // until an update is done, the old agreement stands
  const remoteOk = new Set(), localOk = new Set();
  const out = (/** @type {any} */ item) => Object.fromEntries([['text', item.text], ...fields.filter((f) => f !== 'text').map((f) => [f, item[f] ?? null])]);
  let fatal = null;
  try {
    for (const c of plan.createRemote) {
      try { const r = await api.create(out(c.item)); next[c.localId] = { remoteId: r.id, base: snapshot(c.item, fields), lc: 0, ...(r.etag ? { etag: r.etag } : {}) }; res.createdRemote++; }
      catch (e) { if (isFatal(e)) throw e; res.errors.push(say(e)); }
    }
    for (const u of plan.updateRemote) {
      try { const r = await api.update(u.remoteId, u.patch, out(u.item)); remoteOk.add(u.localId); if (r && r.etag) plan.links[u.localId].etag = r.etag; res.updatedRemote++; }
      catch (e) { if (isFatal(e)) throw e; res.errors.push(say(e)); }
    }
    for (const d of plan.deleteRemote) {
      try { await api.remove(d.remoteId); res.deletedRemote++; }
      catch (e) { if (isFatal(e)) throw e; res.errors.push(say(e)); next[d.localId] = links[d.localId]; }
    }
  } catch (e) { fatal = e; }

  // the local side, even after a failure of the conversation: every step is safe to repeat, and what came in is not thrown away
  /** @type {Record<string, any>} */ const born = {};
  await deps.updateTasks((/** @type {any[]} */ fresh) => {
    const list = [...fresh], at = new Map(list.map((x, i) => [x.id, i]));
    const same = (/** @type {string} */ id, /** @type {string[]} */ fs) => { const cur = list[at.get(id) ?? -1], was = local.get(id); return !!cur && !!was && fs.every((f) => eq(localItem(cur, now)[f], was[f])); };
    for (const u of plan.updateLocal) {
      if (!same(u.localId, Object.keys(u.patch))) continue; // changed while the run was going: next time
      list[at.get(u.localId) ?? 0] = applyToTask(list[at.get(u.localId) ?? 0], u.patch, now); localOk.add(u.localId); res.updatedLocal++;
    }
    for (const id of plan.deleteLocal) {
      if (!same(id, fields)) { next[id] = links[id]; continue; }
      list[at.get(id) ?? 0] = null; res.deletedLocal++;
    }
    for (const c of plan.createLocal) { const id = deps.newId(); list.unshift(taskFromItem(c.item, id, now)); born[id] = { remoteId: c.remoteId, base: snapshot(c.item, fields), lc: 0 }; res.createdLocal++; }
    return list.filter(Boolean);
  });

  // what was agreed in full is remembered as agreed
  const ids = new Set([...plan.updateRemote.map((u) => u.localId), ...plan.updateLocal.map((u) => u.localId)]);
  for (const id of ids) {
    const needR = plan.updateRemote.some((u) => u.localId === id), needL = plan.updateLocal.some((u) => u.localId === id);
    if ((!needR || remoteOk.has(id)) && (!needL || localOk.has(id))) next[id] = plan.links[id];
  }
  await deps.writeLinks('tasks', { ...next, ...born });
  if (fatal) throw fatal;
  return res;
}

/**
 * Planned focus blocks ⇄ events of a calendar (only the ones EyeTime made).
 * @param {{ provider: any, deps: any, today: string, defaultMinutes?: number }} o
 */
export async function syncBlocks({ provider, deps, today, defaultMinutes = 25 }) {
  const api = provider.events, now = deps.now(), res = emptyResult();
  const to = (() => { const [y, m, d] = today.split('-').map(Number); const t = new Date(y, m - 1, d + HORIZON_DAYS); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; })();
  const { ours, busy = [] } = await api.list({ from: today, to });
  const tasks = await deps.readTasks();
  const items = new Map(tasks.filter((x) => x && typeof x.text === 'string').map((x) => [x.id, blockItem(x, today, defaultMinutes)]));
  const local = new Map([...items].filter(([, it]) => it.ok)); // a task that is not a block (any more) is absent here: its event is removed
  const remote = new Map(ours.filter((e) => e.taskId).map((e) => [e.id, { ...e, ok: true }]));
  const links = await deps.readLinks('blocks');
  const plan = planPairs({ local, remote, links, fields: BLOCK_FIELDS, eligible: () => true, adoptKey: (it) => it.taskId || '', remoteComplete: true, now });
  // never a task from an event: an event of ours with no task is removed
  for (const c of plan.createLocal) plan.deleteRemote.push({ localId: '', remoteId: c.remoteId });
  plan.createLocal = [];
  Object.assign(res, { conflicts: plan.conflicts, unsafe: plan.unsafe, held: plan.held, adopted: plan.adopted.length });

  /** @type {Record<string, any>} */ const next = {};
  for (const [id, l] of Object.entries(plan.links)) next[id] = plan.retry[id] || l;
  const remoteOk = new Set(), localOk = new Set();
  const ev = (/** @type {any} */ it) => ({ taskId: it.taskId, title: it.title, day: it.day, start: it.start, end: it.end });
  let fatal = null;
  try {
    for (const c of plan.createRemote) {
      try { const r = await api.create(ev(c.item)); next[c.localId] = { remoteId: r.id, base: snapshot(c.item, BLOCK_FIELDS), lc: 0, ...(r.etag ? { etag: r.etag } : {}) }; res.createdRemote++; }
      catch (e) { if (isFatal(e)) throw e; res.errors.push(say(e)); }
    }
    for (const u of plan.updateRemote) {
      try { const r = await api.update(u.remoteId, u.patch, ev({ ...u.item, taskId: u.localId })); remoteOk.add(u.localId); if (r && r.etag) plan.links[u.localId].etag = r.etag; res.updatedRemote++; }
      catch (e) { if (isFatal(e)) throw e; res.errors.push(say(e)); }
    }
    for (const d of plan.deleteRemote) {
      try { await api.remove(d.remoteId); res.deletedRemote++; }
      catch (e) { if (isFatal(e)) throw e; res.errors.push(say(e)); if (d.localId) next[d.localId] = links[d.localId]; }
    }
  } catch (e) { fatal = e; }

  if (plan.updateLocal.length || plan.deleteLocal.length) {
    await deps.updateTasks((/** @type {any[]} */ fresh) => {
      const list = [...fresh], at = new Map(list.map((x, i) => [x.id, i]));
      const same = (/** @type {string} */ id, /** @type {string[]} */ fs) => { const cur = list[at.get(id) ?? -1], was = local.get(id); return !!cur && !!was && fs.every((f) => eq(blockItem(cur, today, defaultMinutes)[f], was[f])); };
      for (const u of plan.updateLocal) {
        if (!same(u.localId, Object.keys(u.patch))) continue;
        const i = at.get(u.localId) ?? 0; list[i] = applyBlockToTask(list[i], u.patch); localOk.add(u.localId); res.updatedLocal++;
      }
      for (const id of plan.deleteLocal) { // the event was removed from the calendar: the task is no longer booked
        if (!same(id, BLOCK_FIELDS)) { next[id] = links[id]; continue; }
        const i = at.get(id) ?? 0; list[i] = unschedule(list[i]); res.deletedLocal++;
      }
      return list;
    });
  }
  for (const id of new Set([...plan.updateRemote.map((u) => u.localId), ...plan.updateLocal.map((u) => u.localId)])) {
    const needR = plan.updateRemote.some((u) => u.localId === id), needL = plan.updateLocal.some((u) => u.localId === id);
    if ((!needR || remoteOk.has(id)) && (!needL || localOk.has(id))) next[id] = plan.links[id];
  }
  await deps.writeLinks('blocks', next);
  if (fatal) throw fatal;
  return { ...res, busy };
}
