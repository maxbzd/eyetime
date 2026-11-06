// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// A small CalDAV server for the adapter's tests: discovery (principal → home → collections), calendar-query, PUT / DELETE with ETags, Basic sign-in.
export function mockCaldav({ user = 'me@example.com', pass = 'abcd-efgh-ijkl-mnop', host = 'caldav.test' } = {}) {
  const state = { res: new Map(), seq: 0, calls: [], tick: 1 };
  const base = `https://${host}`;
  const cals = [
    { path: '/u1/tasks/', name: 'Reminders', comps: ['VTODO'] },
    { path: '/u1/work/', name: 'Work', comps: ['VEVENT'] },
  ];
  const etag = () => `"e${state.tick++}"`;
  const wrap = (rs) => new Response(`<?xml version="1.0"?><D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">${rs}</D:multistatus>`, { status: 207, headers: { 'content-type': 'application/xml' } });
  const put = (path, ics) => { state.res.set(path, { ics, etag: etag() }); return state.res.get(path); };
  async function handler(url, init = {}) {
    const u = new URL(url), method = init.method || 'GET', h = (k) => init.headers[k] ?? init.headers[k.toLowerCase()];
    state.calls.push(method + ' ' + u.pathname);
    if (u.host !== host) throw new Error('unexpected host ' + u.host);
    if (h('authorization') !== 'Basic ' + btoa(user + ':' + pass)) return new Response('no', { status: 401, headers: { 'www-authenticate': 'Basic' } });
    const body = init.body || '';
    if (method === 'PROPFIND') {
      if (u.pathname === '/' || u.pathname === '/.well-known/caldav') return wrap(`<D:response><D:href>${u.pathname}</D:href><D:propstat><D:prop><D:current-user-principal><D:href>/u1/principal/</D:href></D:current-user-principal></D:prop></D:propstat></D:response>`);
      if (u.pathname === '/u1/principal/') return wrap(`<D:response><D:href>/u1/principal/</D:href><D:propstat><D:prop><C:calendar-home-set><D:href>${base}/u1/</D:href></C:calendar-home-set></D:prop></D:propstat></D:response>`);
      if (u.pathname === '/u1/') return wrap(`<D:response><D:href>/u1/</D:href><D:propstat><D:prop><D:resourcetype><D:collection/></D:resourcetype></D:prop></D:propstat></D:response>` + cals.map((c) => `<D:response><D:href>${c.path}</D:href><D:propstat><D:prop><D:displayname>${c.name}</D:displayname><D:resourcetype><D:collection/><C:calendar/></D:resourcetype><C:supported-calendar-component-set>${c.comps.map((k) => `<C:comp name="${k}"/>`).join('')}</C:supported-calendar-component-set></D:prop></D:propstat></D:response>`).join('') + `<D:response><D:href>/u1/inbox/</D:href><D:propstat><D:prop><D:displayname>Inbox</D:displayname><D:resourcetype><D:collection/></D:resourcetype></D:prop></D:propstat></D:response>`);
      return new Response('', { status: 404 });
    }
    if (method === 'REPORT') {
      const kind = /name="VTODO"/.test(body) ? 'VTODO' : 'VEVENT';
      const rs = [...state.res].filter(([p, r]) => p.startsWith(u.pathname) && new RegExp('BEGIN:' + kind).test(r.ics))
        .map(([p, r]) => `<D:response><D:href>${p}</D:href><D:propstat><D:prop><D:getetag>${r.etag}</D:getetag><C:calendar-data>${r.ics.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</C:calendar-data></D:prop></D:propstat></D:response>`).join('');
      return wrap(rs);
    }
    if (method === 'PUT') {
      const cur = state.res.get(u.pathname);
      if (h('if-none-match') === '*' && cur) return new Response('exists', { status: 412 });
      if (h('if-match') && (!cur || cur.etag !== h('if-match'))) return new Response('changed', { status: 412 });
      const r = put(u.pathname, body);
      return new Response(null, { status: cur ? 204 : 201, headers: { etag: r.etag } });
    }
    if (method === 'GET') { const r = state.res.get(u.pathname); return r ? new Response(r.ics, { headers: { etag: r.etag } }) : new Response('', { status: 404 }); }
    if (method === 'DELETE') {
      const cur = state.res.get(u.pathname); if (!cur) return new Response('', { status: 404 });
      if (h('if-match') && cur.etag !== h('if-match')) return new Response('changed', { status: 412 });
      state.res.delete(u.pathname); return new Response(null, { status: 204 });
    }
    return new Response('?', { status: 405 });
  }
  /** Something another app wrote. */
  const addTodo = (path, ics) => put(path, ics);
  const todo = (uid, summary, extra = []) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VTODO', 'UID:' + uid, 'DTSTAMP:20261101T100000Z', 'LAST-MODIFIED:20261101T100000Z', 'SUMMARY:' + summary, ...extra, 'END:VTODO', 'END:VCALENDAR', ''].join('\r\n');
  const meeting = (uid, summary, start, end) => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'UID:' + uid, 'DTSTAMP:20261101T100000Z', 'SUMMARY:' + summary, 'DTSTART:' + start, 'DTEND:' + end, 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
  return { state, fetch: handler, put, addTodo, todo, meeting, base, user, pass };
}
