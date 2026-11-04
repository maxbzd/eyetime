// Notion, tasks only: one database becomes the task list. The person makes an "internal integration" (notion.so/profile/integrations), copies its secret, and shares the
// database with it (⋯ → Connections); then pastes the database's link here. Speaks Notion's API (version 2022-06-28); everything that depends on its shape is in this file.
//
// Mapping: the title property ⇄ text · a checkbox, or a status property, ⇄ done · a date property ⇄ due. (Priority and length are not mapped: Notion databases have no standard one.)
// Notion allows about three requests a second, so the writes are spaced out; deleting archives the page (Notion's own trash).

import { json } from '../http.js';
import { SyncError } from '../run.js';
import { sleep } from '../http.js';

const BASE = 'https://api.notion.com/v1';
const VERSION = '2022-06-28';
const MAX_PAGES = 15; // 1,500 tasks: beyond that the listing says it is not complete, and deletions are never inferred from it

/** The 32 hex digits of a database link or id. */
export function databaseId(/** @type {string} */ input) {
  const m = /([0-9a-f]{8})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{12})(?![0-9a-f])/i.exec(String(input || '').replace(/\?.*$/, '')) || /([0-9a-f]{8})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{12})/i.exec(String(input || ''));
  return m ? m.slice(1).join('').toLowerCase() : '';
}

const text = (/** @type {any} */ rich) => (rich || []).map((/** @type {any} */ r) => r.plain_text || (r.text && r.text.content) || '').join('').trim();

export const notion = {
  id: 'notion', label: 'Notion', icon: 'notebook-pen', kinds: ['tasks'],
  fields: [
    { key: 'token', label: 'token', secret: true },
    { key: 'database', label: 'database', secret: false },
  ],
  origins: () => ['https://api.notion.com/*'],

  /** Reads the database's properties so the person can say which one is the checkbox (or status) and which one the date. */
  async discover(/** @type {any} */ conn, /** @type {any} */ secrets, /** @type {any} */ env = {}) {
    const id = databaseId(conn.options && conn.options.database);
    if (!id) throw new SyncError('not a Notion database link', 'other');
    const db = await json(`${BASE}/databases/${id}`, { headers: hdr(secrets.token), fetchImpl: env.fetchImpl });
    const props = Object.entries(db.properties || {}).map(([name, p]) => ({ name, type: /** @type {any} */ (p).type }));
    return {
      databaseId: id, title: props.find((p) => p.type === 'title')?.name || '',
      done: props.filter((p) => p.type === 'checkbox' || p.type === 'status').map((p) => ({ id: p.name, name: p.name })),
      date: props.filter((p) => p.type === 'date').map((p) => ({ id: p.name, name: p.name })),
    };
  },

  build(/** @type {any} */ conn, /** @type {any} */ secrets, /** @type {any} */ env = {}) {
    const o = conn.options || {}, id = o.databaseId || databaseId(o.database), titleProp = o.titleProp || 'Name', doneProp = o.doneProp || '', dueProp = o.dueProp || '';
    const pause = env.sleep || sleep;
    const call = async (/** @type {string} */ path, /** @type {any} */ opts = {}) => { await pause(env.noThrottle ? 0 : 340); return json(BASE + path, { ...opts, headers: hdr(secrets.token), fetchImpl: env.fetchImpl }); };
    /** @type {{ done: string, todo: string } | null} */ let statusNames = null;

    const doneOf = (/** @type {any} */ p) => {
      const d = doneProp && p.properties[doneProp];
      if (!d) return false;
      if (d.type === 'checkbox') return !!d.checkbox;
      if (d.type === 'status') return /^(done|complete|completed|finished|closed)$/i.test((d.status && d.status.name) || '') || (d.status && d.status.group === 'complete') || false;
      return false;
    };
    const norm = (/** @type {any} */ p) => ({ id: p.id, text: text(p.properties[titleProp] && p.properties[titleProp].title), done: doneOf(p), due: dueProp && p.properties[dueProp] && p.properties[dueProp].date ? String(p.properties[dueProp].date.start || '').slice(0, 10) || null : null, updatedAt: Date.parse(p.last_edited_time || '') || 0 });

    /** Notion's status property has options in groups; "done" and "not done" are the first option of the complete group and of the to-do group. */
    async function statuses() {
      if (statusNames) return statusNames;
      const db = await call(`/databases/${id}`);
      const s = db.properties && db.properties[doneProp] && db.properties[doneProp].status;
      const opt = (/** @type {string} */ group) => { const g = (s.groups || []).find((/** @type {any} */ x) => x.name.toLowerCase().replace(/\W/g, '') === group); const first = g && (g.option_ids || [])[0]; return (s.options || []).find((/** @type {any} */ x) => x.id === first)?.name || ''; };
      statusNames = { done: opt('complete') || opt('done'), todo: opt('todo') || opt('notstarted') };
      return statusNames;
    }
    async function props(/** @type {Record<string, any>} */ patch) {
      const out = /** @type {Record<string, any>} */ ({});
      if ('text' in patch) out[titleProp] = { title: [{ text: { content: String(patch.text).slice(0, 1900) } }] };
      if ('due' in patch && dueProp) out[dueProp] = { date: patch.due ? { start: patch.due } : null };
      if ('done' in patch && doneProp) {
        const kind = o.doneType === 'status' ? 'status' : 'checkbox';
        if (kind === 'checkbox') out[doneProp] = { checkbox: !!patch.done };
        else { const n = await statuses(); const name = patch.done ? n.done : n.todo; if (name) out[doneProp] = { status: { name } }; }
      }
      return out;
    }

    return {
      tasks: {
        fields: ['text', 'done', ...(dueProp ? ['due'] : [])],
        async list() {
          const items = []; let cursor = null, more = true;
          for (let i = 0; i < MAX_PAGES && more; i++) {
            const res = await call(`/databases/${id}/query`, { method: 'POST', data: { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) } });
            for (const p of res.results || []) if (!p.archived) items.push(norm(p));
            more = !!res.has_more; cursor = res.next_cursor;
          }
          return { items: items.filter((t) => t.text), complete: !more };
        },
        async create(/** @type {any} */ it) {
          const res = await call('/pages', { method: 'POST', data: { parent: { database_id: id }, properties: await props({ text: it.text, due: it.due, done: it.done }) } });
          return { id: res.id };
        },
        async update(/** @type {string} */ pid, /** @type {Record<string, any>} */ patch) { await call(`/pages/${pid}`, { method: 'PATCH', data: { properties: await props(patch) } }); return {}; },
        async remove(/** @type {string} */ pid) { await call(`/pages/${pid}`, { method: 'PATCH', data: { archived: true } }); },
      },
    };
  },
};

const hdr = (/** @type {string} */ token) => ({ authorization: 'Bearer ' + token, 'notion-version': VERSION });
