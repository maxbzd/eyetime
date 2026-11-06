// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// CalDAV (RFC 4791): Apple iCloud, Fastmail, Nextcloud, Radicale, Synology, Yandex and the many others that speak it. Two things from one connection:
//   • a task list (VTODO: the "Reminders" of iCloud, the tasks of Nextcloud or Fastmail)  ⇄ EyeTime's tasks
//   • a calendar (VEVENT): its events become busy times for the planner; the focus blocks EyeTime plans become events in it (and a block moved there moves the task)
// The person gives the server, a user name and an *app-specific password* (never the account password: iCloud and Fastmail issue them in the account settings).
// Google and Microsoft do not accept passwords any more; they have their own connections.
//
// Apple Reminders note: lists that were "upgraded" in iOS 13 and later are no longer visible to CalDAV; the older lists are.

import { http } from '../http.js';
import { SyncError } from '../run.js';
import { parseXml, find, findAll, textOf, escapeXml } from '../xml.js';
import { parseVtodo, buildVtodo, patchVtodo, buildVevent, parseOurEvent, component, UID_PREFIX } from '../ical.js';
import { parseIcsFull } from '../../ics.js';

export const PRESETS = { icloud: 'https://caldav.icloud.com', fastmail: 'https://caldav.fastmail.com' };
const NS = 'xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"';
const XML = { 'content-type': 'application/xml; charset=utf-8' };
const basic = (/** @type {string} */ user, /** @type {string} */ pass) => 'Basic ' + btoa(unescape(encodeURIComponent(user + ':' + pass)));
const rand = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const dayCompact = (/** @type {string} */ d) => d.replace(/-/g, '');

const origin = (/** @type {string} */ u) => { try { return new URL(u).origin + '/*'; } catch { return ''; } };

export const caldav = {
  id: 'caldav', label: 'iCloud · CalDAV', icon: 'calendar-check', kinds: ['tasks', 'events'],
  fields: [{ key: 'server', label: 'server', secret: false }, { key: 'user', label: 'user', secret: false }, { key: 'password', label: 'password', secret: true }],
  /** The sites the browser is asked to allow: the server, the hosts found while looking for the calendars, and every iCloud partition. */
  origins(/** @type {any} */ conn) {
    const o = conn.options || {}, list = new Set([origin(o.server), ...(o.hosts || [])]);
    if (/icloud\.com/i.test(o.server || '')) list.add('https://*.icloud.com/*');
    return [...list].filter(Boolean);
  },

  /** Signs in, finds the calendars and task lists of the account. */
  async discover(/** @type {any} */ conn, /** @type {any} */ secrets, /** @type {any} */ env = {}) {
    const o = conn.options || {}, auth = basic(o.user || '', secrets.password || ''), req = reqer(auth, env);
    const base = new URL(o.server);
    const principalOf = async (/** @type {string} */ url) => {
      const x = await req(url, 'PROPFIND', '0', `<d:propfind ${NS}><d:prop><d:current-user-principal/></d:prop></d:propfind>`);
      return textOf(find(find(x, 'current-user-principal'), 'href'));
    };
    let principal = '', start = base.href;
    try { principal = await principalOf(base.href); } catch (e) { if (e instanceof SyncError && e.kind === 'auth') throw e; }
    if (!principal) { start = new URL('/.well-known/caldav', base).href; principal = await principalOf(start); }
    if (!principal) throw new SyncError('no CalDAV account found at this address', 'other');
    const principalUrl = new URL(principal, start).href;
    const hx = await req(principalUrl, 'PROPFIND', '0', `<d:propfind ${NS}><d:prop><c:calendar-home-set/></d:prop></d:propfind>`);
    const home = textOf(find(find(hx, 'calendar-home-set'), 'href'));
    if (!home) throw new SyncError('this account has no calendars', 'other');
    const homeUrl = new URL(home, principalUrl).href;
    const lx = await req(homeUrl, 'PROPFIND', '1', `<d:propfind ${NS}><d:prop><d:displayname/><d:resourcetype/><c:supported-calendar-component-set/></d:prop></d:propfind>`);
    const calendars = [];
    for (const r of findAll(lx, 'response')) {
      if (!find(find(r, 'resourcetype'), 'calendar')) continue;
      const comps = findAll(find(r, 'supported-calendar-component-set'), 'comp').map((c) => (c.attrs.name || '').toUpperCase());
      calendars.push({ id: new URL(textOf(find(r, 'href')), homeUrl).href, name: textOf(find(r, 'displayname')) || textOf(find(r, 'href')), events: comps.includes('VEVENT'), tasks: comps.includes('VTODO') });
    }
    const hosts = [...new Set([origin(principalUrl), origin(homeUrl), ...calendars.map((c) => origin(c.id))].filter(Boolean))];
    return { calendars, events: calendars.filter((c) => c.events), tasks: calendars.filter((c) => c.tasks), hosts };
  },

  build(/** @type {any} */ conn, /** @type {any} */ secrets, /** @type {any} */ env = {}) {
    const o = conn.options || {}, auth = basic(o.user || '', secrets.password || ''), req = reqer(auth, env), now = () => (env.now ? env.now() : Date.now());
    const put = (/** @type {string} */ url, /** @type {string} */ body, /** @type {Record<string, string>} */ cond) => http(url, { method: 'PUT', headers: { authorization: auth, 'content-type': 'text/calendar; charset=utf-8', ...cond }, body, fetchImpl: env.fetchImpl });
    const out = /** @type {any} */ ({});

    if (o.tasksUrl) {
      /** @type {Map<string, { raw: string, etag: string, uid: string }>} */ const cache = new Map();
      const keep = (/** @type {string} */ id, /** @type {string} */ raw, /** @type {string} */ etag) => cache.set(id, { raw, etag, uid: parseVtodo(raw)?.uid || '' });
      const fetchOne = async (/** @type {string} */ id) => { const r = await http(id, { headers: { authorization: auth }, fetchImpl: env.fetchImpl }); const raw = await r.text(); keep(id, raw, r.headers.get('etag') || ''); return cache.get(id); };
      out.tasks = {
        fields: ['text', 'done', 'due', 'starred'],
        async list() {
          const x = await req(o.tasksUrl, 'REPORT', '1', `<c:calendar-query ${NS}><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VTODO"/></c:comp-filter></c:filter></c:calendar-query>`);
          const items = [];
          for (const r of findAll(x, 'response')) {
            const data = textOf(find(r, 'calendar-data')); if (!data) continue;
            const id = new URL(textOf(find(r, 'href')), o.tasksUrl).href, t = parseVtodo(data);
            if (!t || t.recurring || !t.text) continue;
            keep(id, data, textOf(find(r, 'getetag')));
            items.push({ id, text: t.text, done: t.done, due: t.due, starred: t.starred && !t.done, updatedAt: t.updatedAt });
          }
          return { items, complete: true };
        },
        async create(/** @type {any} */ it) {
          const uid = rand() + '@eyetime', id = new URL(uid + '.ics', o.tasksUrl).href;
          const r = await put(id, buildVtodo({ uid, text: it.text, done: !!it.done, due: it.due || null, starred: !!it.starred }, now()), { 'if-none-match': '*' });
          return { id, etag: r.headers.get('etag') || '' };
        },
        async update(/** @type {string} */ id, /** @type {Record<string, any>} */ patch) {
          const cur = cache.get(id) || (await fetchOne(id));
          const r = await put(id, patchVtodo(cur.raw, patch, now()), cur.etag ? { 'if-match': cur.etag } : {});
          return { etag: r.headers.get('etag') || '' };
        },
        async remove(/** @type {string} */ id) { const cur = cache.get(id); await http(id, { method: 'DELETE', headers: { authorization: auth, ...(cur && cur.etag ? { 'if-match': cur.etag } : {}) }, fetchImpl: env.fetchImpl, accept: [404] }); },
      };
    }

    if (o.eventsUrl) {
      /** @type {Map<string, { uid: string, etag: string, seq: number }>} */ const mine = new Map();
      out.events = {
        async list(/** @type {{ from: string, to: string }} */ { from, to }) {
          const range = `<c:time-range start="${dayCompact(from)}T000000Z" end="${dayCompact(to)}T235959Z"/>`; // wider than the days asked for: the time zone is applied when reading
          const x = await req(o.eventsUrl, 'REPORT', '1', `<c:calendar-query ${NS}><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT">${range}</c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`);
          const ours = [], busy = [];
          for (const r of findAll(x, 'response')) {
            const data = textOf(find(r, 'calendar-data')); if (!data) continue;
            const id = new URL(textOf(find(r, 'href')), o.eventsUrl).href, e = parseOurEvent(data);
            if (e) { mine.set(id, { uid: e.uid, etag: textOf(find(r, 'getetag')), seq: e.seq }); ours.push({ id, taskId: e.taskId, title: e.title, day: e.day, start: e.start, end: e.end, updatedAt: e.updatedAt }); continue; }
            if (component(data, 'VEVENT').props.some((p) => p.name === 'UID' && p.value.startsWith(UID_PREFIX))) continue; // one of ours that was turned into something else
            const parsed = parseIcsFull(data, { from: new Date(from + 'T00:00:00'), days: 15 });
            for (const ev of parsed.events) busy.push({ id: id + '#' + ev.id, title: ev.title, day: ev.day, start: ev.start, end: ev.end });
            for (const ev of parsed.allDay) busy.push({ id: id + '#' + ev.id, title: ev.title, day: ev.day, allDay: true });
          }
          return { ours, busy };
        },
        async create(/** @type {any} */ b) {
          const uid = `${UID_PREFIX}${b.taskId}-${rand()}@eyetime`, id = new URL(uid + '.ics', o.eventsUrl).href;
          const r = await put(id, buildVevent({ uid, taskId: b.taskId, title: b.title, day: b.day, start: b.start, end: b.end }, now(), 0), { 'if-none-match': '*' });
          mine.set(id, { uid, etag: r.headers.get('etag') || '', seq: 0 });
          return { id, etag: r.headers.get('etag') || '' };
        },
        async update(/** @type {string} */ id, /** @type {any} */ _patch, /** @type {any} */ b) {
          const cur = mine.get(id);
          if (!cur) throw new SyncError('an event of ours that was not listed in this run', 'other');
          const r = await put(id, buildVevent({ uid: cur.uid, taskId: b.taskId, title: b.title, day: b.day, start: b.start, end: b.end }, now(), cur.seq + 1), cur.etag ? { 'if-match': cur.etag } : {});
          return { etag: r.headers.get('etag') || '' };
        },
        async remove(/** @type {string} */ id) { const cur = mine.get(id); await http(id, { method: 'DELETE', headers: { authorization: auth, ...(cur && cur.etag ? { 'if-match': cur.etag } : {}) }, fetchImpl: env.fetchImpl, accept: [404] }); },
      };
    }
    return out;
  },
};

/** A WebDAV request whose answer is read as XML. */
function reqer(/** @type {string} */ auth, /** @type {any} */ env) {
  return async (/** @type {string} */ url, /** @type {string} */ method, /** @type {string} */ depth, /** @type {string} */ body) => {
    const res = await http(url, { method, headers: { authorization: auth, depth, ...XML }, body, fetchImpl: env.fetchImpl });
    const text = await res.text();
    try { return parseXml(text); } catch { throw new SyncError('the server did not answer with XML', 'other'); }
  };
}
export { escapeXml };
