// Small Google (Calendar + Tasks) and Microsoft Graph (To Do + Calendar) services for the adapters' tests: the same paths, methods and fields the adapters use.
const send = (status, data) => new Response(data === undefined ? null : JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export function mockGoogle({ token = 'g-access' } = {}) {
  const state = { tasks: new Map(), events: new Map(), seq: 0, calls: [], tick: 1 };
  const stamp = () => new Date(1_700_000_000_000 + state.tick++ * 1000).toISOString();
  async function handler(url, init = {}) {
    const u = new URL(url), method = init.method || 'GET', path = u.pathname;
    state.calls.push(method + ' ' + path);
    if (init.headers.authorization !== 'Bearer ' + token) return send(401, { error: { code: 401 } });
    const body = init.body ? JSON.parse(init.body) : {};
    if (path === '/calendar/v3/users/me/calendarList') return send(200, { items: [{ id: 'primary', summary: 'Me' }, { id: 'work@x', summary: 'Work', summaryOverride: 'Work cal' }] });
    if (path === '/tasks/v1/users/@me/lists') return send(200, { items: [{ id: 'L1', title: 'My Tasks' }] });
    let m = /^\/tasks\/v1\/lists\/L1\/tasks(?:\/([^/]+))?$/.exec(path);
    if (m) {
      if (method === 'GET') return send(200, { items: [...state.tasks.values()] });
      if (method === 'POST') { const id = 't' + ++state.seq; state.tasks.set(id, { id, title: body.title, status: body.status || 'needsAction', due: body.due || undefined, updated: stamp() }); return send(200, state.tasks.get(id)); }
      const t = state.tasks.get(m[1]); if (!t) return send(404, {});
      if (method === 'PATCH') { if ('title' in body) t.title = body.title; if ('status' in body) t.status = body.status; if ('due' in body) t.due = body.due || undefined; t.updated = stamp(); return send(200, t); }
      if (method === 'DELETE') { state.tasks.delete(m[1]); return new Response(null, { status: 204 }); }
    }
    m = /^\/calendar\/v3\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/.exec(path);
    if (m) {
      if (method === 'GET') return send(200, { items: [...state.events.values()] });
      if (method === 'POST') { const id = 'e' + ++state.seq; state.events.set(id, { id, status: 'confirmed', etag: '"1"', updated: stamp(), ...body }); return send(200, state.events.get(id)); }
      const e = state.events.get(m[2]); if (!e) return send(404, {});
      if (method === 'PATCH') { Object.assign(e, body, { updated: stamp() }); return send(200, e); }
      if (method === 'DELETE') { state.events.delete(m[2]); return new Response(null, { status: 204 }); }
    }
    return send(400, { error: 'unknown ' + method + ' ' + path });
  }
  return { state, fetch: handler };
}

export function mockGraph({ token = 'm-access' } = {}) {
  const state = { tasks: new Map(), events: new Map(), seq: 0, calls: [], tick: 1, tokenCalls: 0 };
  const stamp = () => new Date(1_700_000_000_000 + state.tick++ * 1000).toISOString();
  async function handler(url, init = {}) {
    const u = new URL(url), method = init.method || 'GET', path = u.pathname.replace('/v1.0', '');
    state.calls.push(method + ' ' + path);
    if (u.host === 'login.microsoftonline.com') {
      state.tokenCalls++;
      const f = new URLSearchParams(init.body);
      if (f.get('grant_type') === 'authorization_code') return f.get('code') === 'good-code' && f.get('code_verifier') ? send(200, { access_token: 'm-access', refresh_token: 'm-refresh', expires_in: 3600 }) : send(400, { error: 'invalid_grant' });
      if (f.get('grant_type') === 'refresh_token') return f.get('refresh_token') === 'm-refresh' ? send(200, { access_token: 'm-access', refresh_token: 'm-refresh2', expires_in: 3600 }) : send(400, { error: 'invalid_grant' });
    }
    if (init.headers.authorization !== 'Bearer ' + token) return send(401, { error: { code: 'InvalidAuthenticationToken' } });
    const body = init.body ? JSON.parse(init.body) : {};
    if (path === '/me/calendars') return send(200, { value: [{ id: 'cal1', name: 'Calendar', canEdit: true }, { id: 'cal2', name: 'Birthdays', canEdit: false }] });
    if (path === '/me/todo/lists') return send(200, { value: [{ id: 'list1', displayName: 'Tasks' }] });
    let m = /^\/me\/todo\/lists\/list1\/tasks(?:\/([^/]+))?$/.exec(path);
    if (m) {
      if (method === 'GET') return send(200, { value: [...state.tasks.values()] });
      if (method === 'POST') { const id = 't' + ++state.seq; state.tasks.set(id, { id, title: body.title, status: body.status || 'notStarted', importance: body.importance || 'normal', dueDateTime: body.dueDateTime || undefined, lastModifiedDateTime: stamp() }); return send(201, state.tasks.get(id)); }
      const t = state.tasks.get(m[1]); if (!t) return send(404, {});
      if (method === 'PATCH') { for (const k of ['title', 'status', 'importance']) if (k in body) t[k] = body[k]; if ('dueDateTime' in body) t.dueDateTime = body.dueDateTime || undefined; t.lastModifiedDateTime = stamp(); return send(200, t); }
      if (method === 'DELETE') { state.tasks.delete(m[1]); return new Response(null, { status: 204 }); }
    }
    if (method === 'GET' && path === '/me/calendars/cal1/calendarView') return send(200, { value: [...state.events.values()] });
    if (method === 'POST' && path === '/me/calendars/cal1/events') { const id = 'e' + ++state.seq; state.events.set(id, { id, isAllDay: false, showAs: 'busy', lastModifiedDateTime: stamp(), ...body }); return send(201, state.events.get(id)); }
    m = /^\/me\/events\/([^/]+)$/.exec(path);
    if (m) {
      const e = state.events.get(m[1]); if (!e) return send(404, {});
      if (method === 'PATCH') { Object.assign(e, body, { lastModifiedDateTime: stamp() }); return send(200, e); }
      if (method === 'DELETE') { state.events.delete(m[1]); return new Response(null, { status: 204 }); }
    }
    return send(400, { error: 'unknown ' + method + ' ' + path });
  }
  return { state, fetch: handler };
}
