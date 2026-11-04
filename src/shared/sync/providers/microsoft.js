// Microsoft (Outlook, Microsoft 365, Outlook.com): Calendar (busy times in, planned focus blocks out) and To Do (a task list), through Microsoft Graph and the person's own sign-in.
// Needs the OAuth client of EyeTime (oauth-config.js, docs/CONNECTIONS.md); without it this connection says it is not available in this build.
//
// Mapping: To Do — title ⇄ text · status ⇄ done · dueDateTime (a date) ⇄ due · importance high ⇄ starred. Calendar — only events EyeTime made (they carry a private property).

import { json, http } from '../http.js';
import { SyncError } from '../run.js';
import { MICROSOFT_CLIENT_ID } from '../oauth-config.js';
import { microsoftSignIn, microsoftRefresh } from '../oauth.js';

const G = 'https://graph.microsoft.com/v1.0';
export const SCOPES = ['Tasks.ReadWrite', 'Calendars.ReadWrite', 'User.Read'];
const PROP = 'String {66f5a359-4659-4830-9070-00040ec6ac6e} Name EyeTimeTask'; // a private property of our own on each block
const MAX_PAGES = 15;
const hhmm = (/** @type {number} */ n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
const localOf = (/** @type {string} */ utcIso) => { const d = new Date(/z$/i.test(utcIso) ? utcIso : utcIso + 'Z'); return { day: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, min: d.getHours() * 60 + d.getMinutes() }; };
const utcOf = (/** @type {string} */ day, /** @type {number} */ min) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d, Math.floor(min / 60), min % 60).toISOString().replace(/\.\d+Z$/, ''); };

export const microsoft = {
  id: 'microsoft', label: 'Microsoft', icon: 'calendar-range', kinds: ['tasks', 'events'], oauth: true,
  available: () => !!MICROSOFT_CLIENT_ID,
  fields: [],
  origins: () => ['https://graph.microsoft.com/*', 'https://login.microsoftonline.com/*'],

  async signIn(/** @type {any} */ env = {}) { return microsoftSignIn(MICROSOFT_CLIENT_ID, SCOPES, env); },

  async discover(/** @type {any} */ _conn, /** @type {any} */ secrets, /** @type {any} */ env = {}) {
    const h = { authorization: 'Bearer ' + secrets.accessToken };
    const cals = await json(`${G}/me/calendars`, { headers: h, fetchImpl: env.fetchImpl }), lists = await json(`${G}/me/todo/lists`, { headers: h, fetchImpl: env.fetchImpl });
    return { calendars: (cals.value || []).filter((/** @type {any} */ c) => c.canEdit !== false).map((/** @type {any} */ c) => ({ id: c.id, name: c.name })), taskLists: (lists.value || []).map((/** @type {any} */ l) => ({ id: l.id, name: l.displayName })) };
  },

  build(/** @type {any} */ conn, /** @type {any} */ secrets, /** @type {any} */ env = {}) {
    const o = conn.options || {}, now = () => (env.now ? env.now() : Date.now());
    let tok = { accessToken: secrets.accessToken, refreshToken: secrets.refreshToken, expiresAt: secrets.expiresAt || 0 };
    const auth = async () => {
      if (!tok.accessToken || tok.expiresAt - 60_000 < now()) {
        if (!tok.refreshToken) throw new SyncError('sign in again', 'auth');
        const t = await microsoftRefresh(MICROSOFT_CLIENT_ID, tok.refreshToken, SCOPES, env); tok = { ...t, refreshToken: t.refreshToken || tok.refreshToken };
        if (env.saveToken) await env.saveToken(tok);
      }
      return { authorization: 'Bearer ' + tok.accessToken };
    };
    const call = async (/** @type {string} */ url, /** @type {any} */ opts = {}) => json(url, { ...opts, headers: { ...(await auth()), ...(opts.headers || {}) }, fetchImpl: env.fetchImpl });
    const del = async (/** @type {string} */ url) => http(url, { method: 'DELETE', headers: await auth(), fetchImpl: env.fetchImpl, accept: [404] });
    const out = /** @type {any} */ ({});

    if (o.taskList) {
      const base = `${G}/me/todo/lists/${encodeURIComponent(o.taskList)}/tasks`;
      const norm = (/** @type {any} */ t) => ({ id: t.id, text: String(t.title || '').trim(), done: t.status === 'completed', due: t.dueDateTime && t.dueDateTime.dateTime ? String(t.dueDateTime.dateTime).slice(0, 10) : null, starred: t.importance === 'high' && t.status !== 'completed', updatedAt: Date.parse(t.lastModifiedDateTime || '') || 0, recurring: !!t.recurrence });
      const body = (/** @type {Record<string, any>} */ p) => { const b = /** @type {Record<string, any>} */ ({}); if ('text' in p) b.title = p.text; if ('due' in p) b.dueDateTime = p.due ? { dateTime: p.due + 'T00:00:00', timeZone: 'UTC' } : null; if ('starred' in p) b.importance = p.starred ? 'high' : 'normal'; if ('done' in p) b.status = p.done ? 'completed' : 'notStarted'; return b; };
      out.tasks = {
        fields: ['text', 'done', 'due', 'starred'],
        async list() {
          const items = []; let url = `${base}?$top=100`, pages = 0;
          while (url && pages++ < MAX_PAGES) { const r = await call(url); for (const t of r.value || []) items.push(norm(t)); url = r['@odata.nextLink'] || ''; }
          return { items: items.filter((t) => t.text && !t.recurring), complete: !url };
        },
        async create(/** @type {any} */ it) { const r = await call(base, { method: 'POST', data: body({ text: it.text, due: it.due, starred: it.starred, done: it.done }) }); return { id: r.id }; },
        async update(/** @type {string} */ id, /** @type {Record<string, any>} */ patch) { await call(`${base}/${encodeURIComponent(id)}`, { method: 'PATCH', data: body(patch) }); return {}; },
        async remove(/** @type {string} */ id) { await del(`${base}/${encodeURIComponent(id)}`); },
      };
    }

    if (o.calendar) {
      const cal = `${G}/me/calendars/${encodeURIComponent(o.calendar)}`;
      const body = (/** @type {any} */ b) => ({ subject: b.title, start: { dateTime: utcOf(b.day, b.start), timeZone: 'UTC' }, end: { dateTime: utcOf(b.day, b.end), timeZone: 'UTC' }, isReminderOn: false, categories: ['EyeTime'], singleValueExtendedProperties: [{ id: PROP, value: b.taskId }] });
      out.events = {
        async list(/** @type {{ from: string, to: string }} */ { from, to }) {
          const [fy, fm, fd] = from.split('-').map(Number), [ty, tm, td] = to.split('-').map(Number);
          const s = new Date(fy, fm - 1, fd).toISOString(), e = new Date(ty, tm - 1, td + 1).toISOString();
          const ours = [], busy = []; let url = `${cal}/calendarView?startDateTime=${encodeURIComponent(s)}&endDateTime=${encodeURIComponent(e)}&$top=250&$expand=${encodeURIComponent(`singleValueExtendedProperties($filter=id eq '${PROP}')`)}`, pages = 0;
          while (url && pages++ < MAX_PAGES) {
            const r = await call(url, { headers: { prefer: 'outlook.timezone="UTC"' } });
            for (const ev of r.value || []) {
              if (ev.isCancelled) continue;
              const mine = (ev.singleValueExtendedProperties || []).find((/** @type {any} */ p) => p.id === PROP);
              if (mine && !ev.isAllDay) {
                const a = localOf(ev.start.dateTime), b = localOf(ev.end.dateTime);
                if (a.day === b.day) { ours.push({ id: ev.id, taskId: mine.value || '', title: String(ev.subject || '').trim(), day: a.day, start: a.min, end: b.min, updatedAt: Date.parse(ev.lastModifiedDateTime || '') || 0 }); continue; }
              }
              if (ev.showAs === 'free') continue;
              if (ev.isAllDay) busy.push({ id: ev.id, title: ev.subject || '', day: String(ev.start.dateTime).slice(0, 10), allDay: true });
              else { const a = localOf(ev.start.dateTime), b = localOf(ev.end.dateTime); if (a.day === b.day) busy.push({ id: ev.id, title: ev.subject || '', day: a.day, start: hhmm(a.min), end: hhmm(b.min) }); }
            }
            url = r['@odata.nextLink'] || '';
          }
          return { ours, busy };
        },
        async create(/** @type {any} */ b) { const r = await call(`${cal}/events`, { method: 'POST', data: body(b) }); return { id: r.id }; },
        async update(/** @type {string} */ id, /** @type {any} */ _p, /** @type {any} */ b) { await call(`${G}/me/events/${encodeURIComponent(id)}`, { method: 'PATCH', data: { subject: b.title, start: body(b).start, end: body(b).end } }); return {}; },
        async remove(/** @type {string} */ id) { await del(`${G}/me/events/${encodeURIComponent(id)}`); },
      };
    }
    if (!out.tasks && !out.events) throw new SyncError('choose a task list or a calendar first', 'other');
    return out;
  },
};
