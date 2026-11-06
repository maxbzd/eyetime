// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// A small Todoist (API v1) for the adapter's tests: the same paths, methods and fields the adapter uses, with the same rules (a closed task leaves the active list).
export function mockTodoist({ token = 'secret-token' } = {}) {
  const state = { tasks: new Map(), done: new Map(), seq: 0, calls: [], projects: [{ id: 'p1', name: 'Inbox' }, { id: 'p2', name: 'Work' }], failNext: null, tick: 1 };
  const stamp = () => new Date(1_700_000_000_000 + state.tick++ * 1000).toISOString();
  const add = (o) => { const id = String(++state.seq); const t = { id, content: '', priority: 1, due: null, duration: null, project_id: 'p1', updated_at: stamp(), ...o }; state.tasks.set(id, t); return t; };
  const send = (status, data) => new Response(data === undefined ? null : JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
  async function handler(url, init = {}) {
    const u = new URL(url), method = init.method || 'GET', path = u.pathname.replace('/api/v1', '');
    state.calls.push(method + ' ' + path + (u.search ? '?' + u.searchParams.toString() : ''));
    if (u.host !== 'api.todoist.com') throw new Error('unexpected host ' + u.host);
    if (init.headers.authorization !== 'Bearer ' + token) return send(401, { error: 'bad token' });
    if (init.credentials !== 'omit') throw new Error('credentials must be omitted');
    if (state.failNext) { const f = state.failNext; state.failNext = null; return send(f, { error: 'boom' }); }
    const body = init.body ? JSON.parse(init.body) : {};
    if (method === 'GET' && path === '/tasks') { const p = u.searchParams.get('project_id'); return send(200, { results: [...state.tasks.values()].filter((t) => !p || t.project_id === p), next_cursor: null }); }
    if (method === 'GET' && path === '/tasks/completed/by_completion_date') return send(200, { items: [...state.done.values()], next_cursor: null });
    if (method === 'GET' && path === '/projects') return send(200, { results: state.projects, next_cursor: null });
    if (method === 'POST' && path === '/tasks') {
      const t = add({ content: body.content, priority: body.priority || 1, project_id: body.project_id || 'p1', due: body.due_date ? { date: body.due_date, string: body.due_date, is_recurring: false } : null, duration: body.duration ? { amount: body.duration, unit: body.duration_unit } : null });
      return send(200, t);
    }
    let m = /^\/tasks\/([^/]+)\/(close|reopen)$/.exec(path);
    if (method === 'POST' && m) {
      const [, id, act] = m;
      if (act === 'close') { const t = state.tasks.get(id); if (!t) return send(404, {}); state.tasks.delete(id); state.done.set(id, { ...t, completed_at: stamp() }); }
      else { const t = state.done.get(id); if (!t) return send(404, {}); state.done.delete(id); delete t.completed_at; state.tasks.set(id, { ...t, updated_at: stamp() }); }
      return new Response(null, { status: 204 });
    }
    m = /^\/tasks\/([^/]+)$/.exec(path);
    if (m && method === 'POST') {
      const t = state.tasks.get(m[1]); if (!t) return send(404, {});
      if ('content' in body) t.content = body.content;
      if ('priority' in body) t.priority = body.priority;
      if ('due_date' in body) t.due = { date: body.due_date, string: body.due_date, is_recurring: false };
      if (body.due_string === 'no date') t.due = null;
      if ('duration' in body) t.duration = { amount: body.duration, unit: body.duration_unit };
      t.updated_at = stamp();
      return send(200, t);
    }
    if (m && method === 'DELETE') { const had = state.tasks.delete(m[1]) || state.done.delete(m[1]); return had ? new Response(null, { status: 204 }) : send(404, {}); }
    return send(400, { error: 'unknown ' + method + ' ' + path });
  }
  return { state, add, fetch: handler };
}
