// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Two-way synchronisation of one kind of thing (tasks, calendar blocks) between this device and a service, as a pure plan: what to create, change and delete on each side.
//
// The method is the one every serious sync tool uses: a three-way merge against what both sides looked like the last time they agreed (the "base", kept in the link of each pair).
//   - a field changed on one side only travels to the other; a field changed on both to the same value is left; changed on both to different values is a conflict
//   - a conflict goes to the side that changed last (the remote side's own timestamp against the moment this side's change was first seen); a task finished on either side stays finished
//   - an item that is gone from one side is deleted on the other, unless the other side changed it since: an edit is never lost to a deletion
//   - an item with no link is new: created on the other side, or paired with an equal one that is already there (the same text), so connecting a service twice does not double the list
//   - when a service looks empty or a plan would delete more than a third of what is linked, the deletions are held back (`unsafe`): a broken answer must not wipe a list
//
// Nothing here knows about tasks, calendars or any service: items are plain objects, the fields to compare are named by the caller.

/** @typedef {Record<string, any>} Item */
/** @typedef {{ remoteId: string, base: Item | null, lc: number, etag?: string }} Link */

export const eq = (/** @type {any} */ a, /** @type {any} */ b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Three-way merge of the named fields of one pair.
 * @param {{ base: Item | null, local: Item, remote: Item, fields: string[], localAt?: number, remoteAt?: number }} o
 */
export function mergeFields({ base, local, remote, fields, localAt = 0, remoteAt = 0 }) {
  /** @type {Item} */ const merged = {}, toLocal = {}, toRemote = {};
  /** @type {string[]} */ const conflicts = [];
  let localChanged = false;
  for (const f of fields) {
    const b = base ? base[f] : undefined, l = local[f], r = remote[f];
    const lc = base ? !eq(l, b) : true, rc = base ? !eq(r, b) : true; // no base: both sides are "new" to each other
    if (lc) localChanged = localChanged || !!base;
    let v;
    if (!lc && !rc) v = l;
    else if (lc && !rc) { v = l; toRemote[f] = l; }
    else if (!lc && rc) { v = r; toLocal[f] = r; }
    else if (eq(l, r)) v = l;
    else {
      conflicts.push(f);
      const empty = (/** @type {any} */ x) => x === null || x === undefined || x === '' || x === false;
      v = f === 'done' ? !!(l || r) : !base && empty(l) !== empty(r) ? (empty(l) ? r : l) : remoteAt >= localAt ? r : l; // pairing for the first time: what is written beats what is empty
      if (!eq(v, l)) toLocal[f] = v;
      if (!eq(v, r)) toRemote[f] = v;
    }
    merged[f] = v ?? null;
  }
  return { merged, toLocal, toRemote, conflicts, localChanged };
}

const isEmpty = (/** @type {object} */ o) => Object.keys(o).length === 0;
const pick = (/** @type {Item} */ it, /** @type {string[]} */ fields) => Object.fromEntries(fields.map((f) => [f, it[f] ?? null]));

/**
 * @typedef {{
 *   local: Map<string, Item>, remote: Map<string, Item>, links: Record<string, Link>, fields: string[],
 *   eligible?: (item: Item) => boolean, adoptKey?: (item: Item) => string,
 *   remoteComplete?: boolean, now?: number, deletes?: boolean, allowMassDelete?: boolean,
 * }} PlanInput
 * `local` and `remote` map an id to the item (`remote` items may carry `updatedAt`); `links` map a local id to its pair.
 */

/** @param {PlanInput} o */
export function planPairs(o) {
  const { local, remote, links, fields, eligible = () => true, adoptKey = null, remoteComplete = true, now = Date.now(), deletes = true, allowMassDelete = false } = o;
  const plan = {
    /** @type {{ localId: string, item: Item }[]} */ createRemote: [],
    /** @type {{ remoteId: string, item: Item }[]} */ createLocal: [],
    /** @type {{ localId: string, remoteId: string, patch: Item, item: Item }[]} */ updateRemote: [],
    /** @type {{ localId: string, patch: Item }[]} */ updateLocal: [],
    /** @type {{ localId: string, remoteId: string }[]} */ deleteRemote: [],
    /** @type {string[]} */ deleteLocal: [],
    /** @type {Record<string, Link>} */ links: {},
    /** @type {Record<string, Link>} */ retry: {},
    /** @type {{ localId: string, remoteId: string }[]} */ adopted: [],
    conflicts: 0, unsafe: false, held: 0,
  };
  const linkedRemote = new Set(Object.values(links).map((l) => l.remoteId));

  // 1. pairs that were linked
  for (const [localId, link] of Object.entries(links)) {
    const lt = local.get(localId), rt = remote.get(link.remoteId);
    if (lt && rt) {
      const m = mergeFields({ base: link.base, local: lt, remote: rt, fields, localAt: link.lc || now, remoteAt: rt.updatedAt || 0 });
      m.conflicts.length && (plan.conflicts += 1);
      if (!isEmpty(m.toLocal)) plan.updateLocal.push({ localId, patch: m.toLocal });
      if (!isEmpty(m.toRemote)) plan.updateRemote.push({ localId, remoteId: link.remoteId, patch: m.toRemote, item: m.merged });
      plan.links[localId] = { ...link, base: m.merged, lc: 0 }; // once both sides agree, nothing is pending
      if (!isEmpty(m.toRemote) || !isEmpty(m.toLocal)) plan.retry[localId] = { ...link, lc: link.lc || (m.localChanged ? now : 0) }; // if an update fails: the old base, and when this side's change was first seen
    } else if (lt && !rt) {
      if (!remoteComplete) { plan.links[localId] = link; continue; }
      const edited = link.base ? fields.some((f) => !eq(lt[f], link.base?.[f])) : true;
      if (edited || !deletes) { plan.createRemote.push({ localId, item: lt }); } // deleted over there, changed here: the change wins, and the item comes back
      else plan.deleteLocal.push(localId);
    } else if (!lt && rt) {
      const edited = link.base ? fields.some((f) => !eq(rt[f], link.base?.[f])) : true;
      if (edited || !deletes) plan.createLocal.push({ remoteId: link.remoteId, item: rt }); // deleted here, changed there: it comes back
      else plan.deleteRemote.push({ localId, remoteId: link.remoteId });
    } // both gone: the link is dropped
  }

  // 2. new on the remote side: pair with an equal unlinked local item, else create locally
  const free = new Map([...local].filter(([id, it]) => !links[id] && eligible(it)));
  const takenByAdopt = new Set();
  for (const [remoteId, rt] of remote) {
    if (linkedRemote.has(remoteId)) continue;
    let mate = null;
    if (adoptKey) { const k = adoptKey(rt); if (k) for (const [id, it] of free) if (!takenByAdopt.has(id) && adoptKey(it) === k) { mate = id; break; } }
    if (mate) {
      takenByAdopt.add(mate);
      const lt = /** @type {Item} */ (local.get(mate));
      const m = mergeFields({ base: null, local: lt, remote: rt, fields, localAt: 0, remoteAt: rt.updatedAt || 0 });
      if (!isEmpty(m.toLocal)) plan.updateLocal.push({ localId: mate, patch: m.toLocal });
      if (!isEmpty(m.toRemote)) plan.updateRemote.push({ localId: mate, remoteId, patch: m.toRemote, item: m.merged });
      plan.links[mate] = { remoteId, base: m.merged, lc: 0 };
      plan.adopted.push({ localId: mate, remoteId });
    } else plan.createLocal.push({ remoteId, item: rt });
  }

  // 3. new on this side: create remotely
  for (const [id, it] of free) if (!takenByAdopt.has(id)) plan.createRemote.push({ localId: id, item: it });

  // 4. safety: a service that answered with (almost) nothing, or a plan that would delete a lot, is not trusted with deletions
  const total = Object.keys(links).length, deletions = plan.deleteLocal.length + plan.deleteRemote.length;
  if (deletions && !allowMassDelete && (deletions > Math.max(3, total * 0.34) || (total >= 4 && remote.size === 0))) {
    plan.unsafe = true; plan.held = deletions;
    for (const id of plan.deleteLocal) plan.links[id] = links[id];
    for (const d of plan.deleteRemote) plan.links[d.localId] = links[d.localId];
    plan.deleteLocal = []; plan.deleteRemote = [];
  }
  return plan;
}

/** The item the way the link remembers it (only the compared fields). */
export const snapshot = pick;
