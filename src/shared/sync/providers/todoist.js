// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// Todoist, tasks only. The person pastes their API token (Todoist → Settings → Integrations → Developer); nothing else is needed and no sign-in page is involved.
// Speaks Todoist's API v1 (https://developer.todoist.com/api/v1): everything that depends on its shape is in this file.
//
// Mapping: content ⇄ text · checked / closed ⇄ done · due.date ⇄ due · priority 3–4 ⇄ starred · duration (minutes) ⇄ est.
// Recurring tasks are left alone: Todoist and EyeTime each have their own idea of recurrence and either one would break the other's.

import { json, http } from '../http.js';
import { SyncError } from '../run.js';

const BASE = 'https://api.todoist.com/api/v1';
const DONE_WINDOW_MS = 4 * 86_400_000; // finished tasks are listed for a few days, the same as the ones EyeTime keeps in sight

const item = (/** @type {any} */ t, /** @type {boolean} */ done) => ({
  id: String(t.id ?? t.task_id), text: String(t.content || '').trim(), done,
  due: t.due && !t.due.is_recurring && /^\d{4}-\d{2}-\d{2}/.test(t.due.date || '') ? String(t.due.date).slice(0, 10) : null,
  starred: !done && Number(t.priority) >= 3,
  est: t.duration && t.duration.unit === 'minute' && t.duration.amount > 0 ? Number(t.duration.amount) : null,
  updatedAt: Date.parse(t.updated_at || t.completed_at || t.added_at || '') || 0,
});

/** Todoist wants the fields it knows by its own names. */
function body(/** @type {Record<string, any>} */ patch) {
  const o = /** @type {Record<string, any>} */ ({});
  if ('text' in patch) o.content = patch.text;
  if ('due' in patch) { if (patch.due) o.due_date = patch.due; else o.due_string = 'no date'; }
  if ('starred' in patch) o.priority = patch.starred ? 4 : 1;
  if ('est' in patch && patch.est > 0) { o.duration = patch.est; o.duration_unit = 'minute'; }
  return o;
}

export const todoist = {
  id: 'todoist', label: 'Todoist', icon: 'list-checks', kinds: ['tasks'],
  fields: [{ key: 'token', label: 'API token', secret: true, help: 'Todoist → Settings → Integrations → Developer → API token' }],
  origins: () => ['https://api.todoist.com/*'],

  /** The projects to choose from (all of them, or one). */
  async discover(/** @type {any} */ _conn, /** @type {any} */ secrets, /** @type {any} */ env = {}) {
    const out = await pages(`${BASE}/projects`, secrets.token, env);
    return { projects: out.map((p) => ({ id: String(p.id), name: String(p.name || '') })) };
  },

  build(/** @type {any} */ conn, /** @type {any} */ secrets, /** @type {any} */ env = {}) {
    const auth = { authorization: 'Bearer ' + secrets.token };
    const project = conn.options && conn.options.projectId ? String(conn.options.projectId) : '';
    const o = { headers: auth, fetchImpl: env.fetchImpl };
    return {
      tasks: {
        fields: ['text', 'done', 'due', 'starred', 'est'],
        async list() {
          const active = (await pages(`${BASE}/tasks${project ? '?project_id=' + encodeURIComponent(project) : ''}`, secrets.token, env)).filter((t) => !(t.due && t.due.is_recurring)).map((t) => item(t, false));
          const since = new Date((env.now ? env.now() : Date.now()) - DONE_WINDOW_MS).toISOString(), until = new Date((env.now ? env.now() : Date.now()) + 86_400_000).toISOString();
          const finished = (await pages(`${BASE}/tasks/completed/by_completion_date?since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}`, secrets.token, env, 'items'))
            .filter((t) => !project || String(t.project_id) === project).map((t) => item(t, true)).filter((t) => !active.some((a) => a.id === t.id));
          return { items: [...active, ...finished].filter((t) => t.text), complete: true };
        },
        async create(/** @type {any} */ it) {
          const made = await json(`${BASE}/tasks`, { ...o, method: 'POST', data: { ...body(it), ...(project ? { project_id: project } : {}) } });
          if (!made || !made.id) throw new SyncError('Todoist answered without a task', 'other');
          if (it.done) await http(`${BASE}/tasks/${made.id}/close`, { ...o, method: 'POST' });
          return { id: String(made.id) };
        },
        async update(/** @type {string} */ id, /** @type {Record<string, any>} */ patch) {
          const rest = body(patch);
          if (Object.keys(rest).length) await json(`${BASE}/tasks/${encodeURIComponent(id)}`, { ...o, method: 'POST', data: rest });
          if ('done' in patch) await http(`${BASE}/tasks/${encodeURIComponent(id)}/${patch.done ? 'close' : 'reopen'}`, { ...o, method: 'POST' });
          return {};
        },
        async remove(/** @type {string} */ id) { await http(`${BASE}/tasks/${encodeURIComponent(id)}`, { ...o, method: 'DELETE', accept: [404] }); },
      },
    };
  },
};

/** All the pages of a list ({ results, next_cursor }), up to a sane number. */
async function pages(/** @type {string} */ url, /** @type {string} */ token, /** @type {any} */ env, /** @type {string} */ key = 'results') {
  const all = []; let cursor = '';
  for (let i = 0; i < 20; i++) {
    const u = url + (url.includes('?') ? '&' : '?') + 'limit=200' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
    const res = await json(u, { headers: { authorization: 'Bearer ' + token }, fetchImpl: env.fetchImpl });
    const list = Array.isArray(res) ? res : (res && res[key]) || [];
    all.push(...list);
    cursor = res && !Array.isArray(res) ? res.next_cursor || '' : '';
    if (!cursor) return all;
  }
  throw new SyncError('more pages than expected', 'other');
}
