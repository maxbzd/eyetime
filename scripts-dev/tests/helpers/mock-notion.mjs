// A small Notion for the adapter's tests: databases, pages and the properties the adapter reads and writes.
export function mockNotion({ token = 'ntn_secret', dbId = 'a'.repeat(32), titleProp = 'Name', doneProp = 'Done', dueProp = 'Due', status = false } = {}) {
  const state = { pages: new Map(), seq: 0, calls: [], tick: 1, failNext: null, pageSize: 100 };
  const stamp = () => new Date(1_700_000_000_000 + state.tick++ * 1000).toISOString();
  const doneProps = status
    ? { [doneProp]: { type: 'status', status: { options: [{ id: 'o1', name: 'Not started' }, { id: 'o2', name: 'In progress' }, { id: 'o3', name: 'Complete' }], groups: [{ id: 'g1', name: 'To-do', option_ids: ['o1'] }, { id: 'g2', name: 'In progress', option_ids: ['o2'] }, { id: 'g3', name: 'Complete', option_ids: ['o3'] }] } } }
    : { [doneProp]: { type: 'checkbox', checkbox: {} } };
  const send = (status, data) => new Response(data === undefined ? null : JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
  const page = (id, title, done, due, extra = {}) => ({ id, archived: false, last_edited_time: stamp(), properties: { [titleProp]: { type: 'title', title: [{ plain_text: title }] }, [doneProp]: status ? { type: 'status', status: { name: done ? 'Complete' : 'Not started' } } : { type: 'checkbox', checkbox: !!done }, [dueProp]: { type: 'date', date: due ? { start: due } : null } }, ...extra });
  const add = (title, done = false, due = null) => { const id = 'p' + ++state.seq; state.pages.set(id, page(id, title, done, due)); return id; };
  async function handler(url, init = {}) {
    const u = new URL(url), method = init.method || 'GET', path = u.pathname.replace('/v1', '');
    state.calls.push(method + ' ' + path);
    if (u.host !== 'api.notion.com') throw new Error('unexpected host ' + u.host);
    if (init.headers.authorization !== 'Bearer ' + token) return send(401, { message: 'API token is invalid.' });
    if (init.headers['notion-version'] !== '2022-06-28') return send(400, { message: 'version' });
    if (state.failNext) { const f = state.failNext; state.failNext = null; return send(f, { message: 'boom' }); }
    const body = init.body ? JSON.parse(init.body) : {};
    if (method === 'GET' && path === `/databases/${dbId}`) return send(200, { id: dbId, properties: { [titleProp]: { type: 'title' }, ...doneProps, [dueProp]: { type: 'date' }, Tags: { type: 'multi_select' } } });
    if (method === 'GET' && path.startsWith('/databases/')) return send(404, { message: 'Could not find database' });
    if (method === 'POST' && path === `/databases/${dbId}/query`) {
      const all = [...state.pages.values()].filter((p) => !p.archived), start = body.start_cursor ? Number(body.start_cursor) : 0;
      const slice = all.slice(start, start + state.pageSize);
      return send(200, { results: slice, has_more: start + state.pageSize < all.length, next_cursor: start + state.pageSize < all.length ? String(start + state.pageSize) : null });
    }
    if (method === 'POST' && path === '/pages') {
      if (body.parent.database_id !== dbId) return send(400, {});
      const p = body.properties, id = 'p' + ++state.seq;
      state.pages.set(id, page(id, p[titleProp].title[0].text.content, p[doneProp] && (p[doneProp].checkbox ?? p[doneProp].status?.name === 'Complete'), p[dueProp] && p[dueProp].date && p[dueProp].date.start));
      return send(200, state.pages.get(id));
    }
    const m = /^\/pages\/([^/]+)$/.exec(path);
    if (m && method === 'PATCH') {
      const pg = state.pages.get(m[1]); if (!pg) return send(404, {});
      if (body.archived) { pg.archived = true; return send(200, pg); }
      const p = body.properties || {};
      if (p[titleProp]) pg.properties[titleProp].title = [{ plain_text: p[titleProp].title[0].text.content }];
      if (p[doneProp]) pg.properties[doneProp] = status ? { type: 'status', status: { name: p[doneProp].status.name } } : { type: 'checkbox', checkbox: p[doneProp].checkbox };
      if (p[dueProp]) pg.properties[dueProp] = { type: 'date', date: p[dueProp].date };
      pg.last_edited_time = stamp();
      return send(200, pg);
    }
    return send(400, { message: 'unknown ' + method + ' ' + path });
  }
  return { state, add, fetch: handler, dbId };
}
